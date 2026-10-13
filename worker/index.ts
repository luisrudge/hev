import { DurableObject } from "cloudflare:workers";

import type { Env } from "../alchemy.run.ts";

// The whole "inference cluster". One Durable Object. Decided questions and the served count are
// stored in its SQLite; waiting questions and rate limits live in memory, since a restart
// drops their open requests anyway.

type Option = { key: string; label: string; hint?: string };
type Question = { type: "noul" | "choice" | "score"; instructions: string; options: Option[] };
type Parsed = { model: string; state: string; questions: Record<string, Question> };
type Picks = Record<string, string>;
// Where a request came from, coarse enough to log: tells one script apart from a crowd.
type Net = { asn?: number; country?: string };
// `asker` is a hash of the asker's browser id ("" for API callers), safe to broadcast.
type Job = Parsed & {
  id: string;
  createdAt: number;
  asker: string;
  ip: string;
  resolve: (picks: Picks | null) => void;
};
type Decided = Parsed & {
  id: string;
  createdAt: number;
  asker: string;
  picks: Picks | null;
  latency_ms: number;
};

const TIMEOUT_MS = 120_000;
const MAX_QUEUE = 30; // whole cluster
const MAX_PENDING_PER_IP = 2;
const ASKS_PER_MINUTE = 10;
const ANSWER_GAP_MS = 700; // no bots clicking 50 answers a second
const UNSAFE_THRESHOLD = 0.6;
const MAX_BODY_BYTES = 16_384; // real questions are under 2KB
const MAX_SOCKETS = 5_000;
const BROADCAST_MS = 1_000;
const KEEP_DECIDED_MS = 24 * 60 * 60 * 1000; // the daily cron deletes decided questions older than this

// One JSON line per event, so Workers Logs can query its fields. Never log question text or IPs.
const log = (event: string, fields: Record<string, unknown>, level: "log" | "error" = "log") =>
  console[level](JSON.stringify({ event, ...fields }));

async function hash(id: string) {
  if (!id) {
    return "";
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Parse a JSON body, refusing anything bigger than MAX_BODY_BYTES before reading it all.
async function readJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return "too-big";
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return "too-big";
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });

const error = (status: number, message: string) => ({ status, body: { error: { message } } });

function parse(body: any): Parsed | string {
  if (!body || typeof body !== "object") {
    return "Body must be JSON.";
  }
  const state = typeof body.state === "string" ? body.state.trim() : "";
  if (!state) {
    return "`state` must be a non-empty string.";
  }
  if (state.length > 1000) {
    return "`state` is too long. Humans have a 1,000 character context window.";
  }
  if (!body.questions || typeof body.questions !== "object") {
    return "`questions` must be an object.";
  }
  const entries = Object.entries(body.questions as Record<string, any>);
  if (entries.length === 0 || entries.length > 5) {
    return "Send between 1 and 5 questions. Humans get tired.";
  }

  const questions: Record<string, Question> = {};
  for (const [key, q] of entries) {
    if (key.length > 40) {
      return `Question key "${key.slice(0, 40)}…" is too long.`;
    }
    const instructions = String(q?.instructions ?? "")
      .trim()
      .slice(0, 200);
    if (!instructions) {
      return `Question "${key}" needs \`instructions\`.`;
    }
    let options: Option[];
    if (q.type === "noul" || q.type === "bool") {
      options = [
        { key: "true", label: "Yes" },
        { key: "false", label: "No" },
      ];
    } else if (
      q.type === "choice" &&
      q.criteria &&
      typeof q.criteria === "object" &&
      !Array.isArray(q.criteria)
    ) {
      options = Object.entries(q.criteria).map(([k, v]) => ({
        key: k,
        label: k,
        hint: typeof v === "string" ? v : undefined,
      }));
    } else if (q.type === "score" && Array.isArray(q.criteria)) {
      options = q.criteria.map((v: unknown, i: number) => ({ key: String(i), label: String(v) }));
    } else {
      return `Question "${key}" has an unknown type. Use "noul", "choice" (criteria object) or "score" (criteria array).`;
    }
    if (options.length < 2 || options.length > 8) {
      return `Question "${key}" needs 2 to 8 options.`;
    }
    options = options.map((o) => ({
      key: o.key.slice(0, 60),
      label: o.label.slice(0, 60),
      hint: o.hint?.slice(0, 120),
    }));
    questions[key] = { type: q.type === "bool" ? "noul" : q.type, instructions, options };
  }
  return { model: body.model === "hev-flash" ? "hev-flash" : "hev", state, questions };
}

// Same answer shapes as Clef, so it really is drop-in.
function answers(questions: Record<string, Question>, picks: Picks | null) {
  return Object.fromEntries(
    Object.entries(questions).map(([key, q]) => {
      const pick = picks?.[key];
      const n = q.options.length;
      const probabilities = Object.fromEntries(
        q.options.map((o) => [o.key, pick ? (o.key === pick ? 1 : 0) : +(1 / n).toFixed(4)]),
      );
      const confidence = pick ? 1 : 0;
      if (q.type === "noul") {
        return [key, { type: "noul", noul: pick ? (pick === "true" ? 1 : 0) : 0.5 }];
      }
      if (q.type === "choice") {
        return [key, { type: "choice", choice: pick ?? null, probabilities, confidence }];
      }
      const legend = Object.fromEntries(q.options.map((o) => [o.key, o.label]));
      return [
        key,
        {
          type: "score",
          score: pick ? Number(pick) : (n - 1) / 2,
          legend,
          probabilities,
          confidence,
        },
      ];
    }),
  );
}

export class Hev extends DurableObject<Env> {
  jobs = new Map<string, Job>();
  decided: Decided[] = [];
  sockets = new Set<WebSocket>();
  asks = new Map<string, number[]>(); // by ip
  pendingByIp = new Map<string, number>();
  lastAnswer = new Map<string, number>(); // by ip
  served = 0;
  latencySum = 0; // ms, across every answered question, for the average
  lastBroadcast = 0;
  broadcastQueued = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS decided (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, data TEXT NOT NULL)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL)",
    );
    this.load();
    // A fresh instance means any questions waiting in the old one were dropped (deploys do this).
    log("do_start", { served: this.served, decided: this.decided.length });
  }

  load() {
    const sql = this.ctx.storage.sql;
    this.decided = sql
      .exec<{ data: string }>("SELECT data FROM decided ORDER BY created_at DESC LIMIT 15")
      .toArray()
      .map((r) => JSON.parse(r.data));
    const meta = Object.fromEntries(
      sql
        .exec<{ key: string; value: number }>("SELECT key, value FROM meta")
        .toArray()
        .map((r) => [r.key, r.value]),
    );
    this.served = meta.served ?? 0;
    this.latencySum = meta.latency_sum ?? 0;
  }

  // Run by the daily cron.
  cleanup() {
    const { rowsWritten } = this.ctx.storage.sql.exec(
      "DELETE FROM decided WHERE created_at < ?",
      Date.now() - KEEP_DECIDED_MS,
    );
    log("cleanup", { deleted: rowsWritten });
    this.load();
    this.broadcast();
  }

  async infer(body: unknown, ip: string, human: string, net: Net) {
    const asker = await hash(human); // before any checks, so nothing interleaves between them
    const now = Date.now();
    const source = human ? "browser" : "api";
    let fields: Record<string, unknown> = {};
    const done = <R extends { status: number }>(outcome: string, res: R) => {
      log("ask", {
        outcome,
        status: res.status,
        source,
        asker,
        ...net,
        queue: this.jobs.size,
        ...fields,
      });
      return res;
    };

    const recent = (this.asks.get(ip) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= ASKS_PER_MINUTE) {
      return done("rate_limited", error(429, "Too many questions. The humans need a minute."));
    }
    if ((this.pendingByIp.get(ip) ?? 0) >= MAX_PENDING_PER_IP) {
      return done(
        "too_many_pending",
        error(
          429,
          `You already have ${MAX_PENDING_PER_IP} questions waiting. One human at a time, please.`,
        ),
      );
    }
    if (this.jobs.size >= MAX_QUEUE) {
      return done(
        "queue_full",
        error(503, "All humans are busy. Please consider hev-pro (it doesn't exist)."),
      );
    }
    this.asks.set(ip, [...recent, now]);

    const parsed = parse(body);
    if (typeof parsed === "string") {
      return done("invalid", error(400, parsed));
    }
    fields = { model: parsed.model, questions: Object.keys(parsed.questions).length };

    const { verdict, harmful } = await this.moderate(parsed);
    fields = { ...fields, moderation_ms: Date.now() - now, harmful };
    if (verdict === "unsafe") {
      return done(
        "unsafe",
        error(
          422,
          "Our AI safety layer flagged this. Yes, Hev uses AI for exactly one thing: protecting the humans from you.",
        ),
      );
    }
    if (verdict === "down") {
      return done(
        "moderation_down",
        error(503, "Our AI safety layer is down, so the humans are on break. Try again in a bit."),
      );
    }

    const id = `hev_${crypto.randomUUID().slice(0, 8)}`;
    fields = { ...fields, id };
    this.pendingByIp.set(ip, (this.pendingByIp.get(ip) ?? 0) + 1);
    const picks = await new Promise<Picks | null>((resolve) => {
      this.jobs.set(id, { id, ...parsed, createdAt: now, asker, ip, resolve });
      setTimeout(() => resolve(null), TIMEOUT_MS);
      this.broadcast();
    });
    this.pendingByIp.set(ip, (this.pendingByIp.get(ip) ?? 1) - 1);
    const latency_ms = Date.now() - now;

    this.jobs.delete(id);
    const row: Decided = { id, ...parsed, createdAt: now, asker, picks, latency_ms };
    this.decided = [row, ...this.decided].slice(0, 15);
    this.ctx.storage.sql.exec("INSERT INTO decided VALUES (?, ?, ?)", id, now, JSON.stringify(row));
    if (picks) {
      this.served++;
      this.latencySum += latency_ms;
      const bump =
        "INSERT INTO meta VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = value + excluded.value";
      this.ctx.storage.sql.exec(bump, "served", 1);
      this.ctx.storage.sql.exec(bump, "latency_sum", latency_ms);
    }
    this.broadcast();

    fields = { ...fields, latency_ms };
    return done(picks ? "answered" : "timeout", {
      status: 200,
      body: {
        id,
        model: parsed.model,
        answers: answers(parsed.questions, picks),
        latency_ms,
        usage: {
          input_tokens: Math.ceil(JSON.stringify(parsed).length / 4),
          output_tokens: 0,
          human_seconds: picks ? +(latency_ms / 1000).toFixed(1) : 0,
          gpus: 0,
          sandwiches: picks ? +(latency_ms / 3_600_000).toFixed(6) : 0,
        },
        ...(picks
          ? {}
          : { note: "No human answered in 2 minutes. Here's a uniform prior instead." }),
      },
    });
  }

  async moderate(p: Parsed): Promise<{ verdict: "ok" | "unsafe" | "down"; harmful?: number }> {
    const state = {
      context: p.state,
      questions: Object.values(p.questions).map((q) => ({
        question: q.instructions,
        options: q.options.map((o) => o.hint ?? o.label),
      })),
    };
    try {
      const res: any = await this.env.AI.run(
        "@cf/cloudflare/clef-flash" as any,
        {
          model: "clef-flash",
          state,
          questions: {
            verdict: {
              type: "choice",
              instructions:
                "A stranger submitted this to be shown publicly on a website. Classify it.",
              criteria: {
                fine: "Anything normal, silly, absurd, nonsensical, rude or edgy but harmless",
                harmful:
                  "Hate speech or slurs, sexual content, harassment or doxxing of a real person, threats of violence, encouraging self-harm, gore, or illegal content",
              },
            },
          },
        } as any,
      );
      const harmful = res?.answers?.verdict?.probabilities?.harmful;
      if (typeof harmful !== "number") {
        log("moderation_error", { error: "no harmful probability in response" }, "error");
        return { verdict: "down" };
      }
      return { verdict: harmful >= UNSAFE_THRESHOLD ? "unsafe" : "ok", harmful };
    } catch (e) {
      log("moderation_error", { error: String(e) }, "error");
      return { verdict: "down" };
    }
  }

  async answer(id: string, picks: Picks, ip: string, human: string, net: Net) {
    const me = await hash(human); // before any checks, so nothing interleaves between them
    const now = Date.now();
    const reject = (reason: string, message: string) => {
      log("answer", { ok: false, reason, id: String(id).slice(0, 20), human: me, ...net });
      return { ok: false, message };
    };
    if (now - (this.lastAnswer.get(ip) ?? 0) < ANSWER_GAP_MS) {
      return reject("too_fast", "Slow down. Think about it a little.");
    }
    const job = this.jobs.get(id);
    if (!job) {
      return reject("gone", "Too slow. Another human got there first.");
    }
    // Browser askers are matched by id; API askers by IP, since they have no id.
    if (job.asker ? job.asker === me : job.ip === ip) {
      return reject("own_question", "You can't decide your own question.");
    }
    for (const [key, q] of Object.entries(job.questions)) {
      if (!q.options.some((o) => o.key === picks?.[key])) {
        return reject("incomplete", "Answer every question.");
      }
    }
    this.lastAnswer.set(ip, now);
    this.jobs.delete(id);
    job.resolve(picks);
    log("answer", { ok: true, id, human: me, ...net, wait_ms: now - job.createdAt });
    return { ok: true };
  }

  snapshot() {
    const view = (job: Job) => {
      const { resolve: _resolve, ip: _ip, ...rest } = job;
      return rest;
    };
    return JSON.stringify({
      pending: [...this.jobs.values()].map(view),
      decided: this.decided,
      stats: {
        humans_online: this.sockets.size,
        queue: this.jobs.size,
        served: this.served,
        avg_latency_ms: this.served ? Math.round(this.latencySum / this.served) : null,
      },
    });
  }

  // At most one send to everyone per BROADCAST_MS. Every message is a full snapshot, so the
  // skipped ones lose nothing, and a crowd joining at once costs one send each instead of n².
  broadcast() {
    if (this.broadcastQueued) {
      return;
    }
    const wait = this.lastBroadcast + BROADCAST_MS - Date.now();
    if (wait <= 0) {
      return this.sendAll();
    }
    this.broadcastQueued = true;
    setTimeout(() => {
      this.broadcastQueued = false;
      this.sendAll();
    }, wait);
  }

  sendAll() {
    this.lastBroadcast = Date.now();
    const msg = this.snapshot();
    for (const ws of this.sockets) {
      try {
        ws.send(msg);
      } catch {
        this.sockets.delete(ws);
      }
    }
  }

  async fetch() {
    if (this.sockets.size >= MAX_SOCKETS) {
      log("socket", { action: "rejected", online: this.sockets.size });
      return new Response("Too many humans here. Try again soon.", { status: 503 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    this.sockets.add(server);
    // The newcomer gets the feed now; everyone else sees the new count on the next broadcast.
    const msg = this.snapshot();
    server.send(msg);
    // online × bytes is what one broadcast sends.
    log("socket", {
      action: "open",
      online: this.sockets.size,
      bytes: new TextEncoder().encode(msg).byteLength,
    });
    // The page only listens. Anything that talks on this socket isn't the page.
    server.addEventListener("message", () => server.close(1008, "This socket only listens."));
    const drop = () => {
      if (!this.sockets.delete(server)) {
        return;
      } // close and error can both fire
      log("socket", { action: "close", online: this.sockets.size });
      this.broadcast();
    };
    server.addEventListener("close", drop);
    server.addEventListener("error", drop);
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async scheduled(_controller: ScheduledController, env: Env) {
    await env.HEV.getByName("the-only-one").cleanup();
  },

  async fetch(request: Request<unknown, IncomingRequestCfProperties>, env: Env) {
    const url = new URL(request.url);
    const hev = env.HEV.getByName("the-only-one");
    const ip = request.headers.get("cf-connecting-ip") ?? "local";
    const net: Net = { asn: request.cf?.asn, country: request.cf?.country };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST, GET",
          "access-control-allow-headers": "content-type, authorization",
        },
      });
    }

    if (url.pathname === "/v1/systemone" && request.method === "POST") {
      const body = await readJson(request);
      if (body === "too-big") {
        log("ask", { outcome: "too_big", status: 413, ...net });
        return json({ error: { message: "Request too large." } }, 413);
      }
      try {
        const res = await hev.infer(body, ip, request.headers.get("x-hev-human") ?? "", net);
        return json(res.body, res.status);
      } catch (e) {
        // Usually the Durable Object resetting (a deploy) while the question waited.
        log("ask", { outcome: "dropped", ...net, error: String(e) }, "error");
        throw e;
      }
    }
    if (url.pathname === "/api/feed" && request.headers.get("upgrade") === "websocket") {
      return hev.fetch(request);
    }
    if (url.pathname === "/api/answer" && request.method === "POST") {
      const body = await readJson(request);
      if (body === "too-big") {
        return json({ error: { message: "Request too large." } }, 413);
      }
      const { id, picks } = (body ?? {}) as any;
      return json(await hev.answer(id, picks, ip, request.headers.get("x-hev-human") ?? "", net));
    }
    return json({ error: { message: "Not found." } }, 404);
  },
};

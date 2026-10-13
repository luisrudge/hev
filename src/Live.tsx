import { useEffect, useRef, useState } from "react";

import { fmtMs, humanId, myHash, useFeed, useNow, type Decided, type Job } from "./shared.tsx";

const TIMEOUT_MS = 120_000;

type Kind = "noul" | "choice" | "score";
type Draft = {
  state: string;
  question: string;
  kind: Kind;
  options: string[];
  scale: string;
  levels: string[];
};

const MAX_OPTIONS = 8;
const scales: Record<string, string[]> = {
  "1–5": ["1", "2", "3", "4", "5"],
  "😡 😐 😍": ["😡", "😐", "😍"],
  "Bad → Great": ["Bad", "Okay", "Great"],
};

const clean = (values: string[]) => values.map((v) => v.trim()).filter(Boolean);
const optionsOf = (d: Draft) =>
  clean(d.kind === "choice" ? d.options : (scales[d.scale] ?? d.levels));

function toRequest(d: Draft) {
  const opts = optionsOf(d);
  const q =
    d.kind === "noul"
      ? { type: "noul", instructions: d.question }
      : d.kind === "choice"
        ? {
            type: "choice",
            instructions: d.question,
            criteria: Object.fromEntries(opts.map((o) => [o, null])),
          }
        : { type: "score", instructions: d.question, criteria: opts };
  return { model: "hev", state: d.state, questions: { decision: q } };
}

export function LiveGrid() {
  return (
    <div id="live" className="grid scroll-mt-6 items-start gap-5 text-left lg:grid-cols-[5fr_7fr]">
      <Composer />
      <FeedView />
    </div>
  );
}

type Result = {
  answers?: Record<string, any>;
  error?: { message: string };
  note?: string;
  latency_ms?: number;
};

function Composer() {
  const [draft, setDraft] = useState<Draft>({
    state: "",
    question: "",
    kind: "noul",
    options: ["", ""],
    scale: "1–5",
    levels: ["", ""],
  });
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [raw, setRaw] = useState("");
  const [showCurl, setShowCurl] = useState(false);
  const now = useNow();
  const waiting = startedAt !== null && !result;
  const ready =
    draft.state.trim() &&
    draft.question.trim() &&
    (draft.kind === "noul" || optionsOf(draft).length >= 2);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  async function send() {
    setResult(null);
    setRaw("");
    setStartedAt(Date.now());
    const res = await fetch("/v1/systemone", {
      method: "POST",
      headers: { "x-hev-human": humanId },
      body: JSON.stringify(toRequest(draft)),
    }).catch(() => null);
    const text = res ? await res.text() : "";
    setRaw(text);
    try {
      setResult(JSON.parse(text));
    } catch {
      setResult({ error: { message: "Couldn't reach the humans. Try again." } });
    }
  }

  const input =
    "w-full rounded-xl border border-line bg-paper/60 px-4 py-3 outline-none transition focus:border-brand/60 placeholder:text-muted/70";

  return (
    <div className="border-line overflow-hidden rounded-3xl border bg-white shadow-[0_20px_50px_-24px_rgba(22,19,15,0.18)] lg:sticky lg:top-6">
      <div className="border-line flex items-center justify-between border-b px-5 py-4">
        <span className="text-sm">
          <span className="font-display text-brand mr-2 font-bold">1.</span>Ask
        </span>
        <span className="text-muted font-mono text-xs">POST /v1/systemone</span>
      </div>
      <div className="space-y-4 p-5">
        <label className="block">
          <span className="text-muted mb-1.5 block text-xs">Context</span>
          <textarea
            value={draft.state}
            onChange={(e) => set({ state: e.target.value })}
            placeholder="What the human needs to know. Paste a message, describe a situation, anything."
            maxLength={1000}
            rows={3}
            className={`${input} resize-none`}
          />
        </label>
        <label className="block">
          <span className="text-muted mb-1.5 block text-xs">Question</span>
          <input
            value={draft.question}
            onChange={(e) => set({ question: e.target.value })}
            placeholder="What should the human decide?"
            maxLength={200}
            className={input}
          />
        </label>
        <div>
          <span className="text-muted mb-1.5 block text-xs">Answer type</span>
          <div className="border-line grid grid-cols-3 gap-1 rounded-xl border p-1 text-sm">
            {(
              [
                ["noul", "Yes / No"],
                ["choice", "Pick one"],
                ["score", "Rate it"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => set({ kind: k })}
                className={`rounded-lg py-2 transition ${draft.kind === k ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        {draft.kind === "choice" && (
          <div>
            <span className="text-muted mb-1.5 flex justify-between text-xs">
              Options<span>Enter adds another</span>
            </span>
            <Pills
              values={draft.options}
              onChange={(options) => set({ options })}
              placeholders={["Tea", "Coffee", "Another"]}
            />
          </div>
        )}
        {draft.kind === "score" && (
          <div>
            <span className="text-muted mb-1.5 block text-xs">Scale, lowest first</span>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {[...Object.keys(scales), "Custom"].map((k) => (
                <button
                  key={k}
                  onClick={() => set({ scale: k })}
                  className={`rounded-full border px-3 py-1 text-xs transition ${draft.scale === k ? "border-ink bg-ink text-paper" : "border-line text-muted hover:text-ink"}`}
                >
                  {k}
                </button>
              ))}
            </div>
            {scales[draft.scale] ? (
              <Pills values={scales[draft.scale]} arrows />
            ) : (
              <Pills
                values={draft.levels}
                onChange={(levels) => set({ levels })}
                placeholders={["Lowest", "Highest", "Higher"]}
                arrows
              />
            )}
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setShowCurl((s) => !s)}
            className="text-muted hover:text-ink font-mono text-xs"
          >
            {showCurl ? "Hide curl" : "Show curl"}
          </button>
          <button
            onClick={send}
            disabled={waiting || !ready}
            className="bg-brand text-paper rounded-full px-6 py-3 font-medium whitespace-nowrap shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--color-brand)_55%,transparent)] transition hover:scale-[1.03] disabled:opacity-40 disabled:shadow-none"
          >
            {waiting ? "Waiting for a human…" : "Ask a human"}
          </button>
        </div>
        {showCurl && (
          <pre className="border-line bg-paper text-ink/70 max-h-64 overflow-auto rounded-xl border p-4 font-mono text-xs">
            {`curl ${location.origin}/v1/systemone \\\n  -d '${JSON.stringify(toRequest(draft), null, 2)}'`}
          </pre>
        )}
      </div>

      {(waiting || result) && (
        <div className="border-line bg-paper border-t p-5">
          {waiting && (
            <div className="text-center">
              <div className="font-mono text-5xl tabular-nums">
                {((now - startedAt) / 1000).toFixed(1)}s
              </div>
              <p className="text-muted mt-2 text-sm">{waitingLine(now - startedAt)}</p>
            </div>
          )}
          {result && <ResultView result={result} raw={raw} />}
        </div>
      )}
    </div>
  );
}

type PillsProps = {
  values: string[];
  onChange?: (values: string[]) => void;
  placeholders?: string[];
  arrows?: boolean;
};

// Options as the pills the human will see. Editable when onChange is given:
// Enter adds the next pill, Backspace on an empty pill removes it.
function Pills({ values, onChange, placeholders = [], arrows }: PillsProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [focus, setFocus] = useState<{ at: number } | null>(null);
  useEffect(() => {
    if (focus) {
      refs.current[focus.at]?.focus();
    }
  }, [focus]);

  const add = (at: number) => {
    if (!onChange || values.length >= MAX_OPTIONS) {
      return;
    }
    onChange([...values.slice(0, at), "", ...values.slice(at)]);
    setFocus({ at });
  };
  const remove = (i: number) => {
    if (!onChange || values.length <= 2) {
      return;
    }
    onChange(values.filter((_, j) => j !== i));
    setFocus({ at: Math.max(0, i - 1) });
  };
  const pill = "rounded-full border border-line bg-white px-4 py-2 text-sm";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          {arrows && i > 0 && <span className="text-muted">→</span>}
          {onChange ? (
            <span className={`${pill} group focus-within:border-brand/60 flex items-center gap-1`}>
              <input
                ref={(el) => {
                  refs.current[i] = el;
                }}
                value={v}
                size={Math.max(v.length, (placeholders[i] ?? placeholders.at(-1) ?? "").length, 2)}
                maxLength={60}
                placeholder={placeholders[i] ?? placeholders.at(-1)}
                onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (i + 1 < values.length && values[i + 1] === "") {
                      setFocus({ at: i + 1 });
                    } else {
                      add(i + 1);
                    }
                  } else if (e.key === "Backspace" && v === "" && values.length > 2) {
                    e.preventDefault();
                    remove(i);
                  }
                }}
                className="placeholder:text-muted/70 bg-transparent outline-none"
              />
              {values.length > 2 && (
                <button
                  onClick={() => remove(i)}
                  aria-label="Remove"
                  className="text-muted/60 hover:text-ink"
                >
                  ×
                </button>
              )}
            </span>
          ) : (
            <span className={pill}>{v}</span>
          )}
        </div>
      ))}
      {onChange && values.length < MAX_OPTIONS && (
        <button
          onClick={() => add(values.length)}
          aria-label="Add"
          className={`${pill} text-muted hover:text-ink`}
        >
          +
        </button>
      )}
    </div>
  );
}

function waitingLine(ms: number) {
  const lines = [
    "Your question is in the feed.",
    "A human is (hopefully) thinking.",
    "Still thinking. This is normal.",
    "They might be getting a snack.",
    "Scaling up. By which we mean texting a friend.",
    "Nobody around? Send the link to a friend.",
  ];
  return lines[Math.min(Math.floor(ms / 6000), lines.length - 1)];
}

type ResultViewProps = { result: Result; raw: string };

function ResultView({ result, raw }: ResultViewProps) {
  const [open, setOpen] = useState(false);
  if (result.error) {
    return (
      <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-800">
        {result.error.message}
      </p>
    );
  }
  const d = result.answers?.decision;
  const answer =
    d?.type === "noul"
      ? d.noul === 1
        ? "Yes"
        : "No"
      : d?.type === "choice"
        ? d.choice
        : d?.legend?.[d.score];
  return (
    <div>
      {result.note ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-900">
          {result.note}
        </p>
      ) : (
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-display text-brand text-4xl font-bold tracking-tight">
            {answer ?? "—"}
          </span>
          <span className="text-muted text-right text-sm">
            Decided in <span className="text-ink font-mono">{fmtMs(result.latency_ms)}</span>
          </span>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-muted hover:text-ink mt-4 font-mono text-xs"
      >
        {open ? "Hide JSON" : "Show JSON"}
      </button>
      {open && (
        <pre className="border-line bg-paper text-ink/70 mt-2 max-h-64 overflow-auto rounded-xl border p-4 font-mono text-xs">
          {raw}
        </pre>
      )}
    </div>
  );
}

function FeedView() {
  const feed = useFeed();
  const [toast, setToast] = useState<string | null>(null);
  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="border-line relative overflow-hidden rounded-3xl border bg-white shadow-[0_20px_50px_-24px_rgba(22,19,15,0.18)]">
      <div className="border-line flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-5 py-4">
        <span className="flex items-center gap-2 text-sm whitespace-nowrap">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          <span>
            <span className="font-display text-brand mr-2 font-bold">2.</span>Decide
          </span>
        </span>
        <span className="text-muted font-mono text-xs">
          {feed?.stats.humans_online ?? "—"} online · {feed?.stats.served ?? "—"} served · avg{" "}
          {fmtMs(feed?.stats.avg_latency_ms)}
        </span>
      </div>

      {toast && (
        <div className="rise border-brand/40 absolute top-16 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-white px-4 py-2 text-sm whitespace-nowrap shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--color-brand)_55%,transparent)]">
          {toast}
        </div>
      )}

      <div className="max-h-[640px] space-y-3 overflow-y-auto p-4">
        {!feed && <p className="text-muted p-10 text-center">Connecting to the cluster…</p>}
        {feed && feed.pending.length === 0 && (
          <div className="flex flex-col items-center gap-9 px-8 pt-16 pb-12 text-center">
            <span className="relative flex size-3" aria-hidden>
              <span className="radar border-brand absolute inset-0 rounded-full border" />
              <span className="radar border-brand absolute inset-0 rounded-full border [animation-delay:0.8s]" />
              <span className="radar border-brand absolute inset-0 rounded-full border [animation-delay:1.6s]" />
              <span className="bg-brand relative size-3 rounded-full" />
            </span>
            <p className="text-muted">No questions right now. New ones show up here live.</p>
          </div>
        )}
        {feed?.pending.map((job) => (
          <PendingCard key={job.id} job={job} onDone={flash} />
        ))}
      </div>

      {feed && feed.decided.length > 0 && (
        <div className="border-line border-t p-4">
          <p className="text-muted mb-2 px-1 text-[11px] tracking-widest uppercase">
            Recently decided
          </p>
          <ul className="divide-line divide-y">
            {feed.decided.map((d) => (
              <DecidedRow key={d.id} d={d} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const confetti = ["🧠", "✨", "🥪", "👍", "🧍", "💅"];

function burst(x: number, y: number) {
  for (let i = 0; i < 14; i++) {
    const el = document.createElement("span");
    el.textContent = confetti[i % confetti.length];
    el.className = "burst pointer-events-none fixed z-50 text-2xl";
    el.style.left = `${x - 12}px`;
    el.style.top = `${y - 16}px`;
    el.style.setProperty("--dx", `${(Math.random() - 0.5) * 320}px`);
    el.style.setProperty("--dy", `${-60 - Math.random() * 180}px`);
    el.style.setProperty("--r", `${(Math.random() - 0.5) * 720}deg`);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }
}

type PendingCardProps = { job: Job; onDone: (t: string) => void };

function PendingCard({ job, onDone }: PendingCardProps) {
  const now = useNow(500);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const left = Math.max(0, TIMEOUT_MS - (now - job.createdAt));
  const mine = job.asker !== "" && job.asker === myHash;

  async function pick(key: string, value: string, e: React.MouseEvent) {
    const { clientX, clientY } = e;
    const next = { ...picks, [key]: value };
    setPicks(next);
    if (!Object.keys(job.questions).every((k) => next[k])) {
      return;
    }
    setSent(true);
    const res = await fetch("/api/answer", {
      method: "POST",
      headers: { "x-hev-human": humanId },
      body: JSON.stringify({ id: job.id, picks: next }),
    })
      .then((r) => r.json() as Promise<{ ok: boolean; message?: string }>)
      .catch(() => ({ ok: false, message: "Couldn't send your answer. Try again." }));
    if (res.ok) {
      burst(clientX, clientY);
      onDone("Decided");
    } else {
      setSent(false);
      onDone(res.message ?? "Too slow.");
    }
  }

  return (
    <article
      className={`rise relative overflow-hidden rounded-2xl border p-5 ${mine ? "border-brand/40 bg-brand/[0.05]" : "border-line bg-paper/60"} ${sent ? "opacity-50" : ""}`}
    >
      <div
        className={`absolute top-0 left-0 h-0.5 transition-[width] duration-500 ${left < 20_000 ? "bg-red-500" : "bg-brand"}`}
        style={{ width: `${(left / TIMEOUT_MS) * 100}%` }}
      />
      <div className="text-muted mb-3 flex items-center justify-between gap-3 font-mono text-[11px]">
        <span>
          {job.id}
          {mine && (
            <span className="bg-brand/15 text-brand ml-2 rounded-full px-2 py-0.5">yours</span>
          )}
        </span>
        <span className={left < 20_000 ? "text-red-400" : ""}>{Math.ceil(left / 1000)}s left</span>
      </div>
      <p className="font-display text-xl leading-snug font-semibold tracking-tight break-words">
        “{job.state}”
      </p>
      <div className="mt-4 space-y-4">
        {Object.entries(job.questions).map(([key, q]) => (
          <div key={key}>
            <p className="text-ink/80 mb-2 text-sm">{q.instructions}</p>
            {!mine && (
              <div className="flex flex-wrap gap-2">
                {q.options.map((o) => (
                  <button
                    key={o.key}
                    title={o.hint}
                    disabled={sent}
                    onClick={(e) => pick(key, o.key, e)}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      picks[key] === o.key
                        ? "border-brand bg-brand text-paper shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--color-brand)_55%,transparent)]"
                        : "border-line hover:border-ink/40"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {mine && <p className="text-muted mt-4 text-sm">Waiting for another human…</p>}
    </article>
  );
}

type DecidedRowProps = { d: Decided };

function DecidedRow({ d }: DecidedRowProps) {
  const summary = Object.entries(d.questions)
    .map(([k, q]) => q.options.find((o) => o.key === d.picks?.[k])?.label)
    .filter(Boolean)
    .join(", ");
  return (
    <li className="flex items-center justify-between gap-4 px-1 py-2.5 text-sm">
      <span className="text-ink/60 truncate">{d.state}</span>
      <span className="shrink-0 text-right font-mono text-xs">
        {d.picks ? (
          <>
            <span className="text-brand">{summary}</span>{" "}
            <span className="text-muted">
              · human #{(parseInt(d.id.slice(4, 8), 16) % 9000) + 1000} · {fmtMs(d.latency_ms)}
            </span>
          </>
        ) : (
          <span className="text-amber-700">Timed out</span>
        )}
      </span>
    </li>
  );
}

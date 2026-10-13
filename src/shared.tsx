import { useEffect, useState, useSyncExternalStore } from "react";

export type Option = { key: string; label: string; hint?: string };
export type Question = {
  type: "noul" | "choice" | "score";
  instructions: string;
  options: Option[];
};
export type Job = {
  id: string;
  model: string;
  state: string;
  questions: Record<string, Question>;
  createdAt: number;
  asker: string;
};
export type Decided = Job & { picks: Record<string, string> | null; latency_ms: number };
export type Stats = {
  humans_online: number;
  queue: number;
  served: number;
  avg_latency_ms: number | null;
};
export type Feed = { pending: Job[]; decided: Decided[]; stats: Stats };

let feed: Feed | null = null;
const listeners = new Set<() => void>();

// One id per browser (all tabs), so you can't decide your own question from another tab.
export const humanId = (() => {
  let id = localStorage.getItem("hev-human");
  if (!id) {
    localStorage.setItem("hev-human", (id = crypto.randomUUID()));
  }
  return id;
})();

// The server only shares a hash of the asker's id; this is ours, computed the same way.
export let myHash = "";
crypto.subtle.digest("SHA-256", new TextEncoder().encode(humanId)).then((d) => {
  myHash = [...new Uint8Array(d)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  feed = feed && { ...feed }; // new snapshot so cards re-check which ones are ours
  listeners.forEach((l) => l());
});

// One socket for the whole page. The server sends a full snapshot on every change.
let retries = 0;
function connect() {
  const ws = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/feed`,
  );
  ws.onopen = () => (retries = 0);
  ws.onmessage = (e) => {
    feed = JSON.parse(e.data);
    listeners.forEach((l) => l());
  };
  // Back off (1s, 2s, 4s… capped near 30s) with jitter, so a full room or a deploy doesn't bring
  // every page back at the same moment.
  ws.onclose = () =>
    setTimeout(connect, Math.min(30_000, 1000 * 2 ** retries++) * (0.5 + Math.random()));
}
connect();

export function useFeed() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => feed,
  );
}

export function useNow(everyMs = 250) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

export const fmtMs = (ms: number | null | undefined) =>
  ms == null ? "—" : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

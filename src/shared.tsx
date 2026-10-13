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

// Sound: a soft two-note chime, synthesized, so there's no file to load. Browsers keep audio
// locked until the first click or key press, so questions before that stay silent.
let muted = false;
try {
  muted = localStorage.getItem("hev-muted") === "1";
} catch {}
const muteListeners = new Set<() => void>();
let audio: AudioContext | null = null;
let lastChime = 0;

const unlock = () => {
  audio ??= new AudioContext();
  void audio.resume();
};
window.addEventListener("pointerdown", unlock, { once: true });
window.addEventListener("keydown", unlock, { once: true });

function chime(force = false) {
  // One chime per 2s at most, so a burst of questions doesn't turn into a song.
  if (!audio || audio.state !== "running" || (!force && (muted || Date.now() - lastChime < 2000))) {
    return;
  }
  lastChime = Date.now();
  const t = audio.currentTime;
  for (const [freq, delay] of [
    [880, 0],
    [1320, 0.09],
  ]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t + delay);
    gain.gain.linearRampToValueAtTime(0.04, t + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.4);
    osc.connect(gain).connect(audio.destination);
    osc.start(t + delay);
    osc.stop(t + delay + 0.45);
  }
}

export function useMuted() {
  return useSyncExternalStore(
    (l) => (muteListeners.add(l), () => muteListeners.delete(l)),
    () => muted,
  );
}

export function toggleMuted() {
  muted = !muted;
  try {
    localStorage.setItem("hev-muted", muted ? "1" : "0");
  } catch {}
  muteListeners.forEach((l) => l());
  if (!muted) {
    unlock();
    chime(true); // a preview, so unmuting tells you what you'll hear
  }
}

// One socket for the whole page. The server sends a full snapshot on every change.
let retries = 0;
function connect() {
  const ws = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/feed`,
  );
  ws.onopen = () => (retries = 0);
  ws.onmessage = (e) => {
    const next: Feed = JSON.parse(e.data);
    // Chime for someone else's new question, not for the first snapshot after load.
    if (feed) {
      const seen = new Set(feed.pending.map((j) => j.id));
      if (next.pending.some((j) => !seen.has(j.id) && !(j.asker && j.asker === myHash))) {
        chime();
      }
    }
    feed = next;
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

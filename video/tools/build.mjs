// Builds out/hev-decisions.mp4 from index.html: music, frames, sounds, encode.
//
//   pnpm run build
//
// Needs ffmpeg and uv on PATH, and Microsoft Edge (Playwright drives it).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";

// The video's length, in beats of 0.5s, as index.html defines it.
const beats = Number(readFileSync("index.html", "utf8").match(/const L = (\d+) \* BEAT;/)?.[1]);
if (!beats) {
  throw new Error("Could not read the duration from index.html");
}
const duration = beats * 0.5;

// House Vibes by Mixkit, measured at 120.03 BPM. The cut starts on the downbeat of bar 32
// and is slowed by 0.025% so every beat lands on a 0.5s grid.
const SONG = "music/129.mp3";
const START = 64.054;
const TEMPO = 0.99975;

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });

mkdirSync("out", { recursive: true });
console.error(`1/4 music: ${duration}s from ${SONG}`);
run("ffmpeg", [
  "-v",
  "error",
  "-y",
  "-ss",
  String(START),
  "-t",
  (duration * TEMPO).toFixed(4),
  "-i",
  SONG,
  "-af",
  `atempo=${TEMPO},apad=whole_dur=${duration},atrim=0:${duration},afade=t=in:d=0.006`,
  "-ar",
  "48000",
  "-ac",
  "2",
  "out/music.wav",
]);

console.error("2/4 frames (about 10 minutes)");
rmSync("out/sub", { recursive: true, force: true });
run("node", ["tools/render.mjs", "events"]);
run("node", ["tools/render.mjs", "full"]);

console.error("3/4 sounds");
run("uv", ["run", "-q", "--with", "numpy", "tools/sounds.py"]);

// Four subframes per frame, averaged for motion blur, at 60 fps.
console.error("4/4 encode");
run("ffmpeg", [
  "-v",
  "error",
  "-y",
  "-framerate",
  "240",
  "-i",
  "out/sub/%05d.png",
  "-i",
  "out/mix.wav",
  "-filter_complex",
  "[0:v]tmix=frames=4,select='eq(mod(n\\,4)\\,3)',setpts=N/60/TB,format=yuv420p[v]",
  "-map",
  "[v]",
  "-map",
  "1:a",
  "-r",
  "60",
  "-c:v",
  "libx264",
  "-crf",
  "16",
  "-preset",
  "slow",
  "-tune",
  "animation",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-movflags",
  "+faststart",
  "out/hev-decisions.mp4",
]);
rmSync("out/sub", { recursive: true, force: true });
console.error("done: out/hev-decisions.mp4");

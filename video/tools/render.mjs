import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Renders index.html with Playwright (the Edge already on this machine).
//
//   node tools/render.mjs beats            one frame per beat -> out/beats/*.png + out/beats.png
//   node tools/render.mjs at 3.25 7.1      single frames -> out/at/*.png
//   node tools/render.mjs full             60 fps, 4 subframes each -> out/sub/*.png
//   node tools/render.mjs events           the sound cues -> out/events.json
import { chromium } from "playwright";

const FPS = 60;
const SUB = 4;
const [mode = "beats", ...args] = process.argv.slice(2);

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1440 },
  deviceScaleFactor: 1,
});
await page.goto(pathToFileURL(resolve("index.html")).href);
await page.evaluate(() => window.ready);
const duration = await page.evaluate(() => window.DURATION);

async function shot(t, path) {
  await page.evaluate((t) => window.seek(t), t);
  await page.screenshot({ path, type: "png" });
}

if (mode === "events") {
  mkdirSync("out", { recursive: true });
  writeFileSync(
    "out/events.json",
    JSON.stringify(await page.evaluate(() => window.EVENTS), null, 1),
  );
} else if (mode === "beats") {
  mkdirSync("out/beats", { recursive: true });
  for (let i = 0; i < duration / 0.5; i++) {
    await shot(i * 0.5, `out/beats/${String(i).padStart(2, "0")}.png`);
  }
} else if (mode === "at") {
  mkdirSync("out/at", { recursive: true });
  for (const a of args) {
    await shot(Number(a), `out/at/${a}.png`);
  }
} else if (mode === "full") {
  mkdirSync("out/sub", { recursive: true });
  const frames = Math.round(duration * FPS);
  // Subframes are spread around each frame's time, so the blur is centered on it.
  for (let f = 0; f < frames; f++) {
    for (let k = 0; k < SUB; k++) {
      const t = (f + (k - (SUB - 1) / 2) / SUB) / FPS;
      await shot(t, `out/sub/${String(f * SUB + k).padStart(5, "0")}.png`);
    }
    if (f % 60 === 0) {
      process.stderr.write(`frame ${f}/${frames}\n`);
    }
  }
}
await browser.close();

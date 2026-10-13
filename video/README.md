# Hev launch video

A 36s, 1440x1440, 60 fps video introducing the (Human) Decisions API. The whole video is one HTML page: `index.html` draws any moment with `seek(t)`, and every value is a function of time (closed-form springs, no CSS transitions), so frames can be rendered in any order.

## Build

You need Node, pnpm, ffmpeg and [uv](https://docs.astral.sh/uv/) on `PATH`, and Microsoft Edge (Playwright drives it, so no browser download).

```bash
pnpm install
pnpm run build      # writes out/hev-decisions.mp4, about 10 minutes
```

To review a change without the full render:

```bash
node tools/render.mjs beats       # one frame per beat, out/beats/
node tools/render.mjs at 12 17.5  # frames at given seconds, out/at/
```

Open `index.html?t=12` in a browser to see any moment.

## Files

- `index.html`: the video. The timeline is the `T` object; scenes are layers inside one morphing shape.
- `tools/build.mjs`: music cut, frames (4 subframes per frame, blended for motion blur), sounds, encode.
- `tools/render.mjs`: renders frames and exports the sound cues (`out/events.json`).
- `tools/sounds.py`: synthesizes the UI sounds, places each by its measured peak, mixes to -14 LUFS.
- `tools/beats.py`: the tempo and downbeat analysis used to pick the music section.
- `music/129.mp3`: "House Vibes" from [Mixkit](https://mixkit.co/free-stock-music/house/), under the [Mixkit License](https://mixkit.co/license/#musicFree). Not in the repo: download it from Mixkit and save it as `music/129.mp3` before building.
- `fonts/`: Bricolage Grotesque, JetBrains Mono and Permanent Marker, as on the site (OFL and Apache 2.0).

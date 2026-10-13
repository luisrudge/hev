"""UI sounds placed on the beat grid, mixed under the music.

    uv run --with numpy tools/sounds.py      reads out/events.json and out/music.wav, writes out/mix.wav

Each sound is synthesized here, its peak is measured, and it is placed so the peak lands
on the event time. Tails past the end are cut.
"""

import json
import subprocess
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(7)


def env(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(t / attack, 1.0) * np.exp(-t / decay)


def tone(freq, dur, attack=0.001, decay=0.03):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * t) * env(n, attack, decay)


def noise(dur, attack=0.0005, decay=0.004, hp=True):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    if hp:
        x = np.diff(x, prepend=0)  # crude high-pass: keeps the click crisp
    return x * env(n, attack, decay) * 0.3


def layer(*parts):
    """Sum sounds of different lengths."""
    out = np.zeros(max(len(x) for x in parts))
    for x in parts:
        out[: len(x)] += x
    return out


SOUNDS = {
    "click": lambda: layer(0.6 * noise(0.03), 0.5 * tone(2100, 0.06, decay=0.012)),
    "key": lambda: layer(0.45 * noise(0.02, decay=0.0025), 0.2 * tone(3200, 0.03, decay=0.006)),
    # Two bell notes (E6, then B6 70ms later); the first note's peak lands on the beat.
    "success": lambda: layer(0.35 * tone(1318.5, 0.5, 0.002, 0.12), np.pad(0.22 * tone(1975.5, 0.5, 0.002, 0.16), (int(0.07 * SR), 0))),
    "morph": lambda: 0.12 * noise(0.16, attack=0.05, decay=0.05, hp=True),
    # A marker on paper: a short scratchy burst that thins out.
    "scribble": lambda: noise(0.4, attack=0.01, decay=0.12) * (1 + 0.6 * np.sin(np.arange(int(0.4 * SR)) / SR * 2 * np.pi * 18)),
    "tick": lambda: layer(0.3 * noise(0.02, decay=0.002), 0.35 * tone(2600, 0.04, decay=0.008)),
    # A low thump for the full-screen moment.
    "boom": lambda: layer(tone(62, 0.9, attack=0.004, decay=0.28), 0.5 * tone(124, 0.5, attack=0.004, decay=0.12), 0.25 * noise(0.2, decay=0.03, hp=False)),
}
# hev's latency steps: a rising note per beat (A5, C#6, E6, A6, C#7).
for k, f in enumerate([880, 1108.7, 1318.5, 1760, 2217.5]):
    SOUNDS[f"step{k}"] = lambda f=f: tone(f, 0.25, attack=0.003, decay=0.07)
GAIN_DB = {
    "click": -10, "key": -22, "success": -13, "morph": -24, "scribble": -20, "tick": -17, "boom": -8,
    **{f"step{k}": -20 + 1.5 * k for k in range(5)},
}


def read_wav(path):
    with wave.open(path) as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        return data.reshape(-1, w.getnchannels())


def main():
    # The music is cut to the video's length by tools/build.mjs.
    music = read_wav("out/music.wav")
    n = len(music)
    fx = np.zeros(n, dtype=np.float32)

    events = json.load(open("out/events.json"))
    for e in events:
        s = np.asarray(SOUNDS[e["kind"]](), dtype=np.float32)
        s *= 10 ** (GAIN_DB[e["kind"]] / 20) / max(np.abs(s).max(), 1e-9)
        peak = int(np.argmax(np.abs(s)))
        start = int(round(e["t"] * SR)) - peak
        idx = start + np.arange(len(s))
        keep = (idx >= 0) & (idx < n)
        np.add.at(fx, idx[keep], s[keep])

    # The video ends rather than loops: the music fades out over the end card.
    fade = np.ones(n, dtype=np.float32)
    fade[-int(2.5 * SR) :] = np.linspace(1, 0, int(2.5 * SR)) ** 2
    mix = (music * fade[:, None]) * 10 ** (-3 / 20) + fx[:, None]
    np.clip(mix, -1, 1, out=mix)
    pcm = (mix * 32767).astype(np.int16)
    with wave.open("out/mix_raw.wav", "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    # Loudness for web video: about -14 LUFS, true peak under -1 dBTP. Two passes so the
    # gain is one constant (linear) and the mix does not pump.
    first = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", "out/mix_raw.wav", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
        check=True, capture_output=True, text=True,
    ).stderr
    start = first.rindex("{")
    m = json.loads(first[start : first.index("}", start) + 1])
    measured = f"measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", "out/mix_raw.wav", "-af", f"loudnorm=I=-14:TP=-1.5:LRA=11:{measured}:linear=true", "-ar", str(SR), "out/mix.wav"],
        check=True,
    )
    print(f"{len(events)} cues placed")


if __name__ == "__main__":
    main()

"""Beat grid for a song: tempo, beat phase, downbeats and a loop window.

    uv run --with numpy tools/beats.py music/130.mp3 [--bars 7] [--json out.json]

Decodes with ffmpeg, builds a spectral-flux onset envelope, finds the tempo by
autocorrelation, the beat phase with a comb filter, and the downbeat as the beat
phase where the low band (kick) is strongest every 4 beats.
"""

import argparse
import json
import subprocess
import sys

import numpy as np

SR = 22050
HOP = 256
FFT = 2048


def decode(path: str) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        check=True,
        capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32)


def spectrogram(x: np.ndarray) -> np.ndarray:
    window = np.hanning(FFT).astype(np.float32)
    frames = 1 + (len(x) - FFT) // HOP
    idx = np.arange(FFT)[None, :] + HOP * np.arange(frames)[:, None]
    return np.abs(np.fft.rfft(x[idx] * window, axis=1))


def flux(spec: np.ndarray) -> np.ndarray:
    logspec = np.log1p(100 * spec)
    d = np.diff(logspec, axis=0)
    env = np.maximum(d, 0).sum(axis=1)
    env = np.concatenate([[0], env])
    env -= np.convolve(env, np.ones(16) / 16, mode="same")  # remove slow trend
    return np.maximum(env, 0)


def tempo(env: np.ndarray, lo: float = 90, hi: float = 160) -> float:
    fps = SR / HOP
    env = env - env.mean()
    ac = np.correlate(env, env, mode="full")[len(env) - 1 :]
    lags = np.arange(len(ac))
    bpm = 60 * fps / np.maximum(lags, 1)
    mask = (bpm >= lo) & (bpm <= hi)
    best = lags[mask][np.argmax(ac[mask])]
    # Parabolic refinement around the peak for a sub-frame period.
    a, b, c = ac[best - 1], ac[best], ac[best + 1]
    shift = 0.5 * (a - c) / (a - 2 * b + c) if (a - 2 * b + c) != 0 else 0
    return 60 * fps / (best + shift)


def phase(env: np.ndarray, period: float) -> float:
    """Offset in frames (0..period) whose comb of beats collects the most onset energy."""
    best, score = 0.0, -1.0
    for off in np.linspace(0, period, 64, endpoint=False):
        pos = np.arange(off, len(env) - 1, period).astype(int)
        s = env[pos].sum()
        if s > score:
            best, score = off, s
    return best


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("song")
    ap.add_argument("--bars", type=int, default=7)
    ap.add_argument("--json")
    args = ap.parse_args()

    x = decode(args.song)
    spec = spectrogram(x)
    env = flux(spec)
    freqs = np.fft.rfftfreq(FFT, 1 / SR)
    low = flux(spec[:, freqs < 150])
    fps = SR / HOP

    bpm = tempo(env)
    period = 60 * fps / bpm
    off = phase(env, period)
    beats = np.arange(off, len(env) - 1, period)
    beat_t = beats / fps

    # Downbeat: which of the 4 beat positions carries the most kick energy.
    kick = np.array([low[int(b)] for b in beats])
    bar_phase = int(np.argmax([kick[k::4].mean() for k in range(4)]))
    downbeats = beat_t[bar_phase::4]

    # How steady the grid is: share of onset energy that lands within 30ms of a beat.
    near = np.zeros_like(env, dtype=bool)
    for b in beats:
        lo, hi = int(b - 0.03 * fps), int(b + 0.03 * fps) + 1
        near[max(lo, 0) : hi] = True
    on_grid = env[near].sum() / max(env.sum(), 1e-9)

    # Loop window: the downbeat where `bars` bars have the most even, full energy.
    rms = np.sqrt(np.convolve(x**2, np.ones(SR // 10) / (SR // 10), mode="same"))
    span = args.bars * 4 * 60 / bpm
    best_start, best_score = None, -1.0
    for d in downbeats:
        if d + span > len(x) / SR - 1:
            break
        seg = rms[int(d * SR) : int((d + span) * SR)]
        score = seg.mean() - 2 * seg.std() * 0.5
        if score > best_score:
            best_start, best_score = d, score

    result = {
        "song": args.song,
        "duration": round(len(x) / SR, 2),
        "bpm": round(float(bpm), 2),
        "on_grid": round(float(on_grid), 3),
        "first_downbeat": round(float(downbeats[0]), 3),
        "loop_start": None if best_start is None else round(float(best_start), 3),
        "loop_seconds": round(span, 3),
    }
    print(json.dumps(result))
    if args.json:
        with open(args.json, "w") as f:
            json.dump({**result, "beats": [round(float(t), 4) for t in beat_t]}, f)


if __name__ == "__main__":
    sys.exit(main())

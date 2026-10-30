"""Renders the stand-in "GB Sounds" battle loop (an original chiptune, not a copy of any game's track).

The director's packs have no Gen 1 music, so the GB Sounds item plays this instead:
two pulse channels, a 4-bit wave bass and a noise drum, like the Game Boy's sound chip.
Needs numpy and ffmpeg.

  python3 tools/make-gb-battle.py public/assets/audio/bgm/battle_gb.mp3
"""

import subprocess
import sys
import tempfile
import wave

import numpy as np

RATE = 22050
BPM = 152
STEP = 60 / BPM / 4  # one sixteenth note in seconds

# A minor, written as semitones above A3 (220 Hz); None is a rest. One entry per sixteenth.
LEAD_BARS = [
    [12, None, 12, 15, None, 17, 15, None, 12, None, 10, 12, None, 7, None, None],
    [8, None, 8, 10, None, 12, 10, None, 8, None, 7, 8, None, 3, None, None],
    [12, None, 12, 15, None, 17, 19, None, 20, None, 19, 17, None, 15, None, None],
    [17, 15, 12, 15, 17, 15, 12, 10, 12, None, None, None, 0, 3, 7, 10],
    [12, 12, None, 19, None, 17, None, 15, 17, None, 15, None, 12, None, 10, None],
    [8, 8, None, 15, None, 12, None, 10, 12, None, 10, None, 8, None, 7, None],
    [5, 8, 12, 17, 15, 12, 8, 12, 7, 10, 14, 19, 17, 14, 10, 14],
    [12, None, None, None, 11, None, None, None, 12, None, 14, None, 15, None, 16, None],
]
# Root of each bar's chord (semitones above A1) for the bass and the arpeggio.
ROOTS = [0, -4, 0, 3, 0, -4, -7, -1]
CHORD = [0, 3, 7, 12]


def hz(semis: float, base: float) -> float:
    return base * 2 ** (semis / 12)


def pulse(freq: float, n: int, duty: float) -> np.ndarray:
    t = np.arange(n) * freq / RATE
    return np.where((t % 1) < duty, 1.0, -1.0)


def wave4(freq: float, n: int) -> np.ndarray:
    # A triangle quantised to 16 levels, like the Game Boy's wave channel.
    t = (np.arange(n) * freq / RATE) % 1
    tri = 1 - 4 * np.abs(t - 0.5)
    return np.round((tri + 1) * 7.5) / 7.5 - 1


def envelope(n: int, decay: float) -> np.ndarray:
    return np.exp(-np.arange(n) / RATE * decay)


def render() -> np.ndarray:
    step_n = int(STEP * RATE)
    total = step_n * 16 * len(LEAD_BARS)
    out = np.zeros(total)
    noise_state = 0x7FFF
    noise = np.empty(step_n)
    for i in range(step_n):  # a 15-bit LFSR, the Game Boy's noise source (fixed seed, no randomness)
        bit = (noise_state ^ (noise_state >> 1)) & 1
        noise_state = (noise_state >> 1) | (bit << 14)
        noise[i] = 1.0 if noise_state & 1 else -1.0
    for bar, notes in enumerate(LEAD_BARS):
        root = ROOTS[bar]
        for s in range(16):
            at = (bar * 16 + s) * step_n
            seg = slice(at, at + step_n)
            note = notes[s]
            if note is not None:
                held = 1
                while s + held < 16 and notes[s + held] is None and held < 3:
                    held += 1
                n = min(step_n * held, total - at)
                out[at:at + n] += 0.22 * pulse(hz(note, 220), n, 0.25) * envelope(n, 3)
            arp = CHORD[s % 4] + root
            out[seg] += 0.09 * pulse(hz(arp, 220), step_n, 0.125) * envelope(step_n, 18)
            if s % 2 == 0:
                bass = root + (12 if s % 4 == 2 else 0)
                out[at:at + step_n * 2] += 0.22 * wave4(hz(bass, 55), step_n * 2)
            if s % 4 == 0 or s in (6, 14):
                out[seg] += (0.16 if s % 8 == 4 else 0.08) * noise * envelope(step_n, 40 if s % 8 == 4 else 70)
    return np.clip(out, -1, 1)


def main() -> None:
    target = sys.argv[1]
    pcm = (render() * 0.8 * 32767).astype(np.int16)
    with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
        with wave.open(tmp.name, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(pcm.tobytes())
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp.name, '-b:a', '64k', target], check=True)
    print(f'Wrote {target} ({len(pcm) / RATE:.1f} s loop).')


if __name__ == '__main__':
    main()

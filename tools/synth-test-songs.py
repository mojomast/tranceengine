"""Synthesize test songs with known structure (ground truth written alongside)."""
import json, sys
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
rng = np.random.default_rng(7)

def t(n): return np.arange(n) / SR
def expenv(n, decay): return np.exp(-t(n) / decay)
def sos(kind, f, order=2):
    return butter(order, f, kind, fs=SR, output="sos")
def filt(x, kind, f, order=2): return sosfilt(sos(kind, f, order), x)

def kick(f0=150, f1=45, decay=0.35, punch=0.012):
    n = int(SR * 0.6)
    tt = t(n)
    f = f1 + (f0 - f1) * np.exp(-tt / punch * 0.5)
    ph = 2 * np.pi * np.cumsum(f) / SR
    click = filt(rng.standard_normal(n), "highpass", 2000) * np.exp(-tt / 0.004) * 0.3
    return (np.sin(ph) * expenv(n, decay) + click)

def snare(decay=0.18, tone=190):
    n = int(SR * 0.45)
    noise = filt(rng.standard_normal(n), "bandpass", [1200, 7000]) * expenv(n, decay)
    body = np.sin(2 * np.pi * tone * t(n)) * expenv(n, 0.06) * 0.8
    return noise * 0.9 + body

def clap():
    n = int(SR * 0.5)
    x = np.zeros(n)
    for k, off in enumerate([0, 0.012, 0.024]):
        s = int(off * SR)
        m = n - s
        x[s:] += filt(rng.standard_normal(m), "bandpass", [900, 4000]) * np.exp(-t(m) / (0.012 if k < 2 else 0.2))
    return x

def hat(decay=0.035, open_=False):
    n = int(SR * (0.35 if open_ else 0.08))
    return filt(rng.standard_normal(n), "highpass", 7500, 4) * expenv(n, 0.22 if open_ else decay)

def sub808(note_hz, dur, glide_from=None):
    n = int(SR * dur)
    tt = t(n)
    f = np.full(n, note_hz)
    if glide_from: f = note_hz + (glide_from - note_hz) * np.exp(-tt / 0.06)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.minimum(1, tt / 0.005) * np.exp(-tt / (dur * 0.9))
    return np.tanh(x * 2.2) * 0.8

def saw(f, n, detune=0.0):
    ph = (np.cumsum(np.full(n, f * (1 + detune))) / SR) % 1
    return 2 * ph - 1

def pad(freqs, dur, cutoff=900, attack=0.6):
    n = int(SR * dur)
    x = sum(saw(f, n, d) for f in freqs for d in (-0.004, 0.004)) / (len(freqs) * 2)
    x = filt(x, "lowpass", cutoff)
    envl = np.minimum(1, t(n) / attack) * np.minimum(1, (dur - t(n)) / 0.4)
    return x * envl

def reese(f, dur, cutoff=420):
    n = int(SR * dur)
    x = (saw(f, n, -0.012) + saw(f, n, 0.012) + saw(f / 2, n)) / 3
    x = filt(x, "lowpass", cutoff, 4)
    return np.tanh(x * 2.5) * 0.7 * np.minimum(1, t(n) / 0.01)

def riser(dur, f0=300, f1=9000):
    n = int(SR * dur)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    chunks = 48
    for c in range(chunks):
        a, b = c * n // chunks, (c + 1) * n // chunks
        fc = f0 * (f1 / f0) ** (c / chunks)
        lo, hi = max(40, fc * 0.6), min(SR / 2 - 100, fc * 1.6)
        out[a:b] = filt(noise[a:b], "bandpass", [lo, hi])
    return out * np.linspace(0, 1, n) ** 2

def impact(dur=1.6):
    n = int(SR * dur)
    boom = np.sin(2 * np.pi * (40 + 40 * np.exp(-t(n) / 0.15)) * t(n)) * expenv(n, 0.5)
    crash = filt(rng.standard_normal(n), "highpass", 3000) * expenv(n, 0.6) * 0.5
    return boom + crash

def bell(f, dur=1.4):
    n = int(SR * dur)
    return (np.sin(2 * np.pi * f * t(n)) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t(n))) * expenv(n, 0.5) * np.minimum(1, t(n) / 0.003)

class Track:
    def __init__(self, bpm, bars):
        self.bpm, self.beat = bpm, 60 / bpm
        self.bar = self.beat * 4
        self.n = int(SR * (bars * self.bar + 3))
        self.mix = {k: np.zeros(self.n) for k in ["drums", "bass", "music", "fx"]}
        self.events = {"kick": [], "snare": [], "roll": [], "hat": []}
    def hit(self, kind, x, time, gain=1.0):
        self.events[kind].append(round(time, 4)); self.add("drums", x, time, gain)
    def at(self, bar, beat=0.0): return bar * self.bar + beat * self.beat
    def add(self, bus, x, time, gain=1.0):
        s = int(time * SR)
        if s >= self.n: return
        e = min(self.n, s + len(x))
        self.mix[bus][s:e] += x[: e - s] * gain
    def render(self, duck_times=()):
        bass = self.mix["bass"].copy()
        music = self.mix["music"].copy()
        # Sidechain pump from kicks.
        g = np.ones(self.n)
        for tm in duck_times:
            s = int(tm * SR); m = min(self.n - s, int(SR * self.beat * 0.9))
            if m > 0: g[s:s + m] = np.minimum(g[s:s + m], 0.35 + 0.65 * np.linspace(0, 1, m) ** 0.6)
        x = self.mix["drums"] * 0.9 + bass * g * 0.8 + music * g * 0.55 + self.mix["fx"] * 0.5
        x = np.tanh(x * 1.1)
        x /= np.max(np.abs(x)) + 1e-9
        return x * 0.95

def note(n): return 440 * 2 ** ((n - 69) / 12)

def slow_burn():
    """84 BPM half-time trap: intro 4, verse 8, build 4, drop 8, breakdown 4, build 2, drop 8, outro 4."""
    T = Track(84, 42)
    sections = [("intro", 0, 4), ("verse", 4, 12), ("build", 12, 16), ("drop", 16, 24), ("breakdown", 24, 28), ("build", 28, 30), ("drop", 30, 38), ("outro", 38, 42)]
    chords = [[53, 56, 60], [49, 53, 56], [51, 55, 58], [48, 52, 55]]  # Fm Db Eb C
    roots = [41, 37, 39, 36]
    kicks = []
    for name, b0, b1 in sections:
        for bar in range(b0, b1):
            ch = chords[bar % 4]
            if name != "drop" or bar % 2 == 0:
                T.add("music", pad([note(m) for m in ch], T.bar * (2 if name == "drop" else 1), cutoff=700 if name in ("intro", "breakdown", "outro") else 1100), T.at(bar), 0.7)
            if name in ("verse", "drop"):
                for kb in ([0, 2.75] if name == "verse" else [0, 1.5, 2.75]):
                    T.hit("kick", kick(f0=120, f1=40, decay=0.5), T.at(bar, kb), 1.0); kicks.append(T.at(bar, kb))
                T.hit("snare", clap() if name == "drop" else snare(), T.at(bar, 2), 0.9)
                for h in range(8):
                    T.hit("hat", hat(), T.at(bar, h * 0.5), 0.35)
                if bar % 2 == 1:  # triplet hat roll
                    for r in range(6): T.add("drums", hat(0.02), T.at(bar, 3 + r / 6), 0.28)
                if name == "drop":
                    T.add("bass", sub808(note(roots[bar % 4] - 12), T.beat * 2.6, glide_from=note(roots[bar % 4])), T.at(bar), 1.0)
                    T.add("bass", sub808(note(roots[bar % 4] - 12), T.beat * 1.2), T.at(bar, 2.75), 0.9)
            if name in ("intro", "outro") and bar % 1 == 0:
                for h in range(4): T.add("drums", hat(0.03), T.at(bar, h + 0.5), 0.15)
            if name == "build":
                length = b1 - b0
                k = bar - b0
                div = 2 if k < length / 2 else 4 if k < length - 1 else 8
                for r in range(4 * div):
                    T.hit("roll", snare(0.08), T.at(bar, r / div), 0.35 + 0.5 * (k * 4 * div + r) / (length * 4 * div))
            if name == "breakdown":
                for i, m in enumerate([72, 75, 77, 80]): T.add("music", bell(note(m + (bar % 2) * 2)), T.at(bar, i), 0.35)
        if name == "build":
            T.add("fx", riser((b1 - b0) * T.bar), T.at(b0), 1.0)
        if name == "drop":
            T.add("fx", impact(), T.at(b0), 1.0)
    x = T.render(kicks)
    truth = {"bpm": 84, "bar": T.bar, "sections": [{"name": n, "start": round(T.at(a), 3), "end": round(T.at(b), 3)} for n, a, b in sections],
             "drops": [round(T.at(a), 3) for n, a, b in sections if n == "drop"], "events": T.events}
    return x, truth

def breakneck():
    """172 BPM drum & bass: intro 8, build 8, drop 16, breakdown 8, build 4, drop 16, outro 4."""
    T = Track(172, 64)
    sections = [("intro", 0, 8), ("build", 8, 16), ("drop", 16, 32), ("breakdown", 32, 40), ("build", 40, 44), ("drop", 44, 60), ("outro", 60, 64)]
    chords = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]]
    roots = [33, 29, 31, 28]
    kicks = []
    for name, b0, b1 in sections:
        for bar in range(b0, b1):
            if bar % 2 == 0: T.add("music", pad([note(m) for m in chords[(bar // 2) % 4]], T.bar * 2, cutoff=600 if name != "drop" else 1300, attack=0.3), T.at(bar), 0.6)
            if name in ("intro", "breakdown", "outro"):
                for h in range(8): T.add("drums", hat(0.02), T.at(bar, h * 0.5), 0.12 if name != "breakdown" else 0.0)
            if name == "breakdown" and bar % 2 == 0:
                for i, m in enumerate([76, 79, 81, 84]): T.add("music", bell(note(m), 1.0), T.at(bar, i * 2), 0.3)
            if name == "drop":
                for kb in [0, 2.5]: T.hit("kick", kick(f0=170, f1=50, decay=0.22), T.at(bar, kb), 1.0); kicks.append(T.at(bar, kb))
                for sb in [1, 3]: T.hit("snare", snare(0.16, 210), T.at(bar, sb), 1.0)
                for gb in [1.75, 3.5]: T.add("drums", snare(0.05, 230), T.at(bar, gb), 0.3)
                for h in range(8): T.hit("hat", hat(0.025), T.at(bar, h * 0.5 + 0.25), 0.3)
                T.add("bass", reese(note(roots[(bar // 2) % 4]), T.bar * 0.95, cutoff=380 + 200 * (bar % 2)), T.at(bar), 0.9)
            if name == "build":
                length, k = b1 - b0, bar - b0
                div = 1 if k < length / 2 else 2 if k < length - 2 else 4
                for r in range(4 * div): T.hit("roll", snare(0.06, 220), T.at(bar, r / div), 0.25 + 0.55 * (k * 4 * div + r) / (length * 4 * div))
                if k < length - 1:
                    for kb in [0, 2.5]: T.hit("kick", kick(f0=170, f1=50, decay=0.18), T.at(bar, kb), 0.55)
        if name == "build": T.add("fx", riser((b1 - b0) * T.bar, 400, 11000), T.at(b0), 1.0)
        if name == "drop": T.add("fx", impact(1.2), T.at(b0), 1.0)
    x = T.render(kicks)
    truth = {"bpm": 172, "bar": T.bar, "sections": [{"name": n, "start": round(T.at(a), 3), "end": round(T.at(b), 3)} for n, a, b in sections],
             "drops": [round(T.at(a), 3) for n, a, b in sections if n == "drop"], "events": T.events}
    return x, truth

if __name__ == "__main__":
    import subprocess, os
    ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    import tempfile; TMP = tempfile.mkdtemp()
    for name, fn in [("slow-burn", slow_burn), ("breakneck", breakneck)]:
        x, truth = fn()
        wav = os.path.join(TMP, name + ".wav")
        import wave
        pcm = (np.stack([x, x], 1) * 32767).astype(np.int16)
        with wave.open(wav, "wb") as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "160k", os.path.join(ROOT, "assets", "audio", name + ".mp3")], check=True)
        json.dump(truth, open(os.path.join(ROOT, "assets", "truth", name + ".truth.json"), "w"), indent=1)
        print(name, f"{len(x) / SR:.1f}s", "drops at", truth["drops"])

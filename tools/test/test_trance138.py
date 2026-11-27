"""APPROVED TEST (S2): contract for trance138() in tools/synth-test-songs.py and its committed assets.
Run: python3 -m unittest tools/test/test_trance138.py   (needs numpy + scipy; no ffmpeg needed)"""
import importlib.util, json, os, subprocess, sys, tempfile, unittest

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
GEN = os.path.join(ROOT, "tools", "synth-test-songs.py")
EXPECTED = [("intro", 0, 8), ("breakdown", 8, 16), ("build", 16, 24), ("drop", 24, 40),
            ("breakdown", 40, 48), ("build", 48, 52), ("drop", 52, 68), ("outro", 68, 76)]
BAR = 60 / 138 * 4
BEAT = BAR / 4
TOL = 0.0015


def load():
    spec = importlib.util.spec_from_file_location("synth_test_songs", GEN)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


_cache = {}
def song():
    if "s" not in _cache:
        _cache["s"] = load().trance138()
    return _cache["s"]


def near(t, grid):
    return any(abs(t - g) < TOL for g in grid)


def section_of(t, truth):
    for s in truth["sections"]:
        if s["start"] - TOL <= t < s["end"] - TOL:
            return s
    return None


class TestTrance138(unittest.TestCase):
    def test_tempo_and_bar(self):
        x, truth = song()
        self.assertEqual(truth["bpm"], 138)
        self.assertAlmostEqual(truth["bar"], BAR, places=6)

    def test_sections_match_the_plan(self):
        _, truth = song()
        got = [(s["name"], round(s["start"] / BAR), round(s["end"] / BAR)) for s in truth["sections"]]
        self.assertEqual(got, EXPECTED)
        for a, b in zip(truth["sections"], truth["sections"][1:]):
            self.assertAlmostEqual(a["end"], b["start"], places=3)
        self.assertEqual(truth["sections"][0]["start"], 0)

    def test_drops_are_drop_section_starts(self):
        _, truth = song()
        starts = [s["start"] for s in truth["sections"] if s["name"] == "drop"]
        self.assertEqual(len(truth["drops"]), 2)
        for d, s in zip(truth["drops"], starts):
            self.assertAlmostEqual(d, s, places=3)

    def test_event_keys_and_grid_lists(self):
        _, truth = song()
        for k in ("kick", "snare", "roll", "hat", "bass"):
            self.assertIn(k, truth["events"])
            self.assertEqual(truth["events"][k], sorted(truth["events"][k]))
        self.assertEqual(len(truth["downbeats"]), 76)
        self.assertEqual(len(truth["beats"]), 76 * 4)
        for i, d in enumerate(truth["downbeats"]):
            self.assertAlmostEqual(d, i * BAR, places=3)
        self.assertIn("offset_s", truth)
        self.assertEqual(truth["offset_s"], 0)

    def test_four_on_the_floor_in_drops(self):
        _, truth = song()
        kicks = truth["events"]["kick"]
        for s in truth["sections"]:
            if s["name"] != "drop":
                continue
            grid = [s["start"] + i * BEAT for i in range(round((s["end"] - s["start"]) / BEAT))]
            inside = [k for k in kicks if s["start"] - TOL <= k < s["end"] - TOL]
            self.assertEqual(len(inside), len(grid))
            self.assertTrue(all(near(k, grid) for k in inside))

    def test_no_kicks_in_breakdowns_or_last_build_bar(self):
        _, truth = song()
        for k in truth["events"]["kick"]:
            s = section_of(k, truth)
            self.assertIsNotNone(s)
            self.assertNotEqual(s["name"], "breakdown", f"kick at {k} in a breakdown")
            if s["name"] == "build":
                self.assertLess(k, s["end"] - BAR - TOL, f"kick at {k} in the last bar of a build")

    def test_first_breakdown_has_bass_without_kick(self):
        _, truth = song()
        b = truth["sections"][1]
        bass = [t for t in truth["events"]["bass"] if b["start"] - TOL <= t < b["end"] - TOL]
        self.assertGreaterEqual(len(bass), 8 * 4)

    def test_bass_sits_on_offbeats_and_never_on_a_kick(self):
        _, truth = song()
        kicks = truth["events"]["kick"]
        self.assertGreater(len(truth["events"]["bass"]), 100)
        for t in truth["events"]["bass"]:
            frac = (t / BEAT) % 1
            self.assertLess(abs(frac - 0.5), 0.01, f"bass at {t} is not on an offbeat")
            self.assertTrue(all(abs(t - k) > 0.02 for k in kicks))

    def test_claps_on_two_and_four_in_drops(self):
        _, truth = song()
        for s in truth["sections"]:
            if s["name"] != "drop":
                continue
            grid = [s["start"] + bar * BAR + b * BEAT for bar in range(round((s["end"] - s["start"]) / BAR)) for b in (1, 3)]
            sn = [t for t in truth["events"]["snare"] if s["start"] - TOL <= t < s["end"] - TOL]
            self.assertEqual(len(sn), len(grid))

    def test_builds_have_accelerating_rolls(self):
        _, truth = song()
        rolls = truth["events"]["roll"]
        for s in truth["sections"]:
            if s["name"] != "build":
                continue
            r = [t for t in rolls if s["start"] - TOL <= t < s["end"] - TOL]
            first_bar = [t for t in r if t < s["start"] + BAR - TOL]
            last_bar = [t for t in r if t >= s["end"] - BAR - TOL]
            self.assertGreater(len(last_bar), len(first_bar))

    def test_audio_is_finite_and_the_right_length(self):
        import numpy as np
        x, _ = song()
        self.assertTrue(np.all(np.isfinite(x)))
        self.assertLessEqual(float(np.max(np.abs(x))), 1.0)
        self.assertGreater(float(np.max(np.abs(x))), 0.5)
        self.assertAlmostEqual(len(x) / 44100, 76 * BAR + 3, delta=0.05)

    def test_generation_is_deterministic(self):
        import numpy as np
        a, ta = load().trance138()
        b, tb = song()
        self.assertEqual(ta, tb)
        self.assertTrue(np.array_equal(a, b))

    def test_cli_truth_only_writes_just_that_song(self):
        with tempfile.TemporaryDirectory() as d:
            r = subprocess.run([sys.executable, GEN, "--only", "trance138", "--truth-only", "--out-dir", d],
                               capture_output=True, text=True, timeout=600)
            self.assertEqual(r.returncode, 0, r.stderr)
            files = sorted(os.path.relpath(os.path.join(p, f), d) for p, _, fs in os.walk(d) for f in fs)
            self.assertEqual(files, [os.path.join("truth", "trance138.truth.json")])
            with open(os.path.join(d, "truth", "trance138.truth.json")) as f:
                self.assertEqual(json.load(f), json.loads(json.dumps(song()[1])))

    def test_committed_assets_match_the_generator(self):
        with open(os.path.join(ROOT, "assets", "truth", "trance138.truth.json")) as f:
            self.assertEqual(json.load(f), json.loads(json.dumps(song()[1])))
        mp3 = os.path.join(ROOT, "assets", "audio", "trance138.mp3")
        self.assertTrue(os.path.exists(mp3))
        self.assertTrue(500_000 < os.path.getsize(mp3) < 4_000_000)


if __name__ == "__main__":
    unittest.main()

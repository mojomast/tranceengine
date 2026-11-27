# Testing

Four tools, from fastest to slowest. Build first: `bun run build`.

## Scene checker

```sh
bun tools/check-scene.mjs scenes/murmuration.js      # one scene
ENTRY=3 bun tools/check-scene.mjs scenes/polytope.js # start a feature in phase IV
bun tools/check-all.mjs                              # every scene in the manifest
```

It runs the scene in the real engine worker (`dist/engine.bundle.js`) at desktop (1280×720) and phone (390×844)
sizes, feeding it 14 seconds of synthetic music: a calm intro, a build, a drop at 8 s, then full energy, with kick,
snare and hat hits and every audio field present. Every two seconds it cues a scene that reports phases into its next phase.

It fails a scene that:

- is missing its `// name:` first line;
- throws, ends, or runs a loop without `await frame(...)` (it times out);
- produces a non-finite coordinate, size, hue or `fx` value, an unknown shape kind, or an unknown text effect;
- averages over 5 ms of VM time per frame (set `VM_BUDGET_MS` to change it; CI uses 8 because shared runners
  are slower), or exceeds 1500 shapes or 20000 path coordinates in a frame;
- reports phases but ignores a cue for more than 6 frames, or reports a phase without `fx.title`.

The report also lists `phasesSeen`, `cueLagFrames` and the 95th-percentile VM time, which are worth watching even
when they don't fail.

The report is JSON on stdout; the process exits 0 on pass.

## Mapper evaluation

```sh
bun tools/eval-mapper.mjs
```

Decodes every bundled song with `ffmpeg` and maps it. Every `assets/truth/*.truth.json` song is scored after adding
`offset_s` (default 0) to all its times; the real song has no truth file and is only printed. Run it after any change
to `mapper.js`.

Scoring is mir_eval-style and one-to-one: a detection can explain at most one true event and vice versa. Onsets use a
**50 ms** window (`ONSET_WINDOW = 0.05`), beats and downbeats a **70 ms** window (`BEAT_WINDOW = 0.07`), with 1e-9 of
slack at the boundary. The human-readable report shows precision, recall and F for each drum; all scores are
higher-is-better numbers in 0..1 (0, never NaN, for empty lists):

| metric | definition |
|---|---|
| `tempoOk` | 1 when the relative BPM error is below 4%, else 0 |
| `downbeatHit` | share of true bar starts with a detected downbeat within 70 ms; uses `truth.downbeats` when present, else the bar grid |
| `beatF` | F of detected beats vs `truth.beats` when present, else four beats per bar of that grid (70 ms) |
| `kickF`, `kickP`, `kickR` | F, precision and recall of kick onsets vs `truth.events.kick` (50 ms) |
| `snareF` | F of snare onsets vs `events.snare` + `events.roll` (50 ms) |
| `hatF` | F of hat onsets vs `truth.events.hat` (50 ms) |
| `sectionHit` | share of true section starts after 0 with a detected section start within half a bar |
| `dropHit` | share of true drops with a detected drop within 0.25 s |

Flags (the scoring helpers live in the Node-compatible `tools/eval-lib.mjs`):

```sh
bun tools/eval-mapper.mjs --json
bun tools/eval-mapper.mjs --baseline baseline.json [--tolerance 0.02]
bun tools/eval-mapper.mjs --write-baseline baseline.json
```

- `--json` makes stdout a single object `{ "songs": { "<name>": { bpm, ms, ...metrics } } }` and nothing else.
- `--baseline FILE` compares every baseline metric against the new score; `--tolerance N` sets the allowed drop
  (default 0.02). Each drop is printed and the exit code is 1 if there is one, 2 if the file is missing or unreadable
  (fail closed), otherwise 0. A missing, non-finite or dropped score counts as a regression.
- `--write-baseline FILE` writes `{ "<name>": { "<metric>": value } }` for the songs with truth, to use as a baseline
  later.

To regenerate the test songs (and their truth):

```sh
python3 tools/synth-test-songs.py     # needs numpy, scipy, ffmpeg
bun tools/map-songs.mjs               # refresh assets/maps.json afterwards
```

## End-to-end smoke test

```sh
pip install playwright && python -m playwright install chromium
python3 tools/e2e/smoke.py            # CHROME=/path/to/chrome to use a specific browser
```

Serves `dist/` through a Playwright route (no server process), then checks that every bundled track maps and
plays, the planned edit advances, seeking back restores a scene from a VM snapshot, scrubbing while paused moves
the picture, and the page logs no errors. It uses software WebGL, so it runs on machines without a GPU.

## Screenshots

```sh
python3 tools/e2e/screenshots.py         # the stills in docs/screenshots/
python3 tools/e2e/screenshots.py --gif   # and the build-to-drop animation (needs ffmpeg)
```

Scenes are posed with the debug hooks below and the director frozen, so they hold their phase.

## Debug hooks

`window.__trance` exposes the state the tests use. In the browser console:

```js
__trance.scenes                 // scene names, in order
__trance.cut(i)                 // cut to scene i
__trance.cueNow(phase)          // move the current feature to a phase
__trance.freeze(true)           // stop the director (no cuts, no phase steps)
__trance.setAuto(false)
__trance.mapped, __trance.mapT  // is the song mapped, and the map clock in seconds
__trance.plan                   // the planned shots
__trance.events                 // the planned events
__trance.shot                   // the current shot index
__trance.keyframes              // keyframes per shot
__trance.A                      // the live audio state
__trance.slots                  // the two VM slots
__trance.stutterNow(), __trance.forkNow(), __trance.transNow(type, beats)
```

## Manual checklist before a release

- Each bundled track plays start to finish; transitions land on drops; the end card shows.
- Drag the timeline backward and forward while playing and while paused.
- Drop a song file in: the "Mapped …" toast appears within a few seconds.
- Toggle scenes off in the scene list: the plan rebuilds without them.
- Edit a scene in the editor (<kbd>E</kbd>), run it with <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd>, break it on purpose: the error shows and the page survives.
- With reduced motion on in the OS: no flashes, stutters or rewind effect.
- `dist/trance-engine-offline.html` opened from disk with networking off.

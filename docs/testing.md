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
- averages over 5 ms of VM time per frame, or exceeds 1500 shapes or 20000 path coordinates in a frame;
- reports phases but ignores a cue for more than 6 frames, or reports a phase without `fx.title`.

The report also lists `phasesSeen`, `cueLagFrames` and the 95th-percentile VM time, which are worth watching even
when they don't fail.

The report is JSON on stdout; the process exits 0 on pass.

## Mapper evaluation

```sh
bun tools/eval-mapper.mjs
```

Decodes the three bundled songs with `ffmpeg` and maps them. For the two synthetic songs it compares against
`assets/truth/*.truth.json`: tempo, downbeat hit rate, onset precision and recall per drum, section boundaries and
labels, and drop timing. Run it after any change to `mapper.js`. To regenerate the test songs (and their truth):

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

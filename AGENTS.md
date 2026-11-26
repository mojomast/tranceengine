# Notes for AI agents

You are working on Trance Engine: a single-page music-video generator. Scenes are programs in sealed Psychoscript
VMs; a song mapper and a planned director cut them together on the music. Read this file before changing anything.

## Orient yourself (2 minutes)

1. [README.md](README.md) for what it is.
2. [docs/architecture.md](docs/architecture.md) for where things live.
3. The doc for your task: [scene API](docs/scene-api.md), [song maps and director](docs/song-maps-and-director.md),
   or [testing](docs/testing.md).

## Commands

```sh
bun install                                   # once (npm install --ignore-scripts also works)
bun run build                                 # dist/index.html; run after ANY change in src/ or scenes/
bun tools/check-scene.mjs scenes/<file>.js    # one scene; exit 0 = pass
bun tools/check-all.mjs                       # every scene (~3 min)
bun tools/eval-mapper.mjs                     # mapper accuracy vs ground truth (needs ffmpeg)
bun tools/map-songs.mjs                       # refresh assets/maps.json after mapper or audio changes
python3 tools/e2e/smoke.py                    # end-to-end in headless Chromium (needs playwright)
python3 tools/e2e/screenshots.py [--gif]      # regenerate README images
```

Set `CHROME=/path/to/chrome` for the Python tools if Playwright's Chromium isn't installed.

## Ground rules

- **Never edit `dist/`.** It is generated. Edit `src/`, `scenes/`, `assets/` and rebuild.
- **The app modules share one scope.** `src/app/*.js` are concatenated in the order listed in `tools/build.mjs`
  (`mapper, core, text, audio, director, timeline, ui`). There are no imports; a `const` in `core.js` is visible in
  `ui.js`. Top-level statements run in that order. Don't add `import`/`export`.
- **Scenes are not normal JavaScript.** They run in the Psychoscript VM: no typed arrays, timers, `eval`, DOM,
  `fetch`, `Proxy`, `Symbol()`. Every loop iteration must `await frame(...)`. See the language section of the
  scene API.
- **Every scene must pass the checker** before you say you are done. Paste its `avgVm` and `pass`.
- **A scene's first line is `// name: Scene name`** and it must be listed in `scenes/manifest.json`, or it is not
  built in (the build warns).
- **Don't break the safety rails**: the flash limiter (`requestFlash`, at most 2 flashes/s) and the `REDUCE`
  (reduced-motion) branches.
- **Keep `window.__trance` working.** The e2e tests and screenshot tool depend on it; extend it rather than
  renaming things.
- The default song (`assets/audio/song.mp3`) belongs to the project owner. Don't replace or re-encode it.

## Writing a scene well

The checker tells you whether a scene is valid, not whether it is good. Aim for:

- **Several distinct reactions**: kick → body/scale, snare → disruption, hats → glints, bass → weight or chaos,
  pitch (`keyHue`, `note`) → colour, `calm` → slow and sparse, `drop` → release. Name them in the header comment.
- **Anticipation**: features should use `A.build` (0→1 into a drop) and `A.toDrop` (seconds) to gather tension,
  and spend it on `A.drop`. Always fall back gracefully when they are 0/99 (unmapped songs).
- **Four phases for features**, each visibly different, IV the climax. Copy the phase boilerplate from the
  scene API doc exactly: read `s.entry` once, answer `s.cue` immediately, report `phase`, `phases`, `title`.
- **Budget**: the VM interprets your code. ~300 particles with light 3D maths ≈ 3 ms. Recompute static targets
  only when they change; avoid returning small arrays in hot loops; draw trails as `k: "p"` polylines.
- **Look at it.** Rendering bugs (a mirrored word, a scene off-screen, everything white) pass the checker. Take a
  screenshot: build, then adapt `tools/e2e/screenshots.py` (it can pose any scene in any phase with
  `__trance.cut(i)`, `__trance.cueNow(p)` and `__trance.freeze(true)`), and view the image.

## Gotchas we have hit

- **Additive blending washes out.** Dense scenes need lightness ≤ 65 and alpha < 1, or they go white.
- **Rotated targets mirror text.** If a scene spins its formation, don't apply that rotation to text-shaped
  formations (see `murmuration.js`).
- **Feedback `trail` + camera motion smears.** Lower `trail` when the camera moves fast.
- **Headless timing is slow** (~20–25 fps with software GL). Wait on song time (`__trance.mapT`), not wall-clock,
  when testing timed behaviour.
- **With auto-cycle off the director still steps features through phases** every 16 beats and wraps. Use
  `__trance.freeze(true)` when you need a scene to hold still.
- **The mapper's kick detection is ~50–60% precise.** Don't build features that depend on every kick being real;
  beats and sections are reliable.
- **Seeking is a cut.** Code that assumes time only moves forward must handle `A.seeked`.
- **Snapshots embed the scene's code.** Changing a scene's code invalidates its bookmarks and keyframes; that is
  intended.

## Where to change what

| Task | File(s) |
|---|---|
| A new scene | `scenes/<slug>.js`, `scenes/manifest.json` |
| How a scene's frame reacts (punch, slice, sparkle…) | `PROFILE_OF` in `src/app/director.js`, or `fx.react` in the scene |
| Song structure detection | `src/app/mapper.js` → `tools/eval-mapper.mjs` → `tools/map-songs.mjs` |
| Shot lengths, transitions, phases, events | `buildPlan` in `src/app/timeline.js` |
| Seeking, keyframes | `seekTo`, `keyframeTick`, `enterShot` in `src/app/timeline.js`; `catchup` in `src/engine/engine.js` |
| Live (unmapped) analysis | `analyse` and the onset detectors in `src/app/audio.js` |
| Post-processing | `present` in `src/app/director.js`, the shader in `src/app/core.js` |
| Kinetic text effects | `src/app/text.js` |
| A bundled track | `assets/audio/`, `TRACKS` in `src/app/timeline.js`, the `<select id="tracks">` and start buttons in `src/template.html`, then `bun tools/map-songs.mjs` |
| UI, keys, debug hooks | `src/app/ui.js`, `src/template.html` |

## Definition of done

- `bun run build` succeeds with no warnings about unlisted scenes.
- `bun tools/check-all.mjs` passes (or at least every scene you touched).
- Mapper changes: `bun tools/eval-mapper.mjs` shows no regression on the synthetic songs.
- Player, director or engine changes: `python3 tools/e2e/smoke.py` passes.
- You looked at a screenshot of anything visual you changed.
- Docs updated if you changed an API, a command or a file layout.

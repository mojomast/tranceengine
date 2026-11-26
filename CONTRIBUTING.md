# Contributing to Trance Engine

Thanks for wanting to make it better. The most welcome contributions, roughly in order:

1. **New scenes**: one file each, easy to review, and the thing people see.
2. **Better music understanding**: the song mapper (especially kick detection), new test songs with ground truth.
3. **Better editing**: shot patterns, transitions, phase choices in the plan.
4. **Player and accessibility** improvements.

## Setup

```sh
git clone https://github.com/mojomast/tranceengine && cd tranceengine
bun install                      # or: npm install --ignore-scripts
bun run build                    # → dist/index.html
npx serve dist                   # serve it; opening dist/index.html from disk blocks the songs
```

Tools: [Bun](https://bun.sh) ≥ 1.1 (build, scene checker, mapper tools), `ffmpeg` (mapper tools), Python 3 with
Playwright (end-to-end tests and screenshots).

## Layout

```
src/template.html        page markup and styles
src/engine/              the Web Worker hosting two Psychoscript VMs
src/app/                 the app, concatenated in this order: mapper, core, text, audio, director, timeline, ui
scenes/                  one file per scene + manifest.json (order, tier, author)
assets/audio/            bundled songs        assets/maps.json   their precomputed song maps
assets/truth/            ground truth for the synthetic test songs
tools/                   build, checker, mapper tools, test-song synth, e2e tests and screenshots
docs/                    architecture, scene API, song maps and director, testing
```

`dist/` is generated; never edit it.

## Adding a scene

1. Read [docs/scene-api.md](docs/scene-api.md). It is short and has a template.
2. Create `scenes/<slug>.js`. Its first line is `// name: Scene name`.
3. Add it to `scenes/manifest.json`: `{ "file": "<slug>.js", "tier": "flourish", "by": "Your name" }`.
   Use `"tier": "feature"` only for scenes with four phases that build to a climax (see "Phases" in the API doc).
4. `bun run build && bun tools/check-scene.mjs scenes/<slug>.js` until it prints `"pass": true`.
   For features, also `ENTRY=3 bun tools/check-scene.mjs …` to check it opens correctly at its climax.
5. Watch it: `bun run build`, serve `dist/`, press <kbd>S</kbd> to find it, and play all three tracks.
   Live-edit it with <kbd>E</kbd> while you tune.
6. Optionally add its reaction profile to `PROFILE_OF` in `src/app/director.js` (or set `fx.react` in the scene).

What makes a scene merge-worthy:

- It reacts to the music in several **distinct** ways (kick, snare, hats, bass, pitch, sections), not just
  "size = level". Name them in the header comment.
- It looks good on a phone and a 4K screen (scale by `Math.min(s.w, s.h)`).
- It respects `calm` and makes something of `drop`. Features use `build`/`toDrop` to anticipate.
- It stays comfortably inside the budget (average under ~3.5 ms of VM time).
- No flashing of its own beyond what the page's flash limiter allows: don't strobe full-screen brightness on every
  beat.
- No copyrighted characters, logos or artwork.

## Changing the mapper

1. Change `src/app/mapper.js`.
2. `bun tools/eval-mapper.mjs`: tempo, downbeats, sections and drops on the synthetic songs must not regress.
   Paste the before/after output in the PR.
3. `bun tools/map-songs.mjs` to refresh `assets/maps.json`, then `bun run build` and watch the three tracks.

A new kind of song is the best way to improve the mapper: add a generator to `tools/synth-test-songs.py` that
writes ground truth, and make the mapper pass it without breaking the others.

## Changing the director, rendering or UI

- The plan is in `buildPlan` (`src/app/timeline.js`); the live director is `direct` (`src/app/director.js`);
  post-processing is `present()` plus the shader in `src/app/core.js`.
- Run `python3 tools/e2e/smoke.py` before opening a PR.
- If a change is visible, attach a screenshot or a short clip. `python3 tools/e2e/screenshots.py` regenerates the
  README images.
- Keep the flash limiter and reduced-motion handling intact (see "Safety rails" in
  [docs/architecture.md](docs/architecture.md)).

## Code style

- Plain modern JavaScript, no framework, no runtime dependencies besides Psychoscript.
- Two-space indent, no semicolons, double quotes, `const` by default.
- Comments explain *why* or describe behaviour in musical terms ("lands on the downbeat"), not what the next line
  does.
- Keep functions where their neighbours are; the app modules share one scope, so mind top-level order.

## Pull requests

- One topic per PR. Title in the imperative ("Add Tidal pool scene", "Detect half-time snares").
- Say what you checked: checker output for scenes, `eval-mapper` output for mapper changes, smoke test for the rest.
- Don't commit `dist/` or `node_modules/`.

## Reporting bugs

Include the browser and OS, which track (or the kind of song), the time in the song, and what you saw. A console
log (`__trance.plan`, `__trance.err`) helps.

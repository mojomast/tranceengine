# Architecture

Trance Engine is a single HTML page. `tools/build.mjs` inlines everything into `dist/index.html`:

```
src/template.html          markup, CSS, and three placeholders
  /*ENGINE*/  ← dist/engine.bundle.js     Psychoscript + the VM host, run as a Web Worker from a Blob URL
  /*PRESETS*/ ← scenes/*.js in manifest order, as `const PRESETS = [{ name, by, code, tier, phases }]`
  /*APP*/     ← src/app/{mapper,core,text,audio,director,timeline,ui}.js, concatenated in that order
                 (demo.js is spliced in at /*DEMO*/, assets/maps.json at /*MAPS*/)
```

The app modules share one script scope (one `{ … }` block), so a later module can use an earlier module's
`const`s, and functions can call each other in either direction at runtime. There are no imports. Keep this in mind
when you move code: top-level statements run in module order.

## Modules

| File | Owns |
|---|---|
| `src/engine/engine.js` | The worker. Two Psychoscript runtimes (slots `a` and `b`), each exposing one host function, `frame(shapes, fx)`. Handles the operations below. |
| `src/app/mapper.js` | `mapSong(pcm, rate)`: a pure function from audio samples to a song map. Also runs in its own worker for dropped files (see `timeline.js`). |
| `src/app/core.js` | Helpers, the two render pipes, the WebGL post-processing shader, `drawShapes`, `render`, resize and letterbox. |
| `src/app/text.js` | Kinetic text (`{ k: "w" }` shapes, 12 per-letter effects) and the overlay cards (title, chapter, section, credits). |
| `src/app/audio.js` | Playback (tracks, files, the demo synth), the live analyser, onset detectors, the phase-locked beat clock, and `analyse()`, which fills the shared audio state `A` every frame. |
| `src/app/director.js` | Slots and tokens, the worker message handler, `startScene`, transitions, cues, stutters, forks, the live (unmapped) director, `present()` (post-processing), the main loop and the HUD. |
| `src/app/timeline.js` | Song maps: bundled maps, `prepMap`, `mapClock`/`mapSections` (map-driven `A`), `buildPlan` (the edit), `directPlan` (following it), keyframes, seeking, mapping dropped files in a worker, and the timeline strip. |
| `src/app/ui.js` | Moments (captures), the scene manager, the editor, keyboard, drag-and-drop, the desktop-install button, and `window.__trance` (debug hooks used by the tests). |
| `src/app/demo.js` | "Sealed VM", a small Web Audio synth track. |

## One frame

```
loop(now)                                      director.js
  analyse(now, dt)                             audio.js       fills A (live analyser; map-driven when mapped)
  direct(now)                                  director.js    → directPlan(now) in timeline.js when the song is mapped
  runStutter(now)                              director.js
  tickSlot(active), tickSlot(incoming/fork)    director.js    draw the frame a slot sent, then send it the next view
  present(now, dt)                             director.js    WebGL post: transition mix, punch, slice, build, rewind…
  drawCards(now)                               text.js
  updateHud(now)                               director.js
```

Scenes are paced by the page: the worker answers a scene's `await frame(...)` only when the page sends a `tick`
with the next view (`{ t, dt, frame, w, h, cx, cy, mx, my, down, audio, entry, cue }`). A scene that never calls
`frame()` for 3 s gets the engine restarted.

## The worker protocol

Every message names a `slot` (`"a"` or `"b"`) and carries a `token`. A slot's token changes whenever it starts
something new, so late frames from a replaced program are ignored.

| Op | Psychoscript feature | What it does |
|---|---|---|
| `run` | `runtime.program(code).run()` | Start a scene from source. |
| `resume` | `runtime.resume(fromBytes(bytes))` | Start a scene from a snapshot. With `catchup: { n, view }` the first `n` frames are answered immediately without drawing, so a restored scene reaches the song position. |
| `tick` | — | Resolve the pending `frame()` with the next view. |
| `park` | `program.suspend()` + `toBytes` | Suspend a scene to bytes so it can resume later where it left off (scene memory). |
| `beatsnap` | suspend + resume | Snapshot the running scene into a ring on each beat, without it noticing. |
| `stutter` | resume from the ring | Beat-repeat: rewind the scene one beat (or more), on a musical grid. |
| `hold` | — | Pause beat snapshots during a stutter. |
| `fork` | suspend → resume twice | Clone a running scene into the other slot mid-flight. |
| `bookmark` | suspend + resume | Snapshot a scene as it enters a phase (phase bookmarks), or at shot keyframes (seeking). |
| `capture` | suspend + resume | Save a moment the viewer can jump back to. |
| `stop` | abort | Stop a slot. |

Snapshots cost about 2 ms to take and 3 ms to restore, and are typically 20–150 KB.

Replies: `frame` (`{ shapes, fx, vm }`, where `vm` is the ms the scene spent since its last frame), `error`,
`ended`, `parked`, `bookmarked`, `stuttered`, `forked`, `captured`, `caughtUp`.

## Two slots, three states

There are only two VMs. At any moment the page is in one of:

- **steady**: `active` slot on screen, the other idle;
- **transition**: `trans = { from, to, type, start, dur }`, both drawn and mixed in the shader until it finishes,
  then the old slot is parked into scene memory;
- **fork**: the other slot runs a clone of the active scene, drawn mirrored and fading out.

`startScene(slot, i, { entry, kf })` picks how to start a scene, in this order: a keyframe (`kf`, from seeking or a
replayed shot), the phase bookmark for `entry`, the parked memory of the scene, or a fresh run.

## Rendering

Each slot has a pipe of three canvases (`buf`, `prev`, `layer`). `render()` composites a frame:

1. the previous frame, faded by `fx.trail`, scaled by `fx.zoom`, rotated by `fx.spin`, hue-shifted by `fx.hue`;
2. the new shapes on `layer`, drawn with `fx.blend` (additive `lighter` by default), pumped by the kick;
3. optionally folded into a kaleidoscope (`fx.mirror` slices).

`present()` uploads the active pipe (and the incoming or forked one) to WebGL and runs one fragment shader:
transitions between the two textures (dissolve, iris, blinds, wipe, luma reveal, zoom, cut), the per-scene
reaction profile (kick punch, snare slice, hat sparkle, bass shake, key tint), build tension (push-in, zoom blur,
riser glow), the rewind effect, shockwaves, stutter jitter, bloom, vignette, grain, scanlines, flash and the
letterbox. Without WebGL it falls back to plain canvas compositing.

Reaction profiles live in `ARCHETYPES` / `PROFILE_OF` in `director.js`; a scene can override them per frame with
`fx.react`.

## The audio state `A`

`A` is one object, filled by `analyse()` every frame and sent (rounded) to scenes as `s.audio`. Two sources fill it:

- the **live analyser** (Web Audio `AnalyserNode`s, an 8 ms onset sampler, a phase-locked beat clock) always
  provides levels, bands, brightness, noise and chroma;
- the **song map**, when the current track has one, provides hits, beats, bars, phrases, sections, build tension
  and drops, read at `audioEl.currentTime`. These are exact and follow seeks.

Without a map (the demo synth, or a dropped file while it is being mapped) the live detectors provide everything.
With no music at all, a 118 BPM ghost groove keeps scenes moving.

## State that survives

- **Scene memory** (`memory`, up to 12 scenes): parked VMs, resumed when a scene comes back.
- **Phase bookmarks** (`bookmarks`): a snapshot per scene per phase, so the director can open a scene at its climax
  with everything it had built up.
- **Keyframes** (`kfs`, mapped songs only): snapshots per planned shot, at the shot's start and every second bar,
  capped at about 96 MB. They make seeking exact and make replays of a shot identical.
- **Moments**: viewer captures, with a thumbnail.

Edits to a scene's code invalidate its snapshots (each stores the code it was taken from).

## Safety rails

- Flashes are limited to two per second (`requestFlash`); reduced motion disables flashes, stutters, slices,
  rewind and shake.
- Shapes are validated and clamped on the page side (`num`, `clamp`), capped at 6000 shapes and 60000 points.
- A scene that throws shows its error in the editor and leaves the last frame on screen; a hung scene restarts the
  worker.

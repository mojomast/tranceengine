# Scene API

A scene is a JavaScript program that runs forever inside a sealed Psychoscript VM. It cannot touch the DOM, the
network or a clock. Its only way in and out is one host function:

```js
let s = await frame([])                 // first call: draws nothing, returns the first view
while (true) {
  const A = s.audio
  const out = []                        // shapes for this frame
  // …compute…
  s = await frame(out, fx)              // draw, wait for the next frame, get the next view
}
```

The file's first line names it: `// name: Scene name` (two or three words, sentence case). Follow it with a short
comment saying what the scene does and how it hears the music.

## The view `s`

| Field | Meaning |
|---|---|
| `t`, `dt`, `frame` | seconds since the scene started, seconds since the last frame (≈ 1/60), frame counter |
| `w`, `h`, `cx`, `cy` | drawing area in CSS pixels (letterbox excluded) and its centre; anything from a 390×844 phone to a 4K screen |
| `mx`, `my`, `down` | pointer position and whether it is pressed |
| `entry` | the phase the director wants the scene to open in (feature scenes) |
| `cue` | a phase the director asks the scene to move to now, or `-1` |
| `audio` | the audio state, below |

## Audio: `s.audio` (call it `A`)

All values are smoothed and normalised.

**Levels**: `level`, `bass`, `mid`, `high` 0–1 (fast); `energy` 0–1 (slow: low in quiet parts, high in loud ones);
`bands`, 32 values 0–1 from low to high.

**Drums**: each drum type has a one-frame trigger, an envelope and a counter. Give each a different visual job.

| | trigger | envelope | counter |
|---|---|---|---|
| kick | `kickHit` | `kick` (slow decay) | `kicks` |
| snare / clap | `snareHit` | `snare` (medium) | `snares` |
| hi-hat | `hatHit` | `hat` (fast) | `hats` |

(`snap`, `snapHit`, `snaps` are older aliases of the snare.)

**Rhythm**: `beat` (true on the frame of a beat), `beats` (counter), `phase` 0–1 between beats, `anticip` (ramps
0→1 in the last quarter-beat: a wind-up), `bar` 0–3, `barPhase` 0–1 across the bar, `downbeat` (the "1"), `bars`,
`phrase` 0–7 (bar within the 8-bar phrase), `phraseStart`, `bpm`, `beatConf`.

**Timbre and pitch**: `bright` (dark → bright), `noise` (tonal → noisy), `tonal`; `chroma` (12 pitch classes),
`note` (strongest pitch class), `key`, `keyHue` (the key as a hue in degrees).

**Sections**: `calm` 0–1 (high in breakdowns and quiet intros: slow down, simplify, lengthen trails); `drop` (true
on the frame a drop lands); `dropAmt` (1 at the drop, fading over ~2 s).

**Song map** (mapped songs only; empty or zero otherwise, so always have a fallback):

| Field | Meaning |
|---|---|
| `section` | `"intro"`, `"verse"`, `"build"`, `"drop"`, `"main"`, `"breakdown"`, `"outro"` |
| `build` | 0 → 1 through a build, reaching 1 at the drop (eased: slow, then steep) |
| `toDrop` | seconds until the next drop (99 if none is coming) |
| `sectionPos`, `songPos` | 0–1 through the current section and the whole song |

`build` and `toDrop` are what make anticipation possible: gather, tighten, accelerate, then release on `drop`.
See `scenes/murmuration.js` for a scene built around them.

## Shapes

All coordinates are CSS pixels. Any shape takes colour fields: `h` hue (degrees, any number), `s` saturation %,
`l` lightness %, `a` alpha 0–1, and `lw` line width for outlines.

| Shape | Fields |
|---|---|
| circle | `{ k: "c", x, y, r }`, filled unless `fill: false` |
| path | `{ k: "p", pts: [x0, y0, x1, y1, …] }`, closed unless `close: false`, outlined unless `fill: true` |
| line | `{ k: "l", x1, y1, x2, y2 }` |
| text | `{ k: "t", text, x, y, size }`, centred |
| kinetic text | `{ k: "w", text, x, y, size, fx, t, font, align, seed, speed, hs }` |

Shapes are drawn additively by default, so overlaps brighten toward white. Keep lightness around 45–65 and alpha
below 1 in dense scenes.

**Kinetic text** animates per letter, in time with the music. `fx` is one of `type`, `scramble`, `wave`, `punch`,
`split`, `glitch`, `stack`, `orbit`, `flap`, `neon`, `rise`, `flip`; `t` is the seconds since the text appeared
(drive it from your own timer); `font` is `display`, `mono` or `sans`; `align` is `left`, `right` or centred; `hs`
spreads the hue across the letters.

## Frame effects `fx`

| Field | Range | Effect |
|---|---|---|
| `trail` | 0–0.995 | how much of the previous frame survives (0.75 short trails, 0.94 long smears) |
| `zoom` | 0.8–1.25 | feedback scale per frame (1.01 rushes outward, 0.99 sucks inward) |
| `spin` | ±0.5 rad | feedback rotation per frame (keep within ±0.01) |
| `hue` | ±45° | hue drift of old frames per frame |
| `mirror` | 0 or even 2–32 | kaleidoscope slices |
| `blend` | `lighter`, `screen`, `difference`, `source-over` | how new shapes combine with the frame |
| `react` | `{ punch, slice, sparkle, shake, tint }`, each 0–2 | how strongly the page's post-processing reacts for this scene |

## Phases (feature scenes)

Feature scenes tell a story in phases (four, by convention) and the director moves them between phases. A scene
takes part by reading `s.entry` and `s.cue` and reporting where it is:

```js
const PHASES = ["I. Dusk", "II. Murmuration", "III. Gathering", "IV. Scatter"]
const clampP = (p) => Math.max(0, Math.min(PHASES.length - 1, Math.floor(p) || 0))
let phase = clampP(s.entry), phaseT = 0
while (true) {
  if (typeof s.cue === "number" && s.cue >= 0 && s.cue !== phase) { phase = clampP(s.cue); phaseT = 0 }
  phaseT += s.dt
  // …draw the current phase…
  s = await frame(out, { ...fx, phase, phases: PHASES.length, title: PHASES[phase], titleFx: "rise", titleHue: 200 })
}
```

- `phase` / `phases` tell the director where the scene is. When `phase` changes the page bookmarks the VM (so
  the director can later open the scene directly in that phase) and may show `title` as a chapter card, animated
  with `titleFx` in hue `titleHue`.
- Answer a cue on the next frame. The checker measures the lag.
- Make phases build: phase I calm and sparse, phase IV the climax. The director plays phase IV on drops, II–III
  through the body of the song, I in intros and outros, and I–II in breakdowns.
- Never wrap from the last phase back to the first on your own.

Flourishes ignore all of this: they are one look, used for a bar or a few.

## The language

Psychoscript runs a subset of JavaScript in strict mode.

**Allowed**: `let`/`const`, arrow functions, destructuring, spread, classes (no `#private` fields or static blocks),
generators, `async`/`await`, template strings, `Math` (including `Math.random`), `Array`, `Object`, `Map`, `Set`,
`JSON`, `String`, `Number`.

**Not available**: `setTimeout`/`setInterval`, `requestAnimationFrame`, `eval`, `new Function`, `Proxy`,
`Reflect`, `Symbol()`, typed arrays (use plain arrays), `import`/`export`, `with`, the DOM, `fetch`.

The script must never return: every iteration of its loop awaits `frame()`.

## Budgets

The checker (`bun tools/check-scene.mjs scenes/<file>.js`) fails a scene over these:

| | limit | aim for |
|---|---|---|
| VM time per frame (average) | 5 ms | under 3.5 ms |
| shapes per frame | 1500 | under 800 |
| path coordinates per frame | 20000 | under 12000 |

The VM interprets your code, so it is much slower than native JavaScript: roughly 300 animated particles with a
little 3D maths cost 3 ms. Techniques that help:

- Recompute expensive targets only when they change, not every frame.
- Avoid allocating arrays in hot loops (inline small vector maths instead of returning `[x, y, z]`).
- Project once per particle; derive tails and glows from screen-space differences.
- Use `k: "p"` polylines for trails instead of many separate lines.
- Scale everything by `const U = Math.min(s.w, s.h) / 800` so phones and 4K screens look the same.
- Guard divisions: a single `NaN` coordinate fails the check.

## A template

```js
// name: Pulse garden
// Petals open on kicks, snares scatter seeds, hats glint; a build draws everything inward and the drop releases it.
let s = await frame([])
const TAU = Math.PI * 2
let open = 0, pull = 0
const seeds = []
while (true) {
  const A = s.audio, U = Math.min(s.w, s.h) / 800, out = []
  open = Math.max(open * Math.exp(-s.dt * 6), A.kickHit ? 1 : 0)         // kick: the body of the motion
  pull += ((A.build || 0) - pull) * Math.min(1, s.dt * 3)                  // build: anticipation
  if (A.drop) pull = -1                                                     // drop: release
  if (A.snareHit) for (let i = 0; i < 12; i++) seeds.push({ a: Math.random() * TAU, r: 40 * U, v: (200 + Math.random() * 300) * U, life: 1 })
  const R = (180 + open * 40 - pull * 90) * U
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU + s.t * 0.2
    out.push({ k: "c", x: s.cx + Math.cos(a) * R, y: s.cy + Math.sin(a) * R, r: (6 + A.bands[i] * 14) * U,
      h: (A.keyHue || 200) + i * 4, l: 50 + (A.hatHit && i % 3 === 0 ? 30 : 0), a: 0.8 })
  }
  for (let j = seeds.length - 1; j >= 0; j--) {
    const p = seeds[j]; p.r += p.v * s.dt; p.life -= s.dt * 1.5
    if (p.life <= 0) { seeds.splice(j, 1); continue }
    out.push({ k: "c", x: s.cx + Math.cos(p.a) * p.r, y: s.cy + Math.sin(p.a) * p.r, r: 3 * U, h: 40, l: 65, a: p.life })
  }
  pull *= pull < 0 ? Math.exp(-s.dt * 2) : 1
  s = await frame(out, { trail: 0.86 - (A.calm || 0) * 0.1 + pull * 0.05, zoom: 1 + open * 0.01 - pull * 0.006, mirror: A.energy > 0.7 ? 6 : 0 })
}
```

## Design principles

These come from what works in VJ practice and music-visualization research, and from watching this engine run:

1. **One sound, one job.** Map each perceptual cue to one visual cue: kick → body and scale, snare → disruption,
   hats → glints, bass → weight and turbulence, pitch → hue. When everything reacts to everything, nothing reads.
2. **Anticipate, then release.** Use `anticip`, `build` and `toDrop` to wind up; spend it on `drop`.
3. **Stand on your own.** A scene should look good with the music muted: a real system (a flock, an attractor, a
   machine, a polytope) that the music steers, not a meter that bounces.
4. **Quantise motion.** Steps on beats (turn an eighth on every beat, flip on every snare) read as musical; smooth
   drift reads as ambient. Use both on purpose.
5. **Respect calm.** In breakdowns (`calm` near 1) slow down, thin out and lengthen trails, so the drop has
   somewhere to go.
6. **Phases are chapters.** Each phase should look clearly different, and IV should be the one you would put in
   the trailer.

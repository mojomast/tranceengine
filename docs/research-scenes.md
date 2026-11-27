# Scene research: styles, sources and Psychoscript techniques

This is the research behind the overnight scene factory (November 2026): which visual styles a trance video can borrow,
which Psychoscript features no tranceengine scene uses yet, and a catalog of 57 scene concepts. Each concept is tagged with
its style and the Psychoscript technique it shows off. Every concept became a bee brief with an approved test written
first (`tools/test/scene-<slug>.test.mjs`, shared rules in `tools/test/scene-contract.mjs`).

## 1. What Psychoscript gives a scene that plain canvas code does not

Psychoscript (npm `psychoscript` 0.3.x, MIT) is a confined, **resumable** bytecode VM for a strict-mode JavaScript subset. A
program can be suspended to bytes and resumed later, on another worker, or twice. tranceengine already builds its editing
vocabulary on that (`docs/architecture.md`):

| Engine move | VM operation | What a scene author can exploit |
|---|---|---|
| `beatsnap` / `stutter` | snapshot ring per beat, resume from it | Beat-repeat rewinds the *whole scene state*. A scene whose picture is accumulated (growth, drawings, automata) makes the rewind visible: the coral un-grows, the pen lifts. |
| `fork` | suspend, then resume twice | Two copies run on from the same state. With a seeded PRNG they stay identical (a mirror). With `Math.random` after the fork point they **diverge**, which is the basis of the *Forking paths* concept. |
| `park` / scene memory | suspend to bytes | A scene that comes back later resumes its story (the forest is still grown). |
| `bookmark` / keyframes + `catchup` | snapshot per phase / per shot | Seeking and replayed shots restore exact state. That only looks exact if the scene's randomness is **seeded and kept in VM state**. Unseeded `Math.random` makes a replayed shot differ from the first time. |

Hence the factory's rule: **use a seeded PRNG (mulberry32) unless the scene is about divergence.** The VM is deterministic
except `Math.random`, `Date.now()`, `new Date()` and `crypto`, and the PRNG state lives in the VM heap, so snapshots carry it.

Snapshots cost about 2 ms to take and 3 ms to restore and are typically 20-150 KB. Accumulating scenes should keep their
state compact (plain number arrays, capped histories) so per-beat snapshots stay cheap.

### Language features no current scene uses (and the concepts built on them)

From the Psychoscript README and the repo's own subset (`docs/scene-api.md`: classes, generators, async/await, Map, Set,
JSON; no typed arrays, Proxy, Reflect, `Symbol()`, timers, eval or import/export):

| Technique | Feature | Why it fits a beat-synced VM | Concepts |
|---|---|---|---|
| Generator choreography | `function*`, `yield`, `yield*` | Each actor is a coroutine advanced once per frame; a bar cue swaps routines with `yield*`. The coroutine's position is part of the snapshot, so stutters replay the exact move. | coroutine-dancers, dot-tunnel, hilbert-trace, dragon-fold, apollonian-pop, penrose-deflate, megademo |
| Async-generator sequencer | `async function*`, `for await` | A step sequencer whose playhead is an async stream; the main loop still awaits `frame()` each step. | step-sequencer |
| BigInt bitboards | BigInt shifts and bitwise ops | One BigInt holds a whole automaton row, so Rule 30/90/110/150 is a few ops per row, and Life can use bit-parallel adders. Plain arrays only, as typed arrays are not available. | rule30-loom, life-pulse, bit-carpet |
| RegExp rewriting | `String.replace(RegExp, fn)` | L-system grammars are literally string rewriting (Prusinkiewicz and Lindenmayer). | lsystem-garden, fractal-forest |
| Map/Set graphs | `Map`, `Set` | Occupancy sets and child-to-parent maps for aggregation and networks. | dla-coral, slime-web |
| Bytes as pattern | `TextEncoder`, `btoa`, `charCodeAt` | Words become bit grids and bar codes that decode into text on the downbeat. | byte-poem, crt-testcard, sine-scroller, night-broadcast |
| structuredClone echo | `structuredClone` | A ring of past shape states replayed as demoscene "delay vectors". | vector-bobs, time-echo |
| Iterator helpers | `Iterator.from(...).map().filter().take()` | Lazy geometry pipelines without intermediate arrays. | rotozoom-checker |
| Fork divergence | `Math.random` on purpose | Designed for the engine's fork transition. | fork-garden |

Not usable in scenes: `#private` fields, static blocks, typed arrays (the repo docs forbid them, and the approved test
rejects them), `Proxy`, `Reflect`, `Symbol()`, `eval`, timers, the DOM and the network.

## 2. Styles and sources

**Demoscene.** Plasma (sum of sines per pixel), rotozoomer (rotate and scale the UV lookup), tunnels (polar UV), the fire
filter (average neighbours, cool, inject fuel), copper/raster bars, shadebobs, Kefrens bars, vector bobs and delay vectors,
metaballs, sine scrollers. Sources: [Demo effect (Wikipedia)](https://en.wikipedia.org/wiki/Demo_effect),
[Oldschool demo effects](http://seancode.com/demofx/),
[SizeCoding: demoscene effects with pseudo code](http://sizecoding.org/wiki/Design_Tips_and_Demoscene_effects_with_pseudo_code),
[Examples of real-time effects](http://www.oldskool.org/demos/explained/demo_graphics.html),
[The Demo Effects Collection](https://demo-effects.sourceforge.net/).

**Generative art and op-art.** Truchet tiles, especially Smith's 1987 quarter-circle variant
([drmathart: Truchet tiles](https://drmathart.com/Resources/Truchet/), [Truchet tiling](https://en.wikipedia.org/wiki/Truchet_tiling)).
Vera Molnar's rule-and-chance plotter work, for example *Interruptions*, 1968-69 ([V&A: Digital art](https://www.vam.ac.uk/articles/digital-art)).
Op art's controlled repetition and vibration (Bridget Riley, Victor Vasarely:
[Tate: Op art](https://www.tate.org.uk/art/art-terms/o/op-art), [Victor Vasarely](https://en.wikipedia.org/wiki/Victor_Vasarely)).
Space-filling and folding curves ([Hilbert curve](https://en.wikipedia.org/wiki/Hilbert_curve), [Dragon curve](https://en.wikipedia.org/wiki/Dragon_curve)).

**Math art.** Vogel phyllotaxis (angle i·137.508°, radius c·√i: [MathWorld: Vogel spiral](https://mathworld.wolfram.com/VogelSpiral.html)).
Fourier epicycles (a chain of DFT circles). Apollonian gaskets via Descartes' theorem
([evoluteur/apollonian-gasket](https://github.com/evoluteur/apollonian-gasket)).
Chladni figures ([Ernst Chladni](https://en.wikipedia.org/wiki/Ernst_Chladni)), the [harmonograph](https://en.wikipedia.org/wiki/Harmonograph)
and the Hopf fibration ([Niles Johnson: Hopf fibration](https://nilesjohnson.net/hopf.html)).

**Retro vector, CRT and oscilloscope.** Oscilloscope music: the left channel drives X, the right drives Y, and the sound draws the
picture ([Oscilloscope Music](https://oscilloscopemusic.com/info/about/),
[IEEE Spectrum on Jerobeam Fenderson](https://spectrum.ieee.org/jerobeam-fendersons-trippy-oscilloscope-music),
[Kickstarter: The Process](https://www.kickstarter.com/blog/the-process-oscilloscope-music)). Vector-display wireframes, test
cards and scanlines (original designs only, no real broadcaster marks).

**Glitch.** Slice displacement, channel split and datamosh-like smears, done without inverting or flashing the frame
([Glitch art](https://en.wikipedia.org/wiki/Glitch_art)).

**Simulation and growth.** Gray-Scott reaction-diffusion, with Karl Sims' parameters D_A = 1, D_B = 0.5, f ≈ 0.055,
k ≈ 0.062 and the mitosis and coral presets ([Karl Sims: Reaction-diffusion tutorial](http://www.karlsims.com/rd.html),
[Biological Modeling: Gray-Scott](https://biologicalmodeling.org/prologue/gray-scott)).
Physarum agents (sense, steer, deposit; the trail diffuses and decays):
[Jones 2010, Artificial Life 16(2)](https://uwe-repository.worktribe.com/preview/980585/artl.2010.16.2.pdf),
[jasonwebb/morphogenesis-resources](https://github.com/jasonwebb/morphogenesis-resources).
L-systems ([The Algorithmic Beauty of Plants, free edition](https://www.algorithmicbotany.org/papers/abop/abop-fm.pdf)),
[diffusion-limited aggregation](https://en.wikipedia.org/wiki/Diffusion-limited_aggregation),
[Conway's Game of Life](https://conwaylife.com/wiki/Conway%27s_Game_of_Life), [Rule 30](https://mathworld.wolfram.com/Rule30.html),
and curl noise ([Bridson et al. 2007](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf)).
Mathematical marbling (Lu, Jaffer et al., IEEE CG&A 2012, doi:10.1109/MCG.2011.51).

**Sacred and aperiodic geometry.** Girih tilings (Lu and Steinhardt, *Science* 315, 2007, doi:10.1126/science.1135491) and
[Penrose tilings](https://en.wikipedia.org/wiki/Penrose_tiling) by deflation.

**Design movements and typography.** [Bauhaus](https://en.wikipedia.org/wiki/Bauhaus), [Memphis Group](https://en.wikipedia.org/wiki/Memphis_Group),
[International Typographic Style](https://en.wikipedia.org/wiki/International_Typographic_Style), text-mode/ASCII art, Y2K chrome.

**VJ/rave practice.** [VJing](https://en.wikipedia.org/wiki/VJing): give each drum a different visual job, gather tension through
builds and release on the drop. This matches the repo's own reaction guide (`docs/scene-api.md`).

**Photosensitivity.** At most three flashes in any second; no saturated red flashes
([WCAG 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)). The page already caps flashes at two
per second. The approved test forbids near-white lightness (85+), `difference` blending and phases on flourishes, and every brief
forbids full-screen strobing and alternating saturated red.

**Determinism.** mulberry32 is a tiny 32-bit PRNG with good-enough statistics for visuals
([bryc/code: PRNGs](https://github.com/bryc/code/blob/master/jshash/PRNGs.md)). Psychoscript:
[npm](https://www.npmjs.com/package/psychoscript), [GitHub](https://github.com/anomalyco/psychoscript).

## 3. The approved contract every scene must pass

`tools/test/scene-contract.mjs` (static rules) and `tools/check-scene.mjs` (runtime) enforce the following:

- an exact `// name:` first line and a header of 3+ comment lines;
- `while (true)` with `await frame(...)`;
- no timers, network, eval, Proxy/Reflect/Symbol, DOM, typed arrays, import/export, clock or crypto reads;
- no `Math.random` unless the scene is about fork divergence;
- the scene's tagged technique must appear in the code;
- l < 85, no `difference` blending, 4+ distinct audio reactions;
- a file under 12 KB for a flourish or 20 KB for a feature;
- average VM time under 3.5 ms (flourish) or 4.0 ms (feature) at desktop and phone sizes, scaled on slower CI runners;
- at most 1200 or 1400 shapes;
- features report 4 phases, answer cues, and start cleanly at a later phase (`ENTRY=2`).

## 4. Concept catalog

Model: the bee model the brief was written for. DeepSeek is used for most scenes, Nous for simple ones and Kimi for the
heaviest simulations and the four-phase features.

| # | Scene | Slug | Tier | Style | Psychoscript technique | Model | Concept |
|---|---|---|---|---|---|---|---|
| 1 | Plasma lattice | `plasma-lattice` | flourish | demoscene | Seeded PRNG | deepseek-v4.1-flash | Classic demoscene plasma: sum of 3-4 sines over x, y, radius and time, sampled on a coarse grid (about 40x24 cells, fewer on phones) and drawn as soft rounded squares whose hue cycles from keyHue. |
| 2 | Rotozoom checker | `rotozoom-checker` | flourish | demoscene | Iterator helpers | deepseek-v4.1-flash | Demoscene rotozoomer: an XOR/checker texture evaluated through a rotate+scale (u,v) transform, sampled on a coarse grid of tiles. |
| 3 | Copper bars | `copper-bars` | flourish | demoscene | Seeded PRNG | deepseek-v4.1-flash | Amiga copper/raster bars: 6-9 horizontal gradient bars (stacked thin rects, dark edge to bright core, l <= 65) bouncing on phase-offset sines. |
| 4 | Dot tunnel | `dot-tunnel` | flourish | demoscene | Generator choreography | deepseek-v4.1-flash | Early-90s dot tunnel: 24-30 rings of dots receding in z, the tunnel centre wandering on a lissajous path. |
| 5 | Vector bobs | `vector-bobs` | flourish | demoscene | structuredClone echo | deepseek-v4.1-flash | Demoscene vector bobs with delay vectors: a rotating 3D object (cube, then torus knot on the next downbeat) whose vertices are drawn as glowing bobs; the last 6 frames' projected vertex lists are kept with structuredClone in a ring buffer and redrawn as fading delayed echoes. |
| 6 | Shadebobs | `shadebobs` | flourish | demoscene | Seeded PRNG | hy4-flash | Shadebobs: 5-8 translucent bobs (radial-ish layered circles, alpha 0.08-0.15) running on lissajous paths and leaving trails via fx.trail, so overlaps build up shades. |
| 7 | Sine scroller | `sine-scroller` | flourish | demoscene | Bytes as pattern | deepseek-v4.1-flash | Demoscene sine scroller: a short message ('TRANCE ENGINE' or the section name when A.section is set) as kinetic text letters riding a sine wave across the screen, with a mirrored dim reflection below. |
| 8 | Metaball contours | `metaball-contours` | flourish | demoscene | Seeded PRNG | deepseek-v4.1-flash | Metaballs drawn as contour lines: a coarse field grid (about 32x18) of summed r^2/d^2 blobs; marching squares extracts 2-3 iso-levels as line segments. |
| 9 | Ember fire | `demo-fire` | flourish | demoscene | Seeded PRNG | deepseek-v4.1-flash | The classic fire effect on a coarse grid (about 48x28): bottom row seeded with fuel from a seeded PRNG, each cell averages neighbours below and cools. |
| 10 | Truchet weave | `truchet-weave` | flourish | generative | Seeded PRNG | deepseek-v4.1-flash | Smith quarter-circle Truchet tiles: a grid of tiles each drawing two quarter arcs; orientation bits come from a seeded PRNG. |
| 11 | Riley waves | `riley-waves` | flourish | op-art | Seeded PRNG | deepseek-v4.1-flash | Op-art after Bridget Riley's wave paintings: 30-50 parallel horizontal polylines displaced by a sine whose frequency increases down the screen, creating a vibrating surface. |
| 12 | Interruptions | `molnar-interruptions` | flourish | generative | Seeded PRNG | deepseek-v4.1-flash | Vera Molnar's 'Interruptions': a grid of short line segments with seeded random angles and seeded gaps (interruptions). |
| 13 | Vasarely bulge | `vasarely-bulge` | flourish | op-art | Seeded PRNG | deepseek-v4.1-flash | Victor Vasarely 'Vega'-style bulge: a checkerboard of squares/circles warped by a lens that swells from the centre. |
| 14 | Hilbert trace | `hilbert-trace` | flourish | generative | Generator choreography | deepseek-v4.1-flash | A Hilbert space-filling curve (order 5, order 4 on phones) traced progressively: a generator yields the curve's points in order and the main loop pulls more points per frame. |
| 15 | Dragon fold | `dragon-fold` | flourish | generative | Generator choreography | deepseek-v4.1-flash | Heighway dragon curve unfolding: generate the paper-folding turn sequence; each beat adds one fold (up to ~11), animating the newest half rotating out from the previous end. |
| 16 | Sunflower spiral | `sunflower-spiral` | flourish | math art | Seeded PRNG | hy4-flash | Vogel phyllotaxis: point i at angle i*137.508 deg and radius c*sqrt(i), 400-700 seeds. |
| 17 | Epicycle draw | `epicycle-draw` | flourish | math art | Seeded PRNG | deepseek-v4.1-flash | Fourier epicycles: a closed seeded star/flower curve is sampled once, its DFT computed once, and a chain of rotating circles (largest first) draws it with a k:'p' trace. |
| 18 | Apollonian pop | `apollonian-pop` | flourish | math art | Generator choreography | deepseek-v4.1-flash | Apollonian gasket via Descartes' circle theorem (k4 = k1+k2+k3 +/- 2 sqrt(k1k2+k2k3+k3k1), complex form for centres) generated breadth-first by a generator. |
| 19 | Chladni sand | `chladni-sand` | flourish | math art | Seeded PRNG | deepseek-v4.1-flash | Chladni plate: 500-800 sand grains move downhill on /cos(n pi x)cos(m pi y) - cos(m pi x)cos(n pi y)/ toward nodal lines. |
| 20 | Harmonograph | `harmonograph` | flourish | math art | Accumulated state | deepseek-v4.1-flash | Harmonograph: two damped pendulums per axis draw a long decaying figure as a k:'p' polyline accumulated over frames (the drawing is the state, so a stutter visibly redraws). |
| 21 | String art | `string-art` | flourish | math art | Seeded PRNG | hy4-flash | Modular times-table string art: N points on a circle, line i -> (i*k) mod N. |
| 22 | Spirograph gears | `spirograph-gears` | flourish | math art | Seeded PRNG | hy4-flash | Hypotrochoid spirograph: gear ratios snap to a new simple fraction on every downbeat; the pen trace builds as a k:'p' polyline; the gears themselves are faint outlines. |
| 23 | Torus knot | `torus-knot` | flourish | math art | Seeded PRNG | hy4-flash | A (p,q) torus knot drawn as 3-4 offset polylines (a tube look) rotating in 3D; (p,q) changes on phraseStart. |
| 24 | Hopf fibers | `hopf-fibers` | flourish | math art | Seeded PRNG | deepseek-v4.1-flash | Hopf fibration: 30-50 fibre circles from points on a few latitude rings of S2, stereographically projected from S3 into 2D-ish 3D view, slowly rotating. |
| 25 | Cymatic rings | `cymatic-rings` | flourish | physics | Seeded PRNG | deepseek-v4.1-flash | Interference of circular waves: 2-4 point sources (one spawned per kickHit, oldest replaced) emit expanding rings; drawn as rings plus a coarse grid of dots whose size follows the summed wave height. |
| 26 | Oscilloscope XY | `oscilloscope-xy` | flourish | retro vector | Seeded PRNG | deepseek-v4.1-flash | Oscilloscope music style (Jerobeam Fenderson): one green-phosphor beam (k:'p' polyline, fx.trail for phosphor decay) drawing XY lissajous figures whose x/y frequencies come from note and bands; kick morphs the figure toward a 3D wireframe sphere drawn in one stroke; snare adds a harmonic; hats add beam jitter; dim graticule grid behind. |
| 27 | Vector wireframe | `vector-wireframe` | flourish | retro vector | Seeded PRNG | deepseek-v4.1-flash | Retro vector-display wireframes: an icosahedron, then a torus, then a cube on successive downbeats, drawn as glowing lines (bright thin line over a wider dim line) with slight per-frame beam jitter. |
| 28 | Signal glitch | `signal-glitch` | flourish | glitch | Seeded PRNG | deepseek-v4.1-flash | Glitch art without strobing: a composition of geometric blocks and bars sliced into horizontal strips that displace sideways on snareHit (seeded offsets), with an RGB-split look made of three hue-offset copies at low alpha. |
| 29 | Test card | `crt-testcard` | flourish | retro CRT | Bytes as pattern | deepseek-v4.1-flash | A fictional CRT test card (original design: circles, colour bars at l <= 60, grid, centre cross) with scanlines and a slight barrel wobble. |
| 30 | ASCII ripple | `ascii-ripple` | flourish | typography | Seeded PRNG | deepseek-v4.1-flash | Text-mode art: a grid of monospace characters (about 32x16 desktop, 16x24 phone, using plain k:'t' text) where each cell's glyph is chosen by a ripple field's height from a density ramp ' .:-=+*#%@'. |
| 31 | Byte poem | `byte-poem` | flourish | typography | Bytes as pattern | deepseek-v4.1-flash | A word ('PULSE', 'RISE', 'DROP' by section, fallback 'TRANCE') shown as its 8-bit bytes: a block grid where each bit is a cell, bits flip to the next word's bytes on downbeats, and on the last beat of the bar the bits slide together into the readable kinetic text. |
| 32 | Swiss grid | `swiss-grid` | flourish | typography | Seeded PRNG | deepseek-v4.1-flash | International Typographic Style: a strict 12-column grid; big numerals (beat count 1-4) and thin rules slide in on the grid, an offset accent circle; kickHit snaps the big numeral; snare slides a rule; bars change the layout to another seeded grid arrangement; limited palette (keyHue + neutral).. |
| 33 | Bauhaus blocks | `bauhaus-blocks` | flourish | bauhaus | Seeded PRNG | deepseek-v4.1-flash | Bauhaus composition: circles, squares, triangles and quarter-circles in a muted primary palette (red used as a static block only, never alternating) rearranging into a new seeded composition on each beat with eased slides. |
| 34 | Memphis party | `memphis-party` | flourish | memphis | Seeded PRNG | deepseek-v4.1-flash | 80s Memphis design: squiggles, zigzags, confetti dots, semicircles and grid patches popping in on hats with springy scale, drifting slowly. |
| 35 | Chrome blobs | `chrome-blobs` | flourish | y2k | Seeded PRNG | deepseek-v4.1-flash | Y2K liquid chrome: 4-6 blobby shapes built from layered circles with gradient-like stacked fills and a highlight streak, orbiting and merging. |
| 36 | Curl flow | `curl-flow` | flourish | fluid | Seeded PRNG | deepseek-v4.1-flash | Particles (300-500) advected by a curl-of-noise field (cheap pseudo-noise from summed sines with seeded phases), drawn as short streaks. |
| 37 | Coral growth | `dla-coral` | flourish | growth | Map/Set graphs, Accumulated state | deepseek-v4.1-flash | Diffusion-limited aggregation: an occupancy Set of grid cells grows a coral from the centre as seeded random walkers stick; walkers are released faster on kicks; branch tips glow on hats; the cluster is drawn as segments from each cell to its parent (Map child->parent). |
| 38 | L-system garden | `lsystem-garden` | flourish | growth | RegExp rewriting | deepseek-v4.1-flash | L-system plants (Prusinkiewicz & Lindenmayer): 2-3 grammars (fractal plant, bush, seaweed) rewritten with String.replace(/[FX]/g, fn); each beat adds one generation (cap the string length), drawn with a turtle as polylines. |
| 39 | Rule 30 loom | `rule30-loom` | flourish | cellular automata | BigInt bitboards | deepseek-v4.1-flash | Elementary cellular automata as woven textile: each row is a BigInt (one bit per cell, 64-128 cells), next row = rule applied with shifts/AND/OR/XOR; rows scroll up like fabric on a loom. |
| 40 | Bit carpet | `bit-carpet` | flourish | cellular automata | BigInt bitboards | hy4-flash | Sierpinski carpet/triangle from Pascal's triangle mod 2 with BigInt rows (row = row ^ (row << 1n)), zooming slowly into a self-similar corner. |
| 41 | Coroutine dancers | `coroutine-dancers` | flourish | psychoscript-native | Generator choreography | deepseek-v4.1-flash | 12-20 dancers (simple stick figures or glowing dots with limbs), each driven by its own generator choreography routine (spin, hop, wave, slide) that yields one pose per frame; on each downbeat each dancer's routine is swapped for another with yield* delegation. |
| 42 | Step sequencer | `step-sequencer` | flourish | psychoscript-native | Async-generator sequencer | deepseek-v4.1-flash | A 16-step x 4-lane grid sequencer: an async generator yields the playhead step derived from A.barPhase and the main loop consumes it with for await (each iteration still awaits frame). |
| 43 | Time echo | `time-echo` | flourish | psychoscript-native | structuredClone echo | deepseek-v4.1-flash | Delay-vector echoes: a simple figure (rotating polygon star + orbiting dots) whose full shape list from each of the last 8 beats is structuredClone'd into a ring buffer and redrawn as progressively dimmer, larger echoes. |
| 44 | Forking paths | `fork-garden` | flourish | psychoscript-native | Fork divergence, Accumulated state | kimi-for-coding | Designed for the engine's fork transition (one VM suspended, resumed twice): a branching tree grows deterministically from a seeded PRNG for the first beats, then each new branch decision uses Math.random, so two forked copies of the scene grow visibly different futures from the same trunk. |
| 45 | Life pulse | `life-pulse` | flourish | cellular automata | BigInt bitboards, Seeded PRNG | kimi-for-coding | Conway's Game of Life on a 64x36 board stored as BigInt rows, with the neighbour count done by bit-parallel adders (half/full adder on shifted rows). |
| 46 | Turing spots | `turing-spots` | flourish | reaction-diffusion | Seeded PRNG | kimi-for-coding | Gray-Scott reaction-diffusion (Karl Sims' parameters) on a coarse grid (about 48x27, fewer on phones), several steps per frame within budget, rendered as circles sized by B. |
| 47 | Slime web | `slime-web` | flourish | agent sim | Map/Set graphs, Seeded PRNG | kimi-for-coding | Physarum (Jeff Jones 2010): 300-500 agents sense a coarse trail grid ahead-left/ahead/ahead-right, steer, deposit; the grid diffuses and decays; render the trail grid cells above a threshold as dots plus agents faintly. |
| 48 | Ink marbling | `ink-marbling` | flourish | fluid | Accumulated state, Seeded PRNG | kimi-for-coding | Mathematical marbling (Lu, Jaffer et al.): each kickHit drops an ink circle that displaces every existing contour point by the drop formula; tine strokes on snareHit comb the pattern; contours are polylines with point resampling capped for budget. |
| 49 | Girih stars | `girih-stars` | flourish | islamic geometry | Seeded PRNG | kimi-for-coding | Islamic girih / 8-fold star tiling built from a polygons-in-contact construction, drawn as interlaced strapwork lines, rotating and breathing; the star angle changes on downbeats; kick pulses line width; snare shifts the contact angle; keyHue colours.. |
| 50 | Penrose deflation | `penrose-deflate` | flourish | aperiodic tiling | Generator choreography | kimi-for-coding | Penrose P3 rhombus tiling from Robinson-triangle deflation done by a generator per level; zooming into the tiling so a new level appears on each downbeat; kick pulses tile outlines; snare highlights all thin rhombi; keyHue two-tone fill at low alpha.. |
| 51 | Voronoi shatter | `voronoi-shatter` | flourish | generative | Seeded PRNG | kimi-for-coding | Voronoi cells of 20-40 seeded moving sites computed by half-plane clipping per site (cheap at this count) drawn as outlined polygons with soft fills; kickHit shatters: sites jump outward and cells reflow; snare recolours; bass breathes the sites.. |
| 52 | Megademo | `megademo` | feature | demoscene | Generator choreography, Seeded PRNG | kimi-for-coding | A four-part demoscene megademo. |
| 53 | Phosphor odyssey | `phosphor-odyssey` | feature | retro vector | Seeded PRNG | kimi-for-coding | Oscilloscope-music odyssey in one green beam. |
| 54 | Fractal forest | `fractal-forest` | feature | growth | RegExp rewriting, Accumulated state | kimi-for-coding | An L-system forest across four phases. |
| 55 | Op art gallery | `op-art-gallery` | feature | op-art | Seeded PRNG | kimi-for-coding | Four op-art rooms. |
| 56 | Night broadcast | `night-broadcast` | feature | retro CRT | Bytes as pattern, Seeded PRNG | kimi-for-coding | A late-night broadcast on a fictional CRT. |
| 57 | Turing garden | `turing-garden` | feature | reaction-diffusion | Seeded PRNG | kimi-for-coding | Gray-Scott reaction-diffusion on a coarse grid across four regimes. |

## 5. Ideas not yet briefed

- **Scene-aware stutter art.** Scenes could expose their own beat-repeat effect: a scene notices it was resumed from an
  older state (frame counter jumps backwards) and draws a rewind trail. This needs a host field for the rewind count, so it
  is an engine change, not a scene.
- **Durable host functions** (`Host.durableFn`) could let a scene ask the host for the song's section list once and keep the
  answer across snapshots. That is a scene-API change and needs the owner's review.
- **Shader-style SDF scenes.** Signed-distance shapes sampled on a coarse grid (circles, boxes, smooth unions) as a cheap
  stand-in for fragment-shader art. Budget-heavy; try after the coarse-grid simulations prove the cost model.

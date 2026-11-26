# Song maps and the director

The music video is planned before it plays. A **song map** describes the song's structure; the **edit plan** turns
that into shots; the **director** performs the plan, and **keyframes** let it rewind.

```
audio ──► mapSong() ──► map ──► prepMap() ──► buildPlan() ──► plan ──► directPlan() every frame
                         │                                              ▲
                         └──► mapClock() / mapSections() ──► A ─────────┘
```

## The song map (`src/app/mapper.js`)

`mapSong(pcm, rate)` takes mono samples and returns:

```js
{
  duration, bpm, period,              // seconds; period is one beat
  beats: [t, …], downbeats: [t, …],   // seconds
  onsets: { kick: [t, …], snare: [t, …], hat: [t, …] },
  sections: [{ start, end, kind, bars, power }],   // kind: intro | verse | build | drop | main | breakdown | outro
  drops: [t, …],
  frames, tension, frameCount, debug  // per-frame features (dropped from the stored maps)
}
```

Bundled tracks have precomputed maps in `assets/maps.json` (`bun tools/map-songs.mjs`). A song the viewer drops
in is decoded with `decodeAudioData`, mixed to mono, and mapped in a worker built from `mapSong.toString()`; it
takes about a second for a four-minute song. Until the map arrives the live director runs, then the planned
director takes over with a dissolve.

### The pipeline

1. **Features.** Resample to 22.05 kHz; 1024-point FFT, hop 256 (≈ 86 frames/s). Per frame: level, low / mid / high
   energy, spectral flux overall and per band (sub-bass, snare "crack" band, hat band), flatness of the crack band,
   brightness, noisiness, 32 log bands, 12 chroma bins. Each feature is normalised to its 95th percentile.
2. **Hits.** Peak-picking on band flux against a local mean + k·deviation, with song-wide floors anchored on the
   loud sections' peaks. Kicks must be low-heavy and sit on the 16th-note grid; snares must be noisy (flat) and
   crack-heavy; hats must not coincide with a snare.
3. **Tempo.** Autocorrelation of an onset envelope, weighted toward 120 BPM, with a double-tempo check.
4. **Beats.** Dynamic-programming beat tracking (Ellis 2007), then an octave check: if strong, isolated snares fall
   on one position in every four tracked beats, we are counting double time, so every other beat is dropped.
5. **Downbeats.** The bar phase whose beats carry the most kick energy and harmonic change.
6. **Sections.** Per-bar statistics; novelty between the two bars before and after each bar line; peaks above
   1.25 × the median become boundaries; long sections are split into 8-bar phrases.
7. **Labels.** Drops: near the song's peak power, with kicks, and a clear jump (or following a breakdown).
   Quiet stretches: intro, breakdown or outro by position. Then each drop is moved (±2 bars) to the bar line where
   the sub-bass jumps most. Builds are traced backward from each drop through phrases that carry snare rolls or
   rise; a build is split where its continuous roll begins, the quiet part before it becoming a breakdown.
8. **Dense mixes.** If a song never gets quiet (no breakdowns, at most one drop), its choruses are found as lifts
   in brightness instead: sections near the brightest level that jump above the one before. Each lift lands on the
   first bar that is nearly as bright as the section gets; the dip before it becomes its build.

### Accuracy

`bun tools/eval-mapper.mjs` scores the mapper against the synthetic test songs, whose structure is known
(`tools/synth-test-songs.py` writes `assets/truth/*.truth.json`):

| | Slow Burn (84 BPM, half-time) | Breakneck (172 BPM) |
|---|---|---|
| tempo | 83.6 | 172.2 |
| downbeats | all bars | all bars |
| sections | all 8 boundaries and labels | all 7 |
| drops | 45.69 s, 85.68 s (truth 45.714, 85.714) | 22.29 s, 61.36 s (truth 22.326, 61.395) |
| kick precision / recall | 52% / 92% | 62% / 57% |
| snare precision / recall | 75% / 71% | 96% / 77% |

Kick detection is the weakest part (bass notes and toms pass as kicks), but it matters little: transitions follow
the beat grid and sections, and the kick envelope only pumps on detected kicks. Both songs map the same whether
decoded at 22.05 or 48 kHz. The Grimoire song has no ground truth; its map (four lifts at 0:08, 0:39, 1:07, 1:49)
was checked by listening.

## Reading the map while playing (`timeline.js`)

`mapClock()` and `mapSections()` replace the live detectors when the current track is mapped. At
`t = audioEl.currentTime + 20 ms` (the picture lags the sound by about a frame) they:

- fire `kickHit` / `snareHit` / `hatHit` for every onset crossed since the last frame, and `beat` / `downbeat`
  for every beat crossed;
- set `phase`, `bar`, `barPhase`, `bars`, `phrase` (bar within the section's 8-bar phrase), `bpm`;
- set `section`, `sectionPos`, `songPos`, `build` (an eased ramp through the build before each drop), `toDrop`,
  `drop` (crossing a drop time), and `calm` from the section kind.

A jump of more than 0.6 s, or any jump backward, is a **seek**: every cursor moves to the new position, nothing
fires, and `A.seeked` is set for one frame.

## The edit plan (`buildPlan`)

The plan is a list of **shots** `{ t0, t1, scene, entry, kind, type, beats, lead, insert, cues }` and **events**
`{ t, type }`, built once per song (and again when the scene rotation changes) with a seeded RNG, so a song always
gets the same edit.

**Scene pairs chain across sections.** Each section intercuts two feature scenes: the one carried over from the
previous section and a new partner (the least-used feature). The partner carries into the next section, so the
video moves A+B, B+C, C+D… Drops open on the carried scene, now in its climax phase, unless it is already on screen:
a drop is always a cut.

**Shot lengths follow the section.**

| Section | Shots | Into the section | Within it |
|---|---|---|---|
| intro, outro | up to 8 bars | luma reveal / dissolve over 4 beats | dissolve |
| verse | 4 bars, sometimes 3 + a 1-bar flourish | iris, blinds, wipe or luma, landing on the downbeat | cut or 2-beat wipe |
| build | accelerating: … 4, 2, 1, 1 bars (1-bar shots are flourishes) | iris or zoom | cut or zoom |
| drop | 4 bars, sometimes 3 + 1 | **hard cut** with flash and shockwave | cut, blinds or zoom on the beat |
| main | 2 or 4 bars | as verse | as drop |
| breakdown | 4-bar shots | slow 4-beat dissolve | dissolve |

Transitions that take time start `lead` beats early, so they finish exactly on the bar line.

**Phases follow the song.** On a four-phase scale: intro I, verse II (III late in the song), build III, drop IV,
main III (IV late), breakdown II, outro I. Shots of 8 bars or more step a phase forward halfway through.

**Events.** Each section start sets the colour grade and may show the next word of the title; the last beat
before a drop repeats as a beat-repeat stutter (four quarter-beats); late drops may fork the scene into two VMs.

## Following the plan (`directPlan`)

Every frame: fire the events crossed since the last frame, fire the current shot's phase cues, and start the next
shot's transition once `t >= next.t0 - next.lead`. If the next shot has a keyframe from an earlier pass, the scene
starts from it, so replays look the same. Turning auto-cycle off pauses the plan; turning it back on resyncs with a
dissolve.

## Keyframes and seeking

As a shot plays, `keyframeTick` asks the worker to snapshot the scene at the shot's start and on every second
downbeat, stored per shot (about 96 MB at most, evicting the shots farthest away).

On a seek, `seekTo(t)`:

1. finds the shot playing at `t` and the phase it should be in;
2. takes the latest keyframe of that shot at or before `t`, if there is one;
3. resumes it in a VM with `catchup: n` (frames at 1/30 s up to `t`): the worker answers those frames instantly
   without drawing, so the scene arrives at exactly the state it had at `t`;
4. without a keyframe (a part never played), starts the scene fresh in the right phase;
5. cuts to it with the rewind effect (VHS tear, desaturation, chromatic split) and a tag saying what happened.

Scrubbing while paused runs a few frames after each seek so the restored scene is visible.

## Tuning

- Mapper thresholds live in `mapper.js`; run `bun tools/eval-mapper.mjs` after every change, and
  `bun tools/map-songs.mjs` to refresh the bundled maps.
- Shot patterns, transitions, phases and events live in `buildPlan` (`timeline.js`).
- Post-processing strength lives in `present()` (`director.js`) and the shader in `core.js`.
- To test a new song profile, add a generator to `tools/synth-test-songs.py` with its ground truth.

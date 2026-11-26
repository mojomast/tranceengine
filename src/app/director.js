// ---------- Engine worker with two VM slots ----------
const engineURL = URL.createObjectURL(new Blob([$("#engine").textContent], { type: "text/javascript" }))
let worker = null, tokenSeq = 0
const mkSlot = (id) => ({ id, token: 0, next: null, waitingSince: 0, scene: -1, t: 0, frames: 0, fx: null, lastFrameAt: 0, running: false, ready: false,
  entry: 0, cue: -1, phase: -1, phases: 1, title: "" })
const slots = { a: mkSlot("a"), b: mkSlot("b") }
let active = "a"
const other = (id) => (id === "a" ? "b" : "a")
let paused = true, scrubFrames = 0, fpsAvg = 0, vmAvg = 0, hudAt = 0, lastLoop = 0
let mx = innerWidth / 2, my = innerHeight / 2, down = false

const toastEl = $("#toast"); let toastTimer = 0
const toast = (text, bad) => {
  toastEl.textContent = text; toastEl.className = "glass show" + (bad ? " bad" : "")
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (toastEl.className = "glass"), bad ? 6000 : 2800)
}
const showError = (text) => {
  const err = $("#err"); err.textContent = text; err.classList.add("show")
  if (!$("#drawer").classList.contains("open")) toast(text, true)
}
let titleTimer = 0, captionTimer = 0, tagTimer = 0
const showTitle = (name, sub) => {
  $("#title-name").textContent = name; $("#title-sub").textContent = sub
  $("#title").classList.add("show"); clearTimeout(titleTimer); titleTimer = setTimeout(() => $("#title").classList.remove("show"), 7000)
}
const showCaption = (text) => {
  $("#caption").textContent = text; $("#caption").classList.add("show")
  clearTimeout(captionTimer); captionTimer = setTimeout(() => $("#caption").classList.remove("show"), 3200)
}
const showTag = (text) => {
  const el = $("#vmtag"); el.textContent = text; el.classList.add("show")
  clearTimeout(tagTimer); tagTimer = setTimeout(() => el.classList.remove("show"), 1600)
}

const memory = new Map() // scene index -> { bytes, t, code }
const parkKeys = new Map()
// Phase bookmarks: scene index -> { [phase]: { bytes, t, code } }, snapshots taken as a scene enters each phase.
const bookmarks = new Map(), bookKeys = new Map()
const onMessage = (e) => {
  const m = e.data
  if (m.type === "frame") {
    const st = slots[m.slot]
    if (st && m.token === st.token) { st.next = m; st.ready = true }
  } else if (m.type === "error") {
    const st = slots[m.slot]
    if (st && m.token === st.token) { st.running = false; if (m.slot === active || (trans && trans.to === m.slot)) showError(m.message) }
  } else if (m.type === "ended") {
    const st = slots[m.slot]
    if (st && m.token === st.token) { st.running = false; if (m.slot === active) toast("The script finished. Its last frame stays on screen.") }
  } else if (m.type === "parked") {
    const p = parkKeys.get(m.key); parkKeys.delete(m.key)
    if (p && p.code === codes[p.scene]) {
      memory.set(p.scene, { bytes: m.bytes, t: p.t, code: p.code })
      if (memory.size > 12) memory.delete(memory.keys().next().value)
    }
  } else if (m.type === "bookmarked") {
    if (kfKeys.has(m.key)) return onKeyframe(m)
    const b = bookKeys.get(m.key); bookKeys.delete(m.key)
    if (b && b.code === codes[b.scene]) {
      if (!bookmarks.has(b.scene)) bookmarks.set(b.scene, {})
      bookmarks.get(b.scene)[b.phase] = { bytes: m.bytes, t: b.t, code: b.code }
    }
  } else if (m.type === "stuttered") showTag("⟲ beat repeat · VM rewound one beat")
  else if (m.type === "forked") showTag("⑂ forked · one VM became two")
  else if (m.type === "captured") addMoment(m)
  else if (m.type === "captureFailed") { captures.delete(m.id); toast("Couldn't capture: " + m.message, true) }
}
const spawn = () => {
  if (worker) worker.terminate()
  worker = new Worker(engineURL)
  worker.onmessage = onMessage
  worker.onerror = (e) => { slots.a.running = slots.b.running = false; showError("The engine failed: " + (e.message || "unknown error")); e.preventDefault() }
}
spawn()

// Start scene i in a slot: resume it from memory if it was parked before, otherwise from scratch.
// Start scene i in a slot. With an entry phase, prefer that phase's bookmark (the scene resumes with everything it
// had built up by then); otherwise resume it where it was parked and cue the phase; otherwise run it fresh at that phase.
// Returns how it started: "bookmark", "memory" or "fresh".
const startScene = (slotId, i, opts) => {
  opts = opts || {}
  const st = slots[slotId]
  st.token = ++tokenSeq; st.next = null; st.ready = false; st.running = true; st.scene = i; st.frames = 0; st.lastFrameAt = 0
  st.waitingSince = performance.now(); st.phase = -1; st.phases = PRESETS[i].phases || 1; st.title = ""
  const entry = typeof opts.entry === "number" ? opts.entry : null
  st.entry = entry == null ? 0 : entry; st.cue = -1
  // A keyframe from the song map: resume that exact VM state, running n frames ahead to reach the song position.
  const kf = opts.kf
  if (kf && kf.code === codes[i]) {
    if (entry != null && entry !== kf.phase) st.cue = entry
    const n = kf.n || 0
    st.t = kf.sceneT + n / 30
    const catchup = n > 0 ? { n, view: { ...viewFor(st, kf.sceneT, 1 / 30, audioView()), frame: 0 } } : null
    worker.postMessage({ type: "resume", slot: slotId, bytes: kf.bytes, token: st.token, catchup })
    return "snapshot"
  }
  const book = entry != null && !opts.fresh && bookmarks.get(i) && bookmarks.get(i)[entry]
  if (book && book.code === codes[i]) {
    st.t = book.t
    worker.postMessage({ type: "resume", slot: slotId, bytes: book.bytes, token: st.token })
    return "bookmark"
  }
  const mem = !opts.fresh && memory.get(i)
  if (mem && mem.code === codes[i]) {
    st.t = mem.t; memory.delete(i)
    if (entry != null) st.cue = entry
    worker.postMessage({ type: "resume", slot: slotId, bytes: mem.bytes, token: st.token })
    return "memory"
  }
  st.t = 0
  worker.postMessage({ type: "run", slot: slotId, code: codes[i], token: st.token })
  return "fresh"
}
const parkSlot = (slotId) => {
  const st = slots[slotId]
  if (!st.running || st.scene < 0) { worker.postMessage({ type: "stop", slot: slotId }); st.running = false; return }
  const key = ++tokenSeq
  parkKeys.set(key, { scene: st.scene, t: st.t, code: codes[st.scene] })
  worker.postMessage({ type: "park", slot: slotId, key })
  st.running = false; st.token = -1; st.next = null
}
const runCode = (code) => {
  // Editor: run new code in the active slot, replacing whatever was there.
  $("#err").classList.remove("show")
  cancelTransition()
  const st = slots[active]
  memory.delete(current)
  st.token = ++tokenSeq; st.next = null; st.ready = false; st.running = true; st.t = 0; st.waitingSince = performance.now()
  worker.postMessage({ type: "run", slot: active, code, token: st.token })
}

// ---------- Per-scene reaction profiles: how each scene's frame responds to each sound type ----------
// punch: kick zoom and shape pump · slice: snare glitch · sparkle: hat shimmer · shake: bass shake · tint: key colour grade
const ARCHETYPES = {
  pumper: { punch: 1.5, slice: 0.3, sparkle: 0.6, shake: 1, tint: 0.8 },
  glitcher: { punch: 0.7, slice: 1.5, sparkle: 0.9, shake: 0.5, tint: 0.6 },
  shimmer: { punch: 0.8, slice: 0.4, sparkle: 1.6, shake: 0.3, tint: 1 },
  cinematic: { punch: 0.6, slice: 0.2, sparkle: 0.5, shake: 0.4, tint: 1.4 },
  rave: { punch: 1.3, slice: 1.1, sparkle: 1.2, shake: 1.2, tint: 0.7 },
}
const PROFILE_OF = {
  "Eclipse temple": "cinematic", "Spectral manifold": "rave", "Synthwave horizon": "glitcher", "Solar mandala": "pumper",
  "Aurora ribbons": "shimmer", "Neon ocean": "cinematic", "Starfield warp": "rave", "Beat fireworks": "pumper",
  "Unzipping helix": "shimmer", "Firefly swarm": "shimmer", "Sacred geometry": "pumper", "Spiral galaxy": "cinematic",
  "Polygon tunnel": "rave", "Glyph rain": "glitcher", "Moiré rings": "glitcher", "Lightning storm": "cinematic",
  "Spectrum halo": "pumper", "Crystal shards": "rave", "Neon vines": "shimmer", "Spectrum terrain": "glitcher",
  "Melting grid": "glitcher", "Orbit garden": "cinematic", "Lava lamp": "pumper", "Lissajous bloom": "shimmer",
  "Hypno spiral": "pumper", "Kinetic type": "glitcher",
  "The Grimoire": "cinematic", "The Sloperator": "rave", "Summoning circle": "pumper", "Astral city": "cinematic",
  "Murmuration": "shimmer", "Strange attractor": "rave", "Polytope chapel": "pumper",
}
const profileFor = (st) => {
  const base = ARCHETYPES[PROFILE_OF[PRESETS[st.scene] ? PRESETS[st.scene].name : ""] || "rave"]
  const r = st.fx && st.fx.react && typeof st.fx.react === "object" ? st.fx.react : null
  if (!r) return base
  const out = { ...base }
  for (const k of Object.keys(base)) if (typeof r[k] === "number" && Number.isFinite(r[k])) out[k] = clamp(r[k], 0, 2)
  return out
}

// ---------- Flash limiter: never more than 3 flashes in any second (WCAG 2.3.1); we allow 2. ----------
let flash = 0
const flashTimes = []
const requestFlash = (amount) => {
  if (REDUCE) return
  const now = performance.now()
  while (flashTimes.length && now - flashTimes[0] > 1000) flashTimes.shift()
  if (flashTimes.length >= 2) { flash = Math.max(flash, amount * 0.2); return }
  flashTimes.push(now); flash = Math.max(flash, amount)
}

// ---------- Director: a storyline of feature scenes told in phases, with flourishes as punctuation ----------
// Types: 0 dissolve, 1 iris, 2 blinds, 3 diagonal wipe, 4 luma reveal, 5 zoom-in, 6 hard cut.
const TNAMES = ["dissolve", "iris", "blinds", "wipe", "luma reveal", "zoom", "cut"]
const SEG = 16 // beats per story segment: one phase of a feature scene (four bars)
let auto = true, segBeats = 0, lastCutAt = performance.now(), history = [], trans = null, planned = null
let forkState = null, stutter = null, lastStutterBeat = -99, shock = 0, shockR = 0, stut = 0, phaseChangedAt = -99
// The story is told in 8-bar sections. Each section intercuts a pair of feature scenes (one carried over from the
// previous section, so scenes chain together), punctuated by one-bar flourish inserts. A global arc (I–IV) set by the
// song's position and energy decides which phase every scene plays, so all scenes build to the climax together.
const SECTION = 32
const story = { played: [], pair: [-1, -1], turn: 0, section: -1, arc: 0, boost: 0, hue: 30, shotLen: 16, sectionBeats: 0, insert: false, words: [], showcase: false }
let lastCardAt = 0, lastCardTitle = ""
const isFeature = (i) => PRESETS[i] && PRESETS[i].tier === "feature"
const pool = (feature) => {
  const r = rotation(), f = r.filter((i) => isFeature(i) === feature)
  return f.length ? f : r
}
const pickFrom = (list) => {
  let options = list.filter((i) => i !== current && !history.slice(-4).includes(i))
  if (!options.length) options = list.filter((i) => i !== current)
  if (!options.length) options = list
  return options.length ? options[Math.floor(Math.random() * options.length)] : -1
}
const chooseNext = () => pickFrom(pool(true))
const songPos = () => (music === "file" && audioEl.duration ? audioEl.currentTime / audioEl.duration : 0.5)
// The song's arc: I in the intro, II while it builds, III through the body, IV for the last stretch and after drops.
const songArc = () => {
  const pos = songPos()
  let arc = pos < 0.08 ? 0 : pos < 0.35 ? 1 : pos < 0.78 ? 2 : 3
  if (A.calm > 0.55) arc = Math.max(0, arc - 1)
  if (story.boost > 0) arc = 3
  return arc
}
// Which phase a scene should play in a shot: the arc's chapter, sometimes one phase behind for variety.
const chooseEntry = (i) => {
  const n = PRESETS[i].phases || 1
  if (n <= 1) return 0
  const want = Math.round((story.arc / 3) * (n - 1))
  return Math.max(0, Math.min(n - 1, want - (Math.random() < 0.3 && story.arc < 3 ? 1 : 0)))
}
const chooseTransition = (into) => {
  const fromFlourish = !isFeature(current)
  if (A.calm > 0.5 || A.energy < 0.3) return { type: Math.random() < 0.6 ? 0 : 4, beats: fromFlourish ? 2 : 4 }
  if (!into) return { type: Math.random() < 0.6 ? 6 : 5, beats: 1 } // into a flourish: a sharp cut or zoom
  if (A.energy < 0.5) return { type: [1, 3, 4][Math.floor(Math.random() * 3)], beats: 2 }
  const r = Math.random()
  return r < 0.35 ? { type: 6, beats: 1 } : r < 0.6 ? { type: 1, beats: 2 } : r < 0.8 ? { type: 2, beats: 1 } : { type: 4, beats: 2 }
}
const segLen = () => story.shotLen
// Begin a transition into scene i. beats = 0 means "right now, fast" (manual picks).
const beginTransition = (i, type, beats, reason, entry, kf) => {
  if (i < 0) return
  if (trans) finishTransition()
  if (forkState) endFork()
  const to = other(active)
  const how = startScene(to, i, { entry, kf })
  copyPipe(pipes[active], pipes[to])
  const dur = beats > 0 ? beats * period : 380
  trans = { from: active, to, scene: i, type, start: performance.now(), dur, beats, reason }
  if (reason === "seek" || reason === "insert") { /* no caption for scrubs and one-bar inserts */ segBeats = 0; lastCutAt = performance.now(); planned = null; setCurrent(i); if (!story.played.includes(i)) story.played.push(i); return }
  setCurrent(i); history.push(i); if (history.length > 8) history.shift()
  if (!story.played.includes(i)) story.played.push(i)
  segBeats = 0; lastCutAt = performance.now(); planned = null
  const where = how === "snapshot" ? " · restored from a VM snapshot" : how === "bookmark" ? " · from its phase " + (entry + 1) + " bookmark" : how === "memory" ? " · resumed where it left off" : ""
  showCaption(String(i + 1).padStart(2, "0") + " · " + PRESETS[i].name + " · scene by " + byOf(i) + where)
}
const finishTransition = () => {
  if (!trans) return
  const t = trans; trans = null
  parkSlot(t.from)
  active = t.to
  if (t.type === 6) requestFlash(0.28)
}
const cancelTransition = () => {
  if (!trans) return
  worker.postMessage({ type: "stop", slot: trans.to }); slots[trans.to].running = false; slots[trans.to].token = -1
  trans = null
}
const cut = (i) => beginTransition(i, 0, 0, "manual", isFeature(i) ? 0 : null)
// Ask the active feature to move to a phase; it switches on its next frame, landing on the beat.
const cue = (phase) => {
  const st = slots[active]
  if (st.phases <= 1) return false
  st.cue = ((phase % st.phases) + st.phases) % st.phases
  return true
}
const startFork = () => {
  if (forkState || trans || !slots[active].running) return
  const to = other(active), st = slots[to]
  st.token = ++tokenSeq; st.next = null; st.ready = false; st.running = true; st.scene = slots[active].scene; st.t = slots[active].t; st.waitingSince = performance.now()
  st.phase = slots[active].phase; st.phases = slots[active].phases; st.cue = -1
  copyPipe(pipes[active], pipes[to])
  worker.postMessage({ type: "fork", slot: active, to, token: slots[active].token, forkToken: st.token })
  forkState = { slot: to, start: performance.now(), dur: period * 8 }
}
const endFork = () => {
  if (!forkState) return
  worker.postMessage({ type: "stop", slot: forkState.slot }); slots[forkState.slot].running = false; slots[forkState.slot].token = -1
  forkState = null
}
// Beat-repeat: rewind the running scene to its snapshot from one beat ago, on a musical grid.
const startStutter = (times, back, intoCut, force) => {
  // Never rewind across a phase change: the beat snapshots from before it would undo the cue.
  if (REDUCE || stutter || (trans && !intoCut) || !slots[active].running || (!force && A.beats - phaseChangedAt < 3)) return
  const now = performance.now()
  stutter = { slot: active, token: slots[active].token, at: times.map((x) => now + x * period), back }
  worker.postMessage({ type: "hold", slot: active, on: true })
}
const runStutter = (now) => {
  if (!stutter) return
  if (stutter.token !== slots[stutter.slot].token) { stutter = null; return }
  while (stutter.at.length && now >= stutter.at[0]) {
    stutter.at.shift(); stut = 1
    worker.postMessage({ type: "stutter", slot: stutter.slot, token: stutter.token, back: stutter.back })
  }
  if (!stutter.at.length) { worker.postMessage({ type: "hold", slot: stutter.slot, on: false }); stutter = null }
}
// New section: carry one scene over, bring in a new partner, re-read the arc, set the section's colour grade and title word.
const newSection = () => {
  story.section++; story.sectionBeats = 0; story.turn = 0
  if (story.boost > 0) story.boost--
  story.arc = songArc()
  const feats = pool(true)
  const keep = isFeature(current) ? current : story.pair[1] >= 0 && enabled[story.pair[1]] ? story.pair[1] : pickFrom(feats)
  let partner = pickFrom(feats.filter((i) => i !== keep))
  if (partner < 0 || partner === keep) partner = pickFrom(pool(false))
  story.pair = [keep, partner]
  // Some sections are showcases: one scene holds the whole section and walks forward through its phases.
  const keepPhase = keep === current ? slots[active].phase : 0, keepPhases = PRESETS[keep] ? PRESETS[keep].phases || 1 : 1
  story.showcase = story.section > 0 && Math.random() < 0.3 && isFeature(keep) && keep !== story.lastShowcase && keepPhase < keepPhases - 1
  if (story.showcase) story.lastShowcase = keep
  story.hue = (story.hue + 70 + Math.floor(Math.random() * 90)) % 360
  if (story.section > 0 && story.words.length && music !== "none") {
    const w = story.words[(story.section - 1) % story.words.length]
    const fxs = ["flap", "glitch", "neon", "split", "scramble", "rise", "punch", "stack"]
    showCard({ slot: "section", text: w, fx: fxs[story.section % fxs.length], size: 0.12, y: 0.48, h: story.hue, s: 60, l: 82, dur: 2300 })
  }
}
// Shot length follows the energy: 2 bars when it's loud, 4 in the middle, 8 when it's quiet.
const pick = (list) => list[Math.floor(Math.random() * list.length)]
const shotLength = () => (story.showcase ? 16 : A.calm > 0.5 ? 32 : A.energy > 0.6 ? pick([8, 8, 8, 16]) : pick([16, 16, 32]))
// Decide the next shot: the other scene of the pair, a one-bar flourish insert, or (at a section start) the new pair.
const planNext = () => {
  if (story.sectionBeats + story.shotLen >= SECTION || story.section < 0) newSection()
  // A showcase ends once its scene reaches the climax; then the section goes back to intercutting.
  if (story.showcase && (!isFeature(current) || slots[active].phase >= (slots[active].phases || 1) - 1)) story.showcase = false
  if (story.showcase) {
    const n = slots[active].phases || PRESETS[current].phases || 1
    return { kind: "cut", target: current, entry: Math.min(n - 1, Math.max(slots[active].phase + 1, 0)), len: 16, feature: true, ...chooseTransition(true) }
  }
  const insert = !story.insert && isFeature(current) && Math.random() < 0.32 && A.calm < 0.5 && pool(false).some((i) => !isFeature(i))
  if (insert) {
    story.insert = true
    return { kind: "cut", target: pickFrom(pool(false)), entry: null, len: 4, ...chooseTransition(false) }
  }
  story.insert = false
  story.turn++
  let target = story.pair[story.turn % 2]
  if (target === current || target < 0 || !enabled[target]) target = story.pair[(story.turn + 1) % 2]
  if (target === current || target < 0) target = pickFrom(pool(true))
  return { kind: "cut", target, entry: isFeature(target) ? chooseEntry(target) : null, len: shotLength(), feature: true, ...chooseTransition(true) }
}
let snareWindow = []
let directorFrozen = false // set by __trance.freeze(true) for screenshots and tests: the director stops cutting and cueing
const direct = (now) => {
  if (directorFrozen) return
  if (isMapped() && songMap.plan) return directPlan(now)
  // Beat snapshots feed the stutter ring.
  if (A.beat && !trans && !stutter && slots[active].running && !REDUCE) worker.postMessage({ type: "beatsnap", slot: active, token: slots[active].token })
  if (clockBeat) segBeats++
  const st = slots[active]
  if (ended) return
  if (clockBeat) story.sectionBeats++
  // Drops: the whole story jumps to its climax chapter. A feature on screen goes to its last phase (sometimes forking);
  // a flourish smash-cuts into the partner scene's climax.
  if (A.drop) {
    shock = 1; shockR = 0; requestFlash(0.35)
    // Early drops lift the arc one chapter; later ones hit the climax for a section.
    const late = songPos() > 0.3
    if (late) { story.boost = 1; story.arc = 3 } else story.arc = Math.min(3, story.arc + 1)
    if (!auto || drawerOpen()) { if (isFeature(current)) cue(st.phases - 1); return }
    if (isFeature(current) && st.phases > 1) {
      cue(late ? st.phases - 1 : Math.min(st.phases - 1, st.phase + 1)); planned = null
      story.shotLen = Math.min(story.shotLen, segBeats + 8)
      if (late && Math.random() < 0.4) startFork()
    } else {
      const i = story.pair[0] >= 0 && story.pair[0] !== current ? story.pair[0] : chooseNext()
      if (i >= 0) { beginTransition(i, 6, 0.001, "drop", chooseEntry(i)); story.shotLen = 8 }
    }
    return
  }
  // Snare rolls (4+ snares inside one beat) get quarter-beat stutters.
  if (A.snareHit) snareWindow.push(now)
  snareWindow = snareWindow.filter((x) => now - x < period)
  if (snareWindow.length >= 4 && A.energy > 0.4 && A.beats - lastStutterBeat > 16) { lastStutterBeat = A.beats; startStutter([0, 0.25, 0.5], 0); snareWindow = [] }
  if (!clockBeat || drawerOpen() || trans) return
  // Without auto-cycle the current feature still moves through its phases.
  if (!auto) { if (isFeature(current) && A.bar === 0 && segBeats >= SEG) { cue(st.phase + 1); segBeats = 0 } return }
  const L = segLen()
  // Long shots step their scene forward a phase halfway through, if the arc allows.
  if (isFeature(current) && L >= 16 && segBeats === Math.floor(L / 2) && A.bar === 0 && st.phase < Math.min(st.phases - 1, story.arc + 1)) cue(st.phase + 1)
  if (!planned && segBeats >= L - 4) planned = planNext()
  if (planned && planned.kind === "cut") {
    const pos = (4 - (planned.beats % 4)) % 4
    if (A.bar === pos && segBeats >= L - planned.beats) {
      const p = planned
      const intoCut = p.type === 6 && A.beats - lastStutterBeat > 12 && Math.random() < 0.35
      if (p.target === current) {
        // Same scene again: just move it to the arc's chapter.
        if (p.entry != null) cue(p.entry)
        segBeats = 0; planned = null
      } else beginTransition(p.target, p.type, p.beats, p.feature ? "story" : "insert", p.entry)
      story.shotLen = p.len || 16
      if (intoCut) { lastStutterBeat = A.beats; startStutter([0, 0.5, 0.75], 1, true) }
    }
    return
  }
  if (A.bar === 3 && A.phrase % 4 === 1 && A.energy > 0.45 && A.calm < 0.3 && A.beats - lastStutterBeat > 16 && Math.random() < 0.3) {
    lastStutterBeat = A.beats; startStutter([0, 0.5, 0.75], 1)
  }
  if (now - lastCutAt > 70000) { const i = chooseNext(); if (i >= 0) beginTransition(i, 0, 4, "time", chooseEntry(i)) }
}
// Start the story at a song's beginning: auto-cycle on, open on the first feature at chapter I.
const startStory = () => {
  if (!auto) { setAuto(true); toast("Auto-cycle is on: the director is cutting this song.") }
  const first = PRESETS.findIndex((p, i) => p.tier === "feature" && enabled[i])
  const i = first >= 0 ? first : chooseNext()
  story.played = []; story.section = -1; story.sectionBeats = 0; story.arc = 0; story.boost = 0; story.turn = 0; story.insert = false
  story.pair = [i, -1]; story.shotLen = 16
  const title = (trackName || "").trim()
  // Title words for section cards; runs of short words stay together ("GRIMOIRE", "OF THE", "SLOPERATOR").
  story.words = title ? title.toUpperCase().split(/\s+/).reduce((acc, w) => {
    const last = acc[acc.length - 1]
    if (last && w.length <= 3 && last.split(" ").every((x) => x.length <= 3)) acc[acc.length - 1] += " " + w; else acc.push(w)
    return acc
  }, []) : []
  if (isMapped()) { shotIdx = -1; planT = 0; planSynced = true; mc.t = -1; story.section = 0; return }
  if (i >= 0) beginTransition(i, 0, 0, "story", 0)
  newSection()
}
const drawerOpen = () => $("#drawer").classList.contains("open")

// ---------- Present: post-processing driven by what kind of sound is playing ----------
let tintHue = 0, sliceSeed = 0, sliceEnv = 0, lastSliceAt = -1e9
const present = (now, dt) => {
  const st = slots[active], prof = profileFor(st)
  shock = Math.max(0, shock - dt * 1.3); shockR += dt * 0.9
  stut *= Math.exp(-dt * 6); flash *= Math.exp(-dt * 7); rewind *= Math.exp(-dt * 2.6)
  // The slice glitch is an accent, not a texture: at most one per bar, a ~60 ms blip, and only on loud backbeats.
  if (A.snareHit && now - lastSliceAt > period * 3.5 && A.calm < 0.4 && (A.bar === 1 || A.bar === 3) && A.energy > 0.45) { sliceSeed = A.snares; sliceEnv = 1; lastSliceAt = now }
  sliceEnv *= Math.exp(-dt * 16)
  const gradeHue = auto && music !== "none" && story.section >= 0 ? story.hue : A.keyHue
  let dh = gradeHue - tintHue; dh = ((dh + 540) % 360) - 180; tintHue = (tintHue + dh * Math.min(1, dt * 0.8) + 360) % 360
  // Letterbox breathes: wider in breakdowns, snapping open on drops.
  // Builds close the letterbox in on the picture; the drop throws it wide open.
  const barTarget = barBase * (1 + A.calm * 0.35 + A.build * 1.8) * (1 - A.dropAmt * 0.85)
  barNow += (barTarget - barNow) * Math.min(1, dt * 4)
  let mix = 0, ttype = 0
  if (trans) {
    const p = clamp((now - trans.start) / trans.dur, 0, 1)
    const incomingReady = slots[trans.to].ready
    if (trans.type === 6) mix = p >= 1 && incomingReady ? 1 : 0
    else if (trans.type === 2 || trans.type === 1) {
      // Stepped on 16th notes, eased inside each step: transitions that move in time with the music.
      const steps = Math.max(1, Math.round(trans.beats * 4)), k = p * steps
      mix = (Math.floor(k) + smooth01(k - Math.floor(k))) / steps
    } else mix = smooth01(p)
    if (!incomingReady) mix = 0
    ttype = trans.type
    if (p >= 1 && incomingReady) { finishTransition(); mix = 0 }
  }
  const forkAmt = forkState ? clamp(1 - (now - forkState.start) / forkState.dur, 0, 1) : 0
  if (forkState && forkAmt <= 0) endFork()
  const k = REDUCE ? 0 : A.kick * prof.punch * 1.35
  if (!post) {
    vctx.globalAlpha = 1; vctx.drawImage(pipes[active].buf, 0, 0)
    if (trans && mix > 0) { vctx.globalAlpha = mix; vctx.drawImage(pipes[trans.to].buf, 0, 0); vctx.globalAlpha = 1 }
    return
  }
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, post.texs[0])
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pipes[active].buf)
  const second = trans && mix > 0 ? trans.to : forkState && forkAmt > 0 ? forkState.slot : null
  if (second) {
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, post.texs[1])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pipes[second].buf)
  }
  const shakeAmt = REDUCE ? 0 : A.bass * A.energy * 0.008 * prof.shake * (A.kick > 0.5 ? 1 : 0.2) + A.snare * 0.0015 * prof.slice + A.build * A.build * 0.004
  gl.uniform2f(post.R, view.width, view.height)
  gl.uniform2f(post.shake, (Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt)
  gl.uniform1f(post.time, (now % 10000) / 10)
  gl.uniform1f(post.kick, k)
  gl.uniform1f(post.flash, REDUCE ? 0 : Math.min(0.35, flash))
  gl.uniform1f(post.ab, 0.005 + (REDUCE ? 0 : k * 0.02 + stut * 0.02 + A.build * 0.012 + rewind * 0.02))
  gl.uniform1f(post.grain, 0.06 + A.noise * 0.05)
  gl.uniform1f(post.vig, 0.5 + A.bass * 0.15 + A.build * 0.5 + A.calm * 0.15)
  gl.uniform1f(post.bar, barNow)
  gl.uniform1f(post.bloom, (0.6 + A.bright * 1.1) * (0.8 + A.kick * 0.35) * (1 - A.calm * 0.25) + A.dropAmt * 0.9)
  gl.uniform1f(post.slice, REDUCE ? 0 : sliceEnv * Math.min(1, prof.slice))
  gl.uniform1f(post.seed, sliceSeed)
  gl.uniform1f(post.sparkle, REDUCE ? 0 : A.hat * prof.sparkle * 1.5)
  gl.uniform1f(post.tint, clamp((auto && story.section >= 0 ? 0.2 : A.tonal * 0.16) * prof.tint, 0, 0.32))
  gl.uniform1f(post.tintHue, tintHue / 360)
  gl.uniform1f(post.desat, clamp((A.noise - 0.35) * 0.5 + A.calm * 0.18 - A.dropAmt * 0.2, 0, 0.35))
  gl.uniform1f(post.shock, REDUCE ? 0 : shock)
  gl.uniform1f(post.shockR, shockR)
  gl.uniform1f(post.stut, REDUCE ? 0 : stut)
  gl.uniform1f(post.mixv, second && trans ? mix : 0)
  gl.uniform1f(post.ttype, ttype)
  gl.uniform1f(post.fork, second && forkState && !trans ? forkAmt : 0)
  gl.uniform1f(post.build, REDUCE ? 0 : A.build)
  gl.uniform1f(post.rew, REDUCE ? 0 : rewind)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}

// ---------- Main loop ----------
const audioView = () => ({ ...A, bands: A.bands.map((v) => Math.round(v * 1000) / 1000), chroma: A.chroma.map((v) => Math.round(v * 1000) / 1000) })
const tickSlot = (id, now, audio) => {
  const st = slots[id]
  if (!st.running && !st.next) return
  if (st.next) {
    const m = st.next; st.next = null
    const fdt = st.lastFrameAt ? Math.min(0.05, (now - st.lastFrameAt) / 1000) : 1 / 60
    st.lastFrameAt = now
    st.fx = m.fx
    if (m.fx && typeof m.fx.phase === "number" && m.fx.phase !== st.phase) onPhase(id, st, m.fx)
    const prof = profileFor(st)
    render(pipes[id], m.shapes, m.fx, REDUCE ? 0 : (A.kickHit ? 0.08 : 0) + A.kick * 0.045 * prof.punch + (A.drop ? 0.12 : 0))
    st.t += fdt; st.frames++
    if (id === active) {
      if (st.frames > 1) fpsAvg = fpsAvg ? fpsAvg * 0.92 + (1 / Math.max(fdt, 0.001)) * 0.08 : 1 / Math.max(fdt, 0.001)
      vmAvg = vmAvg * 0.9 + m.vm * 0.1
      lastShapes = m.shapes.length
    }
    st.waitingSince = now
    worker.postMessage({ type: "tick", slot: id, token: st.token, view: viewFor(st, st.t, fdt, audio) })
  } else if (st.running && st.waitingSince && now - st.waitingSince > 3000) {
    st.running = false
    if (id === active || (trans && trans.to === id)) {
      spawn(); slots.a.running = slots.b.running = false; trans = null; forkState = null; stutter = null
      showError("The script ran for 3 seconds without calling frame(), so the engine was restarted. Every loop needs an await frame(...).")
    }
  }
}
let lastShapes = 0
const viewFor = (st, t, dt, audio) => ({ t, dt, frame: st.frames, w: W, h: H - 2 * barPx, cx: W / 2, cy: (H - 2 * barPx) / 2, mx, my: my - barPx, down, audio, entry: st.entry, cue: st.cue })
// A scene reported a new phase: clear the cue it answered, bookmark it, and show a chapter card.
const onPhase = (id, st, fx) => {
  const first = st.phase < 0
  st.phase = fx.phase; st.phases = Math.max(1, Math.min(12, num(fx.phases, st.phases)))
  if (id === active) phaseChangedAt = A.beats
  if (st.cue === st.phase) st.cue = -1
  st.title = typeof fx.title === "string" ? fx.title.slice(0, 60) : ""
  const visible = id === active || (trans && trans.to === id)
  if (!visible || st.scene < 0) return
  const key = ++tokenSeq
  bookKeys.set(key, { scene: st.scene, phase: st.phase, t: st.t, code: codes[st.scene] })
  worker.postMessage({ type: "bookmark", slot: id, token: st.token, key })
  const nowMs = performance.now()
  if (st.title && (st.title !== lastCardTitle || nowMs - lastCardAt > 12000) && nowMs - lastCardAt > 3500) lastCardAt = nowMs, lastCardTitle = st.title, showCard({ slot: "chapter", text: st.title, fx: typeof fx.titleFx === "string" ? fx.titleFx : "rise", font: "display", size: 0.06, x: 0.06, y: 0.9, align: "left", h: num(fx.titleHue, 35), dur: 3400 })
  if (!first) { shock = Math.max(shock, 0.5); shockR = 0 }
}
const loop = (now) => {
  requestAnimationFrame(loop)
  const dt = lastLoop ? Math.min(0.1, (now - lastLoop) / 1000) : 1 / 60
  lastLoop = now
  if (paused) { if (!(scrubFrames > 0 && isMapped())) return; scrubFrames-- }
  analyse(now, dt)
  direct(now)
  runStutter(now)
  const audio = audioView()
  tickSlot(active, now, audio)
  if (trans) tickSlot(trans.to, now, audio)
  else if (forkState) tickSlot(forkState.slot, now, audio)
  present(now, dt)
  drawCards(now)
  updateHud(now)
}
requestAnimationFrame(loop)

const hudEls = { k: $("#d-k"), s: $("#d-s"), h: $("#d-h"), beats: $("#d-beats"), bpm: $("#d-bpm"), key: $("#d-key") }
const updateHud = (now) => {
  hudEls.k.style.opacity = 0.2 + A.kick * 0.8
  hudEls.s.style.opacity = 0.2 + A.snare * 0.8
  hudEls.h.style.opacity = 0.2 + A.hat * 0.8
  if (now - hudAt < 250) return
  hudAt = now
  $("#fps").textContent = Math.round(fpsAvg); $("#vm").textContent = vmAvg.toFixed(1); $("#count").textContent = lastShapes
  hudEls.beats.textContent = "●○○○".split("").map((_, i) => (i === A.bar ? "●" : "○")).join("")
  hudEls.bpm.textContent = A.beatConf > 0.22 ? A.bpm + " BPM" : "– BPM"
  hudEls.key.textContent = (music === "none" ? "" : "key " + NOTE_NAMES[A.key])
  if (music === "file") { $("#track-meta").textContent = fmt(audioEl.currentTime) + " / " + fmt(audioEl.duration); if (document.activeElement !== $("#seek")) $("#seek").value = audioEl.currentTime }
  else if (music === "demo") $("#track-meta").textContent = demo.info()
  else $("#track-meta").textContent = "Silent · 118 BPM pulse"
}

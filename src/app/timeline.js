// ---------- Song maps: the song's structure laid on its timeline ----------
// A map (from mapper.js) holds the beat grid, bars, kick/snare/hat hits, sections and drops of a song. With one,
// analysis reads the music from the map at the playback position, and the director follows a whole-song edit
// planned in advance, so every transition lands on a downbeat, a section start or a drop, and seeking moves the
// picture with the song: scenes are restored from Psychoscript snapshots taken the first time through.
const BUNDLED_MAPS = /*MAPS*/ {}
const TRACKS = [
  { url: "song.mp3", title: "Grimoire of the Sloperator", note: "101 BPM · dense and loud, lifts instead of breakdowns" },
  { url: "slow-burn.mp3", title: "Slow Burn", note: "84 BPM half-time · long breakdown, two drops" },
  { url: "breakneck.mp3", title: "Breakneck", note: "172 BPM drum & bass · long builds" },
]
let songMap = null, mapKey = ""
const isMapped = () => !!songMap && music === "file" && songMap.key === mapKey
const lowerIdx = (arr, t) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= t) lo = m + 1; else hi = m } return lo }

// Derived tables: which bar each beat is in and where in the bar it falls, section by bar, build ramps.
const prepMap = (M, key) => {
  const beats = M.beats, downs = M.downbeats
  const downBeat = downs.map((d) => { const k = lowerIdx(beats, d + 0.03) - 1; return Math.max(0, k) })
  const beatBar = new Int32Array(beats.length), beatPos = new Int8Array(beats.length)
  let d = 0
  for (let i = 0; i < beats.length; i++) {
    while (d + 1 < downBeat.length && downBeat[d + 1] <= i) d++
    beatBar[i] = beats[i] + 0.03 < downs[0] ? -1 : d
    beatPos[i] = ((((i - (downBeat[d] || 0)) % 4) + 4) % 4)
  }
  const secs = M.sections.map((s) => ({ ...s }))
  if (secs.length) { secs[0].start = 0; secs[secs.length - 1].end = Math.max(secs[secs.length - 1].end, M.duration) }
  const secBar = secs.map((s) => Math.max(0, lowerIdx(downs, s.start + 0.05) - 1))
  const ramps = M.drops.map((dt) => {
    const b = secs.find((s) => s.kind === "build" && Math.abs(s.end - dt) < 0.6)
    return [b ? b.start : Math.max(0, dt - M.period * 8), dt]
  })
  return { key, M, beatBar, beatPos, secs, secBar, ramps, plan: null }
}

// ---------- Reading the map at the playback position ----------
const MAP_LEAD = 0.02 // the picture is about a frame behind the sound
const mc = { t: -1, prevT: -1, bi: -1, ki: 0, si: 0, hi: 0, from: 0 }
const mapClock = (now, dt) => {
  const S = songMap, M = S.M, on = M.onsets
  const t = (audioEl.currentTime || 0) + MAP_LEAD
  mc.prevT = mc.t
  if (mc.t < 0 || t < mc.t - 0.08 || t > mc.t + 0.6) {
    // A seek (or the first frame): jump every cursor, fire nothing.
    A.seeked = true; mc.from = mc.t
    mc.ki = lowerIdx(on.kick, t); mc.si = lowerIdx(on.snare, t); mc.hi = lowerIdx(on.hat, t); mc.bi = lowerIdx(M.beats, t) - 1
  } else {
    while (mc.ki < on.kick.length && on.kick[mc.ki] <= t) { mc.ki++; A.kickHit = true }
    while (mc.si < on.snare.length && on.snare[mc.si] <= t) { mc.si++; A.snareHit = true }
    while (mc.hi < on.hat.length && on.hat[mc.hi] <= t) { mc.hi++; A.hatHit = true }
    while (mc.bi + 1 < M.beats.length && M.beats[mc.bi + 1] <= t) {
      mc.bi++; A.beat = true; clockBeat = true; A.beats++
      if (S.beatPos[mc.bi] === 0) { A.downbeat = true; barNo++ }
    }
  }
  mc.t = t
  const bi = mc.bi, b0 = bi >= 0 ? M.beats[bi] : 0, b1 = bi + 1 < M.beats.length ? M.beats[bi + 1] : b0 + M.period
  period = clamp((b1 - b0) * 1000, 250, 1500)
  A.phase = bi >= 0 ? clamp((t - b0) / Math.max(0.05, b1 - b0), 0, 1) : 0
  A.anticip = clamp((A.phase - 0.75) / 0.25, 0, 1)
  A.bar = bi >= 0 ? S.beatPos[bi] : 0
  A.barPhase = (A.bar + A.phase) / 4
  const bar = bi >= 0 ? Math.max(0, S.beatBar[bi]) : 0
  const si = Math.max(0, lowerIdx(S.secs.map((s) => s.start), t) - 1)
  A.bars = bar; A.phrase = (((bar - (S.secBar[si] || 0)) % 8) + 8) % 8
  if (A.downbeat && A.phrase === 0) A.phraseStart = true
  A.bpm = Math.round(M.bpm); A.beatConf = 1
  // Keep the live clock in step, so it carries on smoothly if the map is dropped.
  lastBeatT = now - A.phase * period; nextBeatT = lastBeatT + period; conf = 0.6
}
const CALM_OF = { intro: 0.7, verse: 0.15, build: 0.2, drop: 0, main: 0, breakdown: 1, outro: 0.85 }
const mapSections = (now, dt) => {
  const S = songMap, M = S.M, t = mc.t
  const si = Math.max(0, lowerIdx(S.secs.map((s) => s.start), t) - 1), sec = S.secs[si]
  A.section = sec ? sec.kind : ""
  A.sectionPos = sec ? clamp((t - sec.start) / Math.max(0.1, sec.end - sec.start), 0, 1) : 0
  A.songPos = clamp(t / M.duration, 0, 1)
  let build = 0
  for (const [a, b] of S.ramps) if (t >= a && t < b) build = Math.max(build, Math.pow((t - a) / Math.max(0.1, b - a), 1.6))
  A.build = REDUCE ? build * 0.4 : build
  const nd = M.drops.find((d) => d > t)
  A.toDrop = nd != null ? nd - t : 99
  if (!A.seeked && mc.prevT >= 0) for (const d of M.drops) if (d > mc.prevT && d <= t) A.drop = true
  if (A.drop) A.dropAmt = 1; else A.dropAmt *= Math.exp(-dt * 1.2)
  let calm = sec ? CALM_OF[sec.kind] ?? 0.2 : 0.2
  if (sec && sec.kind === "build") calm *= 1 - build
  A.calm += (calm - A.calm) * Math.min(1, dt * (A.seeked ? 30 : 2))
}

// ---------- Planning the edit ----------
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
// Which chapter a section plays, on a 4-phase scale (scaled to each scene's own phase count).
const PHASE_OF = { intro: 0, verse: 1, build: 2, drop: 3, main: 2, breakdown: 1, outro: 0 }
const SEC_HUE = { intro: 210, verse: 170, build: 38, drop: 330, main: 275, breakdown: 200, outro: 230 }
const buildPlan = (S, seed) => {
  const M = S.M, rnd = mulberry(seed), downs = M.downbeats, per = M.period
  const pickR = (arr) => arr[Math.floor(rnd() * arr.length)]
  const rot = rotation()
  let feats = rot.filter(isFeature)
  const flours = rot.filter((i) => !isFeature(i))
  if (!feats.length) feats = rot.length ? rot : [0]
  // Spread the scenes out: pick among the least-used candidates, never one used in the last two picks of its kind.
  const used = new Map(), recent = { f: [], l: [] }
  const choose = (list, avoid) => {
    const r = recent[isFeature(list[0]) ? "f" : "l"]
    let o = list.filter((i) => !avoid.includes(i) && !r.slice(-2).includes(i))
    if (!o.length) o = list.filter((i) => !avoid.includes(i))
    if (!o.length) o = list
    const least = Math.min(...o.map((i) => used.get(i) || 0))
    const i = pickR(o.filter((x) => (used.get(x) || 0) === least))
    used.set(i, (used.get(i) || 0) + 1); r.push(i); return i
  }
  const barT = (b) => (b < downs.length ? downs[b] : M.duration)
  const barAt = (t) => Math.max(0, lowerIdx(downs, t + 0.05) - 1)
  const entryFor = (i, kind, pos) => {
    const n = PRESETS[i] ? PRESETS[i].phases || 1 : 1
    if (!isFeature(i) || n <= 1) return null
    let p = PHASE_OF[kind] ?? 1
    if (kind === "verse" && pos > 0.5) p = 2
    if (kind === "main" && pos > 0.6) p = 3
    return Math.round((p / 3) * (n - 1))
  }
  // Shot lengths in bars. Builds accelerate (… 4, 2, 1, 1) into the drop; calm sections hold long shots.
  const pattern = (kind, n) => {
    if (kind === "build") {
      const rev = [], seq = [1, 1, 2, 4]; let left = n, k = 0
      while (left > 0) { const L = Math.min(left, seq[k] || 4); rev.push(L); left -= L; k++ }
      return rev.reverse()
    }
    const chunk = kind === "intro" || kind === "outro" ? 8 : kind === "main" && rnd() < 0.5 ? 2 : 4
    const out = []; let left = n
    while (left > 0) {
      let L = Math.min(left, chunk); if (left - L === 1) L = left
      if (L === 4 && (kind === "verse" || kind === "main" || kind === "drop") && flours.length && rnd() < 0.3) out.push(3, 1)
      else out.push(L)
      left -= L
    }
    return out
  }
  const T = (type, beats, lead) => ({ type, beats, lead: lead * per })
  const transFor = (kind, first, insert, afterInsert) => {
    if (first) {
      if (kind === "drop") return T(6, 0, 0) // smash cut on the drop
      if (kind === "breakdown" || kind === "outro") return T(0, 4, 0) // slow dissolve into the calm
      if (kind === "intro") return T(4, 4, 0)
      if (kind === "build") return T(pickR([1, 5]), 2, 2) // lands on the build's first downbeat
      return T(pickR([1, 2, 3, 4]), 2, 2)
    }
    if (insert || afterInsert) return rnd() < 0.7 ? T(6, 0, 0) : T(5, 1, 1)
    if (kind === "drop" || kind === "main") { const r = rnd(); return r < 0.55 ? T(6, 0, 0) : r < 0.8 ? T(2, 1, 1) : T(5, 1, 1) }
    if (kind === "build") return rnd() < 0.6 ? T(6, 0, 0) : T(5, 1, 1)
    if (kind === "breakdown" || kind === "intro" || kind === "outro") return T(0, 4, 0)
    return rnd() < 0.3 ? T(6, 0, 0) : T(pickR([1, 3, 4]), 2, 2)
  }
  const shots = [], events = [], secHue = []
  let carry = feats[0], hue = 30
  S.secs.forEach((sec, si) => {
    hue = (SEC_HUE[sec.kind] + Math.floor(rnd() * 60) - 30 + 360) % 360; secHue.push(hue)
    const a = si === 0 ? 0 : barAt(sec.start), z = si + 1 < S.secs.length ? barAt(S.secs[si + 1].start) : downs.length
    const n = z - a
    if (n <= 0) return
    const kind = sec.kind, pos = sec.start / M.duration
    const partner = feats.length > 1 ? choose(feats, [carry]) : carry
    // Drops open on the scene the build was showing, now at its climax; other sections open on the new partner.
    // Drops open on the scene carried over (now at its climax) unless it is already on screen: a drop is always a cut.
    const onScreen = shots.length ? shots[shots.length - 1].scene : -1
    const pair = kind === "drop" && carry !== onScreen ? [carry, partner] : [partner, carry]
    let b = a, turn = 0, prevInsert = false
    pattern(kind, n).forEach((len, li) => {
      const insert = len === 1 && flours.length > 0
      const scene = insert ? choose(flours, []) : pair[turn++ % 2]
      const t0 = si === 0 && li === 0 ? 0 : barT(b)
      shots.push({ t0, t1: barT(b + len), b0: b, bars: len, scene, entry: entryFor(scene, kind, pos), kind, sec: si, insert,
        first: li === 0, cues: [], ...transFor(kind, li === 0, insert, prevInsert) })
      prevInsert = insert; b += len
    })
    carry = partner // the newer scene carries into the next section, so the pairs chain: A+B, B+C, C+D…
    events.push({ t: si === 0 ? 0 : sec.start, type: "section", si, kind })
    const next = S.secs[si + 1]
    // The last beat before a drop repeats as a roll (a beat-repeat of the VM), then the drop smash-cuts in.
    if (kind === "build" && next && next.kind === "drop") events.push({ t: next.start - per, type: "stutter" })
    if (kind === "drop" && pos > 0.4 && n >= 4 && rnd() < 0.6) events.push({ t: barT(a + 2), type: "fork" })
  })
  // Back-to-back shots of the same scene become one shot that cues its next phase at the join.
  for (let k = shots.length - 1; k > 0; k--) {
    const p = shots[k - 1], q = shots[k]
    if (p.scene !== q.scene || (q.first && q.kind === "drop")) continue
    p.t1 = q.t1; p.bars += q.bars
    if (q.entry != null && q.entry !== p.entry) p.cues.push({ t: q.t0, phase: q.entry })
    p.cues.push(...q.cues); shots.splice(k, 1)
  }
  // Long shots step their scene forward a phase halfway through.
  for (const sh of shots) {
    if (sh.bars < 8 || sh.entry == null || sh.kind === "outro") continue
    const n = PRESETS[sh.scene].phases || 1, last = sh.cues.length ? sh.cues[sh.cues.length - 1].phase : sh.entry
    if (last < n - 1) sh.cues.push({ t: barT(sh.b0 + Math.floor(sh.bars / 2)), phase: last + 1 })
    sh.cues.sort((x, y) => x.t - y.t)
  }
  events.sort((x, y) => x.t - y.t)
  return { shots, events, secHue, seed }
}

// ---------- Following the plan ----------
let shotIdx = -1, planT = 0, rewind = 0, planSynced = true
const kfs = new Map(), kfKeys = new Map() // keyframes: shot index -> [{ songT, sceneT, phase, bytes, code }]
let kfBytes = 0
const shotAt = (t) => { const sh = songMap.plan.shots; let k = 0; while (k + 1 < sh.length && sh[k + 1].t0 <= t) k++; return k }
const expectedPhase = (sh, t) => { let p = sh.entry; for (const c of sh.cues) if (c.t <= t + 0.01) p = c.phase; return p }
const keyAt = (k, t) => {
  const sh = songMap.plan.shots[k]
  let best = null
  for (const x of kfs.get(k) || []) if (x.songT <= t + 0.05 && x.code === codes[sh.scene]) best = x
  return best ? { ...best, n: Math.round(clamp(t - best.songT, 0, 10) * 30) } : null
}
const onKeyframe = (m) => {
  const kk = kfKeys.get(m.key); kfKeys.delete(m.key)
  if (!kk || !songMap || kk.plan !== songMap.plan) return
  const list = kfs.get(kk.shot) || []
  if (list.some((x) => Math.abs(x.songT - kk.songT) < 0.5)) return
  list.push({ songT: kk.songT, sceneT: kk.sceneT, phase: kk.phase, code: kk.code, bytes: m.bytes })
  list.sort((x, y) => x.songT - y.songT); kfs.set(kk.shot, list)
  kfBytes += m.bytes.byteLength
  // Keep the snapshot store under ~96 MB: drop the keyframes farthest from where we are.
  while (kfBytes > 96e6 && kfs.size > 1) {
    let far = -1, fd = -1
    for (const k of kfs.keys()) if (Math.abs(k - shotIdx) > fd) { fd = Math.abs(k - shotIdx); far = k }
    for (const x of kfs.get(far)) kfBytes -= x.bytes.byteLength
    kfs.delete(far)
  }
}
// Snapshot the scene of the current shot as it starts and on every second downbeat.
const keyframeTick = (t) => {
  const sh = songMap.plan.shots[shotIdx]
  const id = trans ? trans.to : active, st = slots[id]
  if (!sh || !st.running || st.frames < 3 || st.scene !== sh.scene || stutter || t < sh.t0) return
  const list = kfs.get(shotIdx) || []
  if (list.length && !(A.downbeat && A.bars % 2 === 0)) return
  if (list.some((x) => Math.abs(x.songT - t) < 0.6)) return
  for (const v of kfKeys.values()) if (v.shot === shotIdx && Math.abs(v.songT - t) < 0.6) return
  const key = ++tokenSeq
  kfKeys.set(key, { shot: shotIdx, songT: t, sceneT: st.t, phase: st.phase, code: codes[st.scene], plan: songMap.plan })
  worker.postMessage({ type: "bookmark", slot: id, token: st.token, key })
}
const enterShot = (k, t) => {
  const sh = songMap.plan.shots[k]; shotIdx = k
  const phase = expectedPhase(sh, Math.max(t, sh.t0))
  if (sh.scene === current && slots[active].running && !trans) { if (phase != null) cue(phase); return }
  // Replays of a shot start from the snapshot taken at its start the first time through, so they play back the same.
  const kf = keyAt(k, sh.t0 + 0.6)
  if (kf) kf.n = 0
  beginTransition(sh.scene, sh.type, sh.type === 6 ? 0.001 : sh.beats, sh.insert ? "insert" : "plan", phase, kf)
}
// Seeking: jump straight to the shot playing at t, restore its scene from the nearest snapshot at or before t,
// and let the VM run ahead (without drawing) to the exact position.
const seekTo = (t, visible) => {
  const plan = songMap.plan
  if (!plan || !plan.shots.length) return
  const k = shotAt(t), sh = plan.shots[k]
  cancelTransition(); endFork()
  if (stutter) { worker.postMessage({ type: "hold", slot: stutter.slot, on: false }); stutter = null }
  shotIdx = k
  const phase = expectedPhase(sh, t), kf = keyAt(k, t)
  const si = sh.sec; story.hue = plan.secHue[si] ?? story.hue
  if (!visible) { beginTransition(sh.scene, 0, 0, "plan", phase, kf); return }
  beginTransition(sh.scene, 6, 0.001, "seek", phase, kf)
  if (!REDUCE) rewind = 1
  const back = mc.from >= 0 && t < mc.from
  showTag((back ? "⟲ rewound to " : "⟳ jumped to ") + fmt(t) + (kf ? " · scene restored from a VM snapshot" : phase != null ? " · scene starts at phase " + (phase + 1) : ""))
}
const fireEvent = (ev) => {
  const plan = songMap.plan
  if (ev.type === "section") {
    story.hue = plan.secHue[ev.si] ?? story.hue; story.section = ev.si
    if (ev.si > 0 && ev.kind !== "outro" && ev.kind !== "build" && story.words.length) {
      const w = story.words[(ev.si - 1) % story.words.length]
      const fxs = ev.kind === "drop" ? ["punch", "split", "glitch"] : ["flap", "neon", "scramble", "rise", "stack"]
      showCard({ slot: "section", text: w, fx: fxs[ev.si % fxs.length], size: ev.kind === "drop" ? 0.16 : 0.12, y: 0.48, h: story.hue, s: 60, l: 82, dur: ev.kind === "drop" ? 1600 : 2300 })
    }
  } else if (ev.type === "stutter") startStutter([0, 0.25, 0.5, 0.75], 0, true, true)
  else if (ev.type === "fork") startFork()
}
const directPlan = (now) => {
  const plan = songMap.plan, t = mc.t
  if (A.beat && !trans && !stutter && slots[active].running && !REDUCE) worker.postMessage({ type: "beatsnap", slot: active, token: slots[active].token })
  if (!auto || drawerOpen()) { planSynced = false; planT = t; if (A.drop) { shock = 1; shockR = 0; requestFlash(0.4) } return }
  if (shotIdx < 0 || A.seeked || !planSynced) { seekTo(t, shotIdx >= 0 && planSynced); planSynced = true; planT = t; return }
  if (ended) return
  if (A.drop) { shock = 1; shockR = 0; requestFlash(0.45) }
  for (const ev of plan.events) if (ev.t > planT && ev.t <= t) fireEvent(ev)
  const sh = plan.shots[shotIdx]
  for (const c of sh.cues) if (c.t > planT && c.t <= t && current === sh.scene) cue(c.phase)
  const nx = plan.shots[shotIdx + 1]
  if (nx && t >= nx.t0 - nx.lead) enterShot(shotIdx + 1, t)
  keyframeTick(t)
  planT = t
}

// ---------- Adopting a map ----------
const replan = () => {
  if (!songMap) return
  songMap.plan = buildPlan(songMap, songMap.seed)
  kfs.clear(); kfKeys.clear(); kfBytes = 0
  drawTimeline()
  if (isMapped()) { shotIdx = -1; planSynced = false }
}
const adoptMap = (M, key, title) => {
  let seed = 7; for (const ch of title || key) seed = (seed * 31 + ch.charCodeAt(0)) | 0
  songMap = prepMap(M, key); songMap.seed = seed
  mc.t = -1; shotIdx = -1; planT = 0; planSynced = true
  songMap.plan = buildPlan(songMap, seed)
  kfs.clear(); kfKeys.clear(); kfBytes = 0
  drawTimeline()
}
const dropMap = () => { songMap = null; mapKey = ""; drawTimeline() }

// Mapping a song the viewer brought: decode it, mix to mono, and run the mapper in its own worker.
let mapperWorker = null, mapJob = 0
const mapperURL = () => URL.createObjectURL(new Blob([
  "const mapSong = " + mapSong.toString() + "\n" +
  "onmessage = (e) => { try { const m = mapSong(e.data.pcm, e.data.rate); postMessage({ id: e.data.id, ok: true, map: { duration: m.duration, bpm: m.bpm, period: m.period, beats: m.beats, downbeats: m.downbeats, onsets: m.onsets, sections: m.sections, drops: m.drops } }) } catch (err) { postMessage({ id: e.data.id, ok: false, message: String(err && err.message || err) }) } }",
], { type: "text/javascript" }))
const mapAudio = async (arrayBuffer, key, title) => {
  const job = ++mapJob
  try {
    const buf = await ac.decodeAudioData(arrayBuffer)
    if (job !== mapJob) return
    const n = buf.length, pcm = new Float32Array(n)
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) pcm[i] += d[i] / buf.numberOfChannels }
    if (!mapperWorker) mapperWorker = new Worker(mapperURL())
    const res = await new Promise((resolve) => {
      mapperWorker.onmessage = (e) => { if (e.data.id === job) resolve(e.data) }
      mapperWorker.postMessage({ id: job, pcm, rate: buf.sampleRate }, [pcm.buffer])
    })
    if (job !== mapJob || mapKey !== key) return
    if (!res.ok) return toast("Couldn't map this song (" + res.message + "). The director will follow it live.", true)
    adoptMap(res.map, key, title)
    const drops = res.map.drops.length, secs = res.map.sections.length
    toast("Mapped " + Math.round(res.map.bpm) + " BPM · " + secs + " sections · " + drops + (drops === 1 ? " drop" : " drops") + ". The edit now follows the song.")
  } catch (err) {
    if (job === mapJob) toast("Couldn't read this song's structure, so the director follows it live.", true)
  }
}

// ---------- Timeline strip: shots, sections and drops above the seek bar ----------
const SEC_COLOR = { intro: "#5d6b88", verse: "#2bb3a3", build: "#f0a53a", drop: "#ff3d8b", main: "#9b6cff", breakdown: "#3d8bff", outro: "#5d6b88" }
const drawTimeline = () => {
  const tl = $("#tl"), secsEl = $("#tl-secs"), shotsEl = $("#tl-shots"), dropsEl = $("#tl-drops")
  secsEl.innerHTML = ""; shotsEl.innerHTML = ""; dropsEl.innerHTML = ""
  tl.classList.toggle("mapped", !!(songMap && songMap.plan))
  if (!songMap || !songMap.plan) return
  const D = songMap.M.duration, pct = (t) => (100 * t / D).toFixed(3) + "%"
  for (const s of songMap.secs) {
    const el = document.createElement("i")
    el.style.left = pct(s.start); el.style.width = pct(s.end - s.start)
    el.style.background = s.kind === "build" ? "linear-gradient(90deg,transparent," + SEC_COLOR.build + ")" : SEC_COLOR[s.kind] || "#666"
    el.title = s.kind + " · " + fmt(s.start) + "–" + fmt(s.end)
    secsEl.appendChild(el)
  }
  for (const sh of songMap.plan.shots) {
    const el = document.createElement("i"), hue = (sh.scene * 137.5) % 360
    el.style.left = pct(sh.t0); el.style.width = pct(sh.t1 - sh.t0)
    el.style.background = "hsl(" + hue + " " + (isFeature(sh.scene) ? "62% 52%" : "80% 72%") + ")"
    if (sh.insert) el.className = "ins"
    el.title = fmt(sh.t0) + " · " + PRESETS[sh.scene].name + (sh.entry != null ? " · phase " + (sh.entry + 1) : "") + " · " + sh.kind
    shotsEl.appendChild(el)
  }
  for (const d of songMap.M.drops) { const el = document.createElement("b"); el.style.left = pct(d); el.title = "drop · " + fmt(d); dropsEl.appendChild(el) }
}

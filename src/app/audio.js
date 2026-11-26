// ---------- Audio graph: demo synth or a song file -> tap -> analysers -> speakers ----------
let ac = null, analyser = null, tap = null, lowAn = null, lowBuf = null, specAn = null, spec = null, prevMag = null
let freq = null, wave = null, demo = null, elSource = null, binHz = 21.5
const audioEl = new Audio(); audioEl.preload = "auto"; audioEl.crossOrigin = "anonymous"
let music = "none", musicPlaying = false, trackName = ""
let pcOfBin = null, chromaLo = 0, chromaHi = 0
const ensureAC = () => {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return false
    ac = new AC()
    tap = ac.createGain()
    // Smoothed analyser for the spectrum bands scenes draw with.
    analyser = ac.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.35
    tap.connect(analyser); analyser.connect(ac.destination)
    freq = new Uint8Array(analyser.frequencyBinCount); wave = new Uint8Array(analyser.fftSize)
    // Unsmoothed analyser for onsets (spectral flux), brightness, noisiness and chroma.
    specAn = ac.createAnalyser(); specAn.fftSize = 2048; specAn.smoothingTimeConstant = 0
    spec = new Float32Array(specAn.frequencyBinCount); prevMag = new Float32Array(specAn.frequencyBinCount)
    binHz = ac.sampleRate / specAn.fftSize
    // Pitch class of each bin from C2 to C7, for chroma.
    pcOfBin = new Int8Array(specAn.frequencyBinCount).fill(-1)
    chromaLo = Math.ceil(65 / binHz); chromaHi = Math.min(spec.length - 1, Math.floor(2100 / binHz))
    for (let k = chromaLo; k <= chromaHi; k++) pcOfBin[k] = ((Math.round(12 * Math.log2((k * binHz) / 440) + 69) % 12) + 12) % 12
    // Kick detector: two low-pass stages leave mostly the kick drum, read as short time-domain windows.
    const lp1 = ac.createBiquadFilter(), lp2 = ac.createBiquadFilter()
    for (const f of [lp1, lp2]) { f.type = "lowpass"; f.frequency.value = 110; f.Q.value = 0.7 }
    lowAn = ac.createAnalyser(); lowAn.fftSize = 512; lowBuf = new Float32Array(lowAn.fftSize)
    const mute = ac.createGain(); mute.gain.value = 0
    tap.connect(specAn); specAn.connect(mute)
    tap.connect(lp1); lp1.connect(lp2); lp2.connect(lowAn); lowAn.connect(mute); mute.connect(ac.destination)
    setInterval(sampleOnsets, 8)
  }
  if (ac.state === "suspended") ac.resume().catch(() => {})
  return true
}

/*DEMO*/

const setPlayLabel = () => { $("#play").firstChild.textContent = (music === "none" ? !paused : musicPlaying) ? "Pause" : "Play" }
// The bundled tracks ship with the page, each with a precomputed song map (timeline.js).
const SONG = { url: "song.mp3", title: "Grimoire of the Sloperator" }
const introCard = (title) => {
  showCard({ slot: "title", text: title, fx: "scramble", size: 0.085, y: 0.42, h: 28, dur: 6500, sub: "a Trance Engine music video · scenes running in Psychoscript", subFx: "type" })
}
const setSeekShown = (on) => { $("#tl").hidden = !on }
let trackIdx = 0, loadedTrack = ""
const playTrack = (idx) => {
  if (!ensureAC()) return toast("This browser has no Web Audio, so the song can't be analysed.", true)
  const tr = TRACKS[idx] || TRACKS[0]; trackIdx = TRACKS.indexOf(tr)
  if (demo) demo.stop()
  // The offline build carries the songs inside the page as data URLs.
  const src = (typeof OFFLINE_AUDIO !== "undefined" && OFFLINE_AUDIO[tr.url]) || tr.url
  if (loadedTrack !== tr.url) { audioEl.src = src; loadedTrack = tr.url }
  audioEl.currentTime = 0
  if (!elSource) { elSource = ac.createMediaElementSource(audioEl); elSource.connect(tap) }
  music = "file"; trackName = tr.title; ended = false
  $("#track-name").textContent = trackName; setSeekShown(true)
  if ($("#tracks")) $("#tracks").value = String(trackIdx)
  mapKey = tr.url
  const M = BUNDLED_MAPS[tr.url]
  if (M) adoptMap(M, tr.url, tr.title); else { dropMap(); mapKey = tr.url; fetch(tr.url).then((r) => r.arrayBuffer()).then((b) => mapAudio(b, tr.url, tr.title)).catch(() => {}) }
  resetClock()
  audioEl.play().then(() => { musicPlaying = true; setPaused(false); setPlayLabel(); introCard(tr.title); startStory() },
    () => { musicPlaying = false; setPlayLabel(); toast("The browser blocked playback. Press Play to start the song.", true) })
}
const playSong = () => playTrack(0)
let ended = false
const playDemo = () => {
  if (!ensureAC()) return toast("This browser has no Web Audio, so the demo can't play.", true)
  audioEl.pause()
  if (!demo) demo = makeDemo(ac, tap)
  demo.start(); music = "demo"; musicPlaying = true; setPaused(false); ended = false
  trackName = "Sealed VM"; setSeekShown(false); dropMap()
  $("#track-name").textContent = "Demo track · Sealed VM"
  introCard("Sealed VM"); startStory()
  setPlayLabel()
}
const playFile = (file) => {
  if (!file) return
  if (!/^audio\//.test(file.type) && !/\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|webm)$/i.test(file.name)) return toast("That file isn't audio. Try an MP3, M4A, WAV, OGG or FLAC.", true)
  if (!ensureAC()) return toast("This browser has no Web Audio, so songs can't be analysed.", true)
  if (demo) demo.stop()
  if (audioEl.src) URL.revokeObjectURL(audioEl.src)
  audioEl.src = URL.createObjectURL(file); loadedTrack = ""
  if (!elSource) { elSource = ac.createMediaElementSource(audioEl); elSource.connect(tap) }
  music = "file"; trackName = file.name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim() || "Untitled"
  $("#track-name").textContent = trackName; setSeekShown(true)
  // Map the song in the background: until the map is ready the director follows it live, then switches to the plan.
  dropMap(); mapKey = audioEl.src
  file.arrayBuffer().then((b) => mapAudio(b, audioEl.src, trackName)).catch(() => {})
  resetClock()
  ended = false
  audioEl.play().then(() => { musicPlaying = true; setPaused(false); setPlayLabel(); introCard(trackName); startStory() },
    () => { musicPlaying = false; setPlayLabel(); toast("The browser blocked playback. Press Play to start the song.", true) })
}
audioEl.addEventListener("loadedmetadata", () => { $("#seek").max = audioEl.duration || 1 })
// End card: the title, then the scenes that played, like closing credits.
audioEl.addEventListener("ended", () => {
  musicPlaying = false; ended = true; setPlayLabel()
  const names = story.played.filter((i) => PRESETS[i].tier === "feature").slice(0, 6).map((i) => PRESETS[i].name)
  showCard({ slot: "title", text: "fin", fx: "split", size: 0.18, y: 0.34, h: 28, dur: 14000, sub: trackName, subFx: "type" })
  if (names.length) showCard({ slot: "credits1", text: "featuring " + names.slice(0, 3).join(" · "), fx: "rise", font: "mono", size: 0.028, y: 0.64, h: 30, s: 30, l: 82, dur: 13000 })
  if (names.length > 3) showCard({ slot: "credits2", text: names.slice(3).join(" · "), fx: "rise", font: "mono", size: 0.028, y: 0.7, h: 30, s: 30, l: 82, dur: 13000 })
})
audioEl.addEventListener("error", () => {
  if (music !== "file") return
  musicPlaying = false; setPlayLabel()
  // Browsers won't let a page opened from disk read the songs beside it; the offline build embeds them instead.
  if (location.protocol === "file:" && typeof OFFLINE_AUDIO === "undefined" && loadedTrack) toast("Songs can't load from a page opened from disk. Serve the folder (npx serve dist) or open trance-engine-offline.html.", true)
  else toast("This browser can't decode that file. Try an MP3 or WAV.", true)
})
$("#seek").addEventListener("input", (e) => { if (audioEl.duration) { audioEl.currentTime = +e.target.value; resetClock(); if (ended && audioEl.currentTime < audioEl.duration - 0.5) { ended = false; audioEl.play().then(() => { musicPlaying = true; setPaused(false); setPlayLabel() }, () => {}) } } })
// Scrubbing while paused still moves the picture: a few frames run so the restored scene shows.
audioEl.addEventListener("seeked", () => {
  if (!paused) return
  const now = performance.now(); for (const s of Object.values(slots)) { s.waitingSince = now; s.lastFrameAt = 0 }
  scrubFrames = 24
})
const togglePlay = () => {
  if (music === "demo") {
    if (musicPlaying) { demo.stop(); ac.suspend(); musicPlaying = false; setPaused(true) }
    else { ac.resume(); demo.start(); musicPlaying = true; setPaused(false) }
  } else if (music === "file") {
    if (musicPlaying) { audioEl.pause(); musicPlaying = false; setPaused(true) }
    else {
      ensureAC()
      const restart = ended
      if (restart) { audioEl.currentTime = 0; mc.t = -1 }
      audioEl.play().then(() => { musicPlaying = true; setPaused(false); setPlayLabel(); if (restart) { ended = false; resetClock(); introCard(trackName); startStory() } }, () => toast("The browser blocked playback.", true))
    }
  } else setPaused(!paused)
  setPlayLabel()
}

// ---------- Analysis ----------
// Everything a scene can hear. Hits (kickHit, snareHit, hatHit) are onsets of different sound types;
// beat comes from a phase-locked clock so it stays steady even when a kick is missed.
const A = {
  level: 0, bass: 0, mid: 0, high: 0, energy: 0, bands: new Array(32).fill(0),
  kick: 0, kickHit: false, kicks: 0, snare: 0, snareHit: false, snares: 0, hat: 0, hatHit: false, hats: 0,
  snap: 0, snapHit: false, snaps: 0,
  beat: false, beats: 0, phase: 0, anticip: 0, bar: 0, barPhase: 0, downbeat: false, bars: 0, phrase: 0, phraseStart: false, bpm: 120, beatConf: 0,
  bright: 0.4, noise: 0.2, tonal: 0.8, chroma: new Array(12).fill(0), note: 0, key: 0, keyHue: 0,
  calm: 0, drop: false, dropAmt: 0,
  // From the song map (0 / "" without one): section kind, build tension 0–1, seconds to the next drop, position.
  section: "", build: 0, toDrop: 99, sectionPos: 0, songPos: 0, seeked: false,
}
const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]
// Asymmetric follower: fast attack, slower release (per feature).
const follow = (cur, target, atk, rel, dt) => cur + (target - cur) * (1 - Math.exp(-dt / (target > cur ? atk : rel)))

// Onset stats per band: running mean and deviation of spectral flux, for adaptive thresholds.
const onsetBand = () => ({ mean: 0, dev: 0.01, last: 0 })
const OB = { snare: onsetBand(), hat: onsetBand(), body: onsetBand() }
let pendingKicks = [], pendingSnares = 0, pendingHats = 0, kickSlow = 0, sampleLast = 0
let specBright = 0.4, specNoise = 0.2
const chromaFast = new Array(12).fill(0), chromaSlow = new Array(12).fill(0)
const bandFlux = (lo, hi, mags) => {
  const a = Math.max(1, Math.floor(lo / binHz)), b = Math.min(mags.length - 1, Math.ceil(hi / binHz))
  let f = 0; for (let k = a; k <= b; k++) { const d = mags[k] - prevMag[k]; if (d > 0) f += d }
  return f / (b - a + 1)
}
const isOnset = (band, value, now, refractory, floor) => {
  const thr = band.mean + band.dev * 2.4 + floor
  const hit = value > thr && now - band.last > refractory
  const k = 0.04
  band.mean += (value - band.mean) * k
  band.dev += (Math.abs(value - band.mean) - band.dev) * k
  if (hit) band.last = now
  return hit
}
const mags = new Float32Array(1024)
const bandEnergy = (lo, hi, m) => {
  const a = Math.max(1, Math.floor(lo / binHz)), b = Math.min(m.length - 1, Math.ceil(hi / binHz))
  let e = 0; for (let k = a; k <= b; k++) e += m[k] * m[k]
  return e / (b - a + 1)
}
const energyBand = () => ({ slow: 0, prev: 0, peak: 1e-9, last: 0 })
const EB = { snare: energyBand(), hat: energyBand() }
// Onset when energy jumps above its ~250 ms average, is rising, and is not negligible next to the band's recent peak.
const bandFlatness = (lo, hi, m) => {
  const a = Math.max(1, Math.floor(lo / binHz)), b = Math.min(m.length - 1, Math.ceil(hi / binHz))
  let lg = 0, ar = 0, n = 0
  for (let k = a; k <= b; k++) { const p = m[k] * m[k] + 1e-14; lg += Math.log(p); ar += p; n++ }
  return Math.exp(lg / n) / (ar / n)
}
const bandOnset = (b, e, now, dtms, refractory, ratio, floor) => {
  b.peak = Math.max(e, b.peak * Math.exp(-dtms / 8000))
  const hit = e > b.slow * ratio && e > b.prev * 1.15 && e > Math.max(floor, b.peak * 0.08) && now - b.last > refractory
  b.slow += (e - b.slow) * (1 - Math.exp(-dtms / 250))
  b.prev = e
  if (hit) b.last = now
  return hit
}
const sampleOnsets = () => {
  if (!musicPlaying || !lowAn) return
  const now = performance.now(), dtms = sampleLast ? Math.min(100, now - sampleLast) : 8
  sampleLast = now
  // Kick: low-passed energy jumping well above its recent average.
  lowAn.getFloatTimeDomainData(lowBuf)
  let e = 0; for (let i = 0; i < lowBuf.length; i++) e += lowBuf[i] * lowBuf[i]
  e /= lowBuf.length
  if (e > 1e-3 && e > kickSlow * 1.7 && now - (pendingKicks.length ? pendingKicks[pendingKicks.length - 1] : lastKickAt) > 230) pendingKicks.push(now)
  kickSlow += (e - kickSlow) * (1 - Math.exp(-dtms / 700))
  // Spectral flux on the unsmoothed spectrum.
  specAn.getFloatFrequencyData(spec)
  const n = Math.min(spec.length, mags.length)
  for (let k = 0; k < n; k++) mags[k] = Math.pow(10, Math.max(-140, spec[k]) / 20)
  // Band energies, judged against their own recent average (robust to uneven sampling).
  const crack = bandEnergy(1500, 5000, mags), sizzle = bandEnergy(7000, 15000, mags)
  // Snares and claps are noise: require a flat (non-pitched) spectrum in the band, so synth notes don't count.
  const snareOn = bandOnset(EB.snare, crack, now, dtms, 130, 1.8, 4e-8) && bandFlatness(1500, 5000, mags) > 0.22
  const hatOn = bandOnset(EB.hat, sizzle, now, dtms, 65, 1.9, 1e-8)
  // A snare or clap is a mid-high crack; a hat is high sizzle without the crack.
  if (snareOn) pendingSnares++
  else if (hatOn) pendingHats++
  for (let k = 0; k < n; k++) prevMag[k] = mags[k]
  // Brightness (spectral centroid) and noisiness (spectral flatness), 60 Hz–12 kHz.
  let sw = 0, sm = 0, logSum = 0, pSum = 0, cnt = 0
  const lo = Math.ceil(60 / binHz), hi = Math.min(n - 1, Math.floor(12000 / binHz))
  for (let k = lo; k <= hi; k++) {
    const m = mags[k]; sw += m * k * binHz; sm += m
    if (k * binHz > 200 && k * binHz < 10000) { const p = m * m + 1e-12; logSum += Math.log(p); pSum += p; cnt++ }
  }
  if (sm > 1e-6) {
    const centroid = sw / sm
    specBright += (clamp((Math.log2(centroid) - Math.log2(250)) / (Math.log2(5000) - Math.log2(250)), 0, 1) - specBright) * 0.05
    const flat = Math.exp(logSum / cnt) / (pSum / cnt)
    specNoise += (clamp(flat * 3, 0, 1) - specNoise) * 0.05
  }
  // Chroma: energy per pitch class, fast (current note) and slow (key centre).
  const ch = new Array(12).fill(0)
  for (let k = chromaLo; k <= chromaHi; k++) { const pc = pcOfBin[k]; if (pc >= 0) ch[pc] += mags[k] * mags[k] }
  const mx = Math.max(...ch)
  if (mx > 1e-8) for (let i = 0; i < 12; i++) {
    chromaFast[i] += (ch[i] / mx - chromaFast[i]) * 0.08
    chromaSlow[i] += (ch[i] / mx - chromaSlow[i]) * 0.004
  }
}

// ---------- Beat clock: a phase-locked loop nudged by kick onsets ----------
let period = 500, lastBeatT = 0, nextBeatT = 0, conf = 0, clockBeats = 0, lastKickAt = 0, iois = []
const posScore = [0, 0, 0, 0]
let barOffset = 0, barNo = 0
const resetClock = () => { conf = 0; lastBeatT = 0; nextBeatT = 0; iois = []; posScore.fill(0) }
const onKick = (t) => {
  const gap = t - lastKickAt
  if (lastKickAt && gap > 280 && gap < 1100) {
    iois.push(gap); if (iois.length > 12) iois.shift()
    const sorted = [...iois].sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)]
    // Fold halves/doubles toward the 90–180 BPM range.
    let tgt = med; while (tgt < 333) tgt *= 2; while (tgt > 667) tgt /= 2
    if (conf < 0.3 || Math.abs(tgt - period) / period > 0.12) period += (tgt - period) * 0.5
    else period += (tgt - period) * 0.08
  }
  lastKickAt = t
  if (!lastBeatT) { lastBeatT = t; nextBeatT = t + period; conf = 0.3; return }
  const k = Math.round((t - lastBeatT) / period), predicted = lastBeatT + k * period, err = t - predicted
  if (Math.abs(err) < period * 0.22) {
    // Earlier than predicted: pull the phase back; later: push it forward. Small tempo nudge too.
    lastBeatT += err * 0.35; nextBeatT += err * 0.35
    period = clamp(period + err * 0.04, 300, 1000)
    conf = Math.min(1, conf + 0.2)
    const pos = (((clockBeats + k - barOffset) % 4) + 4) % 4
    posScore[pos] += 1
  } else if (conf < 0.35) { lastBeatT = t; nextBeatT = t + period }
}
let ghostBeat = -1, ghostHalf = -1, ghostQuarter = -1
const peaks = { bass: 0.3, mid: 0.3, high: 0.3 }
let shortE = 0, longE = 0.3, dropArmed = false, lastDropAt = 0
const bandAvg = (lo, hi) => {
  const bin = ac.sampleRate / analyser.fftSize
  const a = Math.max(1, Math.floor(lo / bin)), b = Math.max(a, Math.min(freq.length - 1, Math.ceil(hi / bin)))
  let s = 0; for (let i = a; i <= b; i++) s += freq[i]
  return s / ((b - a + 1) * 255)
}
let clockBeat = false, liveSince = 0
const analyse = (now, dt) => {
  A.beat = false; A.kickHit = false; A.snareHit = false; A.hatHit = false; A.snapHit = false; A.drop = false
  A.downbeat = false; A.phraseStart = false; clockBeat = false
  const live = musicPlaying && analyser
  // With a song map, hits, beats, bars, sections and drops come from the map at the playback position
  // (so they are exact, and seeking moves them with the song); the live analyser still drives levels and bands.
  const mapped = isMapped()
  A.seeked = false
  if (live) {
    sampleOnsets()
    if (mapped) { pendingKicks.length = 0; pendingSnares = 0; pendingHats = 0 }
    while (pendingKicks.length) { const k = pendingKicks.shift(); onKick(k); A.kickHit = true }
    if (pendingSnares) { A.snareHit = true; pendingSnares = 0 }
    if (pendingHats) { A.hatHit = true; pendingHats = 0 }
    analyser.getByteFrequencyData(freq); analyser.getByteTimeDomainData(wave)
    const raw = { bass: bandAvg(35, 130), mid: bandAvg(130, 2000), high: bandAvg(2000, 11000) }
    // Adaptive gain: the peak rises instantly but falls over ~12 s, so breakdowns stay quiet.
    for (const k of ["bass", "mid", "high"]) {
      peaks[k] = Math.max(raw[k], peaks[k] * Math.exp(-dt / 12), 0.3)
      const target = clamp(raw[k] / peaks[k], 0, 1) ** 1.6
      A[k] = follow(A[k], target, k === "high" ? 0.015 : 0.03, k === "bass" ? 0.16 : k === "mid" ? 0.12 : 0.07, dt)
    }
    let rms = 0; for (let i = 0; i < wave.length; i++) { const v = (wave[i] - 128) / 128; rms += v * v }
    A.level = follow(A.level, clamp(Math.sqrt(rms / wave.length) * 3, 0, 1), 0.02, 0.2, dt)
    for (let i = 0; i < 32; i++) {
      const v = bandAvg(40 * Math.pow(350, i / 32), 40 * Math.pow(350, (i + 1) / 32))
      A.bands[i] = follow(A.bands[i], clamp((v - 0.25) / 0.6, 0, 1) ** 1.3, 0.015, 0.09 + (31 - i) * 0.004, dt)
    }
    A.bright = follow(A.bright, specBright, 0.1, 0.4, dt)
    A.noise = follow(A.noise, specNoise, 0.1, 0.4, dt)
    for (let i = 0; i < 12; i++) A.chroma[i] = chromaFast[i]
  } else if (!mapped) {
    // Silent mode: a 118 BPM groove with a backbeat snare, 8th-note hats, and a breakdown then a drop every 32 beats.
    const P = 60000 / 118, b = Math.floor(now / P), half = Math.floor(now / (P / 2)), quarter = Math.floor(now / (P / 4))
    const phraseBeat = ((b % 32) + 32) % 32, breakdown = phraseBeat >= 28
    if (b !== ghostBeat) { ghostBeat = b; if (!breakdown) { onKick(now); A.kickHit = true } }
    if (half !== ghostHalf) { ghostHalf = half; if (!breakdown && half % 2 === 1 && b % 2 === 1) A.snareHit = true }
    if (quarter !== ghostQuarter) { ghostQuarter = quarter; if (!breakdown && quarter % 2 === 1) A.hatHit = true }
    const t = now / 1000
    A.bass = breakdown ? 0.15 : 0.25 + 0.55 * A.kick; A.mid = 0.4 + 0.2 * Math.sin(t * 0.7); A.high = 0.3 + 0.25 * Math.sin(t * 1.3 + 1) + A.hat * 0.2
    A.level = breakdown ? 0.2 : 0.3 + 0.25 * A.kick
    for (let i = 0; i < 32; i++) A.bands[i] = clamp(0.2 + 0.2 * Math.sin(t * 2 + i * 0.4) + 0.45 * A.kick * (1 - i / 32), 0, 1)
    A.bright = 0.45 + 0.25 * Math.sin(t * 0.21); A.noise = 0.2 + 0.1 * Math.sin(t * 0.13)
    const fake = Math.floor(t / 8) % 12
    for (let i = 0; i < 12; i++) A.chroma[i] = i === fake ? 1 : i === (fake + 7) % 12 ? 0.6 : 0.1
    for (let i = 0; i < 12; i++) chromaSlow[i] += (A.chroma[i] - chromaSlow[i]) * 0.01
  }
  // If no kick has locked the clock after 1.5 s of music, let it free-run at the current tempo estimate,
  // so story time keeps moving with any song.
  if (mapped) mapClock(now, dt)
  else {
  if (live && !lastBeatT) { if (!liveSince) liveSince = now; else if (now - liveSince > 1500) { lastBeatT = now; nextBeatT = now + period } }
  if (!live) liveSince = 0
  // Clock beats: fire when the predicted beat time passes.
  if (lastBeatT && nextBeatT) {
    while (now >= nextBeatT) {
      lastBeatT = nextBeatT; nextBeatT += period; clockBeats++; clockBeat = true
      conf *= 0.82
      const pos = (((clockBeats - barOffset) % 4) + 4) % 4
      if (pos === 0) { barNo++; A.downbeat = true; if (barNo % 8 === 0) A.phraseStart = true }
    }
    // Re-pick which beat is "1" every bar, with hysteresis: the strongest kick position wins.
    if (A.downbeat) {
      for (let i = 0; i < 4; i++) posScore[i] *= 0.9
      const best = posScore.indexOf(Math.max(...posScore))
      if (best !== 0 && posScore[best] > posScore[0] * 1.4 + 1) { barOffset = (barOffset + best) % 4; posScore.fill(0) }
    }
  }
  A.beatConf = conf
  if (clockBeat && conf > 0.22) { A.beat = true; A.beats++ }
  A.bpm = Math.round(60000 / period)
  A.phase = lastBeatT ? clamp((now - lastBeatT) / period, 0, 1) : 0
  A.anticip = lastBeatT ? clamp((now - (nextBeatT - period * 0.25)) / (period * 0.25), 0, 1) : 0
  A.bar = (((clockBeats - barOffset) % 4) + 4) % 4
  A.barPhase = (A.bar + A.phase) / 4
  A.bars = barNo; A.phrase = ((barNo % 8) + 8) % 8
  }
  // Envelopes per sound type: kick pumps slowly, snare cracks, hats flicker.
  // Mapped songs pump on real kicks only; a beat without a kick gives a softer push (none in breakdowns).
  A.kick = A.kickHit || (A.beat && !mapped) ? 1 : A.beat ? Math.max(A.kick, 0.4 * (1 - A.calm)) : A.kick * Math.exp(-dt * 7)
  if (A.kickHit) A.kicks++
  if (A.snareHit) { A.snares++; A.snare = 1 } else A.snare *= Math.exp(-dt * 11)
  if (A.hatHit) { A.hats++; A.hat = 1 } else A.hat *= Math.exp(-dt * 22)
  A.snapHit = A.snareHit; A.snaps = A.snares; A.snap = A.snare
  A.tonal = 1 - A.noise
  const key = chromaSlow.indexOf(Math.max(...chromaSlow))
  A.key = key; A.note = A.chroma.indexOf(Math.max(...A.chroma))
  A.keyHue = ((key * 7) % 12) * 30
  A.energy = follow(A.energy, clamp(A.level * 0.7 + A.bass * 0.5, 0, 1), 0.8, 1.6, dt)
  if (mapped) { mapSections(now, dt); return }
  // Sections: last half second of loudness against the last several seconds.
  const loud = clamp(A.level * 0.6 + A.bass * 0.4, 0, 1)
  shortE += (loud - shortE) * Math.min(1, dt / 0.5)
  longE += (loud - longE) * Math.min(1, dt / 6)
  const ratio = shortE / Math.max(0.05, longE), noBeat = now - lastKickAt > 2500
  let calmTarget = clamp((0.85 - ratio) / 0.45, 0, 1)
  if (noBeat) calmTarget = Math.max(calmTarget, 0.75)
  if (!live) calmTarget = ((Math.floor(now / (60000 / 118)) % 32) + 32) % 32 >= 28 ? 1 : 0
  A.calm += (calmTarget - A.calm) * Math.min(1, dt * 1.5)
  if (A.calm > 0.55) dropArmed = true
  const returning = dropArmed && A.calm < 0.5 && (live ? shortE > longE * 0.95 : true)
  const lift = live && shortE > longE * 1.25 && longE > 0.08
  if ((A.beat || A.kickHit) && now - lastDropAt > 16000 && (returning || lift)) {
    A.drop = true; A.dropAmt = 1; dropArmed = false; lastDropAt = now
    // A drop lands on a "1": realign the bar and start a fresh phrase here.
    barOffset = (((clockBeats - 0) % 4) + 4) % 4; barNo = 0; A.bar = 0; A.downbeat = true; A.phraseStart = true; posScore.fill(0)
  } else A.dropAmt *= Math.exp(-dt * 1.2)
}

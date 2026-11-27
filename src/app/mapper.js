// ---------- Song mapper: analyse a whole song before it plays ----------
// mapSong(mono Float32Array, sampleRate) -> beats, downbeats, kick/snare/hat onsets, sections with labels,
// drops, build-up tension and per-frame features, so the visuals can follow the song's timeline exactly.
const mapSong = (input, inRate) => {
  const debug = {}
  // Resample to 22050 Hz (linear) to keep the analysis fast.
  const SR = 22050, ratio = inRate / SR, n = Math.floor(input.length / ratio)
  const x = new Float32Array(n)
  for (let i = 0; i < n; i++) { const p = i * ratio, j = Math.floor(p), f = p - j; x[i] = (input[j] || 0) * (1 - f) + (input[j + 1] || 0) * f }
  const N = 1024, HOP = 256, fps = SR / HOP, half = N / 2, binHz = SR / N
  const frames = Math.max(1, Math.floor((n - N) / HOP))
  // Radix-2 FFT tables.
  const win = new Float32Array(N), rev = new Uint32Array(N), cosT = new Float32Array(half), sinT = new Float32Array(half)
  for (let i = 0; i < N; i++) { win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N); let r = 0; for (let b = 1, v = i; b < N; b <<= 1, v >>= 1) r = (r << 1) | (v & 1); rev[i] = r }
  for (let i = 0; i < half; i++) { cosT[i] = Math.cos((2 * Math.PI * i) / N); sinT[i] = -Math.sin((2 * Math.PI * i) / N) }
  const re = new Float32Array(N), im = new Float32Array(N)
  const fft = () => {
    for (let size = 2; size <= N; size <<= 1) {
      const h = size >> 1, step = N / size
      for (let i = 0; i < N; i += size) for (let j = 0; j < h; j++) {
        const k = j * step, a = i + j, b = a + h
        const tr = re[b] * cosT[k] - im[b] * sinT[k], ti = re[b] * sinT[k] + im[b] * cosT[k]
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti
      }
    }
  }
  const binOf = (hz) => Math.max(1, Math.min(half - 1, Math.round(hz / binHz)))
  const bandEdges = []
  for (let i = 0; i <= 32; i++) bandEdges.push(binOf(40 * Math.pow(250, i / 32)))
  const pc = new Int8Array(half).fill(-1)
  for (let k = binOf(100); k <= binOf(2000); k++) pc[k] = ((Math.round(12 * Math.log2((k * binHz) / 440) + 69) % 12) + 12) % 12
  const L = (a, b) => [binOf(a), binOf(b)]
  const LOW = L(30, 150), MIDB = L(150, 1500), CRACK = L(1500, 5000), SIZZ = L(7000, 10500), ALL = L(30, 8000)
  const KICKB = L(40, 150)
  // Per-frame features.
  const F = {
    level: new Float32Array(frames), low: new Float32Array(frames), mid: new Float32Array(frames), high: new Float32Array(frames),
    fluxAll: new Float32Array(frames), fluxLow: new Float32Array(frames), fluxCrack: new Float32Array(frames), fluxHigh: new Float32Array(frames),
    kickFlux: new Float32Array(frames), kickE: new Float32Array(frames), kickW: new Float32Array(frames),
    flatCrack: new Float32Array(frames), crackP: new Float32Array(frames), sizzP: new Float32Array(frames), bright: new Float32Array(frames), noise: new Float32Array(frames),
    bands: new Float32Array(frames * 32), chroma: new Float32Array(frames * 12),
  }
  const prev = new Float32Array(half), lm = new Float32Array(half)
  for (let f = 0; f < frames; f++) {
    const off = f * HOP
    let rms = 0
    for (let i = 0; i < N; i++) { const v = x[off + i] || 0; re[rev[i]] = v * win[i]; im[rev[i]] = 0; rms += v * v }
    fft()
    for (let k = 0; k < half; k++) { const m = Math.hypot(re[k], im[k]) / half; lm[k] = Math.log1p(1000 * m) }
    F.level[f] = Math.sqrt(rms / N)
    const sum = (r, arr) => { let s = 0; for (let k = r[0]; k <= r[1]; k++) s += arr[k]; return s / (r[1] - r[0] + 1) }
    const flux = (r) => { let s = 0; for (let k = r[0]; k <= r[1]; k++) { const d = lm[k] - prev[k]; if (d > 0) s += d } return s / (r[1] - r[0] + 1) }
    F.low[f] = sum(LOW, lm); F.mid[f] = sum(MIDB, lm); F.high[f] = sum(SIZZ, lm)
    F.fluxAll[f] = flux(ALL); F.fluxLow[f] = flux(LOW); F.fluxCrack[f] = flux(CRACK); F.fluxHigh[f] = flux(SIZZ)
    // Kick band (SuperFlux, Boeck & Widmer 2013): positive log-magnitude difference against a maximum
    // filter over neighbouring bins of the previous frame: moving bass lines and vibrato cancel,
    // while a kick's fast pitch sweep (150->50 Hz in ~20 ms) still jumps out.
    let kf = 0, ke = 0, ks = 0
    for (let k = KICKB[0]; k <= KICKB[1]; k++) {
      const m = Math.max(prev[k - 2], prev[k - 1], prev[k], prev[k + 1], prev[k + 2])
      const d = lm[k] - m
      if (d > kf) kf = d
      if (d > 0.15) ks++
      ke += Math.expm1(lm[k])
    }
    F.kickFlux[f] = kf; F.kickE[f] = ke; F.kickW[f] = kf > 0 ? ks : 0
    let lg = 0, ar = 0
    for (let k = CRACK[0]; k <= CRACK[1]; k++) { const p = Math.expm1(lm[k]) + 1e-6; lg += Math.log(p); ar += p }
    const cn = CRACK[1] - CRACK[0] + 1
    F.flatCrack[f] = Math.exp(lg / cn) / (ar / cn)
    F.crackP[f] = ar / cn
    let sp = 0; for (let k = SIZZ[0]; k <= SIZZ[1]; k++) sp += Math.expm1(lm[k]); F.sizzP[f] = sp / (SIZZ[1] - SIZZ[0] + 1)
    let cw = 0, cs = 0, glg = 0, gar = 0, gn = 0
    for (let k = ALL[0]; k <= ALL[1]; k++) { const p = Math.expm1(lm[k]) + 1e-6; cw += p * k * binHz; cs += p; if (k > binOf(200)) { glg += Math.log(p); gar += p; gn++ } }
    F.bright[f] = cs > 0 ? Math.log2(Math.max(100, cw / cs)) : 0
    F.noise[f] = gn ? Math.exp(glg / gn) / (gar / gn) : 0
    for (let b = 0; b < 32; b++) { let s = 0; for (let k = bandEdges[b]; k <= Math.max(bandEdges[b], bandEdges[b + 1] - 1); k++) s += lm[k]; F.bands[f * 32 + b] = s / Math.max(1, bandEdges[b + 1] - bandEdges[b]) }
    for (let k = 0; k < half; k++) if (pc[k] >= 0) F.chroma[f * 12 + pc[k]] += Math.expm1(lm[k])
    prev.set(lm)
  }
  // Normalise each feature to its 95th percentile so every song drives the visuals over the same range.
  const pct = (arr, p) => { const s = Array.from(arr).filter((v) => v > 0).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length * p)] : 1 }
  for (const key of ["level", "low", "mid", "high", "fluxAll", "fluxLow", "fluxCrack", "fluxHigh", "kickFlux"]) { const q = pct(F[key], 0.95) || 1, cap = key.startsWith("flux") || key === "kickFlux" ? 4 : 1.5; for (let i = 0; i < frames; i++) F[key][i] = Math.min(cap, F[key][i] / q) }
  { const q = pct(F.kickE, 0.95) || 1; for (let i = 0; i < frames; i++) F.kickE[i] /= q }
  { const q = pct(F.bands, 0.97) || 1; for (let i = 0; i < F.bands.length; i++) F.bands[i] = Math.min(1, F.bands[i] / q) }
  { const lo = pct(F.bright, 0.05), hi = pct(F.bright, 0.95); for (let i = 0; i < frames; i++) F.bright[i] = Math.max(0, Math.min(1, (F.bright[i] - lo) / Math.max(0.01, hi - lo))) }
  for (let f = 0; f < frames; f++) { let m = 0; for (let c = 0; c < 12; c++) m = Math.max(m, F.chroma[f * 12 + c]); if (m > 0) for (let c = 0; c < 12; c++) F.chroma[f * 12 + c] /= m }

  // Peak picking with a local adaptive threshold (mean + k·deviation over ±0.4 s).
  const pick = (env, k, floor, gapS, extra) => {
    const out = [], w = Math.round(0.4 * fps), gap = Math.round(gapS * fps)
    let last = -1e9
    for (let i = 2; i < env.length - 2; i++) {
      const v = env[i]
      if (v < floor || v < env[i - 1] || v < env[i + 1] || v < env[i - 2] || v < env[i + 2]) continue
      let s = 0, s2 = 0, c = 0
      for (let j = Math.max(0, i - w); j < Math.min(env.length, i + w); j++) { s += env[j]; s2 += env[j] * env[j]; c++ }
      const mean = s / c, dev = Math.sqrt(Math.max(0, s2 / c - mean * mean))
      if (v > mean + k * dev && i - last >= gap && (!extra || extra(i))) { out.push(i); last = i }
    }
    return out
  }
  // Song-wide anchor: a hit must reach a fair share of the song's typical strong hit (90th percentile of all peaks),
  // so quiet passages don't turn small events into kicks and snares.
  const peakPct = (env, p) => { const pk = []; for (let i = 1; i < env.length - 1; i++) if (env[i] > env[i - 1] && env[i] >= env[i + 1]) pk.push(env[i]); pk.sort((a, b) => a - b); return pk.length ? pk[Math.floor(pk.length * p)] : 1 }
  const snareFloor = 0.3 * peakPct(F.fluxCrack, 0.9)
  // Kick drum onsets (Boeck & Widmer 2013, Dixon 2006): peaks of the SuperFlux kick-band envelope over an
  // adaptive threshold (local mean + k·deviation) with a minimum inter-onset gap. A kick has a beater click
  // (high-frequency transient) and a flux spanning several band bins (its fast pitch sweep), and it pumps new
  // energy into the band; pads, moving bass lines and already-sounding 808s fail at least one of these.
  const click = (i) => Math.max(F.fluxCrack[i] + F.fluxHigh[i], F.fluxCrack[i + 1] + F.fluxHigh[i + 1] || 0, F.fluxCrack[i - 1] + F.fluxHigh[i - 1] || 0)
  // Backtrack from the flux peak to where the band energy starts rising: the flux maximum lags the hit by
  // most of the analysis window. The rise starts when the hit enters the window, so report a fixed
  // 3 hops (~35 ms, about 3/4 of the window) later to centre the estimate on the hit.
  const riseStart = (p) => { let j = p; const lo = Math.max(0, p - Math.round(0.08 * fps)); while (j > lo && F.kickE[j - 1] <= F.kickE[j]) j--; return j }
  const kickRise = (i, j) => F.kickE[Math.min(frames - 1, i + 4)] - F.kickE[Math.max(0, j - 1)]
  const kickPk = pick(F.kickFlux, 1.7, 0.25, 0.15, (i) => { const j = riseStart(i), c = click(j); return kickRise(i, j) > 0.26 && c > 0.12 && (F.kickW[i] >= 2 || c > 0.8) })
  const kickRaw = kickPk.map((i) => Math.min(frames - 1, riseStart(i) + 3))
  // A snare or clap is a noisy crack whose energy sits in 1.5–5 kHz rather than above 7 kHz (where hats live).
  const crackHeavy = (i) => Math.max(F.crackP[i], F.crackP[i + 1] || 0) > 1.2 * Math.max(F.sizzP[i], F.sizzP[i + 1] || 0)
  const snareF = pick(F.fluxCrack, 1.1, Math.max(0.14, snareFloor), 0.1, (i) => F.flatCrack[i] > 0.2 && crackHeavy(i))
  const snareSet = new Set(snareF)
  const hatF = pick(F.fluxHigh, 0.8, 0.1, 0.05, (i) => !snareSet.has(i) && !snareSet.has(i - 1) && !snareSet.has(i + 1))

  // Tempo: autocorrelation of the onset envelope, weighted toward 120 BPM, then octave checks.
  const oenv = new Float32Array(frames)
  for (let i = 0; i < frames; i++) oenv[i] = F.fluxAll[i] + 0.8 * F.fluxLow[i]
  let om = 0; for (const v of oenv) om += v; om /= frames
  const ac = (lag) => { let s = 0; for (let i = lag; i < frames; i++) s += (oenv[i] - om) * (oenv[i - lag] - om); return s / (frames - lag) }
  const bpmOf = (lag) => (60 * fps) / lag
  let best = 0, bestScore = -1e9
  const scores = new Map()
  for (let lag = Math.floor((60 * fps) / 200); lag <= Math.ceil((60 * fps) / 60); lag++) {
    const a = ac(lag); scores.set(lag, a)
    const w = Math.exp(-0.5 * Math.pow(Math.log2(bpmOf(lag) / 120) / 0.9, 2))
    if (a * w > bestScore) { bestScore = a * w; best = lag }
  }
  // Prefer the double tempo when it is nearly as periodic (fast genres), the half when the kick pattern says so.
  const half2 = Math.round(best / 2)
  if (bpmOf(best) < 100 && scores.get(half2) > 0.55 * scores.get(best)) best = half2
  // Sub-frame refinement by parabolic interpolation.
  const a0 = scores.get(best - 1) || 0, a1 = scores.get(best), a2 = scores.get(best + 1) || 0
  const periodF = best + (a0 - a2) / (2 * (a0 - 2 * a1 + a2) || 1) * 0.5
  const bpm = bpmOf(periodF)

  // Beat tracking by dynamic programming (Ellis 2007): beats on strong onsets, spaced close to the period.
  const P = periodF, tight = 120
  const score = new Float32Array(frames), back = new Int32Array(frames).fill(-1)
  let maxO = 0; for (const v of oenv) maxO = Math.max(maxO, v)
  for (let t = 0; t < frames; t++) {
    let bs = 0, bi = -1
    for (let tau = Math.max(0, Math.round(t - 2 * P)); tau <= t - Math.round(P / 2); tau++) {
      const pen = -tight * Math.pow(Math.log((t - tau) / P), 2)
      const s = score[tau] + pen
      if (s > bs || bi < 0) { bs = s; bi = tau }
    }
    score[t] = oenv[t] / (maxO || 1) + (bi >= 0 ? Math.max(0, bs) : 0)
    back[t] = bi
  }
  let end = frames - 1, bestEnd = 0
  for (let t = Math.max(0, frames - Math.round(P * 2)); t < frames; t++) if (score[t] > bestEnd) { bestEnd = score[t]; end = t }
  const beatF = []
  for (let t = end; t >= 0; t = back[t]) { beatF.push(t); if (back[t] < 0) break }
  beatF.reverse()
  // Fill the silent lead-in and tail with the grid so the clock covers the whole song.
  while (beatF.length && beatF[0] - P > 0) beatF.unshift(Math.round(beatF[0] - P))
  while (beatF.length && beatF[beatF.length - 1] + P < frames) beatF.push(Math.round(beatF[beatF.length - 1] + P))

  const near = (arr, f, tol) => arr.some((g) => Math.abs(g - f) <= tol)
  // Octave check: if snares land on only one position in every 8 beats, we are counting double time
  // (a half-time groove): keep every other beat, on the parity that carries the kicks and snares.
  let periodS = P / fps
  {
    // Only strong, isolated snares (no other strong snare within 1.2 beats), so rolls don't smear the pattern.
    const loud = snareF.filter((f) => F.fluxCrack[f] > 0.5)
    const strong = loud.filter((f) => !loud.some((g) => g !== f && Math.abs(g - f) < 1.2 * P) && !near(kickRaw, f, 2))
    const hist = new Array(8).fill(0)
    for (const f of strong) {
      let k = 0; while (k + 1 < beatF.length && beatF[k + 1] <= f) k++
      const frac = beatF[k + 1] ? (f - beatF[k]) / (beatF[k + 1] - beatF[k]) : 0
      if (frac < 0.2 || frac > 0.8) hist[(k + (frac > 0.5 ? 1 : 0)) % 8]++
    }
    const total = hist.reduce((a, b) => a + b, 0), top = Math.max(...hist)
    // Snares repeating every 4 tracked beats (one per real half-bar) also mean double time.
    const h4 = [0, 1, 2, 3].map((q) => hist[q] + hist[q + 4]), top4 = Math.max(...h4)
    const others = hist.filter((v) => v > total * 0.25).length
    debug.snareHist = hist; debug.floors = ["0.25", snareFloor.toFixed(2)]
    if (total >= 8 && bpm > 110 && ((top > total * 0.5 && others === 1) || top4 > total * 0.75)) {
      const parityScore = [0, 0]
      beatF.forEach((f, i) => { parityScore[i % 2] += (near(kickRaw, f, 3) ? 1 : 0) + (near(snareF, f, 3) ? 1 : 0) })
      const keep = parityScore[0] >= parityScore[1] ? 0 : 1
      const halved = beatF.filter((_, i) => i % 2 === keep)
      beatF.length = 0; halved.forEach((f) => beatF.push(f))
      periodS *= 2
    }
  }
  const bpmOut = 60 / periodS
  // Kicks sit on the groove: keep only those within 40 ms of a 16th-note position of the tracked beat grid.
  const tol = Math.round(0.04 * fps)
  const onGrid = (f) => {
    let k = 0; while (k + 1 < beatF.length && beatF[k + 1] <= f) k++
    const a = beatF[k], b = beatF[k + 1] || a + periodS * fps
    for (let q = 0; q <= 4; q++) if (Math.abs(f - (a + ((b - a) * q) / 4)) <= tol) return true
    return false
  }
  const kickF = kickRaw.filter(onGrid)

  // Downbeats: the bar phase whose beats carry the most kick energy and harmonic change.
  const chromaChange = (f) => { if (f < 4 || f >= frames - 4) return 0; let d = 0; for (let c = 0; c < 12; c++) d += Math.abs(F.chroma[(f + 3) * 12 + c] - F.chroma[(f - 3) * 12 + c]); return d / 12 }
  const phaseScore = [0, 0, 0, 0]
  beatF.forEach((f, i) => { phaseScore[i % 4] += (near(kickF, f, 3) ? 1 : 0) + F.fluxLow[f] + 2 * chromaChange(f) - (near(snareF, f, 3) ? 0.6 : 0) })
  const phase0 = phaseScore.indexOf(Math.max(...phaseScore))
  const downF = beatF.filter((_, i) => i % 4 === phase0)
  if (!downF.length || downF[0] > beatF[0]) { /* keep as is */ }

  // Bar-level features.
  const bars = []
  for (let b = 0; b < downF.length; b++) {
    const a = downF[b], z = b + 1 < downF.length ? downF[b + 1] : Math.min(frames, a + Math.round(periodS * fps * 4))
    let lv = 0, lo = 0, hi = 0, br = 0, c = 0
    for (let f = a; f < z; f++) { lv += F.level[f]; lo += F.low[f]; hi += F.high[f]; br += F.bright[f]; c++ }
    const count = (arr) => arr.filter((g) => g >= a && g < z).length
    bars.push({ f: a, t: a / fps, loud: lv / Math.max(1, c), low: lo / Math.max(1, c), high: hi / Math.max(1, c), bright: br / Math.max(1, c), kicks: count(kickF), snares: count(snareF), hats: count(hatF) })
  }
  const maxOf = (k) => Math.max(1e-6, ...bars.map((b) => b[k]))
  const nb = bars.map((b) => ({ loud: b.loud / maxOf("loud"), low: b.low / maxOf("low"), high: b.high / maxOf("high"), bright: b.bright, kicks: Math.min(1, b.kicks / 4), snares: Math.min(1, b.snares / 4) }))
  // Novelty at each bar line: how different the next two bars are from the previous two.
  const vec = (i) => [nb[i].loud * 2, nb[i].low * 2.5, nb[i].high * 1.6, nb[i].kicks, nb[i].snares * 0.6, nb[i].bright * 1.6]
  const avgVec = (a, b) => { const out = [0, 0, 0, 0, 0, 0]; let c = 0; for (let i = Math.max(0, a); i < Math.min(nb.length, b); i++) { vec(i).forEach((v, k) => (out[k] += v)); c++ } return out.map((v) => v / Math.max(1, c)) }
  const novelty = nb.map((_, i) => { if (i < 1) return 0; const p = avgVec(i - 2, i), q = avgVec(i, i + 2); return Math.sqrt(p.reduce((s, v, k) => s + (v - q[k]) * (v - q[k]), 0)) })
  const nMean = [...novelty].sort((a, b) => a - b)[Math.floor(novelty.length / 2)] / 1.3 * 1.25
  const cuts = [0]
  for (let i = 2; i < novelty.length - 1; i++) {
    const v = novelty[i]
    if (v < nMean * 1.3 || v < 0.28) continue
    if (v < novelty[i - 1] || v < novelty[i + 1]) continue
    if (i - cuts[cuts.length - 1] < 2) { if (v > novelty[cuts[cuts.length - 1]]) cuts[cuts.length - 1] = i; continue }
    cuts.push(i)
  }
  // Split long sections into 8-bar phrases so the director always has phrase boundaries.
  const all = []
  for (let s = 0; s < cuts.length; s++) {
    const a = cuts[s], z = s + 1 < cuts.length ? cuts[s + 1] : bars.length
    for (let p = a; p < z; p += 8) all.push([p, Math.min(z, p + 8), p === a])
  }
  // A quiet lead-in before the full band enters is its own intro, even when it ramps up gradually.
  {
    const med = [...bars.map((b) => b.loud)].sort((a, b) => a - b)[Math.floor(bars.length / 2)]
    const [a0, z0] = all[0]
    let k = 0; while (k < z0 && bars[k].loud < 0.85 * med) k++
    if (k >= 1 && k < z0 - 1 && bars[k].loud >= 0.9 * med) all.splice(0, 1, [a0, k, true], [k, z0, true])
  }
  const stats = (a, z) => { const r = { loud: 0, low: 0, kicks: 0, snares: 0, bright: 0, slope: 0 }; let c = 0; for (let i = a; i < z; i++) { r.loud += nb[i].loud; r.low += nb[i].low; r.kicks += bars[i].kicks; r.snares += bars[i].snares; r.bright += nb[i].bright; c++ } for (const k in r) r[k] /= Math.max(1, c); r.slope = z - a > 1 ? (nb[z - 1].loud + nb[z - 1].snares * 0.3 + nb[z - 1].bright * 0.3) - (nb[a].loud + nb[a].snares * 0.3 + nb[a].bright * 0.3) : 0; return r }
  const secs = all.map(([a, z, fresh]) => ({ a, z, fresh, start: bars[a].t, end: z < bars.length ? bars[z].t : frames / fps, ...stats(a, z) }))
  const powerOf = (s) => s.loud * 0.5 + s.low * 0.5
  const maxPower = Math.max(0.01, ...secs.map(powerOf))
  secs.forEach((s, i) => {
    const power = powerOf(s), prev = secs[i - 1], prevPower = prev ? powerOf(prev) : 0
    // Drops: near the song's peak power, with kicks, and a clear jump from what came before.
    if (s.fresh && power >= maxPower * 0.72 && s.kicks >= 1 && (!prev || power > prevPower * 1.25 || prev.kind === "breakdown")) s.kind = "drop"
    // Quiet stretches: intro at the start, outro at the end, breakdown in between.
    else if (i === 0 && power < maxPower * 0.8 && secs[1] && powerOf(secs[1]) > power * 1.2) s.kind = "intro"
    else if (power < maxPower * 0.45) s.kind = i === 0 || secs.slice(0, i).every((q) => powerOf(q) < maxPower * 0.45) ? "intro" : secs.slice(i + 1).every((q) => powerOf(q) < maxPower * 0.45) ? "outro" : "breakdown"
    else s.kind = power >= maxPower * 0.72 ? "main" : "verse"
  })
  // Each drop lands on the downbeat (within ±2 bars) where the sub-bass jumps most from the beat before to the beat after.
  const beatFr = Math.round(periodS * fps)
  const subJump = (f) => { let a = 0, b = 0; for (let k = 0; k < beatFr; k++) { a += F.low[Math.max(0, f - beatFr + k)]; b += F.low[Math.min(frames - 1, f + k)] } return (b - a) / beatFr }
  secs.forEach((sec, i) => {
    if (sec.kind !== "drop") return
    let bestA = sec.a, bestJ = subJump(bars[sec.a].f)
    for (let d = -2; d <= 2; d++) {
      const j = sec.a + d
      if (j <= (secs[i - 1] ? secs[i - 1].a : 0) || j >= bars.length || (secs[i + 1] && j >= secs[i + 1].a)) continue
      const v = subJump(bars[j].f); if (v > bestJ + 0.02) { bestJ = v; bestA = j }
    }
    if (bestA !== sec.a) {
      Object.assign(sec, stats(bestA, sec.z), { a: bestA, start: bars[bestA].t })
      const p = secs[i - 1]; if (p) Object.assign(p, stats(p.a, bestA), { z: bestA, end: sec.start })
    }
  })
  // Dense, compressed mixes never get quiet, so their choruses show up as a lift in brightness instead of power.
  const lift = (sec) => { let v = 0; for (let i = sec.a; i < sec.z; i++) v += nb[i].high + nb[i].bright; return v / Math.max(1, sec.z - sec.a) }
  const quietCount = secs.filter((q, i) => i > 0 && i < secs.length - 1 && q.kind === "breakdown").length
  if (quietCount === 0 && secs.filter((q) => q.kind === "drop").length <= 1) {
    const maxLift = Math.max(...secs.map(lift))
    secs.forEach((sec, i) => {
      if (sec.kind === "intro" || sec.kind === "outro") return
      const prev = secs[i - 1], jump = prev ? lift(sec) - lift(prev) : 0
      if (lift(sec) >= maxLift * 0.85 && jump > 0.25) sec.kind = "drop"
      else if (sec.kind === "drop" && prev && prev.kind !== "intro") sec.kind = "main"
    })
    // A lift often ramps over two bars: it lands on the first bar that is (nearly) as bright as the section gets.
    const shine = (k) => nb[k].high + nb[k].bright
    secs.forEach((sec, i) => {
      const prev = secs[i - 1]
      if (sec.kind !== "drop" || !prev || prev.kind === "intro") return
      let top = 0; for (let k = sec.a; k < sec.z; k++) top = Math.max(top, shine(k))
      for (let k = Math.max(prev.a + 1, sec.a - 1); k <= Math.min(sec.z - 2, sec.a + 1); k++) {
        if (shine(k) >= 0.9 * top) {
          if (k !== sec.a) { Object.assign(sec, stats(k, sec.z), { a: k, start: bars[k].t }); Object.assign(prev, stats(prev.a, k), { z: k, end: sec.start }) }
          break
        }
      }
    })
    // The dip right before a lift (a bar or two of thinner sound) is its build.
    secs.forEach((sec, i) => { const n = secs[i + 1]; if (n && n.kind === "drop" && sec.kind !== "intro" && sec.z - sec.a <= 4 && sec.loud < n.loud * 0.97) sec.kind = "build" })
    debug.lift = secs.map((q) => +lift(q).toFixed(2))
  }
  // Two drops back to back: the first one (a short, loud roll) is really the end of the build.
  for (let i = secs.length - 2; i >= 0; i--) if (secs[i].kind === "drop" && secs[i + 1].kind === "drop" && secs[i].z - secs[i].a <= 3) secs[i].kind = "build"
  // Builds: walk back from each drop through phrases that rise or carry snare rolls (or that sit right before it).
  secs.forEach((s, i) => {
    if (s.kind !== "drop") return
    for (let j = i - 1; j >= 0; j--) {
      const q = secs[j], rolls = q.snares >= 2.5, rising = q.slope > 0.15
      if (q.kind === "drop" || q.kind === "main") break
      if (rolls || (rising && q.kind !== "breakdown") || (j === i - 1 && q.kind === "verse")) q.kind = "build"
      else break
    }
  })
  if (secs.length > 1 && secs[secs.length - 1].kind !== "drop" && powerOf(secs[secs.length - 1]) < maxPower * 0.6) secs[secs.length - 1].kind = "outro"
  // A build starts where its continuous snare roll starts; a quiet stretch before that is a breakdown.
  for (let i = secs.length - 1; i >= 0; i--) {
    const sec = secs[i]
    if (sec.kind !== "build" || sec.z - sec.a < 3) continue
    let k = sec.z - 1
    while (k > sec.a && bars[k - 1].snares >= 2) k--
    const quiet = (j) => nb[j].loud * 0.5 + nb[j].low * 0.5 < maxPower * 0.5
    if (k - sec.a >= 2 && bars[k].snares >= 2 && quiet(sec.a)) {
      const head = { ...sec, z: k, end: bars[k].t, kind: "breakdown" }
      sec.a = k; sec.start = bars[k].t
      secs.splice(i, 0, head)
    }
  }
  const drops = secs.filter((s) => s.kind === "drop").map((s) => s.start)
  // Back-to-back builds (or outros) are one long section.
  for (let i = secs.length - 1; i > 0; i--) {
    const p = secs[i - 1], q = secs[i]
    if (p.kind === q.kind && (q.kind === "build" || q.kind === "outro" || q.kind === "intro")) { Object.assign(p, stats(p.a, q.z), { z: q.z, end: q.end }); secs.splice(i, 1) }
  }
  // Build tension: ramps through each build (or the last two bars before a drop if no build was found).
  const tension = new Float32Array(frames)
  for (const d of drops) {
    const b = secs.find((s) => s.kind === "build" && Math.abs(s.end - d) < 0.5)
    const t0 = b ? b.start : Math.max(0, d - periodS * 8)
    for (let f = Math.floor(t0 * fps); f < Math.min(frames, Math.floor(d * fps)); f++) tension[f] = Math.max(tension[f], Math.pow((f / fps - t0) / Math.max(0.1, d - t0), 1.6))
  }
  const toT = (arr) => arr.map((f) => Math.round((f / fps) * 1000) / 1000)
  return {
    duration: n / SR, bpm: bpmOut, period: periodS, fps,
    beats: toT(beatF), downbeats: toT(downF),
    onsets: { kick: toT(kickF), snare: toT(snareF), hat: toT(hatF) },
    sections: secs.map((s) => ({ start: Math.round(s.start * 1000) / 1000, end: Math.round(s.end * 1000) / 1000, kind: s.kind, bars: s.z - s.a, power: Math.round((s.loud * 0.5 + s.low * 0.5) * 100) / 100 })),
    drops, frames: F, tension, frameCount: frames, debug,
  }
}

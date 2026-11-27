// name: Slime web
// Physarum polycephalum sim after Jeff Jones (2010): a few hundred slime agents
// sense a coarse trail grid ahead-left/ahead/ahead-right, steer, deposit, and the
// grid diffuses and decays into a glowing web of veins drawn as polylines and dots.
// Psychoscript technique: Map/Set graphs - a Map spatial-hashes food sources by grid
// cell, plain-array flags answer occupancy queries, and a seeded mulberry32 PRNG
// (fixed sim stream, per-counter kick/snare streams) keeps replays exact. The torus
// grid has a 3-cell wrapped border (no clamping in hot loops); shapes pooled.
// Kick plants food, snare scatters a seeded slice of agents, hats glint on veins,
// bass opens the sensor angle, keyHue colours the web, build/toDrop pull tight,
// the drop bursts wide; calm slows it.
let s = await frame([])
const TAU = Math.PI * 2
const GW = 32, GH = 20
const PGW = GW + 6, PCELLS = PGW * (GH + 6)
const N = 300
const mulberry32 = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(0x51e55)
// 64 quantised headings: cos/sin tables; SC/SS pre-scaled by the sensor distance.
// Agent positions stay pre-shifted by the border, so sensing is add+truncate.
const DCOS = new Array(64), DSIN = new Array(64), SC = new Array(64), SS = new Array(64)
for (let i = 0; i < 64; i++) {
  DCOS[i] = Math.cos(i * TAU / 64)
  DSIN[i] = Math.sin(i * TAU / 64)
  SC[i] = DCOS[i] * 2.3
  SS[i] = DSIN[i] * 2.3
}
// Interior cell (x, y) is at (y + 3) * PGW + x + 3; the border re-wraps per diffusion.
let trail = new Array(PCELLS).fill(0), scratch = new Array(PCELLS).fill(0)
const ax = new Array(N), ay = new Array(N), ah = new Array(N)
for (let i = 0; i < N; i++) {
  const a = rng() * TAU, r = 3 + rng() * 9
  ax[i] = GW / 2 + 3 + Math.cos(a) * r
  ay[i] = GH / 2 + 3 + Math.sin(a) * r * 0.7
  ah[i] = ((a / TAU * 64 + 16 + (rng() - 0.5) * 12) | 0) & 63
}
const occFlag = new Array(PCELLS).fill(0)
const occArr = new Array(560), jctArr = new Array(480), drawJ = new Array(170)
const runA = new Array(150), runB = new Array(150), isoArr = new Array(100)
let occN = 0, jctN = 0, drawN = 0, runN = 0, isoN = 0
const mkc = (l, a) => ({ k: "c", x: 0, y: 0, r: 1, h: 0, l, a })
const jctPool = [], isoPool = [], agentPool = [], runPool = [], foodPool = [], glintPool = []
for (let i = 0; i < 170; i++) jctPool.push(mkc(58, 0.7))
for (let i = 0; i < 100; i++) isoPool.push(mkc(45, 0.3))
for (let i = 0; i < N; i++) agentPool.push(mkc(52, 0.2))
for (let i = 0; i < 120; i++) runPool.push({ k: "p", pts: [], close: false, h: 0, l: 46, a: 0.45, lw: 1 })
for (let i = 0; i < 16; i++) foodPool.push(i % 2 ? mkc(60, 0.7) : mkc(40, 0.28))
for (let i = 0; i < 10; i++) glintPool.push(mkc(62, 0.5))
const out = [], cellX = new Array(PCELLS).fill(0), cellY = new Array(PCELLS).fill(0)
let runOx = -1, runOy = -1, gi = 0
const foodAt = new Map(), foods = [], glints = []
for (let i = 0; i < 10; i++) glints.push({ on: false, x: 0, y: 0, life: 0 })
const addFood = (px, py, str) => {
  let xi = px | 0, yi = py | 0
  if (xi < 1) xi = 1
  else if (xi > GW - 2) xi = GW - 2
  if (yi < 1) yi = 1
  else if (yi > GH - 2) yi = GH - 2
  const key = (yi + 3) * PGW + xi + 3
  const old = foodAt.get(key)
  if (old) {
    old.s = Math.min(1.6, old.s + str)
    return
  }
  if (occFlag[key] === 1) str *= 1.5
  const f = { x: xi + 0.5, y: yi + 0.5, s: str, key }
  foodAt.set(key, f)
  foods.push(f)
  if (foods.length > 8) {
    const dead = foods.shift()
    foodAt.delete(dead.key)
  }
}
let runStart = -1 // runs of 3+ cells become polylines, else dots
const closeRun = (end) => {
  const len = end - runStart
  if (len >= 3) {
    if (runN < 120) {
      runA[runN] = runStart
      runB[runN] = len
      runN++
    }
  } else {
    for (let q = runStart; q < end && isoN < 100; q++) {
      isoArr[isoN] = q
      isoN++
    }
  }
  runStart = -1
}
// Sim step: sense, steer, move, deposit; every third frame also diffuses + decays,
// rebuilding occupancy, junctions and runs in the same pass, then re-wraps.
const step = (saIdx, speed, deposit, dec, diffuse) => {
  const tr = trail, X = ax, Y = ay, HH = ah, dc = DCOS, ds = DSIN, sc = SC, ss = SS
  for (let i = 0; i < N; i++) {
    const x = X[i], y = Y[i], hi = HH[i]
    const fF = tr[((y + ss[hi]) | 0) * PGW + ((x + sc[hi]) | 0)]
    let hj = (hi - saIdx) & 63
    const fL = tr[((y + ss[hj]) | 0) * PGW + ((x + sc[hj]) | 0)]
    hj = (hi + saIdx) & 63
    const fR = tr[((y + ss[hj]) | 0) * PGW + ((x + sc[hj]) | 0)]
    let ni = hi
    if (fF < fL && fF < fR) ni = (hi + (rng() < 0.5 ? -5 : 5) + 64) & 63
    else if (fL > fF && fL > fR) ni = (hi + 59) & 63
    else if (fR > fF && fR > fL) ni = (hi + 5) & 63
    const cn = dc[ni], sn = ds[ni]
    const j = (rng() - 0.5) * 0.6
    let nx = x + cn * speed - sn * j
    let ny = y + sn * speed + cn * j
    if (nx < 3) nx += GW
    else if (nx >= GW + 3) nx -= GW
    if (ny < 3) ny += GH
    else if (ny >= GH + 3) ny -= GH
    X[i] = nx
    Y[i] = ny
    HH[i] = ni
    const ci = (ny | 0) * PGW + (nx | 0)
    const v = tr[ci] + deposit
    tr[ci] = v > 5 ? 5 : v
  }
  if (!diffuse) return
  for (let j = 0; j < occN; j++) occFlag[occArr[j]] = 0
  occN = 0
  jctN = 0
  runN = 0
  isoN = 0
  const sc2 = scratch, of = occFlag, OA = occArr, JA = jctArr
  for (let y = 0; y < GH; y++) {
    const prow = (y + 3) * PGW + 3
    let cl = tr[prow - 1]
    for (let x = 0; x < GW; x++) {
      const pi = prow + x
      const c = tr[pi]
      const cr = tr[pi + 1]
      const cu = tr[pi - PGW], cd = tr[pi + PGW]
      const nv = (c + (cl + cr + cu + cd) * 0.5) * 0.3333 * dec
      sc2[pi] = nv
      if (nv > 0.5) {
        of[pi] = 1
        if (occN < 560) {
          OA[occN] = pi
          occN++
        }
        if ((cl > 0.5) + (cr > 0.5) + (cu > 0.5) + (cd > 0.5) >= 3 && jctN < 480) {
          JA[jctN] = pi
          jctN++
        }
        if (runStart < 0) runStart = pi
      } else if (runStart >= 0) closeRun(pi)
      cl = cr
    }
    if (runStart >= 0) closeRun(prow + GW)
  }
  const stepJ = jctN > 320 ? 2 : 1
  let m = 0
  for (let j = 0; j < jctN && m < 170; j += stepJ) {
    drawJ[m] = jctArr[j]
    m++
  }
  drawN = m
  trail = sc2
  scratch = tr
  const t2 = trail
  for (let y = 3; y < GH + 3; y++) {
    const r = y * PGW
    for (let b = 0; b < 3; b++) t2[r + b] = t2[r + GW + b], t2[r + GW + 3 + b] = t2[r + 3 + b]
  }
  for (let b = 0; b < 3; b++) {
    for (let x = 0; x < PGW; x++) t2[b * PGW + x] = t2[(GH + b) * PGW + x], t2[(GH + 3 + b) * PGW + x] = t2[(3 + b) * PGW + x]
  }
}
// Warm-up so the web is grown on the first frame.
for (let k = 0; k < 150; k++) step(6, 0.85, 0.28, 0.95, true)
let burst = 0, dphase = 0
while (true) {
  const A = s.audio, dt = s.dt
  const U = Math.min(s.w, s.h) / 800, Ur = U < 0.55 ? 0.55 : U
  const cell = 20 * Ur
  const ox = s.cx - GW * cell / 2, oy = s.cy - GH * cell / 2
  const calm = A.calm || 0, bass = A.bass || 0, kick = A.kick || 0
  const hat = A.hat || 0, energy = A.energy || 0, dropAmt = A.dropAmt || 0
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 10 ? 1 - toDrop / 10 : 0
  const tight = Math.max(build, near) * (1 - Math.min(1, dropAmt * 1.5))

  const hue0 = typeof A.keyHue === "number" ? A.keyHue : 190
  if (A.kickHit) {
    const kr = mulberry32((Math.imul(A.kicks | 0, 0x85ebca6b) + 11) >>> 0)
    addFood(4 + kr() * (GW - 8), 3 + kr() * (GH - 6), 0.9)
  }
  if (A.drop) {
    for (let k = 0; k < 3; k++) addFood(6 + rng() * (GW - 12), 4 + rng() * (GH - 8), 1.3)
    burst = 1
  }
  if (A.snareHit) {
    const sr = mulberry32((Math.imul((A.snares | 0) + 1, 0x9e3779b1) + 97) >>> 0)
    for (let i = (A.snares | 0) % 3; i < N; i += 3) ah[i] = (sr() * 64) | 0
  }

  if (A.hatHit && occN > 0) {
    const g = glints[gi]
    gi = (gi + 1) % glints.length
    const ci = occArr[((A.hats | 0) * 7) % occN]
    g.on = true
    g.x = (ci % PGW) - 3, g.y = ((ci / PGW) | 0) - 3, g.life = 1
  }
  for (let j = foods.length - 1; j >= 0; j--) {
    const f = foods[j]
    f.s *= Math.exp(-dt * 0.45)
    if (f.s < 0.03) {
      foods.splice(j, 1)
      foodAt.delete(f.key)
      continue
    }
    const fc = f.key
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const w9 = dx === 0 && dy === 0 ? 0.5 : dx === 0 || dy === 0 ? 0.24 : 0.12
        trail[fc + dy * PGW + dx] += f.s * w9
      }
    }
  }
  const sa = (0.4 + bass * 0.55) * (1 - tight * 0.3), saIdx = 2 + Math.round(sa * 8)
  const speed = (0.55 + energy * 0.45 + dropAmt * 0.5 + tight * 0.3 + burst * 0.5) * (1 - calm * 0.55)
  dphase = (dphase + 1) % 3
  const diffuse = dphase === 0, dec = 0.955 + calm * 0.03
  step(saIdx, speed, 0.26 + dropAmt * 0.18, diffuse ? dec * Math.sqrt(dec) : dec, diffuse)
  burst *= Math.exp(-dt * 3)
  const moved = runOx !== ox || runOy !== oy
  if (moved) {
    runOx = ox
    runOy = oy
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const pi = (y + 3) * PGW + x + 3
        cellX[pi] = ox + (x + 0.5) * cell
        cellY[pi] = oy + (y + 0.5) * cell
      }
    }
  }
  out.length = 0
  let oi = 0
  const tr = trail, runHue = hue0 + 24
  for (let r = 0; r < runN; r++) {
    const o = runPool[r]
    const pts = o.pts
    if (diffuse || moved) {
      const i0 = runA[r], len = runB[r]
      if (pts.length !== len * 2) pts.length = len * 2
      const y0 = cellY[i0]
      for (let k = 0, q = i0; k < len; k++, q++) {
        pts[k * 2] = cellX[q]
        pts[k * 2 + 1] = y0
      }
      o.a = 0.34 + (len > 8 ? 0.18 : len * 0.02), o.lw = 2 * Ur
    }
    o.h = runHue
    out[oi] = o
    oi++
  }
  const rK = 3.1 * Ur * (1 + kick * 0.3), hK = hue0 + 28, geo = diffuse || moved
  const JP = jctPool, DJ = drawJ
  for (let j = 0; j < drawN; j++) {
    const i = DJ[j]
    const v0 = tr[i]
    const v = v0 > 1.8 ? 1.8 : v0
    const o = JP[j]
    if (geo) o.x = cellX[i], o.y = cellY[i], o.h = hK + v * 24
    o.r = rK * (0.8 + v * 0.25)
    out[oi] = o
    oi++
  }
  for (let q = s.frame % 3; q < isoN; q += 3) {
    const i = isoArr[q]
    const v0 = tr[i]
    const v = v0 > 1.8 ? 1.8 : v0
    const o = isoPool[q]
    o.x = cellX[i], o.y = cellY[i], o.r = 1.5 * Ur * (0.8 + v * 0.25) * (1 + kick * 0.3)
    o.h = hue0 + v * 24, o.l = 45 + v * 7, o.a = 0.22 + v * 0.2
    out[oi] = o
    oi++
  }
  const ahue = hue0 + 160, ar = 1.1 * Ur, aa = 0.22 + hat * 0.14 + dropAmt * 0.1
  const par = s.frame % 5
  const oxA = ox - 3 * cell, oyA = oy - 3 * cell
  const AP = agentPool, X = ax, Y = ay
  for (let i = par; i < N; i += 5) {
    const o = AP[i]
    o.x = oxA + X[i] * cell, o.y = oyA + Y[i] * cell
    o.r = ar, o.h = ahue, o.a = aa
    out[oi] = o
    oi++
  }
  for (let j = 0; j < foods.length; j++) {
    const f = foods[j]
    const fx = ox + f.x * cell, fy = oy + f.y * cell
    const pr = (2.6 + Math.sin(s.t * 5 + j * 1.7) + kick * 1.5) * Ur
    const o1 = foodPool[j * 2]
    o1.x = fx, o1.y = fy, o1.r = pr * (1.6 + f.s), o1.h = hue0 + 90
    const o2 = foodPool[j * 2 + 1]
    o2.x = fx, o2.y = fy, o2.r = pr, o2.h = hue0 + 90
    out[oi] = o1
    oi++
    out[oi] = o2
    oi++
  }
  for (let j = 0; j < glints.length; j++) {
    const g = glints[j]
    if (!g.on) continue
    g.life -= dt * 2.6
    if (g.life <= 0) {
      g.on = false
      continue
    }
    const o = glintPool[j]
    o.x = ox + (g.x + 0.5) * cell, o.y = oy + (g.y + 0.5) * cell
    o.r = (1.4 + (1 - g.life) * 3) * Ur, o.h = hue0 + 140, o.a = g.life * 0.7
    out[oi] = o
    oi++
  }
  out.length = oi
  s = await frame(out, {
    trail: 0.84 + calm * 0.08,
    zoom: 1.003 + kick * 0.012 + dropAmt * 0.01 - tight * 0.005,
    spin: 0.0012,
    hue: 0.6,
    react: { punch: 1.2, slice: 0.4, sparkle: 0.9, shake: 0.7, tint: 0.9 },
  })
}

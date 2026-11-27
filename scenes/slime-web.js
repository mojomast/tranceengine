// name: Slime web
// Physarum polycephalum sim after Jeff Jones (2010): a few hundred slime agents
// sense a coarse trail grid ahead-left/ahead/ahead-right, steer, deposit, and the
// grid diffuses and decays into a glowing web of veins drawn as polylines and dots.
// Psychoscript technique: Map/Set graphs - a Set occupancy set answers adjacency
// queries (vein degree, junctions), a Map is the spatial hash of food sources keyed
// by grid cell, and a seeded mulberry32 PRNG (fixed stream for the sim, per-counter
// streams for kick/snare) so rewinds, beat-repeats and replays redraw the same frames.
// Kick plants a food source the web grows toward, snare scatters a seeded slice of
// agents, hats glint on veins, bass opens the sensor angle, keyHue colours the web,
// build/toDrop pull it tight, the drop bursts it wide; calm slows it.
let s = await frame([])
const TAU = Math.PI * 2
const GW = 44, GH = 26, CELLS = GW * GH
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
// Headings are quantised to 64 directions steered by index: cos/sin come from
// these tables, not from trig calls in the hot loop.
const DCOS = new Array(64), DSIN = new Array(64)
for (let i = 0; i < 64; i++) {
  DCOS[i] = Math.cos(i * TAU / 64)
  DSIN[i] = Math.sin(i * TAU / 64)
}
let trail = new Array(CELLS).fill(0)
let scratch = new Array(CELLS).fill(0)
const ax = new Array(N), ay = new Array(N), ah = new Array(N)
for (let i = 0; i < N; i++) {
  const a = rng() * TAU, r = 3 + rng() * 9
  ax[i] = GW / 2 + Math.cos(a) * r
  ay[i] = GH / 2 + Math.sin(a) * r * 0.7
  ah[i] = ((a / TAU * 64 + 16 + (rng() - 0.5) * 12) | 0) & 63
}
const occ = new Set()
const occArr = new Array(640)
const occDeg = new Array(640)
let occN = 0
const runA = new Array(150), runB = new Array(150)
const isoArr = new Array(130)
let runN = 0, isoN = 0
// Shape pools: the same objects are mutated and re-sent every frame (the worker
// clones them on the way out), so a dense frame costs writes, not allocations.
const dotPool = []
for (let i = 0; i < 320; i++) dotPool.push({ k: "c", x: 0, y: 0, r: 1, h: 0, l: 50, a: 0.5 })
const agentPool = []
for (let i = 0; i < N; i++) agentPool.push({ k: "c", x: 0, y: 0, r: 1, h: 0, l: 52, a: 0.2 })
const runPool = []
for (let i = 0; i < 150; i++) runPool.push({ k: "p", pts: [], close: false, h: 0, l: 46, a: 0.45, lw: 1 })
const foodPool = [], glintPool = []
for (let i = 0; i < 16; i++) foodPool.push({ k: "c", x: 0, y: 0, r: 1, h: 0, l: 50, a: 0.5 })
for (let i = 0; i < 10; i++) glintPool.push({ k: "c", x: 0, y: 0, r: 1, h: 0, l: 62, a: 0.5 })
const foodAt = new Map()
const foods = []
const glints = []
for (let i = 0; i < 10; i++) glints.push({ on: false, x: 0, y: 0, life: 0 })
let gi = 0
const addFood = (px, py, str) => {
  let xi = px | 0, yi = py | 0
  if (xi < 1) xi = 1
  else if (xi > GW - 2) xi = GW - 2
  if (yi < 1) yi = 1
  else if (yi > GH - 2) yi = GH - 2
  const key = yi * GW + xi
  const old = foodAt.get(key)
  if (old) {
    old.s = Math.min(1.6, old.s + str)
    return
  }
  if (occ.has(key)) str *= 1.5
  const f = { x: xi + 0.5, y: yi + 0.5, s: str }
  foodAt.set(key, f)
  foods.push(f)
  if (foods.length > 8) {
    const dead = foods.shift()
    foodAt.delete((dead.y | 0) * GW + (dead.x | 0))
  }
}
// Close a horizontal vein run at cell `end`: runs of 3+ become polylines,
// shorter ones isolated dots. runStart is reset for the next run.
let runStart = -1
const closeRun = (end) => {
  const len = end - runStart
  if (len >= 3) {
    if (runN < 150) {
      runA[runN] = runStart
      runB[runN] = len
      runN++
    }
  } else {
    for (let q = runStart; q < end && isoN < 130; q++) {
      isoArr[isoN] = q
      isoN++
    }
  }
  runStart = -1
}
// One sim step: sense, steer, move, deposit; every second step also diffuses +
// decays the grid and rebuilds occupancy and vein runs in the same pass (dec
// then covers two steps). Agents turn by 5 table steps, about 0.5 rad.
const step = (saIdx, speed, deposit, dec, diffuse) => {
  const so = 2.3
  for (let i = 0; i < N; i++) {
    const x = ax[i], y = ay[i], hi = ah[i]
    let xi = (x + DCOS[hi] * so) | 0, yi = (y + DSIN[hi] * so) | 0
    if (xi < 0) xi = 0
    else if (xi >= GW) xi = GW - 1
    if (yi < 0) yi = 0
    else if (yi >= GH) yi = GH - 1
    const fF = trail[yi * GW + xi]
    let hj = (hi - saIdx) & 63
    xi = (x + DCOS[hj] * so) | 0
    yi = (y + DSIN[hj] * so) | 0
    if (xi < 0) xi = 0
    else if (xi >= GW) xi = GW - 1
    if (yi < 0) yi = 0
    else if (yi >= GH) yi = GH - 1
    const fL = trail[yi * GW + xi]
    hj = (hi + saIdx) & 63
    xi = (x + DCOS[hj] * so) | 0
    yi = (y + DSIN[hj] * so) | 0
    if (xi < 0) xi = 0
    else if (xi >= GW) xi = GW - 1
    if (yi < 0) yi = 0
    else if (yi >= GH) yi = GH - 1
    const fR = trail[yi * GW + xi]
    let ni = hi
    if (fF < fL && fF < fR) ni = (hi + (rng() < 0.5 ? -5 : 5) + 64) & 63
    else if (fL > fF && fL > fR) ni = (hi + 59) & 63
    else if (fR > fF && fR > fL) ni = (hi + 5) & 63
    const j = (rng() - 0.5) * 0.6
    let nx = x + DCOS[ni] * speed - DSIN[ni] * j
    let ny = y + DSIN[ni] * speed + DCOS[ni] * j
    if (nx < 0) nx += GW
    else if (nx >= GW) nx -= GW
    if (ny < 0) ny += GH
    else if (ny >= GH) ny -= GH
    ax[i] = nx
    ay[i] = ny
    ah[i] = ni
    const ci = (ny | 0) * GW + (nx | 0)
    const v = trail[ci] + deposit
    trail[ci] = v > 5 ? 5 : v
  }
  if (!diffuse) return
  occ.clear()
  occN = 0
  runN = 0
  isoN = 0
  for (let y = 0; y < GH; y++) {
    const row = y * GW
    for (let x = 0; x < GW; x++) {
      const i = row + x
      const c = trail[i]
      const cl = x > 0 ? trail[i - 1] : c
      const cr = x < GW - 1 ? trail[i + 1] : c
      const cu = y > 0 ? trail[i - GW] : c
      const cd = y < GH - 1 ? trail[i + GW] : c
      const nv = (c + (cl + cr + cu + cd) * 0.5) * 0.3333 * dec
      scratch[i] = nv
      if (nv > 0.5) {
        occ.add(i)
        if (occN < 640) {
          occArr[occN] = i
          occDeg[occN] = (cl > 0.5 ? 1 : 0) + (cr > 0.5 ? 1 : 0) + (cu > 0.5 ? 1 : 0) + (cd > 0.5 ? 1 : 0)
          occN++
        }
        if (runStart < 0) runStart = i
      } else if (runStart >= 0) closeRun(i)
    }
    if (runStart >= 0) closeRun(row + GW)
  }
  const swap = trail
  trail = scratch
  scratch = swap
}
// Warm-up so the web is already grown on the first frame of a mid-song insert.
for (let k = 0; k < 150; k++) step(6, 0.85, 0.28, 0.95, true)
let burst = 0, diffTick = false, runOx = -1, runOy = -1
while (true) {
  const A = s.audio, dt = s.dt
  const U = Math.min(s.w, s.h) / 800
  const Ur = U < 0.55 ? 0.55 : U
  const cell = 16 * U
  const ox = s.cx - GW * cell / 2, oy = s.cy - GH * cell / 2
  const calm = A.calm || 0
  const bass = A.bass || 0
  const kick = A.kick || 0
  const hat = A.hat || 0
  const energy = A.energy || 0
  const dropAmt = A.dropAmt || 0
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
    g.x = ci % GW
    g.y = (ci / GW) | 0
    g.life = 1
  }
  for (let j = foods.length - 1; j >= 0; j--) {
    const f = foods[j]
    f.s *= Math.exp(-dt * 0.45)
    if (f.s < 0.03) {
      foods.splice(j, 1)
      foodAt.delete((f.y | 0) * GW + (f.x | 0))
      continue
    }
    const fx0 = f.x | 0, fy0 = f.y | 0
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const w9 = dx === 0 && dy === 0 ? 0.5 : dx === 0 || dy === 0 ? 0.24 : 0.12
        trail[(fy0 + dy) * GW + fx0 + dx] += f.s * w9
      }
    }
  }
  const sa = (0.4 + bass * 0.55) * (1 - tight * 0.3)
  const saIdx = 2 + Math.round(sa * 8)
  const speed = (0.55 + energy * 0.45 + dropAmt * 0.5 + tight * 0.3 + burst * 0.5) * (1 - calm * 0.55)
  diffTick = !diffTick
  const dec = 0.955 + calm * 0.03
  step(saIdx, speed, 0.26 + dropAmt * 0.18, diffTick ? dec * dec : dec, diffTick)
  burst *= Math.exp(-dt * 3)
  const out = []
  let oi = 0
  for (let r = 0; r < runN; r++) {
    const o = runPool[r]
    const pts = o.pts
    if (diffTick || runOx !== ox || runOy !== oy) {
      const i0 = runA[r], len2 = runB[r] * 2
      if (pts.length !== len2) pts.length = len2
      const y0 = oy + (((i0 / GW) | 0) + 0.5) * cell
      for (let k = 0; k < len2; k += 2) {
        pts[k] = ox + ((i0 + k / 2) % GW + 0.5) * cell
        pts[k + 1] = y0
      }
    }
    o.h = hue0 + 24
    o.a = 0.34 + (runB[r] > 8 ? 0.18 : runB[r] * 0.02)
    o.lw = 2 * Ur
    out[oi] = o
    oi++
  }
  runOx = ox
  runOy = oy
  let di = 0
  const thinJ = occN > 380
  for (let j = 0; j < occN && di < 320; j++) {
    if (occDeg[j] < 3 || (thinJ && (j & 1) === 1)) continue
    const i = occArr[j]
    const v0 = trail[i]
    const v = v0 > 1.8 ? 1.8 : v0
    const o = dotPool[di]
    di++
    o.x = ox + (i % GW + 0.5) * cell
    o.y = oy + (((i / GW) | 0) + 0.5) * cell
    o.r = 2.4 * Ur * (0.8 + v * 0.25) * (1 + kick * 0.3)
    o.h = hue0 + v * 24 + 28
    o.l = 58
    o.a = 0.7
    out[oi] = o
    oi++
  }
  for (let q = 0; q < isoN && di < 320; q++) {
    const i = isoArr[q]
    const v0 = trail[i]
    const v = v0 > 1.8 ? 1.8 : v0
    const o = dotPool[di]
    di++
    o.x = ox + (i % GW + 0.5) * cell
    o.y = oy + (((i / GW) | 0) + 0.5) * cell
    o.r = 1.3 * Ur * (0.8 + v * 0.25) * (1 + kick * 0.3)
    o.h = hue0 + v * 24
    o.l = 45 + v * 7
    o.a = 0.22 + v * 0.2
    out[oi] = o
    oi++
  }
  const ahue = hue0 + 160
  const ar = 1.1 * Ur
  const aa = 0.18 + hat * 0.14 + dropAmt * 0.1
  const par = s.frame & 1
  for (let i = par; i < N; i += 2) {
    const o = agentPool[i]
    o.x = ox + ax[i] * cell
    o.y = oy + ay[i] * cell
    o.r = ar
    o.h = ahue
    o.a = aa
    out[oi] = o
    oi++
  }
  for (let j = 0; j < foods.length; j++) {
    const f = foods[j]
    const fx = ox + f.x * cell, fy = oy + f.y * cell
    const pr = (2.6 + Math.sin(s.t * 5 + j * 1.7) + kick * 1.5) * Ur
    const o1 = foodPool[j * 2]
    o1.x = fx
    o1.y = fy
    o1.r = pr * (1.6 + f.s)
    o1.h = hue0 + 90
    o1.l = 40
    o1.a = 0.28
    const o2 = foodPool[j * 2 + 1]
    o2.x = fx
    o2.y = fy
    o2.r = pr
    o2.h = hue0 + 90
    o2.l = 60
    o2.a = 0.7
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
    o.x = ox + (g.x + 0.5) * cell
    o.y = oy + (g.y + 0.5) * cell
    o.r = (1.4 + (1 - g.life) * 3) * Ur
    o.h = hue0 + 140
    o.a = g.life * 0.7
    out[oi] = o
    oi++
  }
  s = await frame(out, {
    trail: 0.84 + calm * 0.08,
    zoom: 1.003 + kick * 0.012 + dropAmt * 0.01 - tight * 0.005,
    spin: 0.0012,
    hue: 0.6,
    react: { punch: 1.2, slice: 0.4, sparkle: 0.9, shake: 0.7, tint: 0.9 },
  })
}

// name: Truchet weave
// A generative Smith quarter-circle Truchet weave: one grid, two arcs per tile,
// a seeded mulberry32 PRNG choosing each tile's orientation. Every beat a
// diagonal wave of tiles turns 90 degrees; kickHit flips a whole row, snareHit
// flips a column, hatHit drops glints, bass sets line weight, keyHue tints the
// lines and bands add coloured patches, build shrinks the tiles, drop turns every
// tile at once, and calm slows the easing and lengthens the trail.
// Technique notes: arc polylines come from shape pools (objects and point arrays
// reused every frame), tile rotation cos/sin come from a 1024-step sine table, and
// the per-tile beat-delay floors are tabulated once per frame (19 distinct delays).
let s = await frame([])
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const HALF = Math.PI / 2
const N = 10, NM = N - 1, N2 = N * N
const AP = 6
// Quarter-circle template, scaled by the tile size once per frame into asx/asy.
const arc = []
for (let i = 0; i < AP; i++) {
  const a = Math.PI + (i / (AP - 1)) * HALF
  arc.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5)
}
const asx = new Array(AP), asy = new Array(AP)
// Sine table over a full turn; cos(x) is sin(x + 256).
const TS = new Array(1024)
for (let i = 0; i < 1024; i++) TS[i] = Math.sin(i * (Math.PI * 2 / 1024))
const rng = mulberry32(0x9e3779b9)
const base = [], cur = [], ijs = [], ij25 = [], biA = []
for (let i = 0; i < N; i++) {
  for (let j = 0; j < N; j++) {
    base.push(Math.floor(rng() * 4))
    cur.push(0)
    ijs.push(i + j)
    ij25.push((i + j) * 2.5)
    biA.push((i * 5 + j * 3) % 32)
  }
}
const rowFlip = [], colFlip = []
for (let i = 0; i < N; i++) { rowFlip.push(0); colFlip.push(0) }
// Shape pools: two arc polylines per tile plus the hat glints, mutated in place.
const arcA = [], arcB = []
for (let i = 0; i < N2; i++) {
  arcA.push({ k: "p", pts: new Array(AP * 2), h: 0, s: 85, l: 46, a: 0.4, lw: 1 })
  arcB.push({ k: "p", pts: new Array(AP * 2), h: 0, s: 82, l: 44, a: 0.4, lw: 1 })
}
const glintPool = []
for (let i = 0; i < 14; i++) glintPool.push({ k: "c", x: 0, y: 0, r: 1, h: 0, s: 78, l: 62, a: 0 })
const out = []
const fl = new Array(2 * NM + 1)
const rowY = new Array(N)
const bh32 = new Array(32)
let dropTurns = 0
const glints = []
for (let i = 0; i < 14; i++) glints.push({ x: 0, y: 0, life: 0 })
let gi = 0, first = true
while (true) {
  const A = s.audio, dt = s.dt || 0.016
  const span = Math.min(s.w || 1, s.h || 1)
  const U = span / 800
  const T = (span * 0.84) / N
  const ox = s.cx - (N * T) / 2, oy = s.cy - (N * T) / 2
  const calm = A.calm || 0
  const kick = A.kick || 0
  const bass = A.bass || 0
  const hat = A.hat || 0
  const lvl = A.level || 0
  const dev = A.dropAmt || 0
  const hue0 = typeof A.keyHue === "number" ? A.keyHue : 200
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 12 ? Math.max(0, 1 - toDrop / 12) : 0
  const gather = Math.max(build, near * 0.5)
  const S = T * (1 - gather * 0.3)
  const beatPos = (A.beats || 0) + (A.phase || 0)
  const ease = Math.min(1, dt * (10 + kick * 8) * (1 - calm * 0.5))
  const l0 = Math.min(65, 46 + bass * 8 + kick * 7 + dev * 6)
  const lB = l0 - 2
  const alpha = Math.min(0.72, 0.3 + lvl * 0.16 + hat * 0.06) * (1 - calm * 0.12)
  const lw = Math.max(0.8, (1 + bass * 2.4 + kick * 1.6) * U * (1 - calm * 0.2))
  const bands = A.bands || []
  if (A.kickHit) rowFlip[(((A.kicks || 0) % N) + N) % N] += 1
  if (A.snareHit) colFlip[(((A.snares || 0) % N) + N) % N] += 1
  if (A.drop) dropTurns += 1
  for (let d = 0; d <= 2 * NM; d++) fl[d] = Math.floor(beatPos - (d / (2 * NM)) * 0.6)
  for (let j = 0; j < N; j++) rowY[j] = oy + (j + 0.5) * T
  for (let b = 0; b < 32; b++) bh32[b] = bands[b] === undefined ? 0 : (bands[b] - 0.5) * 36
  for (let p = 0; p < AP; p++) {
    asx[p] = arc[p * 2] * S
    asy[p] = arc[p * 2 + 1] * S
  }
  const hueT = hue0 + s.t * 4
  out.length = 0
  let oi = 0, k = 0
  for (let i = 0; i < N; i++) {
    const tx = ox + (i + 0.5) * T
    const rf = rowFlip[i]
    for (let j = 0; j < N; j++, k++) {
      const tt = base[k] + rf + colFlip[j] + fl[ijs[k]] + dropTurns
      if (first) cur[k] = tt
      else {
        const diff = tt - cur[k]
        if (diff > 2.5 || diff < -2.5) cur[k] = tt
        else cur[k] += diff * ease
      }
      const ix = Math.round(cur[k] * (512 / Math.PI))
      const i0 = ((ix % 1024) + 1024) & 1023
      const c = TS[(i0 + 256) & 1023], sn = TS[i0]
      const ty = rowY[j]
      const hue = hueT + ij25[k] + bh32[biA[k]]
      const oA = arcA[k], ptsA = oA.pts
      const oB = arcB[k], ptsB = oB.pts
      for (let p = 0, q = 0; p < AP; p++, q += 2) {
        const px = asx[p], py = asy[p]
        const rx = px * c - py * sn
        const ry = px * sn + py * c
        ptsA[q] = tx + rx
        ptsA[q + 1] = ty + ry
        ptsB[q] = tx - rx
        ptsB[q + 1] = ty - ry
      }
      oA.h = hue
      oA.l = l0
      oA.a = alpha
      oA.lw = lw
      oB.h = hue + 12
      oB.l = lB
      oB.a = alpha
      oB.lw = lw
      out[oi] = oA
      out[oi + 1] = oB
      oi += 2
    }
  }
  first = false
  if (A.hatHit) {
    const g = glints[gi]
    gi = (gi + 1) % glints.length
    const hh = Math.imul(((A.hats || 0) | 0) + 1, 2654435761) >>> 0
    const hh2 = Math.imul(hh ^ (hh >>> 15), 2246822519) >>> 0
    g.x = ox + ((hh >>> 8) % 65536) / 65536 * N * T
    g.y = oy + ((hh2 >>> 8) % 65536) / 65536 * N * T
    g.life = 1
  }
  for (let q = 0; q < glints.length; q++) {
    const g = glints[q]
    if (g.life <= 0) continue
    g.life -= dt * 3
    if (g.life <= 0) continue
    const o = glintPool[q]
    o.x = g.x
    o.y = g.y
    o.r = (1.4 + hat * 2.2) * U * g.life + 0.4
    o.h = hue0 + 150
    o.a = g.life * 0.75
    out[oi] = o
    oi++
  }
  out.length = oi
  s = await frame(out, {
    trail: 0.56 + calm * 0.12 + dev * 0.04,
    zoom: 1 + kick * 0.008 + dev * 0.006,
    spin: 0.0009 * (1 - calm * 0.6),
    hue: 0.4 + (A.high || 0) * 0.8,
  })
}

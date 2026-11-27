// name: Truchet weave
// A generative Smith quarter-circle Truchet weave: one grid, two arcs per tile,
// a seeded mulberry32 PRNG choosing each tile's orientation. Every beat a
// diagonal wave of tiles turns 90 degrees; kickHit flips a whole row, snareHit
// flips a column, hatHit drops glints, bass sets line weight, keyHue tints the
// lines and bands add coloured patches, build shrinks the tiles, drop turns every
// tile at once, and calm slows the easing and lengthens the trail.
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
const AP = 8
const arc = []
for (let i = 0; i < AP; i++) {
  const a = Math.PI + (i / (AP - 1)) * HALF
  arc.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5)
}
const rng = mulberry32(0x9e3779b9)
const base = [], cur = [], delay = []
for (let i = 0; i < N; i++) {
  for (let j = 0; j < N; j++) {
    base.push(Math.floor(rng() * 4))
    cur.push(0)
    delay.push(((i + j) / (2 * NM)) * 0.6)
  }
}
const rowFlip = [], colFlip = []
for (let i = 0; i < N; i++) { rowFlip.push(0); colFlip.push(0) }
let dropTurns = 0
const glints = []
for (let i = 0; i < 14; i++) glints.push({ x: 0, y: 0, life: 0 })
let gi = 0, first = true
while (true) {
  const A = s.audio, out = []
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
  const ease = Math.min(1, (s.dt || 0.016) * (10 + kick * 8) * (1 - calm * 0.5))
  const l0 = Math.min(65, 46 + bass * 8 + kick * 7 + dev * 6)
  const alpha = Math.min(0.72, 0.3 + lvl * 0.16 + hat * 0.06) * (1 - calm * 0.12)
  const lw = Math.max(0.8, (1 + bass * 2.4 + kick * 1.6) * U * (1 - calm * 0.2))
  const bands = A.bands || []
  if (A.kickHit) rowFlip[(((A.kicks || 0) % N) + N) % N] += 1
  if (A.snareHit) colFlip[(((A.snares || 0) % N) + N) % N] += 1
  if (A.drop) dropTurns += 1
  let k = 0
  for (let i = 0; i < N; i++) {
    const tx = ox + (i + 0.5) * T
    for (let j = 0; j < N; j++, k++) {
      const tt = base[k] + rowFlip[i] + colFlip[j] + Math.floor(beatPos - delay[k]) + dropTurns
      if (first) cur[k] = tt
      else {
        const diff = tt - cur[k]
        if (diff > 2.5 || diff < -2.5) cur[k] = tt
        else cur[k] += diff * ease
      }
      const ang = cur[k] * HALF
      const c = Math.cos(ang), sn = Math.sin(ang)
      const ty = oy + (j + 0.5) * T
      const bi = (i * 5 + j * 3) % 32
      const bh = bands[bi] === undefined ? 0.5 : bands[bi]
      const hue = hue0 + s.t * 4 + (i + j) * 2.5 + (bh - 0.5) * 36
      const ptsA = [], ptsB = []
      for (let p = 0; p < AP * 2; p += 2) {
        const px = arc[p], py = arc[p + 1]
        const rx = (px * c - py * sn) * S
        const ry = (px * sn + py * c) * S
        ptsA.push(tx + rx, ty + ry)
        ptsB.push(tx - rx, ty - ry)
      }
      out.push({ k: "p", pts: ptsA, h: hue, s: 85, l: l0, a: alpha, lw })
      out.push({ k: "p", pts: ptsB, h: hue + 12, s: 82, l: l0 - 2, a: alpha, lw })
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
    g.life -= (s.dt || 0.016) * 3
    if (g.life <= 0) continue
    out.push({ k: "c", x: g.x, y: g.y, r: (1.4 + hat * 2.2) * U * g.life + 0.4, h: hue0 + 150, s: 78, l: 62, a: g.life * 0.75 })
  }
  s = await frame(out, {
    trail: 0.56 + calm * 0.12 + dev * 0.04,
    zoom: 1 + kick * 0.008 + dev * 0.006,
    spin: 0.0009 * (1 - calm * 0.6),
    hue: 0.4 + (A.high || 0) * 0.8,
  })
}

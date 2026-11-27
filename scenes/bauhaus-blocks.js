// name: Bauhaus blocks
// Bauhaus / Dessau poster geometry after Moholy-Nagy and Bayer: circles, squares,
// right triangles and quarter-discs on warm paper in a muted primary palette.
// Psychoscript technique: a seeded mulberry32 PRNG seeded from the song's beat
// counter draws a new composition on every beat, so rewinds, beat-repeats and
// replays redraw exactly the same layouts while the blocks glide there on eased
// slides. Kick scales the big circle, snare rocks the triangles, hats tick seeded
// dots, keyHue nudges the palette, bass weights the ring, calm slows the glide,
// build/toDrop pull the blocks inward and the drop springs them open. The red
// square is a fixed anchor and never alternates.
let s = await frame([])
const HALF = Math.PI / 2
const mulberry32 = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const seedOf = (i) => (Math.imul(((i | 0) + 0x3c6ef372) | 0, 0x85ebca6b) ^ 0x27d4eb2f) >>> 0
const SQ = [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]
const TRI = [-0.5, -0.5, 0.5, -0.5, -0.5, 0.5]
const QP = [-0.5, -0.5]
for (let i = 0; i < 6; i++) {
  const a = (i / 5) * HALF
  QP.push(Math.cos(a) - 0.5, Math.sin(a) - 0.5)
}
const mk = (kind, h, sat, lit, alpha, x, y, size, rot) => {
  const o = { kind, h, sat, lit, alpha, x, y, size, rot, s0: size, tx: x, ty: y, ts: size, tr: rot }
  if (kind !== "circle") {
    const geo = kind === "square" ? SQ : kind === "tri" ? TRI : QP
    const pts = []
    for (let i = 0; i < geo.length; i++) pts.push(0)
    o.geo = geo
    o.pts = pts
  }
  return o
}
const blocks = [
  mk("circle", 212, 48, 52, 0.92, 0.5, 0.5, 0.4, 0),
  mk("tri", 44, 60, 58, 0.92, 2 / 3, 1 / 6, 0.26, 0),
  mk("quarter", 220, 16, 32, 0.92, 5 / 6, 5 / 6, 0.3, 0),
  mk("square", 40, 24, 62, 0.9, 1 / 6, 5 / 6, 0.2, 0),
  mk("quarter", 212, 48, 52, 0.9, 5 / 6, 1 / 2, 0.22, HALF),
  mk("tri", 30, 52, 52, 0.9, 0.5, 5 / 6, 0.16, HALF),
]
const paper = [0, 0, 0, 0, 0, 0, 0, 0]
const anchorPts = [0, 0, 0, 0, 0, 0, 0, 0]
const dots = []
const dRng = mulberry32(0x51ed0d)
for (let i = 0; i < 14; i++) dots.push({ x: 0.06 + dRng() * 0.88, y: 0.06 + dRng() * 0.88, life: 0 })
let dotNext = 0
const cells = [1, 2, 3, 4, 5, 6, 7, 8]
let first = true, lastBeat = 0
while (true) {
  const A = s.audio, out = [], dt = Math.min(0.05, s.dt || 0.016)
  const span = Math.max(1, Math.min(s.w || 1, s.h || 1))
  const U = span / 800
  const P = span * 0.78
  const ox = s.cx - P / 2, oy = s.cy - P / 2
  const bass = A.bass || 0, kick = A.kick || 0, snare = A.snare || 0
  const hat = A.hat || 0, calm = A.calm || 0, drops = A.dropAmt || 0
  const kh = typeof A.keyHue === "number" ? A.keyHue : 200
  const tint = (kh - 200) * 0.05
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 8 ? Math.max(0, 1 - toDrop / 8) : 0
  const gather = Math.max(build, near) * (1 - Math.min(1, drops * 1.5))
  const beatIdx = typeof A.beats === "number" ? A.beats : 0
  if (first) {
    first = false
    lastBeat = beatIdx
  }
  else if (beatIdx !== lastBeat) {
    lastBeat = beatIdx
    const rr = mulberry32(seedOf(beatIdx))
    for (let i = cells.length - 1; i > 0; i--) {
      const j = (rr() * (i + 1)) | 0
      const t = cells[i]
      cells[i] = cells[j]
      cells[j] = t
    }
    for (let i = 0; i < blocks.length; i++) {
      const o = blocks[i], cell = cells[i]
      o.tx = ((cell % 3) + 0.5) / 3 + (rr() - 0.5) * 0.05
      o.ty = (((cell / 3) | 0) + 0.5) / 3 + (rr() - 0.5) * 0.05
      o.ts = Math.min(0.5, Math.max(0.12, o.s0 * (0.85 + rr() * 0.35)))
      o.tr = ((rr() * 4) | 0) * HALF
    }
  }
  const ease = 1 - Math.exp(-dt * (6 + kick * 5) * (1 - calm * 0.6))
  const pinch = 1 - gather * 0.18
  const pop = 1 + drops * 0.14
  paper[0] = ox
  paper[1] = oy
  paper[2] = ox + P
  paper[3] = oy
  paper[4] = ox + P
  paper[5] = oy + P
  paper[6] = ox
  paper[7] = oy + P
  out.push({ k: "p", pts: paper, fill: true, h: 40, s: 18, l: 56, a: 0.92 })
  for (let i = 0; i < blocks.length; i++) {
    const o = blocks[i]
    o.x += (o.tx - o.x) * ease
    o.y += (o.ty - o.y) * ease
    o.size += (o.ts - o.size) * ease
    o.rot += (o.tr - o.rot) * ease
    const gx = 0.5 + (o.x - 0.5) * (1 - gather * 0.22)
    const gy = 0.5 + (o.y - 0.5) * (1 - gather * 0.22)
    const sz = o.size * pinch * pop
    const hu = o.h + tint
    const li = Math.min(65, o.lit + bass * 5)
    if (o.kind === "circle") {
      const half = sz * 0.72
      const px = ox + Math.min(1 - half, Math.max(half, gx)) * P
      const py = oy + Math.min(1 - half, Math.max(half, gy)) * P
      const rad = sz * P * (0.5 + kick * 0.18)
      out.push({ k: "c", x: px, y: py, r: rad, h: hu, s: o.sat, l: li, a: o.alpha })
      out.push({ k: "c", x: px, y: py, r: rad * (1.22 + drops * 0.18), fill: false,
        h: hu + 8, s: o.sat - 8, l: Math.min(65, li - 2), a: 0.42 + bass * 0.2,
        lw: (1.2 + bass * 3.2 + kick * 1.4) * U })
    } else {
      const half = sz * 0.5
      const px = ox + Math.min(1 - half, Math.max(half, gx)) * P
      const py = oy + Math.min(1 - half, Math.max(half, gy)) * P
      const ang = o.rot + (o.kind === "tri" ? snare * 0.6 : 0)
      const cr = Math.cos(ang), sr = Math.sin(ang)
      const geo = o.geo, pts = o.pts
      for (let p = 0; p < geo.length; p += 2) {
        const ux = geo[p] * sz * P, uy = geo[p + 1] * sz * P
        pts[p] = px + ux * cr - uy * sr
        pts[p + 1] = py + ux * sr + uy * cr
      }
      out.push({ k: "p", pts, fill: true, h: hu, s: o.sat, l: li, a: o.alpha })
    }
  }
  const as = 0.26 * P, ax = ox + P / 6, ay = oy + P / 6
  anchorPts[0] = ax - as / 2
  anchorPts[1] = ay - as / 2
  anchorPts[2] = ax + as / 2
  anchorPts[3] = ay - as / 2
  anchorPts[4] = ax + as / 2
  anchorPts[5] = ay + as / 2
  anchorPts[6] = ax - as / 2
  anchorPts[7] = ay + as / 2
  out.push({ k: "p", pts: anchorPts, fill: true, h: 3, s: 62, l: 48, a: 0.95 })
  if (A.hatHit) {
    const d = dots[dotNext]
    dotNext = (dotNext + 1) % dots.length
    d.life = 1
  }
  for (let i = 0; i < dots.length; i++) {
    const d = dots[i]
    if (d.life <= 0) continue
    d.life -= dt * 3.2
    if (d.life <= 0) {
      d.life = 0
      continue
    }
    out.push({ k: "c", x: ox + d.x * P, y: oy + d.y * P, r: (1.5 + hat * 2.2 + bass * 0.8) * U,
      h: (i % 3 === 0 ? 212 : 44) + tint, s: 60, l: 62, a: Math.min(0.82, d.life) })
  }
  out.push({ k: "p", pts: paper, fill: false, h: 220, s: 12, l: 30, a: 0.55, lw: (1 + bass * 0.8) * U })
  s = await frame(out, {
    trail: 0.08 + calm * 0.14,
    zoom: 1 + kick * 0.008 + drops * 0.006,
    spin: 0,
    hue: 0,
    blend: "source-over",
  })
}

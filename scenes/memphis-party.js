// name: Memphis party
// Memphis Group (1980s) poster collage: cream paper, black grid patches, pastel
// semicircles, squiggles, zigzags and confetti. A seeded mulberry32 PRNG (Math.imul)
// keeps every ornament identical on rewind; hats spring pieces in, kickHit and the
// downbeat pop the centre, snare swaps palette, bass weights, build floods, toDrop
// gathers, drop spins once, calm slows the drift and keyHue tints the paper.
let s = await frame([])
const TAU = Math.PI * 2
const mulberry32 = (a) => () => {
  a = (a + 0x6d2b79f5) >>> 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const rnd = mulberry32(0x51e9a7f3)
const mkPts = (n) => {
  const p = []
  for (let i = 0; i < n; i++) p.push(0)
  return p
}
const PAL = [
  [344, 188, 48, 268, 22, 156],
  [198, 322, 46, 238, 208, 168],
  [262, 24, 196, 52, 330, 148],
]
const wave = [], zig = [], semi = []
for (let i = 0; i < 24; i++) {
  const x = i / 23 - 0.5
  wave.push(x, Math.sin(x * TAU * 2) * 0.1)
}
for (let i = 0; i < 11; i++) zig.push(i / 10 - 0.5, i % 2 ? 0.09 : -0.09)
for (let i = 0; i <= 10; i++) {
  const a = Math.PI * i / 10
  semi.push(Math.cos(a) * 0.5, -Math.sin(a) * 0.5)
}
const circles = [
  { x: -0.26, y: 0.01, r: 0.205, slot: 0, fill: true, lit: 58, a: 0.9, w: 0 },
  { x: 0.30, y: 0.10, r: 0.10, slot: 2, fill: true, lit: 60, a: 0.92, w: 0 },
  { x: 0.30, y: -0.25, r: 0.15, slot: 1, fill: false, lit: 54, a: 0.85, w: 1.6 },
]
const semis = []
{
  const cfg = [[-0.20, 0.27, 0.20, Math.PI, 1, 56], [0.31, -0.02, 0.12, -Math.PI / 2, 3, 56]]
  for (const c of cfg) semis.push({ x: c[0], y: c[1], r: c[2], rot: c[3], slot: c[4], lit: c[5], pts: mkPts(semi.length) })
}
const squigs = []
{
  const cfg = [[0.0, -0.33, 0.66, 0.02, 0, 0.9, 52], [-0.14, 0.34, 0.74, 0.06, 2, 1.2, 50],
    [0.30, 0.27, 0.42, 1.1, 3, 0.8, 50]]
  for (const c of cfg) squigs.push({ x: c[0], y: c[1], len: c[2], rot: c[3], slot: c[4], w: c[5], lit: c[6], pts: mkPts(wave.length) })
}
const zigs = []
{
  const cfg = [[0.22, -0.40, 0.55, 0, 3, 52], [-0.36, 0.12, 0.30, Math.PI / 2, 4, 52]]
  for (const c of cfg) zigs.push({ x: c[0], y: c[1], len: c[2], rot: c[3], slot: c[4], lit: c[5], pts: mkPts(zig.length) })
}
const grids = []
{
  const cfg = [[-0.30, -0.31, 0.30, 0.17, 0], [0.32, 0.30, 0.22, -0.13, 1]]
  for (const c of cfg) {
    const tiles = []
    for (let gy = 0; gy < 4; gy++) {
      for (let gx = 0; gx < 4; gx++) {
        if ((gx + gy) % 2) continue
        tiles.push({ lx: -0.5 + (gx + 0.5) / 4, ly: -0.5 + (gy + 0.5) / 4, half: 0.125, pts: mkPts(8) })
      }
    }
    grids.push({ x: c[0], y: c[1], size: c[2], rot: c[3], tone: c[4], tiles })
  }
}
const dots = []
for (let i = 0; i < 26; i++) {
  dots.push({ x: (rnd() - 0.5) * 0.92, y: (rnd() - 0.5) * 0.84, r: 0.008 + rnd() * 0.012,
    slot: (rnd() * 6) | 0, ph: rnd() * TAU })
}
const orn = []
for (let i = 0; i < 14; i++) {
  orn.push({ bx: (rnd() - 0.5) * 0.9, by: (rnd() - 0.5) * 0.8, rot: rnd() * TAU,
    size: 0.05 + rnd() * 0.07, kind: i % 6, ci: (rnd() * 6) | 0, ph: rnd() * TAU,
    amp: 0.004 + rnd() * 0.008, age: 10, pts: mkPts(wave.length), pts2: mkPts(8) })
}
let ornNext = 0
let pop = 0, spin = 0, spinV = 0
const bgPts = mkPts(8)
while (true) {
  const A = s.audio, dt = Math.min(0.05, s.dt || 0.016), out = []
  const W = s.w || 1, H = s.h || 1
  const span = Math.max(1, Math.min(W, H)), P = span * 0.86, PX = Math.max(P, W * 0.7)
  const calm = A.calm || 0, kick = A.kick || 0, bass = A.bass || 0
  const snare = A.snare || 0, hat = A.hat || 0, drops = A.dropAmt || 0
  const speed = 1 - calm * 0.65
  const build = typeof A.build === "number" && A.build > 0 ? A.build : 0
  const toDrop = typeof A.toDrop === "number" && A.toDrop > 0 && A.toDrop < 99 ? A.toDrop : 99
  const near = toDrop < 8 ? Math.max(0, 1 - toDrop / 8) : 0
  const tense = near * (1 - Math.min(1, drops * 2))
  const comp = 1 + build * 0.16
  const kh = A.keyHue || 200
  const tint = (kh - 200) * 0.04
  const pal = PAL[(((A.snares | 0) % 3) + 3) % 3]
  const lwBase = Math.max(1.2, span * 0.0085)
  if (A.kickHit || A.downbeat) pop = 1
  pop *= Math.exp(-dt * 3.4)
  if (A.drop) spinV = TAU * 2.2
  spin += spinV * dt
  spinV *= Math.exp(-dt * 2.2)
  if (A.hatHit) {
    const o = orn[ornNext]
    ornNext = (ornNext + 1) % orn.length
    const r = mulberry32(((A.hats | 0) * 131 + ornNext) | 0)
    o.bx = (r() - 0.5) * 0.9
    o.by = (r() - 0.5) * 0.8
    o.kind = (r() * 6) | 0
    o.ci = (r() * 6) | 0
    o.rot = r() * TAU
    o.size = 0.05 + r() * 0.07
    o.ph = r() * TAU
    o.amp = 0.004 + r() * 0.008
    o.age = 0
  }
  const cosS = Math.cos(spin), sinS = Math.sin(spin)
  bgPts[0] = 0; bgPts[1] = 0; bgPts[2] = W; bgPts[3] = 0
  bgPts[4] = W; bgPts[5] = H; bgPts[6] = 0; bgPts[7] = H
  out.push({ k: "p", pts: bgPts, fill: true, h: 44 + tint, s: 30, l: 59, a: 1 })
  if (build > 0.02) {
    out.push({ k: "c", x: s.cx, y: s.cy, r: span * (0.18 + build * 0.95),
      h: pal[3] + tint, s: 52, l: 58, a: 0.10 + build * 0.20 })
  }
  for (let gi = 0; gi < grids.length; gi++) {
    const g = grids[gi]
    const size = g.size * P * (1 + bass * 0.04 + build * 0.06)
    const gr = spin + g.rot + (s.t * 0.025 + gi * 0.3) * speed
    const gc = Math.cos(gr), gs = Math.sin(gr)
    const bxg = g.x * PX * comp, byg = g.y * P * comp
    const gcx = s.cx + bxg * cosS - byg * sinS
    const gcy = s.cy + bxg * sinS + byg * cosS
    for (let ti = 0; ti < g.tiles.length; ti++) {
      const t = g.tiles[ti], pts = t.pts
      const ox = t.lx * size, oy = t.ly * size
      const ccx = gcx + ox * gc - oy * gs
      const ccy = gcy + ox * gs + oy * gc
      const hx = t.half * size
      const ux = hx * gc, uy = hx * gs, vx = -hx * gs, vy = hx * gc
      pts[0] = ccx - ux - vx; pts[1] = ccy - uy - vy
      pts[2] = ccx + ux - vx; pts[3] = ccy + uy - vy
      pts[4] = ccx + ux + vx; pts[5] = ccy + uy + vy
      pts[6] = ccx - ux + vx; pts[7] = ccy - uy + vy
      if (g.tone === 0) out.push({ k: "p", pts, fill: true, h: 0, s: 0, l: 17, a: 0.92 })
      else out.push({ k: "p", pts, fill: true, h: pal[5] + tint, s: 60, l: 56, a: 0.9 })
    }
  }
  for (let i = 0; i < circles.length; i++) {
    const c = circles[i]
    const bx = c.x * PX * comp, by = c.y * P * comp
    const x = s.cx + bx * cosS - by * sinS
    const y = s.cy + bx * sinS + by * cosS
    const r = c.r * P * (1 + bass * 0.05 + pop * 0.02)
    if (c.fill) out.push({ k: "c", x, y, r, h: pal[c.slot] + tint, s: 62, l: c.lit, a: c.a })
    else out.push({ k: "c", x, y, r, fill: false, h: pal[c.slot] + tint, s: 64, l: c.lit, a: c.a,
      lw: c.w * lwBase * (1 + bass * 0.5) })
  }
  for (let i = 0; i < semis.length; i++) {
    const m = semis[i]
    const bx = m.x * PX * comp, by = m.y * P * comp
    const x = s.cx + bx * cosS - by * sinS
    const y = s.cy + bx * sinS + by * cosS
    const rot = spin + m.rot + Math.sin(s.t * 0.12 + i) * 0.05 * speed
    const cs = Math.cos(rot), sn = Math.sin(rot)
    const rad = m.r * P * (1 + bass * 0.04)
    for (let p = 0; p < semi.length; p += 2) {
      m.pts[p] = x + (semi[p] * cs - semi[p + 1] * sn) * rad
      m.pts[p + 1] = y + (semi[p] * sn + semi[p + 1] * cs) * rad
    }
    out.push({ k: "p", pts: m.pts, fill: true, h: pal[m.slot] + tint, s: 62, l: m.lit, a: 0.9 })
  }
  for (let i = 0; i < squigs.length; i++) {
    const q = squigs[i]
    const bx = q.x * PX * comp, by = q.y * P * comp
    const x = s.cx + bx * cosS - by * sinS
    const y = s.cy + bx * sinS + by * cosS
    const rot = spin + q.rot + Math.sin(s.t * 0.15 + i * 0.7) * 0.06 * speed + snare * 0.05
    const cs = Math.cos(rot), sn = Math.sin(rot)
    const len = q.len * P * comp
    for (let p = 0; p < wave.length; p += 2) {
      q.pts[p] = x + (wave[p] * cs - wave[p + 1] * sn) * len
      q.pts[p + 1] = y + (wave[p] * sn + wave[p + 1] * cs) * len
    }
    out.push({ k: "p", pts: q.pts, close: false, h: pal[q.slot] + tint, s: 66, l: q.lit,
      a: 0.92, lw: lwBase * q.w * (1 + bass * 0.5) })
  }
  for (let i = 0; i < zigs.length; i++) {
    const z = zigs[i]
    const bx = z.x * PX * comp, by = z.y * P * comp
    const x = s.cx + bx * cosS - by * sinS
    const y = s.cy + bx * sinS + by * cosS
    const rot = spin + z.rot + snare * 0.18 + Math.sin(s.t * 0.3 + i) * 0.05
    const cs = Math.cos(rot), sn = Math.sin(rot)
    const len = z.len * P * comp
    for (let p = 0; p < zig.length; p += 2) {
      z.pts[p] = x + (zig[p] * cs - zig[p + 1] * sn) * len
      z.pts[p + 1] = y + (zig[p] * sn + zig[p + 1] * cs) * len
    }
    out.push({ k: "p", pts: z.pts, close: false, h: pal[z.slot] + tint, s: 66, l: z.lit,
      a: 0.92, lw: lwBase * 0.8 })
  }
  for (let i = 0; i < dots.length; i++) {
    const d = dots[i]
    const ux = d.x * comp + Math.sin(s.t * 0.22 + d.ph) * 0.006
    const uy = d.y * comp + Math.cos(s.t * 0.18 + d.ph) * 0.006
    const bx = ux * PX, by = uy * P
    const x = s.cx + bx * cosS - by * sinS
    const y = s.cy + bx * sinS + by * cosS
    const r = Math.max(0.7, d.r * P * (1 + bass * 0.7 + hat * 0.6))
    out.push({ k: "c", x, y, r, h: pal[d.slot] + tint, s: 64, l: 59, a: 0.9 })
  }
  for (let i = 0; i < orn.length; i++) {
    const o = orn[i]
    o.age += dt * (1 - calm * 0.5)
    const sc = o.age < 1.4 ? 1 - Math.exp(-o.age * 8) * Math.cos(o.age * 19) : 1
    if (sc < 0.03) continue
    const ux = o.bx * comp + Math.sin(s.t * 0.2 * speed + o.ph) * o.amp
    const uy = o.by * comp + Math.cos(s.t * 0.16 * speed + o.ph) * o.amp
    const bx = ux * PX, by = uy * P
    const x = s.cx + bx * cosS - by * sinS
    const y = s.cy + bx * sinS + by * cosS
    const rot = spin + o.rot + s.t * 0.03 * speed
    const cs = Math.cos(rot), sn = Math.sin(rot)
    const size = o.size * P * sc
    const hu = pal[o.ci] + tint, sat = 58 + (o.ci % 3) * 5, lit = 60 - (o.ci % 2) * 4
    if (o.kind === 0) out.push({ k: "c", x, y, r: size * 0.15, h: hu, s: sat, l: lit, a: 0.92 })
    else if (o.kind === 4) out.push({ k: "c", x, y, r: size * 0.3, fill: false, h: hu, s: sat, l: lit,
      a: 0.85, lw: lwBase * 0.7 })
    else if (o.kind === 5) {
      for (let t = 0; t < 2; t++) {
        const ox = (t ? -0.25 : 0.25) * size, oy = (t ? -0.25 : 0.25) * size
        const ccx = x + ox * cs - oy * sn, ccy = y + ox * sn + oy * cs
        const hh = size * 0.25
        const ux2 = hh * cs, uy2 = hh * sn, vx2 = -hh * sn, vy2 = hh * cs
        const pts = t ? o.pts2 : o.pts
        pts[0] = ccx - ux2 - vx2; pts[1] = ccy - uy2 - vy2
        pts[2] = ccx + ux2 - vx2; pts[3] = ccy + uy2 - vy2
        pts[4] = ccx + ux2 + vx2; pts[5] = ccy + uy2 + vy2
        pts[6] = ccx - ux2 + vx2; pts[7] = ccy - uy2 + vy2
        if (t === 0) out.push({ k: "p", pts, fill: true, h: hu, s: sat, l: lit, a: 0.9 })
        else out.push({ k: "p", pts, fill: true, h: 0, s: 0, l: 17, a: 0.9 })
      }
    } else {
      const geo = o.kind === 1 ? wave : o.kind === 2 ? zig : semi
      for (let p = 0; p < geo.length; p += 2) {
        o.pts[p] = x + (geo[p] * cs - geo[p + 1] * sn) * size
        o.pts[p + 1] = y + (geo[p] * sn + geo[p + 1] * cs) * size
      }
      if (o.kind === 3) out.push({ k: "p", pts: o.pts, fill: true, h: hu, s: sat, l: lit, a: 0.9 })
      else out.push({ k: "p", pts: o.pts, close: false, h: hu, s: sat, l: lit, a: 0.9, lw: lwBase * 0.7 })
    }
  }
  const mR = P * (0.125 + pop * 0.035 + tense * 0.012) * (1 + bass * 0.03)
  out.push({ k: "c", x: s.cx, y: s.cy, r: mR, h: pal[2] + tint, s: 72, l: 60, a: 0.97 })
  out.push({ k: "c", x: s.cx, y: s.cy, r: mR * 1.32, fill: false, h: 0, s: 0, l: 18, a: 0.92,
    lw: lwBase * 1.5 })
  out.push({ k: "c", x: s.cx - mR * 0.3, y: s.cy - mR * 0.3, r: mR * 0.3, h: 0, s: 0, l: 15, a: 0.95 })
  s = await frame(out, {
    trail: 0.02 + calm * 0.1,
    zoom: 1 + kick * 0.008 + drops * 0.004,
    hue: 0.3,
    blend: "source-over",
  })
}

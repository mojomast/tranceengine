// name: Oscilloscope XY
// Retro vector, after Jerobeam Fenderson's oscilloscope music: one green-phosphor
// beam on a dim graticule whose X/Y lissajous figure is steered by the song.
// Psychoscript technique: a seeded mulberry32 PRNG picks every frequency ratio and
// fills a precomputed jitter table, so rewinds, beat-repeats and replays redraw
// exactly the same frames.
// Kick morphs the beam into a rotating 3D wireframe sphere drawn in one stroke;
// snare folds a harmonic into the curve; hats twitch it with PRNG jitter; bass sets
// its weight; note and keyHue choose hue and ratios; calm slows and dims it;
// build/toDrop pinch it in, the downbeat reshapes it and the drop springs it open.
let s = await frame([])
const TAU = Math.PI * 2
const N = 300
const mulberry32 = (seed) => {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6D2B79F5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(0x5EED1234)
const u = [], jit = [], sph = []
for (let i = 0; i < N; i++) {
  u.push((i / N) * TAU)
  const th = (i / (N - 1)) * Math.PI
  const ph = th * 11
  sph.push(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph))
}
for (let i = 0; i < 512; i++) jit.push(rnd() * 2 - 1)
let ta = 3, tb = 4, a = 3, b = 4
let sphere = 0, harm = 0, pulse = 0, first = true
while (true) {
  const A = s.audio, dt = s.dt, out = []
  const span = Math.min(s.w, s.h), U = span / 800
  const calm = A.calm || 0
  const kick = A.kick || 0
  const bass = A.bass || 0
  const snare = A.snare || 0
  const hat = A.hat || 0
  const drops = A.dropAmt || 0
  const note = typeof A.note === "number" ? A.note : 0
  const keyHue = typeof A.keyHue === "number" ? A.keyHue : 110
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 10 ? Math.max(0, 1 - toDrop / 10) : 0
  const tighten = Math.max(build, near) * (1 - Math.min(1, drops * 2))
  const bands = A.bands || []
  const bLo = bands[3] || 0
  const bMid = bands[9] || 0
  if (first || A.downbeat || (A.beat && (A.beats || 0) % 8 === 0)) {
    const r1 = rnd(), r2 = rnd()
    ta = 1 + (note % 5) + Math.floor(r1 * 2)
    tb = 2 + Math.floor((bLo + bMid) * 2) + Math.floor(r2 * 3)
    if (tb === ta) tb = ta + 1
    if (A.downbeat) pulse = 1
  }
  first = false
  const glide = 0.06 * (1 - calm * 0.7)
  a += (ta - a) * glide
  b += (tb - b) * glide
  if (A.kickHit) sphere = 0.72 + bass * 0.28
  sphere *= Math.exp(-dt * 4.5)
  if (A.snareHit) harm = 0.6 + snare * 0.4
  harm *= Math.exp(-dt * 6)
  if (A.drop) pulse = 1
  else pulse *= Math.exp(-dt * 5)
  const R = Math.max(span * 0.07, span * 0.3 * (1 + kick * 0.05 + drops * 0.12 + pulse * 0.06 - tighten * 0.18) * (1 - calm * 0.12))
  const hue = 126 + (note * 2.4 + keyHue * 0.05) % 30
  const cx = s.cx, cy = s.cy, G = span * 0.42
  const gl = Math.max(1, U)
  for (let i = -4; i <= 4; i++) {
    const o = (i / 4) * G
    const ga = 0.1 + bass * 0.06 + (i === 0 ? 0.1 : 0)
    out.push({ k: "l", x1: cx + o, y1: cy - G, x2: cx + o, y2: cy + G, h: hue - 10, s: 55, l: 38, a: ga, lw: gl })
    out.push({ k: "l", x1: cx - G, y1: cy + o, x2: cx + G, y2: cy + o, h: hue - 10, s: 55, l: 38, a: ga, lw: gl })
  }
  out.push({ k: "c", x: cx, y: cy, r: G * 0.36, fill: false, h: hue - 8, s: 45, l: 40, a: 0.16, lw: gl })
  out.push({ k: "c", x: cx, y: cy, r: G * 0.72, fill: false, h: hue - 8, s: 45, l: 40, a: 0.12, lw: gl })
  const tw = s.t * (0.9 + (A.energy || 0) * 1.4) * (1 - calm * 0.6)
  const ry = s.t * 0.55 * (1 - calm * 0.55) + bass * 0.6
  const cs = Math.cos(ry), ss = Math.sin(ry)
  const rx = 0.55 + Math.sin(s.t * 0.27) * 0.25
  const cX = Math.cos(rx), sX = Math.sin(rx)
  const hAmt = harm * 0.22
  const jp = ((A.hats || 0) * 19 + (s.frame >> 1) * 5) | 0
  const jx = hat * 4.5 * U, jy = hat * 4.5 * U
  const pts = []
  for (let i = 0; i < N; i++) {
    const uu = u[i]
    const lx = Math.sin(a * uu + tw) * R
    const ly = Math.sin(b * uu + tw * 0.7) * R * Math.cos(uu * 0.5 + s.t * 0.2)
    const hx = Math.sin((b + 2.5) * uu - tw) * R * hAmt
    const hy = Math.cos((a + 3) * uu + tw * 0.5) * R * hAmt
    const bx = sph[i * 3], by = sph[i * 3 + 1], bz = sph[i * 3 + 2]
    const x1 = bx * cs + bz * ss
    const z1 = bz * cs - bx * ss
    const y1 = by * cX - z1 * sX
    const z2 = by * sX + z1 * cX
    const persp = R / (1 + z2 * 0.35)
    const j1 = jit[(i * 13 + jp) & 511]
    const j2 = jit[(i * 29 + jp + 97) & 511]
    pts.push(
      cx + lx * (1 - sphere) + x1 * persp * sphere + hx + j1 * jx,
      cy + ly * (1 - sphere) + y1 * persp * sphere + hy + j2 * jy
    )
  }
  out.push({ k: "p", pts, h: hue, s: 95, l: 58, a: 0.24, lw: (4 + bass * 6 + kick * 4 + drops * 4) * U })
  out.push({ k: "p", pts, h: hue, s: 100, l: 63, a: 0.78, lw: (1.1 + bass * 1.8 + kick * 1.4 + drops * 0.8) * U })
  out.push({ k: "c", x: pts[N * 2 - 2], y: pts[N * 2 - 1], r: (2.5 + kick * 2.5 + drops * 2) * U, h: hue + 8, s: 90, l: 62, a: 0.85 })
  s = await frame(out, {
    trail: 0.88 + calm * 0.06,
    zoom: 1.003 + kick * 0.012 + drops * 0.006,
    spin: 0.0012,
    hue: 0.4,
  })
}

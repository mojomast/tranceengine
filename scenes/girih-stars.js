// name: Girih stars
// Islamic girih strapwork, after the star-and-cross tiling of mosque walls: a rotating
// grid of square cells where every edge midpoint grows two straps at a contact angle
// (the polygons-in-contact construction); the straps meet inside the cell and close
// into an 8-fold star, with a smaller {8/3} star polygon turning at each centre.
// Psychoscript technique: a seeded mulberry32 PRNG (Math.imul) fixes every cell's hue
// and lightness jitter at layout, and a seeded hash picks each downbeat's angle step,
// so a rewind, beat-repeat or replay redraws exactly the same frames. No Math.random.
// Reactions: the downbeat steps the whole tiling to a new star angle, kick pulses the
// strap width, snare shifts the contact angle, hats shimmer alternate cells, bass
// swells the stars, keyHue paints the straps, energy lifts brightness; a build (or a
// near drop) tightens the contact angle and quickens the turn, the drop lands a
// quarter-turn release with a hue split, and calm slows, thins and dims the lattice.
let s = await frame([])
const TAU = Math.PI * 2
const SEED = 0x9e3779b9
const mulberry32 = (a) => {
  a = a >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hash01 = (n) => {
  let t = Math.imul((n | 0) ^ SEED, 0x85ebca6b)
  t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35)
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296
}
const N = 12
let W = 0, H = 0, h0 = 40, U = 1
let ox = [], oy = [], alt = [], hueJ = [], litJ = [], rad = []
const layout = () => {
  W = s.w
  H = s.h
  U = Math.min(W, H) / 800
  h0 = (Math.sqrt(W * W + H * H) * 1.04) / (2 * (N - 1))
  const rnd = mulberry32(SEED)
  ox = []; oy = []; alt = []; hueJ = []; litJ = []; rad = []
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const lx = (gx - (N - 1) / 2) * h0 * 2
      const ly = (gy - (N - 1) / 2) * h0 * 2
      ox.push(lx)
      oy.push(ly)
      alt.push((gx + gy) & 1)
      hueJ.push((rnd() - 0.5) * 18)
      litJ.push((rnd() - 0.5) * 7)
      rad.push(Math.sqrt(lx * lx + ly * ly) / (h0 * N))
    }
  }
}
let rot = 0, rotT = 0, thetaK = 0
layout()
while (true) {
  const A = s.audio, dt = s.dt, out = []
  if (s.w !== W || s.h !== H) layout()
  const calm = A.calm || 0
  const kick = A.kick || 0
  const snare = A.snare || 0
  const hat = A.hat || 0
  const bass = A.bass || 0
  const energy = A.energy || 0
  const dropAmt = A.dropAmt || 0
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 12 ? 1 - toDrop / 12 : 0
  const tension = Math.max(build, near)
  const hue0 = typeof A.keyHue === "number" ? A.keyHue : 205
  if (A.downbeat) {
    const stp = Math.floor(hash01((A.bars || 0) + 1) * 6)
    rotT += (stp < 3 ? stp - 3 : stp - 2) * (TAU / 32)
  }
  if (A.drop) rotT += TAU / 8
  rot += (rotT - rot) * Math.min(1, dt * 5)
  rot += dt * (0.05 + tension * 0.3 - calm * 0.035)
  if (A.snareHit) thetaK = (hash01((A.snares || 0) + 7) - 0.5) * 0.3
  thetaK *= Math.exp(-dt * 3)
  let theta = 1.01 + thetaK + snare * 0.06 + tension * 0.1 - calm * 0.08
    + Math.sin((A.barPhase || 0) * TAU) * 0.03 * (1 - calm * 0.5)
  if (theta < 0.85) theta = 0.85
  if (theta > 1.16) theta = 1.16
  let br = 0.9 + 0.08 * (1 - calm * 0.5) * Math.sin((A.barPhase || 0) * TAU + 1.5)
    + kick * 0.07 + bass * 0.05 + dropAmt * 0.06
  if (br > 1) br = 1
  if (br < 0.78) br = 0.78
  const st = Math.sin(theta), ct = Math.cos(theta)
  const u = (st + ct) / (2 * st * ct)
  const px = u * ct, py = u * st - 1
  const cs = Math.cos(rot), sn = Math.sin(rot)
  const vx = [], vy = []
  const addV = (x, y) => {
    vx.push(x * cs - y * sn)
    vy.push(x * sn + y * cs)
  }
  addV(0, -1); addV(px, py); addV(1, 0); addV(-py, px)
  addV(0, 1); addV(-px, -py); addV(-1, 0); addV(py, -px)
  const sa = -rot * 0.6 + s.t * 0.1
  const sx = [], sy = []
  for (let k = 0; k < 8; k++) {
    const a = sa + k * 3 * (TAU / 8)
    sx.push(Math.cos(a) * 0.44)
    sy.push(Math.sin(a) * 0.44)
  }
  const lw = Math.max(0.6, (1.4 + kick * 2.4 + bass * 0.9 + dropAmt * 1.3 + tension * 0.5) * U * (1 - calm * 0.3))
  const alpha = 0.55 + energy * 0.15 + kick * 0.12
  const hb = A.hats || 0
  const R = h0 * br
  const vxr = [], vyr = [], sxr = [], syr = []
  for (let k = 0; k < 8; k++) {
    vxr.push(vx[k] * R)
    vyr.push(vy[k] * R)
    sxr.push(sx[k] * R)
    syr.push(sy[k] * R)
  }
  const cx = s.cx, cy = s.cy, m = ox.length
  for (let i = 0; i < m; i++) {
    const wx = ox[i] * cs - oy[i] * sn + cx
    const wy = ox[i] * sn + oy[i] * cs + cy
    const pts = []
    for (let k = 0; k < 8; k++) pts.push(wx + vxr[k], wy + vyr[k])
    const shimmer = ((alt[i] + hb) & 1) * hat
    const hue = hue0 + hueJ[i] + rad[i] * 30 + alt[i] * dropAmt * 170 + s.t * 6
    const li = Math.min(62, 46 + litJ[i] + shimmer * 12 + dropAmt * 8 + energy * 4 - calm * 8)
    out.push({ k: "p", pts, close: true, h: hue, s: 78, l: li, a: alpha, lw })
    if (alt[i] === 0) {
      const sp = []
      for (let k = 0; k < 8; k++) sp.push(wx + sxr[k], wy + syr[k])
      out.push({ k: "p", pts: sp, close: true, h: hue + 30, s: 70, l: Math.min(64, li + 8), a: alpha * 0.8, lw: lw * 0.7 })
    }
  }
  s = await frame(out, {
    trail: 0.84 + calm * 0.1 + tension * 0.04,
    zoom: 1.003 + kick * 0.012 + dropAmt * 0.015,
    spin: 0.002,
    hue: 0.5 + energy,
  })
}

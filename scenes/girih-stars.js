// name: Girih stars
// Islamic girih strapwork, after the star-and-cross tiling of mosque walls: a rotating
// grid of square cells where every edge midpoint grows two straps at a contact angle
// (the polygons-in-contact construction); the straps meet inside the cell and close
// into an 8-fold star, with a smaller {8/3} star polygon turning at each centre.
// Psychoscript technique: a seeded mulberry32 PRNG (Math.imul) fixes every cell's hue
// and lightness jitter at layout, and a seeded hash picks each downbeat's angle step,
// so a rewind, beat-repeat or replay redraws exactly the same frames. No Math.random.
// Cells outside the viewport are culled and the surviving star polylines come from
// shape pools (objects and point arrays reused every frame), so a frame costs writes.
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
const N = 12, NC = N * N
let W = 0, H = 0, h0 = 40, U = 1
let ox = [], oy = [], alt = [], hueJ = [], litJ = []
// Shape pools: two closed polylines per cell (the strap star, plus the {8/3} star on
// even cells). The same objects and 16-slot point arrays are mutated and re-sent every
// frame, so a dense frame costs writes, not allocations. Cells that fall outside the
// viewport are skipped (feedback zoom/spin never brings off-screen ink back in).
const starPool = [], subPool = []
for (let i = 0; i < NC; i++) {
  starPool.push({ k: "p", pts: new Array(16), h: 0, s: 78, l: 50, a: 0.6, lw: 1 })
  subPool.push({ k: "p", pts: new Array(16), h: 0, s: 70, l: 58, a: 0.5, lw: 1 })
}
const out = []
const layout = () => {
  W = s.w
  H = s.h
  U = Math.min(W, H) / 800
  h0 = (Math.sqrt(W * W + H * H) * 1.04) / (2 * (N - 1))
  const rnd = mulberry32(SEED)
  ox = []; oy = []; alt = []; hueJ = []; litJ = []
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const lx = (gx - (N - 1) / 2) * h0 * 2
      const ly = (gy - (N - 1) / 2) * h0 * 2
      ox.push(lx)
      oy.push(ly)
      alt.push((gx + gy) & 1)
      // The radial hue drift (radius * 30) is folded into the jitter here, once.
      hueJ.push((rnd() - 0.5) * 18 + (Math.sqrt(lx * lx + ly * ly) / (h0 * N)) * 30)
      litJ.push((rnd() - 0.5) * 7)
    }
  }
}
// Unit strap-star vertices for the current contact angle land in bx/by; the {8/3}
// star turns as one rigid body, so its eight vertices are composed from a single
// cos/sin pair and these fixed offsets (k * 3/8 turns) instead of sixteen trig calls.
const bx = new Array(8), by = new Array(8)
const C3 = new Array(8), S3 = new Array(8)
for (let k = 0; k < 8; k++) {
  C3[k] = Math.cos(k * 3 * (TAU / 8))
  S3[k] = Math.sin(k * 3 * (TAU / 8))
}
const vxr = new Array(8), vyr = new Array(8), sxr = new Array(8), syr = new Array(8)
let rot = 0, rotT = 0, thetaK = 0
layout()
while (true) {
  const A = s.audio, dt = s.dt
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
  bx[0] = 0; by[0] = -1
  bx[1] = px; by[1] = py
  bx[2] = 1; by[2] = 0
  bx[3] = -py; by[3] = px
  bx[4] = 0; by[4] = 1
  bx[5] = -px; by[5] = -py
  bx[6] = -1; by[6] = 0
  bx[7] = py; by[7] = -px
  const R = h0 * br
  const sa = -rot * 0.6 + s.t * 0.1
  const ca = Math.cos(sa), qa = Math.sin(sa)
  const q = 0.44 * R
  for (let k = 0; k < 8; k++) {
    vxr[k] = (bx[k] * cs - by[k] * sn) * R
    vyr[k] = (bx[k] * sn + by[k] * cs) * R
    sxr[k] = (ca * C3[k] - qa * S3[k]) * q
    syr[k] = (qa * C3[k] + ca * S3[k]) * q
  }
  const lw = Math.max(0.6, (1.4 + kick * 2.4 + bass * 0.9 + dropAmt * 1.3 + tension * 0.5) * U * (1 - calm * 0.3))
  const alpha = 0.55 + energy * 0.15 + kick * 0.12
  const hb = A.hats || 0
  const hueBase = hue0 + s.t * 6
  const hueDrop = dropAmt * 170
  const lBase = 46 + dropAmt * 8 + energy * 4 - calm * 8
  const lwSub = lw * 0.7, alphaSub = alpha * 0.8
  const margin = R + lw + 2
  const mLeft = -margin, mRight = W + margin, mTop = -margin, mBot = H + margin
  const cx = s.cx, cy = s.cy, m = ox.length
  let oi = 0
  for (let i = 0; i < m; i++) {
    const wx = ox[i] * cs - oy[i] * sn + cx
    const wy = ox[i] * sn + oy[i] * cs + cy
    if (wx < mLeft || wx > mRight || wy < mTop || wy > mBot) continue
    const o = starPool[i]
    const pts = o.pts
    for (let k = 0, j = 0; k < 8; k++, j += 2) {
      pts[j] = wx + vxr[k]
      pts[j + 1] = wy + vyr[k]
    }
    const a8 = alt[i]
    const shimmer = ((a8 + hb) & 1) * hat
    const hue = hueBase + hueJ[i] + a8 * hueDrop
    let li = lBase + litJ[i] + shimmer * 12
    if (li > 62) li = 62
    o.h = hue
    o.l = li
    o.a = alpha
    o.lw = lw
    out[oi] = o
    oi++
    if (a8 === 0) {
      const p2 = subPool[i]
      const sp = p2.pts
      for (let k = 0, j = 0; k < 8; k++, j += 2) {
        sp[j] = wx + sxr[k]
        sp[j + 1] = wy + syr[k]
      }
      p2.h = hue + 30
      p2.l = li + 8 > 64 ? 64 : li + 8
      p2.a = alphaSub
      p2.lw = lwSub
      out[oi] = p2
      oi++
    }
  }
  out.length = oi
  s = await frame(out, {
    trail: 0.84 + calm * 0.1 + tension * 0.04,
    zoom: 1.003 + kick * 0.012 + dropAmt * 0.015,
    spin: 0.002,
    hue: 0.5 + energy,
  })
}

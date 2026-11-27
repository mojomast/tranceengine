// name: Chladni sand
// Style: math art after Ernst Chladni's vibrating plates. A seeded mulberry32 PRNG
// (Math.imul) scatters the 380 grains and picks the (n, m) figure list, so a rewind,
// beat-repeat or replay redraws exactly the same frames; the grains are settled onto
// the nodal lines of |cos(n pi x)cos(m pi y) - cos(m pi x)cos(n pi y)| by gradient
// descent, relaxed in round-robin halves between moves and drawn from a reused pool of
// circle objects. Reactions: downbeat switches to the next seeded (n, m) figure and the
// sand re-forms, kick shakes the grains and brightens the plate, snare pushes a radial
// shock through them, hats glint on a rotating subset, bass sets the plate size, keyHue
// and bright colour them, calm slows and dims the settling with a longer trail,
// build/toDrop tighten the plate for anticipation, and a drop scatters the sand
// outward. Unmapped songs (build 0, toDrop 99) simply settle without the extra tension.
let s = await frame([])
const PI = Math.PI, TAU = PI * 2, N = 380, HALF = N >> 1
let rngState = 0x51E5D11
const rnd = () => {
  rngState |= 0
  rngState = (rngState + 0x6D2B79F5) | 0
  let z = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState)
  z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z
  return ((z ^ (z >>> 14)) >>> 0) / 4294967296
}
const FIGS = []
for (let i = 0; i < 14; i++) {
  const a = 1 + Math.floor(rnd() * 6)
  let b = 1 + Math.floor(rnd() * 6)
  if (b === a) b = (b % 6) + 1
  FIGS.push(a, b)
}
let fi = 0, n = FIGS[0], m = FIGS[1], nP = n * PI, mP = m * PI
const GX = [], GY = [], SXA = [], SYA = []
for (let i = 0; i < N; i++) {
  const a = rnd() * TAU, amp = 0.4 + rnd() * 0.6
  SXA.push(Math.cos(a) * amp)
  SYA.push(Math.sin(a) * amp)
}
for (let i = 0; i < N; i++) {
  let x = 0, y = 0
  for (let k = 0; k < 12; k++) {
    x = rnd() * 2 - 1
    y = rnd() * 2 - 1
    const p = nP * x, q = mP * y, r = mP * x, t = nP * y
    if (Math.abs(Math.cos(p) * Math.cos(q) - Math.cos(r) * Math.cos(t)) < 0.1) break
  }
  GX.push(x)
  GY.push(y)
}
const settle = (i, lim) => {
  const x = GX[i], y = GY[i]
  const p = nP * x, q = mP * y, r = mP * x, t = nP * y
  const cp = Math.cos(p), sp = Math.sin(p), cq = Math.cos(q), sq = Math.sin(q)
  const cr = Math.cos(r), sr = Math.sin(r), ct = Math.cos(t), st = Math.sin(t)
  const g = cp * cq - cr * ct
  const gx = mP * sr * ct - nP * sp * cq
  const gy = nP * cr * st - mP * cp * sq
  const den = gx * gx + gy * gy
  if (den > 1e-6) {
    let d = -g / den
    if (d > lim) d = lim
    else if (d < -lim) d = -lim
    GX[i] = x + d * gx
    GY[i] = y + d * gy
  }
}
for (let it = 0; it < 14; it++) {
  for (let i = 0; i < N; i++) {
    settle(i, 0.2)
    const x = GX[i], y = GY[i]
    GX[i] = x > 0.98 ? 0.98 : x < -0.98 ? -0.98 : x
    GY[i] = y > 0.98 ? 0.98 : y < -0.98 ? -0.98 : y
  }
}
const pool = [], out = []
for (let i = 0; i < N; i++) {
  const o = { k: "c", x: 0, y: 0, r: 1, h: 200, s: 78, l: 50, a: 0.5 }
  pool.push(o)
  out.push(o)
}
const plate = { k: "p", pts: [0, 0, 0, 0, 0, 0, 0, 0], h: 0, s: 40, l: 38, lw: 1, a: 0.3 }
const ringO = { k: "c", x: 0, y: 0, r: 1, fill: false, lw: 1, h: 0, s: 80, l: 56, a: 0 }
out.push(plate)
let reform = 0, tick = 0, rr = 0
while (true) {
  const A = s.audio, dt = s.dt
  const span = Math.min(s.w, s.h), U = span / 800
  const calm = A.calm || 0
  const kick = A.kick || 0
  const snare = A.snare || 0
  const hat = A.hat || 0
  const hatNo = A.hats || 0
  const bass = A.bass || 0
  const bright = A.bright || 0
  const energy = A.energy || 0
  const dropAmt = A.dropAmt || 0
  const keyHue = typeof A.keyHue === "number" ? A.keyHue : 200
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 10 ? 1 - toDrop / 10 : 0
  const tension = Math.max(build, near) * (1 - Math.min(1, dropAmt * 1.8))
  if (A.downbeat) {
    fi = (fi + 2) % FIGS.length
    n = FIGS[fi]
    m = FIGS[fi + 1]
    nP = n * PI
    mP = m * PI
    reform = 0.5
  }
  reform = reform > dt ? reform - dt : 0
  tick++
  const move = reform > 0 || (calm > 0.6 ? tick % 3 === 0 : (tick & 1) === 0)
  if (move) {
    const its = reform > 0 ? 3 : 1
    const lim = its > 1 ? 0.14 : 0.05
    const i0 = reform > 0 ? 0 : rr * HALF
    const i1 = reform > 0 ? N : i0 + HALF
    rr = 1 - rr
    for (let it = 0; it < its; it++) {
      for (let i = i0; i < i1; i++) {
        settle(i, lim)
        const x = GX[i], y = GY[i]
        GX[i] = x > 0.98 ? 0.98 : x < -0.98 ? -0.98 : x
        GY[i] = y > 0.98 ? 0.98 : y < -0.98 ? -0.98 : y
      }
    }
  }
  let k = 0.64 + bass * 0.12 + kick * 0.02 + dropAmt * 0.05 - calm * 0.06 - tension * 0.04
  k = k < 0.5 ? 0.5 : k > 0.78 ? 0.78 : k
  const half = span * k * 0.5
  const shake = (kick * 0.035 + hat * 0.006) * (1 - calm * 0.7)
  const shock = snare * 0.1 + dropAmt * 0.18
  const l0 = 44 + bright * 9 - calm * 4
  const a0 = 0.38 + energy * 0.1 + kick * 0.04 - calm * 0.08
  const cx = s.cx, cy = s.cy
  for (let i = 0; i < N; i++) {
    const x = GX[i], y = GY[i]
    const gl = hat > 0.25 && (i + hatNo * 5) % 19 === 0 ? hat : 0
    const o = pool[i]
    o.x = cx + (x + SXA[i] * shake + x * shock) * half
    o.y = cy + (y + SYA[i] * shake + y * shock) * half
    o.r = (1.7 + bright * 1.2 + gl * 1.6 + kick * 0.5) * U
    o.h = keyHue + x * 24 + y * 14 + gl * 90
    o.l = l0 + gl * 9
    o.a = a0 + gl * 0.2
  }
  const pp = plate.pts
  pp[0] = cx - half
  pp[1] = cy - half
  pp[2] = cx + half
  pp[3] = cy - half
  pp[4] = cx + half
  pp[5] = cy + half
  pp[6] = cx - half
  pp[7] = cy + half
  plate.h = keyHue + 200
  plate.lw = 1.4 * U
  if (reform > 0) {
    ringO.x = cx
    ringO.y = cy
    ringO.r = half * (0.4 + (0.5 - reform) * 1.2)
    ringO.lw = (1 + reform * 2) * U
    ringO.h = keyHue + 60
    ringO.a = reform * 0.5
    out[N + 1] = ringO
  } else out.length = N + 1
  s = await frame(out, {
    trail: 0.35 + calm * 0.18 + dropAmt * 0.05,
    zoom: 1 + kick * 0.004 + dropAmt * 0.006,
    spin: 0,
    hue: 0.35 + hat * 0.5,
  })
}

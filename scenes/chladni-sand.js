// name: Chladni sand
// Style: math art after Ernst Chladni's vibrating plates. A seeded mulberry32 PRNG
// (Math.imul) scatters the 560 grains and picks the (n, m) figure list, so a rewind,
// beat-repeat or replay redraws exactly the same frames; the grains are settled onto
// the nodal lines of |cos(n pi x)cos(m pi y) - cos(m pi x)cos(n pi y)| by gradient
// descent. Reactions: downbeat switches to the next seeded (n, m) figure and the sand
// re-forms, kick shakes the grains and brightens the plate, snare pushes a radial shock
// through them, hats glint on a rotating subset, bass sets the plate size, keyHue and
// bright colour them, calm slows and dims the settling with a longer trail, build/toDrop
// tighten the plate for anticipation, and a drop scatters the sand outward. Unmapped
// songs (build 0, toDrop 99) simply settle without the extra tension.
let s = await frame([])
const PI = Math.PI, TAU = PI * 2, N = 560
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
const GX = [], GY = [], DX = [], DY = [], PH = []
for (let i = 0; i < N; i++) {
  const a = rnd() * TAU
  DX.push(Math.cos(a))
  DY.push(Math.sin(a))
  PH.push(rnd())
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
for (let it = 0; it < 14; it++) {
  for (let i = 0; i < N; i++) {
    let x = GX[i], y = GY[i]
    const p = nP * x, q = mP * y, r = mP * x, t = nP * y
    const cp = Math.cos(p), sp = Math.sin(p), cq = Math.cos(q), sq = Math.sin(q)
    const cr = Math.cos(r), sr = Math.sin(r), ct = Math.cos(t), st = Math.sin(t)
    const g = cp * cq - cr * ct
    const gx = mP * sr * ct - nP * sp * cq
    const gy = nP * cr * st - mP * cp * sq
    const den = gx * gx + gy * gy
    if (den > 1e-6) {
      let d = -g / den
      if (d > 0.2) d = 0.2
      else if (d < -0.2) d = -0.2
      x += d * gx
      y += d * gy
    }
    GX[i] = x > 0.98 ? 0.98 : x < -0.98 ? -0.98 : x
    GY[i] = y > 0.98 ? 0.98 : y < -0.98 ? -0.98 : y
  }
}
let reform = 0, tick = 0
while (true) {
  const A = s.audio, dt = s.dt, out = []
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
  const its = reform > 0 ? 3 : 1
  const move = reform > 0 || (calm > 0.6 ? tick % 3 === 0 : (tick & 1) === 0)
  let k = 0.64 + bass * 0.12 + kick * 0.02 + dropAmt * 0.05 - calm * 0.06 - tension * 0.04
  k = k < 0.5 ? 0.5 : k > 0.78 ? 0.78 : k
  const half = span * k * 0.5
  const shake = (kick * 0.035 + hat * 0.006) * (1 - calm * 0.7)
  const shock = snare * 0.1 + dropAmt * 0.18
  const l0 = 44 + bright * 9 - calm * 4
  const a0 = 0.38 + energy * 0.1 + kick * 0.04 - calm * 0.08
  for (let i = 0; i < N; i++) {
    let x = GX[i], y = GY[i]
    if (move) {
      for (let it = 0; it < its; it++) {
        const p = nP * x, q = mP * y, r = mP * x, t = nP * y
        const cp = Math.cos(p), sp = Math.sin(p), cq = Math.cos(q), sq = Math.sin(q)
        const cr = Math.cos(r), sr = Math.sin(r), ct = Math.cos(t), st = Math.sin(t)
        const g = cp * cq - cr * ct
        const gx = mP * sr * ct - nP * sp * cq
        const gy = nP * cr * st - mP * cp * sq
        const den = gx * gx + gy * gy
        if (den > 1e-6) {
          let d = -g / den
          const lim = its > 1 ? 0.14 : 0.05
          if (d > lim) d = lim
          else if (d < -lim) d = -lim
          x += d * gx
          y += d * gy
        }
      }
      x = x > 0.98 ? 0.98 : x < -0.98 ? -0.98 : x
      y = y > 0.98 ? 0.98 : y < -0.98 ? -0.98 : y
      GX[i] = x
      GY[i] = y
    }
    const gl = hat > 0.25 && (i + hatNo * 5) % 19 === 0 ? hat : 0
    const ox = x + DX[i] * shake * (0.4 + PH[i] * 0.6) + x * shock
    const oy = y + DY[i] * shake * (0.4 + PH[i] * 0.6) + y * shock
    out.push({
      k: "c",
      x: s.cx + ox * half,
      y: s.cy + oy * half,
      r: (1.4 + bright * 1.2 + gl * 1.6 + kick * 0.5) * U,
      h: keyHue + x * 24 + y * 14 + gl * 90,
      s: 78,
      l: l0 + gl * 9,
      a: a0 + gl * 0.2,
    })
  }
  out.push({
    k: "p",
    pts: [s.cx - half, s.cy - half, s.cx + half, s.cy - half,
      s.cx + half, s.cy + half, s.cx - half, s.cy + half],
    h: keyHue + 200,
    s: 40,
    l: 38,
    lw: 1.4 * U,
    a: 0.3,
  })
  if (reform > 0) {
    out.push({
      k: "c", x: s.cx, y: s.cy, r: half * (0.4 + (0.5 - reform) * 1.2),
      fill: false, lw: (1 + reform * 2) * U, h: keyHue + 60, s: 80, l: 56,
      a: reform * 0.5,
    })
  }
  s = await frame(out, {
    trail: 0.35 + calm * 0.18 + dropAmt * 0.05,
    zoom: 1 + kick * 0.004 + dropAmt * 0.006,
    spin: 0,
    hue: 0.35 + hat * 0.5,
  })
}

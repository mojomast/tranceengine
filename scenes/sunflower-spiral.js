// name: Sunflower spiral
// Vogel phyllotaxis as math art: seed i sits at i*137.508 degrees on a c*sqrt(i) radius, so
// Fibonacci arms emerge from a head of florets. The technique is a seeded mulberry32 PRNG built
// on Math.imul, so rewinds, beat repeats and replays redraw identical sparkles. Bass nudges the
// divergence angle a few tenths of a degree and the arms re-form; kicks send a radial ripple;
// hats sparkle random seeds; keyHue paints by index; the drop sweeps the angle through rational
// approximants; calm slows, thins and lengthens the trail; a nearby build tightens the spiral.
let s = await frame([])
const GOLD = 137.508 * Math.PI / 180
const N = 520, LEVELS = 9, MID = 4
const rad = [], waveS = [], waveC = []
const cosT = [], sinT = []
for (let i = 0; i < N; i++) {
  const r = Math.sqrt((i + 1) / N)
  rad.push(r)
  waveS.push(Math.sin(r * 46))
  waveC.push(Math.cos(r * 46))
}
for (let k = 0; k < LEVELS; k++) {
  const d = (k - MID) * 0.0009, cs = [], sn = []
  for (let i = 0; i < N; i++) {
    const a = (i + 1) * (GOLD + d)
    cs.push(Math.cos(a))
    sn.push(Math.sin(a))
  }
  cosT.push(cs)
  sinT.push(sn)
}
const glow = []
for (let i = 0; i < N; i++) glow.push(0)
let rng = 0x9e3779b9
const rnd = () => {
  rng = (rng + 0x6d2b79f5) | 0
  let z = rng
  z = Math.imul(z ^ (z >>> 15), z | 1)
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
  return ((z ^ (z >>> 14)) >>> 0) / 4294967296
}
let rot = 0, ripT = -10, sweep = 0, tilt = 0
while (true) {
  const A = s.audio, out = []
  const span = Math.min(s.w, s.h), U = span / 800
  const bass = A.bass || 0, kick = A.kick || 0, hat = A.hat || 0
  const calm = A.calm || 0, drops = A.dropAmt || 0
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 8 ? Math.max(0, 1 - toDrop / 8) : 0
  const hue0 = typeof A.keyHue === "number" ? A.keyHue : 200
  if (A.kickHit) ripT = s.t
  if (A.drop) sweep = 1
  if (A.hatHit) for (let h = 0; h < 7; h++) glow[(rnd() * N) | 0] = 1
  const age = s.t - ripT
  const amp = age >= 0 && age < 1.8 ? Math.exp(-age * 3.2) * (1 + kick) : 0
  const ph = age * 17, cosP = Math.cos(ph), sinP = Math.sin(ph)
  let lvl = Math.round(MID + (bass - 0.35) * 8 + near * 1.5 - drops * 1.5)
  if (sweep > 0) {
    lvl = Math.floor((1 - sweep) * LEVELS) % LEVELS
    sweep = Math.max(0, sweep - s.dt * 0.85)
  }
  if (lvl < 0) lvl = 0
  if (lvl >= LEVELS) lvl = LEVELS - 1
  const cs = cosT[lvl], sn = sinT[lvl]
  tilt += (0.05 + bass * 0.12 + drops * 0.4) * (1 - calm * 0.75) * s.dt
  rot += tilt * s.dt
  const cosR = Math.cos(rot), sinR = Math.sin(rot)
  const R = span * (0.34 + kick * 0.045 + drops * 0.05 - calm * 0.08 - build * 0.015)
  const step = calm > 0.55 ? 2 : 1
  const gd = Math.exp(-s.dt * 5)
  const size = (2.1 + bass * 1.6 + hat * 1.2 + drops * 1.4) * U
  for (let i = 0; i < N; i += step) {
    let g = glow[i]
    if (g > 0.001) { g *= gd; glow[i] = g }
    else if (g !== 0) glow[i] = 0
    const rr = R * rad[i] + amp * 11 * U * (waveS[i] * cosP - waveC[i] * sinP)
    const bx = cs[i], by = sn[i]
    const x = s.cx + rr * (bx * cosR - by * sinR)
    const y = s.cy + rr * (bx * sinR + by * cosR)
    out.push({ k: "c", x, y, r: size * (0.55 + rad[i] * 0.6) * (1 + g * 0.9),
      h: hue0 + i * 0.19 + g * 90, s: 78 - calm * 20, l: 48 + bass * 10 + g * 7,
      a: 0.62 + hat * 0.12 + g * 0.2 })
  }
  s = await frame(out, {
    trail: 0.86 + calm * 0.1 + drops * 0.02,
    zoom: 1.002 + kick * 0.012 + drops * 0.008,
    hue: 0.4,
  })
}

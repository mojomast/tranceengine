// name: String art
// Modular times-table string art: N points on a circle, chords i -> (i*k) mod N.
// Inspired by 1960s plotter drawings: the cardioid at k=2, nephroid at k=3, stars above.
// Technique: a seeded mulberry32 PRNG fixes every point's jitter and the palette offset once,
// so rewinds, beat repeats and replays redraw identical frames; no Math.random here.
// Bass and beat phase glide k, kickHit jumps it by one, snareHit steps the rotation,
// hats brighten every fourth chord, keyHue sets the palette, build tightens the web,
// calm thins and slows it, and the drop adds a second counter-rotating table.
let s = await frame([])
const TAU = Math.PI * 2
let seed = 0x6d2b79f5
const prng = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let z = seed
  z = Math.imul(z ^ (z >>> 15), z | 1)
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
  return ((z ^ (z >>> 14)) >>> 0) / 4294967296
}
const N = 180
const ux = [], uy = []
for (let i = 0; i < N; i++) {
  const a = (i / N) * TAU + (prng() - 0.5) * (TAU / N) * 0.3
  const r = 0.95 + prng() * 0.05
  ux.push(Math.cos(a) * r)
  uy.push(Math.sin(a) * r)
}
const palette = prng() * 60
const rimX = [], rimY = []
for (let i = 0; i < 72; i++) {
  const a = (i / 72) * TAU
  rimX.push(Math.cos(a))
  rimY.push(Math.sin(a))
}
let k = 2.4, lift = 0, turn = 0, glow = 0
while (true) {
  const A = s.audio, dt = s.dt, out = []
  const span = Math.min(s.w, s.h), U = span / 800
  const bass = A.bass || 0, kick = A.kick || 0
  const calm = A.calm || 0, drops = A.dropAmt || 0
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 8 ? Math.max(0, 1 - toDrop / 8) : 0
  const tense = Math.max(build, near) * (1 - Math.min(1, drops * 1.5))
  const target = 2 + bass * 2.2 + (A.phase || 0) * 0.9 + tense * 1.5
  if (A.kickHit) lift = 1
  if (A.snareHit) turn += 0.37
  lift *= Math.exp(-dt * 4)
  glow = Math.max(glow * Math.exp(-dt * 7), A.hatHit ? 1 : 0)
  k += (target - k) * Math.min(1, dt * 2.4)
  const kk = k + lift
  const rot = turn + s.t * (0.03 + (1 - calm) * 0.06) + Math.sin(s.t * 0.27) * 0.05
  const cr = Math.cos(rot), sr = Math.sin(rot)
  const R = span * (0.32 + bass * 0.05 + kick * 0.03 - calm * 0.05) * (1 - tense * 0.06)
  const hue0 = (typeof A.keyHue === "number" ? A.keyHue : 200) + palette
  const step = calm > 0.55 ? 2 : 1
  const alpha = (0.36 + bass * 0.12 + kick * 0.08 + drops * 0.05) * (1 - calm * 0.3)
  const lw = (0.7 + bass * 1.3 + kick * 1.1) * U
  const rim = []
  for (let i = 0; i <= 72; i++) {
    const j = i === 72 ? 0 : i
    const x = rimX[j] * R * 1.02, y = rimY[j] * R * 1.02
    rim.push(s.cx + x * cr - y * sr, s.cy + x * sr + y * cr)
  }
  out.push({ k: "p", pts: rim, close: false, h: hue0 + 40, s: 70, l: 50, a: 0.45, lw: 1.1 * U })
  for (let pass = 0; pass < (drops > 0.12 ? 2 : 1); pass++) {
    const pk = pass === 0 ? kk : kk + 1.3 + (A.note || 0) * 0.06
    const pcr = pass === 0 ? cr : Math.cos(-rot * 1.2 + 0.5)
    const psr = pass === 0 ? sr : Math.sin(-rot * 1.2 + 0.5)
    const pR = pass === 0 ? R : R * 0.82
    const pa = pass === 0 ? alpha : alpha * 0.7
    for (let i = 0; i < N; i += step) {
      const j = (i * pk) % N
      const j0 = Math.floor(j), j1 = (j0 + 1) % N, f = j - j0
      const ax = ux[j0] + (ux[j1] - ux[j0]) * f
      const ay = uy[j0] + (uy[j1] - uy[j0]) * f
      const bx = ux[i], by = uy[i]
      const x1 = s.cx + (bx * pcr - by * psr) * pR
      const y1 = s.cy + (bx * psr + by * pcr) * pR
      const x2 = s.cx + (ax * pcr - ay * psr) * pR
      const y2 = s.cy + (ax * psr + ay * pcr) * pR
      const hi = i % 4 === 0 ? glow : 0
      out.push({ k: "l", x1, y1, x2, y2,
        h: hue0 + i * 0.28 + hi * 30 + pass * 60,
        s: 82, l: 48 + bass * 4 + hi * 12 - calm * 8,
        a: pa + hi * 0.14, lw })
    }
  }
  s = await frame(out, {
    trail: 0.84 + calm * 0.08 + drops * 0.03,
    zoom: 1.003 + kick * 0.012 + drops * 0.006,
    hue: 0.6,
  })
}

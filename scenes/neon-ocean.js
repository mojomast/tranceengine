// name: Neon ocean
// Layered neon swells recede in perspective to a glowing moon on the horizon, with its reflection below.
// Bass lifts the swells, high end adds choppiness, each beat rolls a swell toward the viewer, snares throw glints on the crests, drops surge the tide and shift the colour, and calm flattens the water to glass.
let s = await frame([])
const NL = 14
const NX = 36
const glints = []
let swellP = 2
while (true) {
  const A = s.audio
  const out = []
  const w = s.w
  const h = s.h
  const u = Math.min(w, h) / 800
  const hy = h * 0.42
  const bottom = h * 0.97
  const calmK = 1 - A.calm * 0.85
  const drop = A.dropAmt || 0
  if (A.beat) swellP = 0
  swellP = Math.min(2, swellP + s.dt * 0.85)
  const sway = Math.sin(A.phase * Math.PI * 2)

  // sky haze and horizon
  for (let j = 1; j <= 5; j++) {
    const yy = hy - u * j * 16
    out.push({ k: "l", x1: w * 0.1, y1: yy, x2: w * 0.9, y2: yy, h: 285, s: 90, l: 50, a: 0.12 - j * 0.018, lw: 1.5 * u })
  }
  out.push({ k: "l", x1: 0, y1: hy, x2: w, y2: hy, h: 300, s: 100, l: 60, a: 0.55, lw: 2 * u })

  // moon on the horizon
  const R = Math.min(w, h) * 0.11 * (1 + A.kick * 0.04 + drop * 0.12)
  const myp = hy - R * 0.35
  out.push({ k: "c", x: s.cx, y: myp, r: R * 3.4, h: 325, s: 100, l: 50, a: 0.05 })
  out.push({ k: "c", x: s.cx, y: myp, r: R * 1.9, h: 325, s: 100, l: 55, a: 0.1 })
  out.push({ k: "c", x: s.cx, y: myp, r: R, h: 330, s: 100, l: 68, a: 0.9 })

  // swell rows, back to front
  const rows = []
  for (let i = 0; i < NL; i++) {
    const d = (i + 1) / NL
    const yBase = hy + (bottom - hy) * Math.pow(d, 1.8) - A.kick * u * 8 * d
    const bump = Math.exp(-((d - swellP) * (d - swellP)) / 0.012)
    const amp = u * (3 + 62 * Math.pow(d, 1.6)) * (1 + A.bass * 1.1 + drop * 1.5 + bump * 1.0) * calmK
    rows.push({
      i, d, yBase, amp, bump,
      kk: 2 * Math.PI / (w * (0.12 + 0.45 * d)),
      sp: 0.7 + d * 0.5,
      off: i * 0.42 + sway * 0.9,
      chop: 0.18 + A.high * 0.9
    })
  }
  const rowY = (r, x, t) => {
    const v = Math.sin(x * r.kk - t * r.sp + r.off)
      + r.chop * Math.sin(x * r.kk * 2.6 + t * r.sp * 2.1 + r.i * 1.7)
    return r.yBase - r.amp * v * 0.5
  }
  const step = (w + 40) / NX
  for (const r of rows) {
    const pts = []
    for (let j = 0; j <= NX; j++) {
      const x = -20 + j * step
      pts.push(x, rowY(r, x, s.t))
    }
    out.push({
      k: "p", pts, close: false,
      h: 292 - r.d * 115 + drop * 100,
      s: 95, l: 38 + r.d * 24 + r.bump * 14, a: 0.3 + r.d * 0.5, lw: (1 + r.d * 2.2) * u
    })
  }

  // moon reflection, shimmering on the water
  for (let j = 0; j < 12; j++) {
    const yy = hy + u * (7 + j * 7 + j * j * 0.6)
    const wd = R * (1.15 - j * 0.08) * (0.7 + 0.3 * Math.sin(s.t * 3 + j * 1.3))
    const jit = Math.sin(yy * 0.08 + s.t * 2.2) * 3 * u
    out.push({ k: "l", x1: s.cx - wd + jit, y1: yy, x2: s.cx + wd + jit, y2: yy, h: 325, s: 100, l: 65, a: Math.max(0.05, 0.55 - j * 0.04), lw: 2 * u })
  }

  // snare/hat glints near the crests of the front rows
  if (A.snapHit) {
    for (let g = 0; g < 2; g++) {
      const r = rows[NL - 1 - (g % 2)]
      let best = null
      for (let c = 0; c < 6; c++) {
        const x = Math.random() * w
        const y = rowY(r, x, s.t)
        if (best === null || y < best.y) best = { x, y, life: 1 }
      }
      glints.push(best)
    }
  }
  for (let g = glints.length - 1; g >= 0; g--) {
    const q = glints[g]
    q.life -= s.dt * 2.2
    if (q.life <= 0) { glints.splice(g, 1); continue }
    const len = (8 + 14 * q.life) * u
    out.push({ k: "c", x: q.x, y: q.y, r: (1.5 + 4 * q.life) * u, h: 185, s: 70, l: 92, a: q.life * 0.9 })
    out.push({ k: "l", x1: q.x - len, y1: q.y, x2: q.x + len, y2: q.y, h: 185, s: 80, l: 85, a: q.life * 0.7, lw: u })
  }
  while (glints.length > 60) glints.shift()

  const fx = { trail: Math.min(0.85, 0.78 + A.calm * 0.07) }
  s = await frame(out, fx)
}

// name: Synthwave horizon
// A neon perspective grid rushes toward the viewer under a striped sun and a mountain skyline.
// Energy and bass set the grid speed, the sun stripes breathe with the phase, kicks bounce the horizon, snares flash a grid row, drops launch a speed burst with a colour shift, and calm slows it to a dusk drift.
let s = await frame([])
let scroll = 0
let flashF = 0.5
const NR = 16   // horizontal grid rows
const NV = 8    // vertical lines per side of centre
const SB = 9    // sun stripes
while (true) {
  const A = s.audio
  const out = []
  const u = Math.min(s.w, s.h) / 800
  const dt = s.dt || 0
  const bandAt = (i) => A.bands[i] || 0
  const hy = s.h * 0.56 - A.kick * s.h * 0.018
  const bottom = s.h * 1.02

  // grid speed: energy and bass push it, a drop bursts it, calm slows it to a drift
  const speed = (0.12 + A.energy * 0.45 + A.bass * 0.25 + A.dropAmt * 2.2) * (1 - A.calm * 0.8)
  scroll = (scroll + speed * dt) % 1
  if (A.snapHit) flashF = Math.random()

  const hueG = 300 + s.t * 2 + A.dropAmt * 120
  const phaseW = Math.sin(A.phase * Math.PI * 2) * 0.1

  // sun: centred on the horizon, stripes get wider toward the bottom and pulse with the phase
  const R = Math.min(s.w, s.h) * 0.26 * (1 + A.bass * 0.04)
  const sx = s.cx
  const top = hy - R
  out.push({ k: "c", x: sx, y: hy - R * 0.4, r: R * 1.25, h: 330 + A.dropAmt * 120, s: 100, l: 50, a: 0.08 })
  for (let i = 0; i < SB; i++) {
    const ta = Math.pow(i / SB, 1.6)
    const tb = Math.pow((i + 1) / SB, 1.6)
    const duty = Math.min(0.95, Math.max(0.2, 0.85 - 0.5 * (i / SB) + phaseW))
    const tc = ta + (tb - ta) * duty
    const y0 = top + R * ta
    const y1 = top + R * tc
    const xa = Math.sqrt(Math.max(0, R * R - (y0 - hy) * (y0 - hy)))
    const xb = Math.sqrt(Math.max(0, R * R - (y1 - hy) * (y1 - hy)))
    out.push({ k: "p", pts: [sx - xa, y0, sx + xa, y0, sx + xb, y1, sx - xb, y1],
      fill: true, h: 320 + ta * 80 + A.dropAmt * 120, s: 100, l: 58, a: 0.9 })
  }

  // mountain skyline: ridge shape from a fixed pattern, lifted by the spectrum
  const MK = 48
  const mpts = [0, hy]
  for (let k = 0; k <= MK; k++) {
    const x = (k / MK) * s.w
    const rg = 0.5 + 0.25 * Math.sin(k * 0.9) + 0.25 * Math.sin(k * 2.3 + 1)
    const bv = bandAt(Math.round((k / MK) * 31))
    const mh = s.h * (0.03 + 0.1 * rg + 0.1 * bv)
    mpts.push(x, hy - mh)
  }
  mpts.push(s.w, hy)
  out.push({ k: "p", pts: mpts, fill: true, h: 265 + A.dropAmt * 120, s: 70, l: 30, a: 0.55 })
  out.push({ k: "p", pts: mpts.slice(2, -2), close: false, h: 275 + A.dropAmt * 120, s: 100, l: 60, a: 0.8, lw: 2 * u })

  // horizon line with a soft bloom
  out.push({ k: "l", x1: 0, y1: hy, x2: s.w, y2: hy, h: 185 + A.dropAmt * 120, s: 100, l: 65, a: 0.9, lw: 2 * u })
  out.push({ k: "l", x1: 0, y1: hy, x2: s.w, y2: hy, h: 185 + A.dropAmt * 120, s: 100, l: 60, a: 0.15, lw: 10 * u })

  // perspective floor: rows bunch up at the horizon and spread toward the viewer
  for (let i = 0; i < NR; i++) {
    const f = (i / NR + scroll) % 1
    const y = hy + (bottom - hy) * Math.pow(f, 2.2)
    const near = Math.abs(f - flashF) < 0.07 ? 1 : 0
    const l = 52 + A.kick * 10 + A.snap * 12 + near * A.snap * 25
    out.push({ k: "l", x1: 0, y1: y, x2: s.w, y2: y, h: hueG, s: 100, l, a: 0.25 + 0.7 * f, lw: (1.2 + near * A.snap * 3) * u })
  }

  // converging verticals from the vanishing point; each one shimmers with its band
  for (let j = -NV; j <= NV; j++) {
    const b = bandAt(Math.round((j + NV) / (2 * NV) * 31))
    const x2 = s.cx + j * s.w * 0.13
    out.push({ k: "l", x1: s.cx, y1: hy, x2, y2: bottom, h: hueG, s: 100, l: 50 + b * 15, a: 0.35 + b * 0.5, lw: (1 + b * 2) * u })
  }

  s = await frame(out, { trail: 0.8 + A.calm * 0.06, zoom: 1 + A.dropAmt * 0.006, hue: 0.4, mirror: 0, blend: "lighter" })
}

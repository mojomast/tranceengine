// name: Unzipping helix
// A rotating double helix in perspective: energy sets the spin, each rung follows one spectrum band, beats twist it a step,
// snares send a pulse along the strands, drops unzip it and zip it back, and calm leaves one slow strand.
let s = await frame([])
const N = 32
const STEP = 0.42
let acc = 0
let twist = 0
let twistTarget = 0
let pulse = 999
let zipT = 1
let calmSm = 0

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

while (true) {
  const A = s.audio
  const dt = Math.min(0.05, s.dt || 1 / 60)
  const out = []
  const u = Math.min(s.w, s.h) / 800
  const bands = A.bands || []
  const energy = A.energy || 0
  const calm = A.calm || 0
  const dropAmt = A.dropAmt || 0
  const bass = A.bass || 0

  // calm eases the spin toward a slow drift
  calmSm += (calm - calmSm) * 0.05
  const speed = (0.45 + energy * 1.5) * (1 - 0.55 * calmSm) + (s.down ? 0.8 : 0)
  acc += dt * speed

  // each beat steps the helix one rung-angle; the step eases in
  if (A.beat) twistTarget += STEP
  twist += (twistTarget - twist) * 0.18

  // drop: strands fly apart and zip back over ~1.8 s
  if (A.drop) zipT = 0
  if (zipT < 1) zipT = Math.min(1, zipT + dt / 1.8)
  const sep = Math.sin(Math.PI * zipT) * (1 + dropAmt * 0.5)

  // snare hit launches a pulse that travels up the helix
  if (A.snapHit) pulse = 0
  else pulse = Math.min(pulse + dt * 40, N + 10)

  const L = Math.min(s.w, s.h) * 1.1
  const R = Math.max(1, Math.min(s.w, s.h) * (0.13 + bass * 0.03))
  const D = R * 3.5
  const tilt = -0.5 + Math.sin(s.t * 0.13) * 0.12
  const ct = Math.cos(tilt)
  const st = Math.sin(tilt)
  const proj = (a, py, z) => {
    const p = D / (D - z)
    return {
      x: s.cx + (a * ct - py * st) * p,
      y: s.cy + (a * st + py * ct) * p,
      p,
      nz: (z / R + 1) / 2
    }
  }
  const boost = (i) => Math.exp(-Math.pow(i - pulse, 2) / 12)

  // two strands, 180 degrees apart around the axis
  const S = [[], []]
  for (let i = 0; i < N; i++) {
    const a = (i / (N - 1) - 0.5) * L
    const phi = i * STEP + acc + twist
    for (let q = 0; q < 2; q++) {
      const ang = phi + q * Math.PI
      const side = q === 0 ? 1 : -1
      const py = R * Math.cos(ang) + side * sep * R * 0.6
      const z = R * Math.sin(ang)
      S[q].push(proj(a, py, z))
    }
  }

  // strands: depth-shaded segments and dots
  for (let q = 0; q < 2; q++) {
    const hue = q === 0 ? 195 + acc * 12 : 315 + acc * 12
    const fade = q === 1 ? 1 - calmSm : 1
    if (fade < 0.02) continue
    for (let i = 0; i < N - 1; i++) {
      const p0 = S[q][i]
      const p1 = S[q][i + 1]
      const b = boost(i + 0.5)
      const nz = (p0.nz + p1.nz) / 2
      out.push({ k: "l", x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, h: hue, s: 90,
        l: clamp(32 + nz * 30 + b * 25, 0, 72),
        a: clamp((0.35 + nz * 0.4 + b * 0.5) * fade, 0, 1),
        lw: (1 + nz * 1.6) * u })
    }
    for (let i = 0; i < N; i++) {
      const p = S[q][i]
      const b = boost(i)
      out.push({ k: "c", x: p.x, y: p.y, r: (1.6 + p.p * 1.2 + b * 2.5) * u, h: hue, s: 90,
        l: clamp(40 + p.nz * 25 + b * 30, 0, 75),
        a: clamp((0.7 + b * 0.3) * fade, 0, 1) })
    }
  }

  // rungs: rung i is driven by band i; length and brightness both follow it
  const rungFade = 1 - calmSm * 0.85
  for (let i = 0; i < N; i++) {
    const a1 = S[0][i]
    const a2 = S[1][i]
    const band = clamp(bands[i] || 0, 0, 1)
    const mxp = (a1.x + a2.x) / 2
    const myp = (a1.y + a2.y) / 2
    const f = 0.55 + 0.45 * band
    const b = boost(i)
    const nz = (a1.nz + a2.nz) / 2
    out.push({ k: "l",
      x1: mxp + (a1.x - mxp) * f, y1: myp + (a1.y - myp) * f,
      x2: mxp + (a2.x - mxp) * f, y2: myp + (a2.y - myp) * f,
      h: 150 + i * 6 + acc * 10, s: 85,
      l: clamp(30 + band * 35 + nz * 10 + b * 20, 0, 72),
      a: clamp((0.15 + band * 0.7 + b * 0.3) * rungFade, 0, 1),
      lw: (0.7 + band * 2.2) * u })
  }

  s = await frame(out, { trail: 0.84, zoom: 1 + (A.kick || 0) * 0.006, spin: 0, hue: 0.6 })
}

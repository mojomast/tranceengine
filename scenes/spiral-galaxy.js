// name: Spiral galaxy
// A tilted disc of stars on logarithmic arms, spinning differentially (inner runs faster).
// Energy sets the spin, bar sets the arm count (2-5), bands light the arms, kick swells the core.
// snapHit ignites a supernova, a drop collapses the disc then blasts it outward, calm flattens and slows it.
let s = await frame([])

const N = 300
const stars = []
for (let i = 0; i < N; i++) {
  stars.push({
    f: Math.pow(Math.random(), 0.75), // 0 = core, 1 = rim
    jr: (Math.random() - 0.5) * 0.07,
    ja: (Math.random() - 0.5) * 0.14,
    tw: Math.random(),
  })
}

const TAU = Math.PI * 2
const omega = f => 1 / Math.sqrt(0.25 + f) // differential rotation: inner faster
const spiral = f => 3.0 * Math.log(1 + 4 * f) // logarithmic arm curvature

let phase = 0 // accumulated rotation, so speed changes stay smooth
let dropT = -100 // time of the last drop
let novae = [] // supernovae: { k: star index, t0: start time }
const posX = new Array(N).fill(0)
const posY = new Array(N).fill(0)

function ellipse(cx, cy, rx, ry, rot, n) {
  const p = []
  const cr = Math.cos(rot), sr = Math.sin(rot)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry
    p.push(cx + x * cr - y * sr, cy + x * sr + y * cr)
  }
  return p
}

while (true) {
  const A = s.audio
  const out = []
  const u = Math.min(s.w, s.h) / 800
  const Rmax = Math.min(s.w, s.h) * 0.4
  const dt = Math.min(s.dt || 1 / 60, 0.1)

  const calm = A.calm || 0
  const energy = A.energy || 0
  const kick = A.kick || 0
  const bass = A.bass || 0
  const drop = A.dropAmt || 0
  const arms = 2 + Math.min(3, Math.max(0, Math.floor(A.bar || 0)))

  // speed follows energy, slowed by calm; squash flattens the disc in calm parts
  phase += dt * (0.1 + energy * 0.25) * (1 - 0.5 * calm)
  const squash = 0.55 - 0.3 * calm
  const tilt = 0.45 + 0.2 * Math.sin(s.t * 0.05)
  const cT = Math.cos(tilt), sT = Math.sin(tilt)
  const project = (x0, y0) => {
    const yy = y0 * squash
    return [s.cx + x0 * cT - yy * sT, s.cy + x0 * sT + yy * cT]
  }

  // drop: collapse into the core, then blast outward and settle back
  if (A.drop) dropT = s.t
  const dd = s.t - dropT
  let m
  if (dd < 0.8) {
    const q = Math.max(0, dd / 0.8)
    m = 1 - 0.85 * q * q
  } else if (dd < 1.6) {
    m = 0.15 + 1.6 * ((dd - 0.8) / 0.8)
  } else {
    m = 1.75 - 0.75 * Math.min(1, (dd - 1.6) / 1.6)
  }

  // stars
  const bright = Math.min(1, 0.5 + kick * 0.3 + drop * 0.5 + Math.max(0, 1 - m) * 0.3)
  for (let i = 0; i < N; i++) {
    const star = stars[i]
    const f = star.f
    const arm = i % arms
    const ang = arm * (TAU / arms) + spiral(f) + star.ja * (0.4 + f) + phase * omega(f)
    const rad = Math.max(0.02, f + star.jr) * Rmax * m
    const [x, y] = project(Math.cos(ang) * rad, Math.sin(ang) * rad)
    posX[i] = x
    posY[i] = y
    const bi = Math.min(31, Math.floor(f * 32))
    const bv = (A.bands && A.bands[bi]) || 0
    const sz = (1.1 + bv * 2.4 + (A.snap || 0) * 1.6 * star.tw) * u
    out.push({
      k: "c", x, y, r: sz,
      h: 45 + f * 165, s: 40 + f * 50,
      l: 50 + bv * 14 + (A.snap || 0) * 10,
      a: Math.min(0.95, 0.4 + 0.45 * bv + 0.15 * (A.snap || 0) * star.tw),
    })
  }

  // supernova on each snare/clap/hi-hat hit, on a random star
  if (A.snapHit) novae.push({ k: Math.floor(Math.random() * N), t0: s.t })
  novae = novae.filter(n => s.t - n.t0 < 0.9)
  for (const n of novae) {
    const age = (s.t - n.t0) / 0.9
    const x = posX[n.k], y = posY[n.k]
    out.push({ k: "c", x, y, r: (3 + 50 * age) * u, h: 200, s: 80, l: 70, a: 0.5 * (1 - age), fill: false, lw: 2 })
    out.push({ k: "c", x, y, r: (5 - 3 * age) * u, h: 40, s: 30, l: 95, a: 0.9 * (1 - age) })
  }

  // faint outlines of the arms, following the same rotation
  for (let a = 0; a < arms; a++) {
    const pts = []
    for (let j = 0; j <= 24; j++) {
      const f = (j / 24) * 1.05
      const ang = a * (TAU / arms) + spiral(f) + phase * omega(f)
      const rad = f * Rmax * m
      const [x, y] = project(Math.cos(ang) * rad, Math.sin(ang) * rad)
      pts.push(x, y)
    }
    out.push({ k: "p", pts, close: false, h: 210, s: 70, l: 60, a: 0.1 + 0.1 * (A.high || 0), lw: 1.2 * u + 0.5 })
  }

  // dim disc glow, core bulge and a pulsing bright centre
  out.push({
    k: "p", fill: true, h: 230, s: 60, l: 40, a: 0.06,
    pts: ellipse(s.cx, s.cy, Rmax * 1.05 * m, Rmax * 1.05 * m * squash, tilt, 40),
  })
  const coreR = (16 + bass * 30 + kick * 18) * u * (1 + 0.08 * (1 - (A.phase || 0)))
  for (let L = 0; L < 4; L++) {
    out.push({
      k: "c", x: s.cx, y: s.cy, r: coreR * (1.9 - L * 0.42),
      h: 35 - L * 6, s: 90 - L * 20,
      l: 40 + L * 8 + bright * 8, a: 0.22 + bright * 0.2,
    })
  }
  out.push({ k: "c", x: s.cx, y: s.cy, r: coreR * 0.35, h: 50, s: 20, l: 80, a: 0.3 + bright * 0.4 })

  // shock ring after a drop
  if (dd < 1.2) {
    const q = dd / 1.2
    const rr = Rmax * (0.2 + 1.6 * q)
    out.push({
      k: "p", pts: ellipse(s.cx, s.cy, rr, rr * squash, tilt, 48),
      h: 50, s: 90, l: 65, a: 0.5 * (1 - q), lw: 2 * u + 0.5,
    })
  }

  s = await frame(out, {
    trail: 0.84 + calm * 0.1,
    zoom: 1 + kick * 0.005,
    spin: 0.0008,
    hue: 0.6,
    mirror: drop > 0.4 ? 6 : 0,
  })
}

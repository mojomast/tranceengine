// name: Orbit garden
// An orrery: planets ride elliptical orbits around a pulsing sun ringed by a 32-ray corona that follows the spectrum.
// Energy sets orbit speed, each bar flares one planet on the beat, snares launch comets, drops line the planets up then release them, and calm slows everything while the orbit paths fade in.
let s = await frame([])

const N = 6
const planets = []
for (let i = 0; i < N; i++) {
  planets.push({
    a: 0.2 + i * 0.12,
    e: 0.12 + (i % 3) * 0.11,
    tilt: 0.35 + i * 0.7,
    th: Math.random() * Math.PI * 2,
    spd: 0.9 / Math.sqrt(i + 1),
    hue: 15 + i * 55,
    size: 0.8 + (i % 3) * 0.35,
    moon: i % 2 === 1,
    ring: i === 2 || i === 4,
    mAng: Math.random() * Math.PI * 2,
    flare: 0
  })
}

const stars = []
for (let i = 0; i < 70; i++) stars.push({ x: Math.random(), y: Math.random(), p: Math.random() * Math.PI * 2 })

let comets = []
let alignE = 0
let holdT = 0
let calmS = 0

// point on an orbit; the sun sits at one focus of the ellipse
function ellPt(p, R, sx, sy, th) {
  const a = p.a * R
  const b = a * Math.sqrt(1 - p.e * p.e)
  const f = a * p.e
  const c = Math.cos(p.tilt), sn = Math.sin(p.tilt)
  const ox = sx - f * c, oy = sy - f * sn
  const lx = a * Math.cos(th), ly = b * Math.sin(th)
  return [ox + lx * c - ly * sn, oy + lx * sn + ly * c]
}

function orbitPath(p, R, sx, sy, n) {
  const pts = []
  for (let k = 0; k < n; k++) {
    const q = ellPt(p, R, sx, sy, (k / n) * Math.PI * 2)
    pts.push(q[0], q[1])
  }
  return pts
}

function ringPath(x, y, rx, ry, tilt, n) {
  const pts = []
  const c = Math.cos(tilt), sn = Math.sin(tilt)
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2
    const lx = rx * Math.cos(a), ly = ry * Math.sin(a)
    pts.push(x + lx * c - ly * sn, y + lx * sn + ly * c)
  }
  return pts
}

while (true) {
  const A = s.audio
  const out = []
  const dt = Math.min(s.dt || 1 / 60, 0.05)
  const m = Math.min(s.w, s.h)
  const u = m / 800
  const R = m * 0.44
  const sx = s.cx, sy = s.cy
  const sunR = m * 0.055 * (1 + A.kick * 0.12 + A.bass * 0.08 + (1 - A.phase) * 0.05)

  // smoothed scene state
  calmS += (A.calm - calmS) * 0.03
  if (A.drop) holdT = 1.8
  holdT = Math.max(0, holdT - dt)
  const aTarget = holdT > 0 ? 1 : 0
  alignE += (aTarget - alignE) * (aTarget ? 0.08 : 0.035)
  // orbit advance per unit of planet speed, scaled by energy, calm and alignment
  const sp = (0.35 + A.energy * 1.1) * (1 - 0.7 * calmS) * (1 - 0.85 * alignE) * dt

  // background stars
  for (const st of stars) {
    const tw = 0.5 + 0.5 * Math.sin(s.t * 2 + st.p)
    out.push({ k: "c", x: st.x * s.w, y: st.y * s.h, r: (0.8 + A.high * 1.5) * u, h: 210, s: 60, l: 75,
      a: 0.08 + 0.2 * tw * (0.5 + A.high) })
  }

  // orbit paths, faint until calm fades them in
  for (const p of planets) {
    out.push({ k: "p", pts: orbitPath(p, R, sx, sy, 56), h: p.hue, s: 70, l: 55, a: 0.03 + 0.3 * calmS, lw: 1 * u })
  }

  // corona: 32 rays, one per spectrum band, with a flash on snares
  for (let i = 0; i < 32; i++) {
    const ang = (i / 32) * Math.PI * 2 + s.t * 0.05
    const bv = A.bands[i] || 0
    const r0 = sunR * 1.35
    const r1 = sunR * (1.45 + bv * 3.2 + A.snap * 0.6)
    const ca = Math.cos(ang), sa = Math.sin(ang)
    out.push({ k: "l", x1: sx + ca * r0, y1: sy + sa * r0, x2: sx + ca * r1, y2: sy + sa * r1,
      h: 25 + i * 4 + s.t * 8, s: 100, l: 60, a: 0.35 + bv * 0.5, lw: 2 * u })
  }

  // pulsing sun: swells on the kick, brightens at the start of each beat
  out.push({ k: "c", x: sx, y: sy, r: sunR * 2.6, h: 30, s: 100, l: 50, a: 0.07 + A.level * 0.1 })
  out.push({ k: "c", x: sx, y: sy, r: sunR, h: 42, s: 100, l: 70, a: 0.95 })
  out.push({ k: "c", x: sx, y: sy, r: sunR * 0.45, h: 55, s: 100, l: 90, a: 0.8 })

  // on each beat, one planet flares; the bar picks which one
  if (A.beat) {
    const idx = (Math.floor(A.bar) + Math.floor(A.beats / 4) * 4) % N
    planets[idx].flare = 1
  }

  // snares launch comets in from outside, aimed near the sun
  if (A.snapHit && comets.length < 5) {
    const ang = Math.random() * Math.PI * 2
    const x0 = sx + Math.cos(ang) * m * 0.9, y0 = sy + Math.sin(ang) * m * 0.9
    const tx = sx + (Math.random() - 0.5) * R * 0.8, ty = sy + (Math.random() - 0.5) * R * 0.8
    const d = Math.hypot(tx - x0, ty - y0) || 1
    const spd = m * 0.6
    comets.push({ x: x0, y: y0, vx: (tx - x0) / d * spd, vy: (ty - y0) / d * spd,
      hist: [], hue: 170 + Math.random() * 80, life: 0 })
  }
  for (const c of comets) {
    c.hist.push({ x: c.x, y: c.y })
    if (c.hist.length > 36) c.hist.shift()
    c.x += c.vx * dt
    c.y += c.vy * dt
    c.life += dt
  }
  comets = comets.filter(c => c.life < 9 && (c.life < 0.5 || Math.hypot(c.x - sx, c.y - sy) < m * 1.4))
  for (const c of comets) {
    const n = c.hist.length
    for (let j = 0; j < n; j++) {
      const q = c.hist[j]
      const f = (j + 1) / (n + 1)
      out.push({ k: "c", x: q.x, y: q.y, r: (1 + 3 * f) * u, h: c.hue, s: 80, l: 70, a: 0.5 * f })
    }
    out.push({ k: "c", x: c.x, y: c.y, r: 5 * u, h: c.hue, s: 60, l: 85, a: 0.95 })
  }

  // drop: expanding shock ring
  if (A.dropAmt > 0.05) {
    out.push({ k: "c", x: sx, y: sy, r: m * (0.2 + (1 - A.dropAmt) * 0.5), fill: false, h: 40, s: 100, l: 65,
      a: A.dropAmt * 0.5, lw: 3 * u })
  }

  // planets: orbit position, blended toward a shared line during a drop
  for (let i = 0; i < N; i++) {
    const p = planets[i]
    p.th += p.spd * sp
    p.mAng += dt * (2.5 + A.high * 2) * (1 - 0.6 * calmS)
    const op = ellPt(p, R, sx, sy, p.th)
    const lpx = sx + p.a * R, lpy = sy
    const x = op[0] + (lpx - op[0]) * alignE
    const y = op[1] + (lpy - op[1]) * alignE
    const pr = (4 + p.size * 4) * u * (1 + p.flare * 0.7 + A.kick * 0.08)
    p.flare *= 0.93
    if (p.flare > 0.03) {
      out.push({ k: "c", x: x, y: y, r: pr * (3 + p.flare * 3), h: p.hue + 20, s: 100, l: 60, a: 0.14 * p.flare })
    }
    out.push({ k: "c", x: x, y: y, r: pr, h: p.hue, s: 80, l: 62, a: 0.9 })
    if (p.ring) {
      out.push({ k: "p", pts: ringPath(x, y, pr * 2.6, pr * 0.9, -0.35, 36), h: p.hue + 40, s: 70, l: 70, a: 0.6, lw: 1.2 * u })
    }
    if (p.moon) {
      const mx = x + Math.cos(p.mAng) * pr * 3.6
      const my = y + Math.sin(p.mAng) * pr * 3.6
      out.push({ k: "c", x: mx, y: my, r: pr * 0.35, h: 200, s: 40, l: 80, a: 0.9 })
    }
  }

  s = await frame(out, { trail: 0.88, zoom: 1 + A.kick * 0.004, hue: 0.3 })
}

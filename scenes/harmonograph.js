// name: Harmonograph
// Style: math art after the Victorian two-pendulum drawing machines of the 1890s: a sheet of
//   paper, four damped swings, one lacy line that spirals inward and never repeats exactly.
// Technique: accumulated state — every frame appends fresh pen samples to a growing k:'p' polyline
//   kept in the VM, so the picture is the memory: a beat repeat re-enters the half-drawn sheet and
//   a resumed snapshot carries on from the same nib instead of starting over.
// Reactions: kickHit resets the four damped pendulums and kick swells the ink; snareHit/snare rotate
//   the whole sheet; hatHit/hat sprinkle glints along the nib; bass thickens the stroke; note/chroma
//   pick near-rational frequency pairs; keyHue paints them; calm slows the swings; build/toDrop
//   gather the spiral in and drop/dropAmt lets it open; phraseStart wipes the paper and re-inks.
let s = await frame([])
const TAU = Math.PI * 2
const mulberry32 = (seed) => {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(0x51ee7a11)
const RATIOS = [[2, 3], [3, 4], [3, 5], [4, 5], [5, 7], [5, 8], [7, 8], [4, 7]]
const BASE = [0.68, 0.32, 0.6, 0.4]
const DAMP = [0.45, 0.62, 0.5, 0.72]
const FLOOR = [0.06, 0.025, 0.05, 0.03]
const MAXP = 2600, PRIME = 1100, HEAD = 150
const pts = [], glints = []
let fx1 = 2, fx2 = 3, fy1 = 4, fy2 = 5
let p1 = 0, p2 = 0, p3 = 0, p4 = 0
let a1 = BASE[0], a2 = BASE[1], a3 = BASE[2], a4 = BASE[3]
let theta = 0, rot = 0, R = 200, pulse = 0
let lastW = 0, lastH = 0, lastCx = 0, lastCy = 0

const choose = () => {
  const A = s.audio
  const note = typeof A.note === "number" ? A.note : 0
  const chroma = A.chroma || []
  let w = 0
  for (let i = 0; i < 12; i++) w += (chroma[i] || 0) * (i + 1)
  const r = RATIOS[(note + Math.floor(w)) % RATIOS.length]
  fx1 = r[0] * (1 + (rnd() - 0.5) * 0.014)
  fx2 = r[1] * (1 + (rnd() - 0.5) * 0.014)
  fy1 = (r[0] + r[1]) * (1 + (rnd() - 0.5) * 0.014)
  fy2 = (r[1] + 2) * (1 + (rnd() - 0.5) * 0.014)
  p1 = rnd() * TAU
  p2 = rnd() * TAU
  p3 = rnd() * TAU
  p4 = rnd() * TAU
  rot = 0
}

const prime = () => {
  pts.splice(0, pts.length)
  glints.splice(0, glints.length)
  theta = 0
  a1 = BASE[0] * 1.25
  a2 = BASE[1] * 1.25
  a3 = BASE[2] * 1.25
  a4 = BASE[3] * 1.25
  const q1 = Math.exp(-0.0002)
  const q2 = Math.exp(-0.00032)
  const q3 = Math.exp(-0.00025)
  const q4 = Math.exp(-0.00036)
  for (let i = 0; i < PRIME; i++) {
    theta += 0.012
    const x = a1 * Math.sin(fx1 * theta + p1) + a2 * Math.sin(fx2 * theta + p2)
    const y = a3 * Math.sin(fy1 * theta + p3) + a4 * Math.sin(fy2 * theta + p4)
    pts.push(s.cx + x * R, s.cy + y * R)
    a1 *= q1
    a2 *= q2
    a3 *= q3
    a4 *= q4
  }
}

const spin = (ang) => {
  const c = Math.cos(ang), sn = Math.sin(ang)
  for (let j = 0; j < pts.length; j += 2) {
    const x = pts[j] - s.cx, y = pts[j + 1] - s.cy
    pts[j] = s.cx + x * c - y * sn
    pts[j + 1] = s.cy + x * sn + y * c
  }
  for (let j = 0; j < glints.length; j++) {
    const g = glints[j]
    const x = g.x - s.cx, y = g.y - s.cy
    g.x = s.cx + x * c - y * sn
    g.y = s.cy + x * sn + y * c
  }
  rot += ang
}

R = Math.min(s.w, s.h) * 0.36
choose()
prime()
lastW = s.w
lastH = s.h
lastCx = s.cx
lastCy = s.cy

while (true) {
  const A = s.audio, dt = s.dt > 0 ? s.dt : 1 / 60, out = []
  const span = Math.min(s.w, s.h), U = span / 800
  const calm = A.calm || 0
  const kick = A.kick || 0
  const snare = A.snare || 0
  const hat = A.hat || 0
  const bass = A.bass || 0
  const level = A.level || 0
  const energy = A.energy || 0
  const keyHue = typeof A.keyHue === "number" ? A.keyHue : 190
  const note = typeof A.note === "number" ? A.note : 0
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const dropAmt = typeof A.dropAmt === "number" ? A.dropAmt : 0
  const near = toDrop < 9 ? Math.max(0, 1 - toDrop / 9) : 0
  const gather = Math.max(build, near) * (1 - Math.min(1, dropAmt * 1.6))

  if (s.w !== lastW || s.h !== lastH) {
    const k = Math.min(s.w / lastW, s.h / lastH)
    for (let j = 0; j < pts.length; j += 2) {
      pts[j] = s.cx + (pts[j] - lastCx) * k
      pts[j + 1] = s.cy + (pts[j + 1] - lastCy) * k
    }
    for (let j = 0; j < glints.length; j++) {
      glints[j].x = s.cx + (glints[j].x - lastCx) * k
      glints[j].y = s.cy + (glints[j].y - lastCy) * k
    }
    lastW = s.w
    lastH = s.h
    lastCx = s.cx
    lastCy = s.cy
  }

  if (A.phraseStart && s.frame > 1) {
    choose()
    prime()
  }

  R = span * 0.36 * (1 - gather * 0.24 + dropAmt * 0.1 + kick * 0.03)

  if (A.kickHit) {
    a1 = BASE[0]
    a2 = BASE[1]
    a3 = BASE[2]
    a4 = BASE[3]
    pulse = 1
  }
  if (A.drop) {
    a1 = BASE[0] * 1.12
    a2 = BASE[1] * 1.12
    a3 = BASE[2] * 1.12
    a4 = BASE[3] * 1.12
    pulse = 1.3
  }
  pulse *= Math.exp(-dt * 7)

  if (A.snareHit) {
    const dir = (A.snares || 0) % 2 ? 1 : -1
    spin(dir * (0.05 + snare * 0.08))
  }

  const hue = keyHue * 0.6 + note * 6 + 40 + energy * 40 + bass * 20
  const lit = 50 + bass * 4 + kick * 3

  if (A.hatHit) {
    const n = 2 + ((A.hats || 0) % 2)
    for (let i = 0; i < n; i++) {
      const b = rnd() * TAU, rr = (2 + rnd() * 9) * U
      glints.push({ x: s.cx + Math.cos(b) * rr, y: s.cy + Math.sin(b) * rr,
        life: 0.7 + rnd() * 0.3, h: hue + 130 + rnd() * 50 })
    }
    if (glints.length > 26) glints.splice(0, glints.length - 26)
  }

  const dth = (5 * (1 - calm * 0.35 + gather * 0.55) + level * 1.2) * dt / 12
  const cr = Math.cos(rot), sr = Math.sin(rot)
  for (let i = 0; i < 12; i++) {
    theta += dth
    const x = a1 * Math.sin(fx1 * theta + p1) + a2 * Math.sin(fx2 * theta + p2)
    const y = a3 * Math.sin(fy1 * theta + p3) + a4 * Math.sin(fy2 * theta + p4)
    pts.push(s.cx + (x * cr - y * sr) * R, s.cy + (x * sr + y * cr) * R)
  }
  a1 = Math.max(FLOOR[0], a1 * Math.exp(-dt * DAMP[0]))
  a2 = Math.max(FLOOR[1], a2 * Math.exp(-dt * DAMP[1]))
  a3 = Math.max(FLOOR[2], a3 * Math.exp(-dt * DAMP[2]))
  a4 = Math.max(FLOOR[3], a4 * Math.exp(-dt * DAMP[3]))
  if (pts.length > MAXP * 2) pts.splice(0, 600)

  if (pts.length >= 4) {
    const core = Math.max(0.7, (0.9 + bass * 1.7 + kick * 1.3 + pulse * 0.5) * U)
    out.push({ k: "p", pts, h: hue, s: 72, l: lit - 8, a: 0.1, lw: core * 6 + 3 * U })
    out.push({ k: "p", pts, h: hue, s: 78, l: lit, a: 0.5, lw: core })
    const hn = Math.min(HEAD, pts.length >> 1) * 2
    out.push({ k: "p", pts: pts.slice(pts.length - hn), h: hue + 14, s: 86, l: 62, a: 0.85, lw: core * 1.7 })
    out.push({ k: "c", x: pts[pts.length - 2], y: pts[pts.length - 1],
      r: (2 + kick * 2.5 + pulse * 1.6) * U, h: hue + 20, s: 90, l: 64, a: 0.9 })
  }

  for (let j = glints.length - 1; j >= 0; j--) {
    const g = glints[j]
    g.life -= dt * 2.1
    if (g.life <= 0) { glints.splice(j, 1); continue }
    out.push({ k: "c", x: g.x, y: g.y, r: (1 + 2.4 * g.life) * U, h: g.h, s: 80, l: 64, a: g.life * 0.7 })
  }

  if (dropAmt > 0.02) {
    out.push({ k: "c", x: s.cx, y: s.cy, r: span * (0.08 + dropAmt * 0.26), fill: false,
      h: hue + 60, s: 70, l: 58, a: dropAmt * 0.22, lw: U })
  }

  s = await frame(out, {
    trail: 0.16 + calm * 0.12 + energy * 0.05,
    zoom: 1 + pulse * 0.006 + dropAmt * 0.003,
    spin: 0.0006,
    hue: 0.25,
    react: { punch: 0.3 + kick * 0.4, sparkle: hat * 0.5, shake: 0 },
  })
}

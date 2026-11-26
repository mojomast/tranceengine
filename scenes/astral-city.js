// name: Astral city
// A camera journey in four phases. I: dusk drive, a perspective road under a striped sun, the skyline made from the
// spectrum, oncoming headlights on hi-hats. II: neon district, towers streaming past with windows flickering on hi-hats
// and billboards in different text effects. III: liftoff, the camera rising through cloud layers into the stars.
// IV: astral, a ringed planet pulsing on kicks above a sea of clouds while constellations connect, one line per beat.
let s = await frame([])
const TAU = Math.PI * 2
const PHASES = ["I. Dusk drive", "II. Neon district", "III. Liftoff", "IV. Astral"]
const clampP = (p) => Math.max(0, Math.min(PHASES.length - 1, Math.floor(p) || 0))
let phase = clampP(s.entry), phaseT = 0
const SIGNS = [["SLOP", "stack"], ["GRIMOIRE", "wave"], ["OPERATOR", "glitch"], ["24/7", "neon"], ["NO SIGNAL", "scramble"], ["VOID", "flip"]]
let cam = phase >= 2 ? 1 : 0, travel = 0
const towers = []
for (let i = 0; i < 14; i++) towers.push({ z: 2 + i * 1.4, side: i % 2 ? 1 : -1, x: 1.6 + Math.random() * 1.6, h: 1.5 + Math.random() * 3.5, w: 0.6 + Math.random() * 0.6, sign: i % 3 === 0 ? SIGNS[i % SIGNS.length] : null, seed: i })
const cars = [], stars = [], clouds = []
for (let i = 0; i < 90; i++) stars.push({ x: Math.random(), y: Math.random(), r: Math.random() })
for (let i = 0; i < 8; i++) clouds.push({ y: Math.random(), x: Math.random(), w: 0.3 + Math.random() * 0.5 })
const nodes = []
for (let i = 0; i < 12; i++) nodes.push({ x: 0.1 + Math.random() * 0.8, y: 0.08 + Math.random() * 0.4 })
let links = 0

while (true) {
  const A = s.audio
  const dt = Math.min(0.05, s.dt || 1 / 60)
  if (typeof s.cue === "number" && s.cue >= 0 && s.cue !== phase) { phase = clampP(s.cue); phaseT = 0; if (phase === 3) links = 0 }
  phaseT += dt
  const W = s.w, H = s.h, U = Math.min(W, H) / 800, out = []
  cam += ((phase >= 2 ? 1 : 0) - cam) * Math.min(1, dt * (phase === 2 ? 0.5 : 1.5))
  const hz = H * (0.55 + cam * 0.35), f = Math.min(W, H) * 0.9, camH = 1 + cam * 6
  const speed = (1.2 + A.energy * 3 + A.dropAmt * 4) * (phase === 1 ? 1.6 : 1)
  travel += speed * dt
  const hue = 300 + (A.keyHue || 0) * 0.15, cyan = 185
  const P = (X, Y, z) => [s.cx + (X * f) / z, hz + ((camH - Y) * f) / z * 0.35]

  // Sky: stars fade in as the camera rises.
  const starA = 0.15 + cam * 0.7
  for (const st of stars) {
    const y = (st.y * (hz - 10)) % H
    out.push({ k: "c", x: st.x * W, y, r: (0.6 + st.r * 1.4) * U * (1 + A.hat * st.r), h: 220, s: 30, l: 80, a: starA * (0.4 + st.r * 0.6) })
  }
  // Striped sun behind the skyline (phases I–II), sinking as the camera rises.
  if (phase <= 2) {
    const sr = Math.min(W, H) * 0.22 * (1 + A.kick * 0.04), sy = hz - sr * 0.35 + cam * H * 0.2
    for (let i = 0; i < 9; i++) {
      const yy = sy - sr + (i / 9) * sr * 2, half = Math.sqrt(Math.max(0, sr * sr - (yy - sy) * (yy - sy)))
      const thick = (2 + (i / 9) * 10 * (0.6 + 0.4 * Math.cos(A.phase * TAU))) * U
      if (yy < hz) out.push({ k: "l", x1: s.cx - half, y1: yy, x2: s.cx + half, y2: yy, h: 20 + i * 6, s: 95, l: 58, a: 0.85, lw: thick })
    }
    // Skyline silhouette from the spectrum.
    const sky = []
    for (let i = 0; i <= 64; i++) {
      const v = A.bands[Math.floor((i / 64) * 31)], x = (i / 64) * W
      sky.push(x, hz - (0.02 + v * 0.12 + ((i * 7) % 5) * 0.012) * H * (1 - cam * 0.6))
      sky.push(x + W / 64, hz - (0.02 + v * 0.12 + ((i * 7) % 5) * 0.012) * H * (1 - cam * 0.6))
    }
    out.push({ k: "p", pts: sky, close: false, h: hue, s: 70, l: 45, a: 0.8, lw: 1.6 * U })
    out.push({ k: "l", x1: 0, y1: hz, x2: W, y2: hz, h: hue, l: 60, a: 0.8, lw: 1.5 * U })
  }
  // Road with lane dashes rushing toward the camera.
  if (phase <= 2) {
    const fade = 1 - cam
    for (const side of [-1, 1]) {
      const [x0, y0] = P(side * 1.2, 0, 40), [x1, y1] = P(side * 1.2, 0, 0.6)
      out.push({ k: "l", x1: x0, y1: y0, x2: x1, y2: y1, h: cyan, l: 60, a: 0.8 * fade, lw: 2 * U })
    }
    for (let k = 0; k < 14; k++) {
      const z = 0.6 + ((k * 2.5 - travel * 4) % 35 + 35) % 35
      const [xa, ya] = P(0, 0, z), [xb, yb] = P(0, 0, z + 0.8)
      out.push({ k: "l", x1: xa, y1: ya, x2: xb, y2: yb, h: 50, l: 70, a: Math.min(1, 6 / z) * fade, lw: Math.max(1, (12 * U) / z) })
    }
    // Oncoming headlights spawn on hi-hats.
    if (A.hatHit && cars.length < 16) cars.push({ z: 40, lane: Math.random() < 0.5 ? -0.6 : 0.6 })
    for (let j = cars.length - 1; j >= 0; j--) {
      const c = cars[j]; c.z -= dt * (speed * 6 + 8)
      if (c.z < 0.7) { cars.splice(j, 1); continue }
      for (const dx of [-0.15, 0.15]) {
        const [x, y] = P(c.lane + dx, 0.2, c.z)
        out.push({ k: "c", x, y, r: Math.max(1, (14 * U) / c.z), h: c.lane < 0 ? 0 : 55, s: c.lane < 0 ? 90 : 20, l: 70, a: fade })
      }
    }
  }
  // Neon district: towers stream past, windows flicker on hats, billboards use different text effects.
  if (phase === 1 || (phase === 2 && cam < 0.6)) {
    const fade = phase === 1 ? Math.min(1, phaseT * 1.5) : 1 - cam
    towers.sort((a, b) => b.z - a.z)
    for (const t of towers) {
      t.z -= speed * dt * 2.2
      if (t.z < 0.5) { t.z += 20; t.h = 1.5 + Math.random() * 3.5; t.seed++ }
      const [xa, ya] = P(t.side * t.x, 0, t.z), [xb, yb] = P(t.side * (t.x + t.w), t.h, t.z)
      const l = Math.min(xa, xb), r = Math.max(xa, xb), top = Math.min(ya, yb), bot = Math.max(ya, yb)
      if (r < 0 || l > W) continue
      const near = Math.min(1, 3 / t.z)
      out.push({ k: "p", pts: [l, bot, r, bot, r, top, l, top], fill: true, h: 260, s: 40, l: 8, a: 0.55 * fade })
      out.push({ k: "p", pts: [l, bot, r, bot, r, top, l, top], h: hue + t.seed * 20, s: 80, l: 55, a: near * fade, lw: Math.max(1, 2 * U * near) })
      const cols = 3, rows = 6
      for (let i = 0; i < cols * rows; i++) {
        const lit = Math.sin(i * 12.9 + t.seed * 7.1 + A.hats * (i % 5 === 0 ? 1 : 0)) > 0.1
        if (!lit) continue
        const wx = l + (r - l) * (0.15 + (i % cols) * 0.27), wy = top + (bot - top) * (0.1 + Math.floor(i / cols) * 0.14)
        out.push({ k: "c", x: wx, y: wy, r: Math.max(0.8, (r - l) * 0.04), h: i % 4 ? 45 : cyan, s: 80, l: 65, a: near * fade * 0.9 })
      }
      if (t.sign && near > 0.25) out.push({ k: "w", text: t.sign[0], x: (l + r) / 2, y: top - (r - l) * 0.25, size: Math.max(8, (r - l) * 0.32), fx: t.sign[1], t: phaseT + t.seed, font: "display", h: hue + t.seed * 40, l: 65, a: fade })
    }
  }
  // Liftoff and astral: cloud layers sliding past, a cloud sea, a ringed planet, constellations.
  if (phase >= 2) {
    for (const c of clouds) {
      c.y += dt * (phase === 2 ? 0.25 : 0.03) * (1 + A.energy); if (c.y > 1.1) { c.y = -0.1; c.x = Math.random() }
      const cy = phase === 2 ? c.y * H : H * (0.75 + c.y * 0.2), cw = c.w * W
      const pts = []
      for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU; pts.push(c.x * W + Math.cos(a) * cw * 0.5, cy + Math.sin(a) * cw * 0.08 * (1 + 0.3 * Math.sin(a * 3 + s.t))) }
      out.push({ k: "p", pts, fill: true, h: 230, s: 30, l: 50, a: phase === 3 ? 0.025 : 0.05 })
      out.push({ k: "p", pts, h: 230, s: 40, l: 65, a: phase === 3 ? 0.16 : 0.25, lw: 1.2 * U })
    }
  }
  if (phase === 3) {
    const pr = Math.min(W, H) * 0.2 * (1 + A.kick * 0.06), px = W * 0.68, py = H * 0.42 - Math.min(1, phaseT * 0.3) * H * 0.08
    out.push({ k: "c", x: px, y: py, r: pr, h: hue, s: 60, l: 30, a: 0.35 })
    out.push({ k: "c", x: px, y: py, r: pr, fill: false, h: hue, s: 70, l: 60, a: 0.9, lw: 2.5 * U })
    const ring = []
    for (let i = 0; i <= 48; i++) { const a = (i / 48) * TAU; ring.push(px + Math.cos(a) * pr * 1.8, py + Math.sin(a) * pr * 0.35) }
    out.push({ k: "p", pts: ring, h: 45, s: 80, l: 65, a: 0.85, lw: (2 + A.bass * 3) * U })
    if (A.beat && links < nodes.length - 1) links++
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i], x = n.x * W, y = n.y * H
      out.push({ k: "c", x, y, r: (2.5 + (A.snare > 0.4 && (i + A.snares) % 4 === 0 ? 5 * A.snare : 0)) * U, h: 200, s: 30, l: 85, a: 0.95 })
      if (i < links) { const m = nodes[i + 1]; out.push({ k: "l", x1: x, y1: y, x2: m.x * W, y2: m.y * H, h: cyan, l: 70, a: 0.6, lw: 1.2 * U }) }
    }
    out.push({ k: "w", text: "ASTRAL", x: W * 0.3, y: H * 0.62, size: 70 * U, fx: "rise", t: phaseT, h: hue, l: 75 })
    out.push({ k: "w", text: "above the slop", x: W * 0.3, y: H * 0.62 + 60 * U, size: 22 * U, fx: "wave", t: phaseT - 0.8, font: "mono", h: cyan, s: 40, l: 80 })
  }
  if (phase === 0) out.push({ k: "w", text: "dusk, downwind of the slop", x: s.cx, y: H * 0.1, size: 22 * U, fx: "type", t: phaseT - 0.5, font: "mono", h: 40, s: 40, l: 80, speed: 14 })

  s = await frame(out, {
    trail: [0.78, 0.74, 0.86, 0.9][phase],
    zoom: phase === 2 ? 0.995 : 1 + A.kick * 0.006, spin: 0, hue: 0.2, mirror: 0,
    phase, phases: PHASES.length, title: PHASES[phase], titleFx: "rise", titleHue: hue,
    react: { punch: 0.8, slice: phase === 1 ? 1.3 : 0.4, sparkle: 1.2, shake: 0.6, tint: 1.1 },
  })
}

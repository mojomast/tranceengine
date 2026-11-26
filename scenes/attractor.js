// name: Strange attractor
// Particles riding four chaotic systems in 3D, each a phase: I. Thomas, II. Aizawa, III. Lorenz, IV. Halvorsen.
// The bass is wired into the maths: in Thomas the damping b drops below its chaos threshold (≈0.208) as the bass
// rises, so quiet passages settle into orbits and heavy ones turn turbulent. Kicks speed up time for a moment,
// snares kick a spray of particles off the attractor, hats light the heads, pitch sets the hue, a build (song map)
// pushes the system toward chaos and spins the camera, and a drop blows the cloud outward before the attractor
// reels it back in.
let s = await frame([])
const TAU = Math.PI * 2
const PHASES = ["I. Thomas", "II. Aizawa", "III. Lorenz", "IV. Halvorsen"]
const clampP = (p) => Math.max(0, Math.min(PHASES.length - 1, Math.floor(p) || 0))
let phase = clampP(s.entry), phaseT = 0
// Each system: its field, plus where it lives and how big it is, so particles can be handed from one to the next.
const SYS = [
  { c: [0, 0, 0], r: 3.2, dt: 1.6 },
  { c: [0, 0, 0.6], r: 1.4, dt: 0.9 },
  { c: [0, 0, 25], r: 22, dt: 0.42 },
  { c: [-3.5, -3.5, -3.5], r: 7.5, dt: 0.5 },
]
const field = (k, x, y, z, chaos) => {
  if (k === 0) { const b = 0.215 - chaos * 0.05; return [Math.sin(y) - b * x, Math.sin(z) - b * y, Math.sin(x) - b * z] }
  if (k === 1) { const a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1 + chaos * 0.05; return [(z - b) * x - d * y, d * x + (z - b) * y, c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x] }
  if (k === 2) { const sg = 10, rho = 24 + chaos * 8, be = 8 / 3; return [sg * (y - x), x * (rho - z) - y, x * y - be * z] }
  const a = 1.89 - chaos * 0.15; return [-a * x - 4 * y - 4 * z - y * y, -a * y - 4 * z - 4 * x - z * z, -a * z - 4 * x - 4 * y - x * x]
}
const N = 170, TAIL = 6
const P = []
const seedIn = (k) => { const S = SYS[k]; return [S.c[0] + (Math.random() - 0.5) * S.r, S.c[1] + (Math.random() - 0.5) * S.r, S.c[2] + (Math.random() - 0.5) * S.r * 0.5] }
for (let i = 0; i < N; i++) { const p = seedIn(phase); P.push({ x: p[0], y: p[1], z: p[2], hist: [], glow: 0, spray: 0, sx: 0, sy: 0, sz: 0 }) }
let sys = phase, yaw = 0, pitch = 0.4, warp = 0, blow = 0, hue = 200, settle = 0
// Hand every particle over to another system: keep its place relative to the old system's centre and size.
const handOver = (to) => {
  const A0 = SYS[sys], B0 = SYS[to]
  for (const p of P) {
    p.x = B0.c[0] + ((p.x - A0.c[0]) / A0.r) * B0.r; p.y = B0.c[1] + ((p.y - A0.c[1]) / A0.r) * B0.r; p.z = B0.c[2] + ((p.z - A0.c[2]) / A0.r) * B0.r
    p.hist.length = 0
  }
  sys = to; settle = 1
}
for (let k = 0; k < 120; k++) for (const p of P) { const d = field(sys, p.x, p.y, p.z, 0.3); const h = 0.01 * SYS[sys].dt; p.x += d[0] * h; p.y += d[1] * h; p.z += d[2] * h }

while (true) {
  const A = s.audio
  const dt = Math.min(0.05, s.dt || 1 / 60)
  if (typeof s.cue === "number" && s.cue >= 0 && s.cue !== phase) { phase = clampP(s.cue); phaseT = 0 }
  phaseT += dt
  if (phase !== sys) handOver(phase)
  const W = s.w, H = s.h, out = []
  const build = A.build || 0
  const chaos = Math.min(1, A.bass * 0.9 + build * 0.8 + (phase === 3 ? 0.2 : 0))
  warp = Math.max(warp * Math.exp(-dt * 5), A.kickHit ? 1 : 0)
  if (A.drop) blow = 1
  blow *= Math.exp(-dt * 1.4); settle *= Math.exp(-dt * 2)
  const S = SYS[sys], speed = (0.55 + A.energy * 0.6 + warp * 1.4 + build * 1.2) * S.dt
  // Snare: a spray of particles is flung off the attractor; the field pulls them home over the next second.
  if (A.snareHit) for (let q = 0; q < 24; q++) { const p = P[Math.floor(Math.random() * N)]; p.spray = 1; p.sx = (Math.random() - 0.5) * S.r * 2.5; p.sy = (Math.random() - 0.5) * S.r * 2.5; p.sz = (Math.random() - 0.5) * S.r * 2.5 }
  if (A.hatHit) for (let q = 0; q < 30; q++) P[Math.floor(Math.random() * N)].glow = 1
  // Integrate: one Euler step a frame (steps are capped so a fast moment can't throw a particle off).
  const h = dt * speed
  for (const p of P) {
    {
      const d = field(sys, p.x, p.y, p.z, chaos)
      const m = Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2])
      const cap = m * h > S.r * 0.15 ? (S.r * 0.15) / (m * h) : 1
      p.x += d[0] * h * cap; p.y += d[1] * h * cap; p.z += d[2] * h * cap
    }
    if (p.spray > 0.01) { p.x += p.sx * p.spray * dt * 3; p.y += p.sy * p.spray * dt * 3; p.z += p.sz * p.spray * dt * 3; p.spray *= Math.exp(-dt * 4) }
    if (!(Math.abs(p.x) < 1e4 && Math.abs(p.y) < 1e4 && Math.abs(p.z) < 1e4)) { const q = seedIn(sys); p.x = q[0]; p.y = q[1]; p.z = q[2]; p.hist.length = 0 }
    p.hist.push(p.x, p.y, p.z); if (p.hist.length > TAIL * 3) p.hist.splice(0, 3)
  }
  // Camera: orbit, faster through a build; the drop dollies out and the cloud swells.
  yaw += dt * (0.15 + build * 0.9 + warp * 0.2 + (phase === 3 ? 0.2 : 0))
  pitch = 0.35 + Math.sin(s.t * 0.13) * 0.25
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
  const R = (Math.min(W, H) * 0.42) / S.r * (1 + blow * 0.5 - build * 0.1 + warp * 0.03), camZ = 3.4
  hue += (((A.note || 0) * 30 + 180) % 360 - hue) * Math.min(1, dt * 0.6)
  const proj = (x, y, z) => {
    x = (x - S.c[0]) * (1 + blow * 0.8); y = (y - S.c[1]) * (1 + blow * 0.8); z = (z - S.c[2]) * (1 + blow * 0.8)
    const x1 = x * cy - y * sy, y1 = x * sy + y * cy
    const z2 = z * cp - y1 * sp, d2 = z * sp + y1 * cp
    const k = camZ / (camZ + d2 / S.r)
    return [s.cx + x1 * R * k, s.cy - z2 * R * k, k]
  }
  const U = Math.min(W, H) / 800
  for (let i = 0; i < N; i++) {
    const p = P[i], hh = p.hist
    if (hh.length < 6) continue
    const pts = []
    let k = 1
    const bl = 1 + blow * 0.8
    for (let j = 0; j < hh.length; j += 3) {
      const x = (hh[j] - S.c[0]) * bl, y = (hh[j + 1] - S.c[1]) * bl, z = (hh[j + 2] - S.c[2]) * bl
      const x1 = x * cy - y * sy, y1 = x * sy + y * cy
      k = camZ / (camZ + (z * sp + y1 * cp) / S.r)
      pts.push(s.cx + x1 * R * k, s.cy - (z * cp - y1 * sp) * R * k)
    }
    const depth = Math.max(0, Math.min(1, (k - 0.7) * 1.6))
    const lh = hue + [0, 80, 150, 230][sys] + (i / N) * 90 - chaos * 50 + p.spray * 120
    out.push({ k: "p", pts, close: false, h: lh, s: 70 + chaos * 25, l: 40 + depth * 25 + p.glow * 30, a: 0.5 + depth * 0.5, lw: (0.8 + depth * 2.2) * U * (1 + warp * 0.4) })
    if (p.glow > 0.1) out.push({ k: "c", x: pts[pts.length - 2], y: pts[pts.length - 1], r: (2 + p.glow * 4) * U, h: lh, s: 40, l: 85, a: p.glow })
    p.glow *= 0.86
  }
  // A faint equation readout, so you can see which system is running and how chaotic it is.
  const label = ["Thomas  b = " + (0.215 - chaos * 0.05).toFixed(3), "Aizawa  f = " + (0.1 + chaos * 0.05).toFixed(3), "Lorenz  ρ = " + (24 + chaos * 8).toFixed(1), "Halvorsen  a = " + (1.89 - chaos * 0.15).toFixed(2)][sys]
  out.push({ k: "w", text: label, x: W * 0.95, y: H * 0.08, size: 15 * U, fx: settle > 0.3 ? "scramble" : "type", t: phaseT, font: "mono", align: "right", h: hue, s: 30, l: 70, a: 0.65 })

  s = await frame(out, {
    trail: 0.72 + chaos * 0.12 + build * 0.08, zoom: 1 + warp * 0.006 + build * 0.008, spin: 0, hue: 0.3 + chaos * 0.6, mirror: phase === 3 && A.energy > 0.6 ? 2 : 0,
    phase, phases: PHASES.length, title: PHASES[phase], titleFx: "scramble", titleHue: hue,
    react: { punch: 1.1, slice: 0.6, sparkle: 1.3, shake: 0.7, tint: 0.9 },
  })
}

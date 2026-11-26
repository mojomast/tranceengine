// name: Murmuration
// A flock of starlings in 3D, in four phases. I. Dusk: a loose flock drifting on a swirling wind. II. Murmuration: every
// two bars the flock pours itself into a new form (sphere, torus, helix, wave, wings) while a hawk dives through it on
// each snare. III. Gathering: the flock packs into a tightening orb that spins faster as the build rises (song map:
// build and toDrop). IV. Scatter: on the drop it bursts outward, then spells SLOP and keeps re-forming on every bar.
// Kicks make the whole flock breathe, hats glint off random wings, and the song's pitch tints the sky.
let s = await frame([])
const TAU = Math.PI * 2
const PHASES = ["I. Dusk", "II. Murmuration", "III. Gathering", "IV. Scatter"]
const clampP = (p) => Math.max(0, Math.min(PHASES.length - 1, Math.floor(p) || 0))
let phase = clampP(s.entry), phaseT = 0
const N = 300
const px = [], py = [], pz = [], vx = [], vy = [], vz = [], tx = [], ty = [], tz = [], glint = []
for (let i = 0; i < N; i++) {
  const a = Math.random() * TAU, r = Math.random() * 0.8
  px.push(Math.cos(a) * r); py.push((Math.random() - 0.5) * 0.6); pz.push(Math.sin(a) * r)
  vx.push(0); vy.push(0); vz.push(0); tx.push(0); ty.push(0); tz.push(0); glint.push(0)
}
// 5x7 dot-matrix letters for the word the flock spells.
const FONT = {
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
}
const wordCells = (word) => {
  const cells = []
  const n = word.length, cw = 0.2, gap = 0.2, total = n * 5 * cw * 0.5 + (n - 1) * gap
  for (let k = 0; k < n; k++) {
    const g = FONT[word[k]]; if (!g) continue
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === "1") cells.push([-total / 2 + k * (2.5 * cw + gap) + c * cw * 0.5, -0.4 + r * cw * 0.55])
  }
  return cells
}
const SLOP = wordCells("SLOP")
const FORMS = ["sphere", "torus", "helix", "wave", "wings"]
let form = "cloud", formIdx = 0, formT = 0, placed = "", frameNo = 0
// Each bird's place in a form, from its index (golden-angle spreads keep every form evenly filled).
const placeAll = (name) => {
  for (let i = 0; i < N; i++) {
    const u = i / N, g = i * 2.39996
    let x = 0, y = 0, z = 0
    if (name === "sphere") { const yy = 1 - 2 * u, rr = Math.sqrt(1 - yy * yy); x = Math.cos(g) * rr; y = yy; z = Math.sin(g) * rr }
    else if (name === "torus") { const a = u * TAU * 1, b = g; x = (0.75 + 0.3 * Math.cos(b)) * Math.cos(a * 7); z = (0.75 + 0.3 * Math.cos(b)) * Math.sin(a * 7); y = 0.3 * Math.sin(b) }
    else if (name === "helix") { const a = u * TAU * 3, side = i % 2 ? Math.PI : 0; x = Math.cos(a + side) * 0.45; z = Math.sin(a + side) * 0.45; y = (u - 0.5) * 2.1 }
    else if (name === "wave") { const gx = (i % 22) / 21 - 0.5, gz = Math.floor(i / 22) / 15 - 0.5; x = gx * 2.2; z = gz * 1.6; y = 0.25 * Math.sin(gx * 9 + formT * 3) * Math.cos(gz * 7) }
    else if (name === "wings") { const side = i % 2 ? 1 : -1, a = u * Math.PI; x = side * (0.15 + Math.sin(a) * 1.0); y = -Math.sin(a * 2) * 0.35 + (1 - Math.sin(a)) * 0.2; z = Math.cos(a) * 0.5 }
    else if (name === "orb") { const yy = 1 - 2 * u, rr = Math.sqrt(1 - yy * yy); x = Math.cos(g) * rr; y = yy; z = Math.sin(g) * rr }
    else if (name === "word") { const c = SLOP[i % SLOP.length], j = Math.floor(i / SLOP.length); x = c[0] + Math.cos(j * 2.4) * 0.025; y = c[1] + Math.sin(j * 2.4) * 0.025; z = Math.sin(j) * 0.03 }
    tx[i] = x; ty[i] = y; tz[i] = z
  }
}
let yaw = 0, pitch = 0.25, center = [0, 0, 0], breath = 0, burst = 0, hueBase = 210, spin = 0
const hawk = { x: 3, y: 0, z: 0, vx: 0, vy: 0, vz: 0, on: 0 }
let lastBar = -1

while (true) {
  const A = s.audio
  const dt = Math.min(0.05, s.dt || 1 / 60)
  if (typeof s.cue === "number" && s.cue >= 0 && s.cue !== phase) { phase = clampP(s.cue); phaseT = 0; formT = 0 }
  phaseT += dt; formT += dt
  const W = s.w, H = s.h, R = Math.min(W, H) * 0.4, out = []
  const build = Math.max(A.build || 0, phase === 2 ? Math.min(1, phaseT / 12) * 0.6 : 0)
  const newBar = A.downbeat && A.bars !== lastBar
  if (newBar) lastBar = A.bars

  // Choose the formation.
  if (phase === 0) form = "cloud"
  else if (phase === 1) { if (form === "cloud" || form === "orb" || form === "word" || (newBar && A.bars % 2 === 0 && formT > 1.5)) { form = FORMS[formIdx++ % FORMS.length]; formT = 0 } }
  else if (phase === 2) form = "orb"
  else { if (form !== "word" && form !== "burst" && phaseT < 0.2) { form = "burst"; burst = Math.max(burst, 0.7) } if (form === "burst" && phaseT > 1.2) { form = "word"; formT = 0 } else if (form === "word" && formT > 4 && newBar) { form = FORMS[formIdx++ % FORMS.length]; formT = 0 } else if (form !== "word" && form !== "burst" && newBar && formT > 1.5) { form = FORMS[formIdx++ % FORMS.length]; formT = 0 } }
  if (A.drop) { burst = 1; if (phase === 3) { form = "burst"; phaseT = 0 } }
  const size = form === "orb" ? 0.85 - build * 0.6 : form === "word" ? 1.1 : 1
  frameNo++
  // Targets are recomputed only when the form changes (the wave keeps rippling, so it refreshes every few frames).
  if (form !== "cloud" && form !== "burst" && (form !== placed || (form === "wave" && frameNo % 4 === 0))) { placeAll(form); placed = form }

  // Wind: a cheap divergence-ish swirl field from crossed sines.
  const T = s.t
  center = [Math.sin(T * 0.13) * 0.4 * (phase === 0 ? 1 : 0.3), Math.sin(T * 0.21) * 0.15, Math.cos(T * 0.11) * 0.3 * (phase === 0 ? 1 : 0.3)]
  breath = Math.max(breath * Math.exp(-dt * 6), A.kickHit ? 1 : 0)
  burst *= Math.exp(-dt * 1.5)
  // The hawk: on each snare it dives through the flock from a random side.
  if (A.snareHit && phase >= 1 && form !== "word") {
    const a = Math.random() * TAU
    hawk.x = Math.cos(a) * 1.8; hawk.z = Math.sin(a) * 1.8; hawk.y = 0.9
    hawk.vx = -hawk.x * 3.2; hawk.vz = -hawk.z * 3.2; hawk.vy = -1.6; hawk.on = 1
  }
  hawk.x += hawk.vx * dt; hawk.y += hawk.vy * dt; hawk.z += hawk.vz * dt; hawk.on *= Math.exp(-dt * 1.4)
  if (A.hatHit) for (let q = 0; q < 14; q++) glint[Math.floor(Math.random() * N)] = 1

  const seek = form === "cloud" ? 0 : form === "burst" ? 0 : form === "word" ? 9 : 4 + build * 6
  const wind = form === "cloud" ? 1.4 : form === "word" ? 0.15 : 0.5 - build * 0.3
  const damp = Math.exp(-dt * (form === "word" ? 3.5 : 2))
  const rotY = form === "orb" ? (0.6 + build * 5) * dt : 0
  spin += rotY
  // Only the orb spins its targets; every other form (the word above all) faces the camera.
  const cs = form === "orb" ? Math.cos(spin) : 1, sn = form === "orb" ? Math.sin(spin) : 0
  let speedSum = 0
  for (let i = 0; i < N; i++) {
    let x = px[i], y = py[i], z = pz[i]
    let ax = (Math.sin(y * 3.1 + T * 0.7) - Math.cos(z * 2.3 - T * 0.5)) * wind
    let ay = (Math.sin(z * 2.7 + T * 0.6) - Math.cos(x * 3.3 + T * 0.4)) * wind * 0.6
    let az = (Math.sin(x * 2.9 - T * 0.8) - Math.cos(y * 2.1 + T * 0.3)) * wind
    if (seek > 0) {
      // Targets spin with the orb.
      const gx = (tx[i] * cs - tz[i] * sn) * size + center[0], gz = (tx[i] * sn + tz[i] * cs) * size + center[2], gy = ty[i] * size + center[1]
      ax += (gx - x) * seek; ay += (gy - y) * seek; az += (gz - z) * seek
    } else if (form === "cloud") { ax += (center[0] - x) * 0.8; ay += (center[1] - y) * 1.2; az += (center[2] - z) * 0.8 }
    // Kick: the flock breathes out from its centre.
    const dx = x - center[0], dy = y - center[1], dz = z - center[2], d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.05
    const push = breath * 3 * (phase === 0 ? 0.4 : 1) + burst * (form === "burst" ? 9 : 0)
    ax += (dx / d) * push; ay += (dy / d) * push; az += (dz / d) * push
    // The hawk scatters everything near it.
    if (hawk.on > 0.05) {
      const hx = x - hawk.x, hy = y - hawk.y, hz = z - hawk.z, hd = hx * hx + hy * hy + hz * hz
      if (hd < 0.25) { const f = (0.25 - hd) * 60 * hawk.on; ax += hx * f; ay += hy * f; az += hz * f }
    }
    vx[i] = (vx[i] + ax * dt) * damp; vy[i] = (vy[i] + ay * dt) * damp; vz[i] = (vz[i] + az * dt) * damp
    px[i] = x + vx[i] * dt; py[i] = y + vy[i] * dt; pz[i] = z + vz[i] * dt
    speedSum += Math.abs(vx[i]) + Math.abs(vy[i]) + Math.abs(vz[i])
  }

  // Camera: a slow orbit; it squares up to face the flock when it spells a word.
  const yawTarget = form === "word" ? Math.round(yaw / TAU) * TAU : yaw + dt * (0.12 + build * 0.5 + (phase === 3 ? 0.25 : 0))
  yaw += (yawTarget - yaw) * Math.min(1, dt * (form === "word" ? 3 : 8))
  pitch += ((form === "word" ? 0 : 0.25 + Math.sin(T * 0.1) * 0.15) - pitch) * Math.min(1, dt * 2)
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
  const camZ = 3.2 - breath * 0.15 - build * 0.6
  hueBase += (((A.keyHue || 0) + 200) % 360 - hueBase) * Math.min(1, dt * 0.3)
  const heat = build * (phase === 2 ? 1 : 0.6)
  // Sky: a dim horizon glow that warms through a build.
  out.push({ k: "c", x: s.cx, y: H * 0.95, r: Math.max(W, H) * 0.75, h: hueBase + 30 - heat * 40, s: 70, l: 10 + heat * 12 + A.bass * 4, a: 0.12 })
  const proj = (x, y, z) => {
    const x1 = x * cy - z * sy, z1 = x * sy + z * cy
    const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp
    const k = camZ / (camZ + z2)
    return [s.cx + x1 * R * k, s.cy + y2 * R * k, k]
  }
  for (let i = 0; i < N; i++) {
    const a = proj(px[i], py[i], pz[i])
    // The tail: the velocity turned by the camera, in screen space (no second projection).
    const sp2 = Math.abs(vx[i]) + Math.abs(vy[i]) + Math.abs(vz[i]), tl = (0.06 + Math.min(0.12, sp2) * 0.25) * R * a[2]
    const wx = vx[i] * cy - vz[i] * sy, wz = vx[i] * sy + vz[i] * cy
    const b = [a[0] - wx * tl, a[1] - (vy[i] * cp - wz * sp) * tl]
    glint[i] *= 0.88
    const depth = Math.max(0, Math.min(1, (a[2] - 0.75) * 2))
    out.push({ k: "l", x1: b[0], y1: b[1], x2: a[0], y2: a[1], h: hueBase + sp2 * 40 + i * 0.1 - heat * 160, s: 60 + heat * 30, l: 35 + depth * 30 + glint[i] * 40 + heat * 20 + (form === "word" ? 22 : 0), a: 0.55 + depth * 0.45, lw: (1.2 + depth * 2.2 + (form === "word" ? 1.5 : 0)) * a[2] * (Math.min(W, H) / 700) })
  }
  if (hawk.on > 0.08) {
    const h = proj(hawk.x, hawk.y, hawk.z), sc = 14 * h[2] * (Math.min(W, H) / 700)
    out.push({ k: "p", pts: [h[0] - sc, h[1] - sc * 0.4, h[0], h[1] + sc * 0.3, h[0] + sc, h[1] - sc * 0.4], close: false, h: 0, s: 80, l: 60, a: hawk.on, lw: 3 })
  }
  // Countdown halo while gathering: a ring that closes as the drop approaches.
  if (form === "orb" && A.toDrop < 16) {
    const f = Math.max(0, Math.min(1, A.toDrop / 16)), rr = R * (0.15 + f * 0.9)
    out.push({ k: "c", x: s.cx, y: s.cy, r: rr, fill: false, h: hueBase - 160, s: 90, l: 70, a: 0.25 + (1 - f) * 0.5, lw: 1.5 + (1 - f) * 4 })
  }

  s = await frame(out, {
    trail: form === "word" ? 0.82 : phase === 3 ? 0.86 : 0.78 + build * 0.12,
    zoom: 1 + breath * 0.004 + build * 0.01, spin: form === "orb" ? 0.002 + build * 0.01 : 0, hue: phase === 3 ? 1 : 0, mirror: 0,
    phase, phases: PHASES.length, title: PHASES[phase], titleFx: phase === 3 ? "split" : "rise", titleHue: hueBase,
    react: { punch: 0.9, slice: 0.4, sparkle: 1.4, shake: 0.6, tint: 0.8 },
  })
}

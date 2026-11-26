// name: The Sloperator
// The machine the song is named after, in four phases. I: a CRT boots, typing its log, with a flap counter and a
// progress bar. II: production, where the conveyor steps forward on every beat, the piston stamps on kicks, gears mesh,
// the gauge needle follows the bass and slop blobs ride the belt. III: overclock, everything doubled, red warning
// glitching, sparks on snares. IV: meltdown, parts drifting apart, slop overflowing and the screen scrambling.
let s = await frame([])
const TAU = Math.PI * 2
const PHASES = ["I. Boot", "II. Production", "III. Overclock", "IV. Meltdown"]
const clampP = (p) => Math.max(0, Math.min(PHASES.length - 1, Math.floor(p) || 0))
let phase = clampP(s.entry), phaseT = 0
const LOG = ["SLOPERATOR OS v0.1", "> mounting grimoire ...... ok", "> calibrating slop ....... ok", "> loading operators ...... ok", "> warming the vats ......", "READY."]
const rect = (x, y, w, h) => [x, y, x + w, y, x + w, y + h, x, y + h]
const gear = (cx, cy, r, teeth, rot) => {
  const pts = []
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = rot + (i / (teeth * 2)) * TAU, a1 = rot + ((i + 1) / (teeth * 2)) * TAU, rr = i % 2 ? r * 0.82 : r
    pts.push(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr, cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr)
  }
  return pts
}
let morph = phase > 0 ? 1 : 0, belt = 0, beltTo = 0, gearRot = 0, gearTo = 0, made = 0, apart = phase === 3 ? 1 : 0
const blobs = [], sparks = [], floods = []

while (true) {
  const A = s.audio
  const dt = Math.min(0.05, s.dt || 1 / 60)
  if (typeof s.cue === "number" && s.cue >= 0 && s.cue !== phase) { phase = clampP(s.cue); phaseT = 0 }
  phaseT += dt
  const W = s.w, H = s.h, U = Math.min(W, H) / 800, out = []
  const over = phase === 2, melt = phase === 3
  const hue = over ? 2 : melt ? 320 : 165, accent = over ? 30 : 55
  morph += ((phase > 0 ? 1 : 0) - morph) * Math.min(1, dt * 2)
  apart += ((melt ? 1 : 0) - apart) * Math.min(1, dt * 0.7)
  const drift = (i) => apart * (40 + (i % 3) * 30) * U * Math.sin(s.t * 0.7 + i)

  // CRT: full screen while booting, shrinking into the machine's corner after.
  const sw = W * (0.7 - morph * 0.42), sh = H * (0.62 - morph * 0.34)
  const sx = (W - sw) / 2 + morph * W * 0.22 + drift(1), sy = H * (0.18 - morph * 0.08) + drift(2)
  out.push({ k: "p", pts: rect(sx, sy, sw, sh), fill: true, h: hue, s: 50, l: 10, a: 0.4 })
  out.push({ k: "p", pts: rect(sx, sy, sw, sh), h: hue, s: 70, l: 55, a: 0.9, lw: 3 * U })
  const fs = Math.max(9, sh * (morph > 0.5 ? 0.085 : 0.055))
  if (phase === 0) {
    LOG.forEach((line, k) => {
      const tt = phaseT - k * 0.9
      if (tt > 0) out.push({ k: "w", text: line, x: sx + sw * 0.06, y: sy + sh * 0.12 + k * fs * 1.5, size: fs, fx: "type", t: tt, font: "mono", align: "left", h: hue, s: 60, l: 70, speed: 26 })
    })
    const pct = Math.min(100, Math.floor(phaseT * 9 + A.energy * 20))
    const bars = Math.floor(pct / 5)
    out.push({ k: "w", text: "[" + "#".repeat(bars) + ".".repeat(20 - bars) + "] " + pct + "%", x: sx + sw * 0.06, y: sy + sh * 0.88, size: fs, fx: "flap", t: phaseT, font: "mono", align: "left", h: accent, s: 80, l: 65 })
  } else {
    const label = over ? "OVERCLOCK" : melt ? "REBOOTING..." : "OUTPUT " + String(made).padStart(6, "0")
    out.push({ k: "w", text: label, x: sx + sw / 2, y: sy + sh * 0.25, size: fs * 1.2, fx: over ? "glitch" : melt ? "scramble" : "flap", t: phaseT, font: "mono", h: over ? 0 : hue, s: 80, l: 65, seed: made })
    // A small spectrum readout.
    for (let i = 0; i < 12; i++) {
      const v = A.bands[i * 2 + 2], bw = sw * 0.8 / 12
      out.push({ k: "p", pts: rect(sx + sw * 0.1 + i * bw, sy + sh * 0.88 - v * sh * 0.45, bw * 0.7, v * sh * 0.45), fill: true, h: hue + i * 6, l: 55, a: 0.7 })
    }
  }

  if (morph > 0.05) {
    const al = morph
    const floorY = H * 0.8
    // Housing and hopper.
    const hx = W * 0.08 + drift(3), hy = H * 0.3 + drift(4)
    out.push({ k: "p", pts: rect(hx, hy, W * 0.22, H * 0.38), h: hue, s: 40, l: 45, a: al * 0.8, lw: 2 * U })
    out.push({ k: "p", pts: [hx + W * 0.04, hy, hx + W * 0.18, hy, hx + W * 0.14, hy + H * 0.1, hx + W * 0.08, hy + H * 0.1], h: accent, l: 55, a: al * 0.8, lw: 2 * U })
    // Gears: they turn a notch on every beat, twice as fast when overclocked.
    if (A.beat || (over && A.hatHit)) gearTo += TAU / 16
    gearRot += (gearTo - gearRot) * 0.2
    const gs = [[hx + W * 0.06, hy + H * 0.2, 42, 10], [hx + W * 0.06 + 70 * U, hy + H * 0.2 + 30 * U, 30, 8], [hx + W * 0.15, hy + H * 0.29, 36, 9]]
    gs.forEach(([gx, gy, r, teeth], i) => out.push({ k: "p", pts: gear(gx + drift(i + 5), gy + drift(i + 6), r * U, teeth, gearRot * (i % 2 ? -1.3 : 1)), h: accent, s: 60, l: 55 + A.kick * 10, a: al * 0.9, lw: 1.6 * U }))
    // Conveyor: rollers, belt and moving dashes. It steps forward on each beat.
    const bx0 = W * 0.12, bx1 = W * 0.88, by = floorY - 30 * U
    if (A.beat || (over && (A.snareHit || A.hatHit))) beltTo += W * 0.06
    belt += (beltTo - belt) * 0.25
    out.push({ k: "l", x1: bx0, y1: by - 12 * U + drift(7), x2: bx1, y2: by - 12 * U + drift(8), h: hue, l: 50, a: al, lw: 2 * U })
    out.push({ k: "l", x1: bx0, y1: by + 12 * U + drift(7), x2: bx1, y2: by + 12 * U + drift(8), h: hue, l: 40, a: al, lw: 2 * U })
    for (let x = (belt % (40 * U)); x < bx1 - bx0; x += 40 * U) out.push({ k: "l", x1: bx0 + x, y1: by - 12 * U, x2: bx0 + x + 14 * U, y2: by - 12 * U, h: hue, l: 70, a: al * 0.7, lw: 3 * U })
    for (const rx of [bx0, bx1]) {
      out.push({ k: "c", x: rx, y: by, r: 12 * U, fill: false, h: hue, l: 60, a: al, lw: 2 * U })
      out.push({ k: "l", x1: rx, y1: by, x2: rx + Math.cos(belt / (12 * U)) * 12 * U, y2: by + Math.sin(belt / (12 * U)) * 12 * U, h: hue, l: 70, a: al, lw: 2 * U })
    }
    // Piston: stamps down on every kick.
    const px = W * 0.5 + drift(9), stamp = A.kick * (over ? 1.2 : 1)
    const ph = H * 0.12 + stamp * (by - 12 * U - H * 0.38 - H * 0.12)
    out.push({ k: "p", pts: rect(px - 10 * U, H * 0.26, 20 * U, ph), h: accent, l: 55, a: al, lw: 2 * U })
    out.push({ k: "p", pts: rect(px - 36 * U, H * 0.26 + ph, 72 * U, 18 * U), fill: true, h: accent, l: 50, a: al * 0.6 })
    // Gauge: needle on the bass, shaking in the red when overclocked.
    const gx = W * 0.78 + drift(10), gy = H * 0.68, gr = 46 * U
    const arc = []
    for (let i = 0; i <= 24; i++) { const a = Math.PI + (i / 24) * Math.PI; arc.push(gx + Math.cos(a) * gr, gy + Math.sin(a) * gr) }
    out.push({ k: "p", pts: arc, close: false, h: hue, l: 60, a: al, lw: 2 * U })
    const na = Math.PI + Math.min(1, A.bass * 0.85 + (over ? 0.25 + Math.random() * 0.08 : 0)) * Math.PI
    out.push({ k: "l", x1: gx, y1: gy, x2: gx + Math.cos(na) * gr * 0.9, y2: gy + Math.sin(na) * gr * 0.9, h: over ? 0 : accent, l: 65, a: al, lw: 3 * U })
    // Slop: a blob drops from the hopper on each beat and rides the belt into the vat.
    if (A.beat && phase >= 1) { blobs.push({ x: hx + W * 0.11, y: hy + H * 0.12, vy: 0, on: false, hue: hue + Math.random() * 60, r: (10 + Math.random() * 10) * U }); made++ }
    for (let j = blobs.length - 1; j >= 0; j--) {
      const b = blobs[j]
      if (!b.on) { b.vy += 900 * U * dt; b.y += b.vy * dt; if (b.y >= by - 12 * U - b.r) { b.y = by - 12 * U - b.r; b.on = true } }
      else b.x += (beltTo - belt) * 0.25
      if (b.x > bx1) { b.y += 300 * U * dt; b.x += 40 * U * dt }
      if (b.y > H + 40) { blobs.splice(j, 1); continue }
      const squash = Math.abs(b.x - px) < 40 * U && b.on ? 1 - stamp * 0.6 : 1
      for (let q = 0; q < 3; q++) out.push({ k: "c", x: b.x + Math.sin(s.t * 5 + q * 2) * b.r * 0.4, y: b.y + (1 - squash) * b.r + Math.cos(s.t * 4 + q) * b.r * 0.2, r: b.r * (0.7 + q * 0.15) * (0.8 + A.bass * 0.3), h: b.hue, s: 80, l: 50, a: 0.45 })
    }
    // Overclock sparks from the piston on snares.
    if (over && A.snareHit) for (let q = 0; q < 10; q++) sparks.push({ x: px, y: H * 0.26 + ph + 18 * U, vx: (Math.random() - 0.5) * 400 * U, vy: -Math.random() * 300 * U, life: 1 })
  }
  for (let j = sparks.length - 1; j >= 0; j--) {
    const p = sparks[j]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * U * dt; p.life -= dt * 2
    if (p.life <= 0) { sparks.splice(j, 1); continue }
    out.push({ k: "l", x1: p.x, y1: p.y, x2: p.x - p.vx * 0.02, y2: p.y - p.vy * 0.02, h: 40, l: 70, a: p.life, lw: 2 * U })
  }
  // Meltdown: slop floods up from the floor in big pulsing blobs.
  if (melt) {
    if ((A.beat || A.snareHit) && floods.length < 40) floods.push({ x: Math.random() * W, y: H + 30, r: (30 + Math.random() * 50) * U, v: (40 + Math.random() * 80) * U, hue: 300 + Math.random() * 80 })
    out.push({ k: "w", text: "SLOP OVERFLOW", x: s.cx, y: H * 0.1, size: 48 * U, fx: "split", t: phaseT, h: 320, l: 70, seed: 5 })
  }
  for (let j = floods.length - 1; j >= 0; j--) {
    const f = floods[j]; f.y -= f.v * dt; if (!melt) f.y += f.v * dt * 3
    if (f.y < -f.r * 2 || f.y > H + 200) { floods.splice(j, 1); continue }
    out.push({ k: "c", x: f.x + Math.sin(s.t + j) * 20 * U, y: f.y, r: f.r * (1 + A.bass * 0.3 + A.kick * 0.15), h: f.hue, s: 80, l: 45, a: 0.3 })
  }

  s = await frame(out, {
    trail: [0.8, 0.78, 0.72, 0.86][phase],
    zoom: melt ? 1.01 + A.kick * 0.01 : 1 + A.kick * 0.006, spin: melt ? 0.003 : 0, hue: over ? 1.5 : 0.2, mirror: 0,
    phase, phases: PHASES.length, title: PHASES[phase], titleFx: phase === 0 ? "type" : "flap", titleHue: hue,
    react: { punch: 1, slice: over ? 1.6 : 0.8, sparkle: 0.8, shake: over ? 1.5 : 0.6, tint: 0.6 },
  })
}

// name: Laser fan
// Two emitters at the bottom edge throw a thin fan of lasers that sweeps across
// the bar. Kicks snap the spread to a new angle and widen the beams, snares pull
// the emitters apart into a mirrored pair, hats send glints climbing the beams,
// bass sets beam width and brightness, and the key hue is spread across the fan.
// Calm thins the fan, slows the sweep and lengthens the trail; a build pinches the
// beams into a point and the drop throws them wide with twice the beam count.
let s = await frame([])
const TAU = Math.PI * 2
const glints = []
for (let i = 0; i < 24; i++) glints.push({ on: false, f: 0, e: 0, p: 0, life: 0 })
let gi = 0
let jump = 0, jumpT = 0
while (true) {
  const A = s.audio, dt = s.dt, out = []
  const span = Math.min(s.w, s.h), U = span / 800
  const calm = A.calm || 0
  const bass = A.bass || 0
  const kick = A.kick || 0
  const snare = A.snare || 0
  const hat = A.hat || 0
  const drops = A.dropAmt || 0
  const hue0 = typeof A.keyHue === "number" ? A.keyHue : 200
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 12 ? Math.max(0, 1 - toDrop / 12) : 0
  const converge = Math.max(build, near) * (1 - Math.min(1, drops * 1.6))
  if (A.kickHit) jumpT = ((A.kicks || 0) % 5 - 2) * 0.05
  jump += (jumpT - jump) * Math.min(1, dt * 16)
  const sweep = Math.sin((A.barPhase || 0) * TAU) * (0.55 - calm * 0.3 + drops * 0.15) + Math.sin(s.t * 0.22) * 0.05
  const center = -Math.PI / 2 + sweep + jump
  const spread = (1.05 - calm * 0.22) * (1 - converge * 0.95) + drops * 0.75 + kick * 0.12
  const n = drops > 0.15 ? 12 : calm > 0.55 ? 4 : 6
  const sep = 5 * U + snare * span * 0.09
  const ey = s.cy + span * 0.44
  const L = span * (1.1 - converge * 0.4 + drops * 0.08)
  const lw = (0.7 + bass * 2 + kick * 2.2 + drops * 0.7) * U * (1 - calm * 0.3)
  const ba = 0.42 + bass * 0.28 + kick * 0.1
  for (let e = 0; e < 2; e++) {
    const ex = e === 0 ? s.cx - sep : s.cx + sep
    for (let i = 0; i < n; i++) {
      let a = center + (i / (n - 1) - 0.5) * spread
      if (e === 1) a = Math.PI - a
      out.push({ k: "l", x1: ex, y1: ey, x2: ex + Math.cos(a) * L, y2: ey + Math.sin(a) * L,
        h: hue0 + i * 8 + e * 4, s: 90, l: 54 + bass * 8, a: ba, lw })
    }
    out.push({ k: "c", x: ex, y: ey, r: (2.5 + kick * 3 + bass * 1.5) * U, h: hue0 + 20, l: 60, a: 0.8 })
  }
  if (A.hatHit) {
    const g = glints[gi]
    gi = (gi + 1) % glints.length
    g.on = true
    g.f = ((A.hats || 0) * 0.618) % 1
    g.e = (A.hats || 0) % 2
    g.p = 0.04
    g.life = 1
  }
  for (let i = 0; i < glints.length; i++) {
    const g = glints[i]
    if (!g.on) continue
    g.p += dt * 1.7
    g.life -= dt * 1.9
    if (g.p > 1 || g.life <= 0) { g.on = false; continue }
    let a = center + (g.f - 0.5) * spread
    if (g.e === 1) a = Math.PI - a
    const ex = g.e === 0 ? s.cx - sep : s.cx + sep
    out.push({ k: "c", x: ex + Math.cos(a) * L * g.p, y: ey + Math.sin(a) * L * g.p,
      r: (2 + hat * 2.5) * U, h: hue0 + 140 + g.f * 80, s: 80, l: 62, a: Math.min(0.85, g.life * (0.5 + hat * 0.5)) })
  }
  s = await frame(out, {
    trail: 0.84 + calm * 0.1 + drops * 0.03,
    zoom: 1.004 + kick * 0.02 + drops * 0.008,
    spin: 0.0015,
    hue: 0.8,
  })
}

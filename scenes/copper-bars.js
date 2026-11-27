// name: Copper bars
// Demoscene copper/raster bars after the Amiga era: each bar is a stack of thin strips
// shading from a dark edge to a hot core, and a drop flips the wall to Kefrens verticals.
// Psychoscript technique: a seeded mulberry32 PRNG picks every bar amplitude and phase
// once, so rewinds, beat repeats and replays redraw exactly the same frames (no Math.random).
// Hearing: kickHit slams all bars toward the centre, snareHit shoves alternating bars
// sideways and opens the stack, hats flick a thin sparkle bar, bass thickens the bars,
// note/chroma tint each bar, calm thins and slows them, build/toDrop tighten the wave and
// the drop switches to vertical bars for the bar.
let s = await frame([])
const TAU = Math.PI * 2
let seed = 0x9e3779b9
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const N = 9, SL = 6
const amp = [], ph = [], spd = []
for (let i = 0; i < N; i++) {
  amp.push(0.55 + rnd() * 0.9)
  ph.push(rnd() * TAU)
  spd.push(0.7 + rnd() * 0.8)
}
const spark = []
for (let i = 0; i < 6; i++) spark.push({ life: 0, x: 0, y: 0, h: 30 })
let si = 0, gather = 0, dis = 0, kef = 0
const b0 = s.audio.bpm > 20 ? 60 / s.audio.bpm : 0.435
if ((s.audio.dropAmt || 0) > 0.6) kef = 4 * b0
while (true) {
  const A = s.audio, dt = s.dt, out = []
  const span = Math.min(s.w, s.h), U = span / 800
  const cx = s.cx, cy = s.cy
  const kick = A.kick || 0
  const bass = A.bass || 0
  const calm = A.calm || 0
  const hat = A.hat || 0
  const sn = A.snare || 0
  const lvl = A.level || 0
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 10 ? Math.max(0, 1 - toDrop / 10) : 0
  const tense = Math.max(build, near) * (1 - Math.min(1, calm * 1.5))
  const bp = A.bpm > 20 ? 60 / A.bpm : 0.435
  if (A.drop) kef = 4 * bp
  kef = Math.max(0, kef - dt)
  if (A.kickHit) gather = 1
  else gather *= Math.exp(-dt * 5.5)
  if (A.snareHit) dis = 1
  else dis *= Math.exp(-dt * 5)
  if (A.hatHit) {
    const sp = spark[si]
    si = (si + 1) % spark.length
    sp.life = 1
    sp.x = cx + (rnd() * 2 - 1) * span * 0.34
    sp.y = cy + (rnd() * 2 - 1) * span * 0.3
    sp.h = 24 + rnd() * 34
  }
  const note = typeof A.note === "number" ? A.note : 0
  const chroma = A.chroma && A.chroma.length ? A.chroma : null
  const vertical = kef > 0
  const n = calm > 0.55 ? 6 : 8
  const thick = span * (0.048 + bass * 0.012)
  const space = thick * 1.3 * (1 - gather * 0.25)
  const wobAmp = span * 0.05 * (0.6 + tense * 0.7) * (1 - calm * 0.45)
  const halfLen = span * (vertical ? 0.33 + lvl * 0.05 : 0.4 + lvl * 0.05)
  const speed = (1 - calm * 0.5) * (1 + tense * 0.5)
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * space
    const wob = Math.sin((A.phase || 0) * TAU + ph[i]) * amp[i] + Math.sin(s.t * spd[i] * speed + ph[i]) * 0.3
    const pc = (note + i * 5) % 12
    const cv = chroma ? chroma[pc] : 0.5
    const h = 22 + i * 4 + cv * 38
    const core = 47 + kick * 7 + bass * 5 + sn * 3
    const base = off * (1 - gather * 0.8) + wob * wobAmp
    const lat = dis * (i % 2 ? 1 : -1) * span * 0.025
    for (let j = 0; j < SL; j++) {
      const w = 1 - Math.abs((j / (SL - 1)) * 2 - 1)
      const l = 12 + (core - 12) * w
      if (vertical) {
        const x0 = cx + base - thick / 2 + (thick / SL) * j
        const x1 = x0 + thick / SL + U * 0.4
        out.push({ k: "p", pts: [x0, cy - halfLen + lat, x1, cy - halfLen + lat, x1, cy + halfLen + lat, x0, cy + halfLen + lat], h, s: 92, l, a: 0.72, fill: true })
      } else {
        const y0 = cy + base - thick / 2 + (thick / SL) * j
        const y1 = y0 + thick / SL + U * 0.4
        out.push({ k: "p", pts: [cx - halfLen + lat, y0, cx + halfLen + lat, y0, cx + halfLen + lat, y1, cx - halfLen + lat, y1], h, s: 92, l, a: 0.72, fill: true })
      }
    }
  }
  for (let i = 0; i < spark.length; i++) {
    const sp = spark[i]
    if (sp.life <= 0) continue
    sp.life -= dt * 5.5
    if (sp.life <= 0) continue
    out.push({ k: "l", x1: sp.x - span * 0.11, y1: sp.y, x2: sp.x + span * 0.11, y2: sp.y,
      h: sp.h, s: 55, l: 64, a: sp.life * 0.75, lw: (1.2 + hat * 2.2) * U })
  }
  s = await frame(out, {
    trail: Math.min(0.9, 0.6 + calm * 0.22 - kick * 0.06 + (vertical ? 0.04 : 0)),
    zoom: 1 + kick * 0.012 - gather * 0.008 + tense * 0.004,
    hue: 0.5 + sn * 0.9,
    react: { punch: kick * 0.7, sparkle: hat * 0.5, tint: 0.2 + bass * 0.3 },
  })
}

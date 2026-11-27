// name: Arp constellation
// Twelve stars, one per pitch class; chroma sets their brightness. Hats light the next star
// in an up, down or up-down arpeggio (switching every 4 bars) and draw a fading line from the
// previous one, so a constellation builds over the bar. Kick steps the wheel's rotation and
// scales it, snares brighten the lines and swap them to a complementary hue, keyHue and note
// colour the field, calm thins and slows it, build multiplies chords, and the drop joins every
// star to every other briefly with a six-fold mirror.
let s = await frame([])
const TAU = Math.PI * 2
const BC = [], BS = [], SX = [], SY = []
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * TAU - Math.PI / 2
  BC.push(Math.cos(a))
  BS.push(Math.sin(a))
  SX.push(0)
  SY.push(0)
}
const lit = []
for (let i = 0; i < 12; i++) lit.push(0)
const segs = []
let rot = 0, step = 0, lastP = -1
while (true) {
  const A = s.audio, U = Math.min(s.w, s.h) / 800, out = []
  const calm = A.calm || 0
  const keyHue = typeof A.keyHue === "number" ? A.keyHue : 200
  const note = typeof A.note === "number" ? A.note : 0
  const build = A.build || 0
  const toDrop = typeof A.toDrop === "number" && A.toDrop < 90 ? A.toDrop : 99
  const dropAmt = A.dropAmt || 0
  const snare = A.snare || 0
  const kick = A.kick || 0
  const barN = Math.max(0, typeof A.bars === "number" ? A.bars : Math.floor((A.beats || 0) / 4))
  const dir = barN % 2 ? 1 : -1
  if (A.kickHit) rot += dir * 0.13
  const ang = rot + s.t * 0.035 * (1 - calm * 0.85)
  const cr = Math.cos(ang), sr = Math.sin(ang)
  const tension = toDrop < 4 ? 1 - toDrop / 4 : 0
  const R = Math.min(s.w, s.h) * (0.31 + (A.bass || 0) * 0.03 + kick * 0.012) *
    (1 - calm * 0.12) * (1 + build * 0.06 + tension * 0.04)
  const kickS = 1 + kick * 0.045
  const visible = 12 - Math.floor(calm * 6)
  const hasChroma = A.chroma && A.chroma.length === 12
  const baseHue = keyHue + Math.sin(s.t * 0.7) * 8
  const comp = Math.min(1, snare * 1.3)

  if (A.hatHit) {
    const k = step % 24
    const cycle = Math.floor(barN / 4) % 3
    let p
    if (cycle === 0) p = k % 12
    else if (cycle === 1) p = 11 - (k % 12)
    else p = k < 12 ? k : 23 - k
    lit[p] = 1
    if (lastP >= 0 && segs.length < 64) segs.push({ a: lastP, b: p, life: 1 })
    lastP = p
    step++
  }
  for (let i = 0; i < 12; i++) lit[i] = Math.max(0, lit[i] - s.dt * (1.7 + calm))
  for (let i = segs.length - 1; i >= 0; i--) {
    segs[i].life -= s.dt * (0.5 - calm * 0.2)
    if (segs[i].life <= 0) segs.splice(i, 1)
  }
  for (let i = 0; i < 12; i++) {
    SX[i] = s.cx + (BC[i] * cr - BS[i] * sr) * R * kickS
    SY[i] = s.cy + (BC[i] * sr + BS[i] * cr) * R * kickS
  }

  for (let i = 0; i < 12; i++) {
    if (i + 1 >= visible) continue
    const j = (i + 1) % 12
    out.push({ k: "l", x1: SX[i], y1: SY[i], x2: SX[j], y2: SY[j], h: baseHue + i * 30,
      s: 52, l: 50, a: 0.13 + (A.mid || 0) * 0.05, lw: 1 * U })
  }
  if (build > 0.02) {
    for (let i = 0; i < 12; i++) {
      if ((i + 5) % 12 >= visible) continue
      const j = (i + 5) % 12
      out.push({ k: "l", x1: SX[i], y1: SY[i], x2: SX[j], y2: SY[j], h: baseHue + 55,
        s: 60, l: 54, a: Math.min(0.3, build * 0.22), lw: 0.9 * U })
    }
    if (build > 0.55) {
      for (let i = 0; i < 12; i++) {
        if ((i + 7) % 12 >= visible) continue
        const j = (i + 7) % 12
        out.push({ k: "l", x1: SX[i], y1: SY[i], x2: SX[j], y2: SY[j], h: baseHue + 100,
          s: 58, l: 56, a: (build - 0.55) * 0.32, lw: 0.8 * U })
      }
    }
  }

  const lineHue = baseHue + 180 * comp
  for (let i = 0; i < segs.length; i++) {
    const g = segs[i]
    if (g.a >= visible || g.b >= visible) continue
    out.push({ k: "l", x1: SX[g.a], y1: SY[g.a], x2: SX[g.b], y2: SY[g.b],
      h: lineHue + (g.a + g.b) * 6, s: 68, l: Math.min(64, 54 + snare * 8),
      a: Math.min(0.82, (0.14 + g.life * 0.55) * (1 + snare * 0.3)),
      lw: (1.2 + g.life * 1.1) * U })
  }

  for (let i = 0; i < 12; i++) {
    if (i >= visible) continue
    const ch = hasChroma ? A.chroma[i] : 0.35 + 0.25 * Math.sin(i * 1.7 + s.t * 0.8)
    const b = 0.2 + ch * 0.7 + lit[i] * 0.8
    const r = (1.8 + b * 3.4 + (i === note ? 1.6 : 0)) * U * kickS
    out.push({ k: "c", x: SX[i], y: SY[i], r: r * 3.1, h: baseHue + i * 30,
      s: 58, l: 54, a: Math.min(0.2, 0.06 + b * 0.12) })
    out.push({ k: "c", x: SX[i], y: SY[i], r, h: baseHue + i * 30 + ch * 40,
      s: 60 + ch * 20, l: Math.min(65, 42 + b * 20 + snare * 4),
      a: Math.min(0.92, 0.38 + b * 0.5) })
  }

  if (dropAmt > 0.04) {
    const da = Math.min(0.5, dropAmt * 0.45)
    for (let i = 0; i < 12; i++) {
      for (let j = i + 1; j < 12; j++) {
        out.push({ k: "l", x1: SX[i], y1: SY[i], x2: SX[j], y2: SY[j],
          h: baseHue + 90 + dropAmt * 120, s: 60, l: 58, a: da, lw: 1 * U })
      }
    }
  }

  s = await frame(out, {
    trail: 0.84 + calm * 0.1,
    zoom: 1 + kick * 0.012 + dropAmt * 0.01,
    spin: dir * 0.0016 * (1 - calm * 0.7),
    hue: 0.9,
    mirror: dropAmt > 0.12 ? 6 : 0,
  })
}

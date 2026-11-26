// name: Solar mandala
// A mandala that builds through the bar: one more ring of petals on each beat.
// Petals breathe with the beat phase, snares throw out sparkle rings,
// a drop blows it into a 12-fold starburst, and breakdowns shrink it to a slow ember.
let s = await frame([])
const sparks = []
while (true) {
  const A = s.audio
  const out = []
  const u = Math.min(s.w, s.h) / 760
  const R = Math.min(s.w, s.h) * (0.3 + A.bass * 0.1) * (1 - A.calm * 0.35)
  const turn = Math.floor(A.beats / 8) % 2 ? 1 : -1
  const breathe = 1 + 0.12 * Math.cos(A.phase * Math.PI * 2)
  const rings = A.calm > 0.5 ? 2 : 3 + A.bar
  const burst = A.dropAmt > 0.3
  if (A.snapHit) sparks.push({ r: R * 0.9, life: 1, h: A.snaps * 53 })
  for (let ring = 0; ring < rings; ring++) {
    const n = 6 + ring * 4
    const rr = R * (0.15 + ring * 0.15) * breathe * (1 + A.dropAmt * 0.4)
    const speed = (ring % 2 ? 0.4 : -0.3) * turn * (1 - A.calm * 0.7)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + s.t * speed
      const x = s.cx + Math.cos(a) * rr
      const y = s.cy + Math.sin(a) * rr
      const h = ring * 40 + s.t * 30 + i * 4 + A.beats * 37 + (burst ? 180 : 0)
      if (burst) {
        out.push({ k: "l", x1: s.cx + Math.cos(a) * rr * 0.3, y1: s.cy + Math.sin(a) * rr * 0.3, x2: x, y2: y, h, lw: 2 * u + A.kick * 3, l: 60, a: 0.8 })
      } else {
        out.push({ k: "c", x, y, r: (2 + ring * 2 + A.high * 7 + A.kick * 5) * u * (1 - A.calm * 0.5), h, l: 50 + A.mid * 15 - A.calm * 12, a: 0.85 })
      }
    }
  }
  for (let j = sparks.length - 1; j >= 0; j--) {
    const sp = sparks[j]
    sp.r += 9 * u
    sp.life -= 0.035
    if (sp.life <= 0) { sparks.splice(j, 1); continue }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      out.push({ k: "c", x: s.cx + Math.cos(a) * sp.r, y: s.cy + Math.sin(a) * sp.r, r: 2.2 * u * sp.life + 0.5, h: sp.h, l: 70, a: sp.life })
    }
  }
  s = await frame(out, {
    trail: 0.88 + A.energy * 0.05 + A.calm * 0.05,
    zoom: 1.006 + A.kick * 0.03 + A.dropAmt * 0.02,
    spin: 0.004 * turn * (1 - A.calm * 0.6),
    hue: 1 + A.high * 3,
    mirror: burst ? 12 : A.calm > 0.5 ? 4 : 8,
  })
}

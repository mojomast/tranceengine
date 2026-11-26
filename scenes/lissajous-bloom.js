// name: Lissajous bloom
// One long line traced through a Lissajous figure. Every 4 beats it picks new
// frequency ratios and glides toward them; snares leave rotated echoes; a drop
// nests three copies inside each other; the line width pulses with the beat phase.
let s = await frame([])
let a = 3, b = 4, ta = 3, tb = 4
const curve = (R, rot, ph) => {
  const pts = []
  const c = Math.cos(rot), sn = Math.sin(rot)
  for (let i = 0; i <= 700; i++) {
    const u = (i / 700) * Math.PI * 2
    const x = Math.sin(a * u + s.t + ph) * R
    const y = Math.sin(b * u) * R * Math.cos(u * 0.5 + s.t * 0.3)
    pts.push(s.cx + x * c - y * sn, s.cy + x * sn + y * c)
  }
  return pts
}
while (true) {
  const A = s.audio
  if (A.beat && A.beats % 4 === 0) {
    ta = 1 + Math.floor(Math.random() * 6)
    tb = 1 + Math.floor(Math.random() * 6)
  }
  const glide = 0.04 * (1 - A.calm * 0.75)
  a += (ta - a) * glide
  b += (tb - b) * glide
  const R = Math.min(s.w, s.h) * (0.34 + A.kick * 0.06)
  const width = (1.2 + A.level * 2.5) * (1 + 0.5 * Math.cos(A.phase * Math.PI * 2)) * (1 - A.calm * 0.5)
  const hue = s.t * 40 + A.beats * 25
  const out = [{ k: "p", pts: curve(R, 0, 0), h: hue, lw: width, a: 0.9 }]
  if (A.snap > 0.2) out.push({ k: "p", pts: curve(R * 0.92, A.snap * 0.5, 0.4), h: hue + 120, lw: width * 0.6, a: A.snap * 0.8 })
  if (A.dropAmt > 0.2) {
    out.push({ k: "p", pts: curve(R * 0.62, 0, 1.2), h: hue + 60, lw: width * 0.8, a: A.dropAmt })
    out.push({ k: "p", pts: curve(R * 0.34, 0, 2.4), h: hue + 200, lw: width * 0.6, a: A.dropAmt })
  }
  s = await frame(out, { trail: 0.88 + A.calm * 0.08, zoom: 1.006 + A.kick * 0.025, spin: -0.003, hue: 1.2, mirror: A.dropAmt > 0.3 ? 6 : 0 })
}

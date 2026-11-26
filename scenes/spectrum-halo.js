// name: Spectrum halo
// The spectrum wrapped into a halo. The number of arms changes with each beat of the bar,
// snares light the bar tips, a drop turns the bars inward, and in breakdowns
// the spectrum melts into one soft closed shape.
let s = await frame([])
let spin = 0
const ARMS = [2, 3, 4, 6]
while (true) {
  const A = s.audio
  const B = A.bands
  const n = B.length
  const out = []
  spin += s.dt * (0.1 + A.energy * 0.6) + (A.beat ? 0.15 : 0)
  const m = Math.min(s.w, s.h)
  const R = m * (0.17 + A.kick * 0.04 + 0.02 * Math.cos(A.phase * Math.PI * 2))
  const reach = m * 0.3
  const inward = A.dropAmt > 0.3 ? -0.6 : 1
  if (A.calm > 0.5) {
    const pts = []
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2 + spin
      const v = B[Math.abs(31 - Math.abs(i % 64 - 32)) % 32]
      const r = R + 10 + v * reach * 0.6
      pts.push(s.cx + Math.cos(a) * r, s.cy + Math.sin(a) * r)
    }
    out.push({ k: "p", pts, h: 200 + s.t * 15, lw: 2.5, l: 55, a: 0.8 })
  } else {
    const arms = ARMS[A.bar]
    for (let arm = 0; arm < arms; arm++) {
      const base = (arm / arms) * Math.PI * 2 + spin
      for (let i = 0; i < n; i++) {
        const a = base + ((i + 0.5) / n) * (Math.PI * 2 / arms)
        const len = (10 + B[i] * reach) * inward
        const x2 = s.cx + Math.cos(a) * (R + len), y2 = s.cy + Math.sin(a) * (R + len)
        out.push({ k: "l", x1: s.cx + Math.cos(a) * R, y1: s.cy + Math.sin(a) * R, x2, y2,
          h: 190 + i * 5 + s.t * 20, lw: 2 + B[i] * 5, l: 42 + B[i] * 18, a: 0.75 })
        if (A.snap > 0.3 && B[i] > 0.35) out.push({ k: "c", x: x2, y: y2, r: 2 + A.snap * 4, h: 40 + i * 4, l: 70, a: A.snap })
      }
    }
  }
  out.push({ k: "c", x: s.cx, y: s.cy, r: R * 0.8, fill: false, lw: 2 + A.kick * 10, h: s.t * 40 + A.beats * 30 })
  s = await frame(out, { trail: 0.82 + A.calm * 0.12, zoom: 1.012 + A.kick * 0.035 + A.dropAmt * 0.03, spin: 0.002, hue: 1.5 })
}

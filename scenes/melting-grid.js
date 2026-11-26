// name: Melting grid
// A grid of lines rippling out from a point that steps around the four quarters of
// the screen with the bar. The bass sets how hard it ripples; snares glitch rows sideways;
// a drop doubles the grid density; breakdowns leave only slow horizontal waves.
let s = await frame([])
const SPOTS = [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7]]
let ox = s.cx, oy = s.cy
while (true) {
  const A = s.audio
  const target = SPOTS[A.bar]
  ox += (target[0] * s.w - ox) * 0.12
  oy += (target[1] * s.h - oy) * 0.12
  const out = []
  const dense = A.dropAmt > 0.4
  const step = Math.max(dense ? 18 : 26, Math.min(s.w, s.h) / (dense ? 21 : 16))
  const amp = 10 + A.bass * 45
  const warp = (pts, x, y) => {
    const dx = x - ox, dy = y - oy
    const d = Math.sqrt(dx * dx + dy * dy)
    const push = Math.sin(d * 0.025 - s.t * 3) * amp * (520 / (520 + d))
    pts.push(x + Math.sin(y * 0.012 + s.t) * 12, y + push + Math.sin(x * 0.01 + s.t * 1.3) * 10)
  }
  let row = 0
  for (let y = -step; y < s.h + step; y += step) {
    const pts = []
    const glitch = A.snap > 0.2 && (row * 7 + A.snaps) % 3 === 0 ? (((row * 37 + A.snaps * 11) % 9) - 4) * 12 * A.snap : 0
    for (let x = -step; x < s.w + step; x += step / 2) warp(pts, x + glitch, y)
    out.push({ k: "p", pts, close: false, h: y * 0.4 + s.t * 40 + (glitch ? 120 : 0), lw: 1.5 + A.mid * 2, a: 0.75 })
    row++
  }
  if (A.calm < 0.5) {
    for (let x = -step; x < s.w + step; x += step) {
      const pts = []
      for (let y = -step; y < s.h + step; y += step / 2) warp(pts, x, y)
      out.push({ k: "p", pts, close: false, h: x * 0.3 + 180 + s.t * 40, lw: 1 + A.mid * 1.5, a: 0.55 })
    }
  }
  s = await frame(out, { trail: 0.76 + A.calm * 0.12, zoom: 1.02 + A.kick * 0.02, spin: 0.002, hue: 2, mirror: dense ? 8 : 4 })
}

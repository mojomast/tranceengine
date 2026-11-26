// name: Polygon tunnel
// Polygons fall toward you; the bass is the throttle. Each beat twists the tunnel
// a notch, snares light up struts between the rings, a drop throws it into reverse
// and folds it four ways, and breakdowns thin it to a few slow outlines.
let s = await frame([])
const RINGS = 18
let depth = 0
let twist = 0, twistTo = 0
while (true) {
  const A = s.audio
  if (A.beat) twistTo += Math.PI / 6 * (A.bar % 2 ? 1 : -1)
  twist += (twistTo - twist) * 0.15
  const dir = A.dropAmt > 0.3 ? -1 : 1
  depth += s.dt * (0.4 + A.energy * 1.5 + A.bass * 1.5) * (1 - A.calm * 0.7) * dir
  const count = A.calm > 0.5 ? 8 : RINGS
  const out = []
  const rings = []
  for (let i = 0; i < count; i++) {
    const z = (i + (((depth % 1) + 1) % 1)) / count
    const id = i - Math.floor(depth)
    const size = Math.pow(z, 2.2) * Math.max(s.w, s.h) * 0.9 * (1 + A.kick * 0.15)
    const sides = 3 + ((((id + A.beats) % 4) + 4) % 4)
    const rot = s.t * 0.4 + id * 0.35 + twist * z
    const ox = s.cx + (s.mx - s.cx) * (1 - z) * 0.5
    const oy = s.cy + (s.my - s.cy) * (1 - z) * 0.5
    const pts = []
    for (let k = 0; k < sides; k++) {
      const a = rot + (k / sides) * Math.PI * 2
      pts.push(ox + Math.cos(a) * size, oy + Math.sin(a) * size)
    }
    rings.push(pts)
    out.push({ k: "p", pts, h: id * 25 - s.t * 40 + A.beats * 20, lw: (1 + z * 6 + A.bass * z * 6) * (1 - A.calm * 0.6), a: z })
  }
  if (A.snap > 0.15) {
    for (let i = 0; i + 1 < rings.length; i++) {
      const p = rings[i], q = rings[i + 1]
      out.push({ k: "l", x1: p[0], y1: p[1], x2: q[0], y2: q[1], h: 50 + i * 10, lw: 2 * A.snap, l: 70, a: A.snap })
    }
  }
  s = await frame(out, { trail: 0.8 + A.calm * 0.1, zoom: dir > 0 ? 0.985 - A.kick * 0.02 : 1.02, spin: -0.006 * dir, hue: 3, mirror: A.dropAmt > 0.3 || A.energy > 0.6 ? 4 : 0 })
}

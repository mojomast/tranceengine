// name: Firefly swarm
// 300 fireflies kept in the VM. Each beat throws their attractor somewhere new;
// snares split the swarm between two attractors; a drop blasts them outward;
// in breakdowns they settle into a slow rotating ring and blink with the beat phase.
let s = await frame([])
const flies = []
for (let i = 0; i < 300; i++) {
  flies.push({ x: Math.random() * s.w, y: Math.random() * s.h, vx: 0, vy: 0, h: Math.random() * 360, off: Math.random() })
}
let ax = s.cx, ay = s.cy, bx = s.cx, by = s.cy
const spot = () => {
  const a = Math.random() * Math.PI * 2
  const r = Math.min(s.w, s.h) * (0.08 + Math.random() * 0.3)
  return [s.cx + Math.cos(a) * r, s.cy + Math.sin(a) * r]
}
while (true) {
  const A = s.audio
  if (A.beat) [ax, ay] = spot()
  if (A.snapHit) [bx, by] = spot()
  if (A.drop) {
    for (const f of flies) {
      const dx = f.x - s.cx, dy = f.y - s.cy, d = Math.hypot(dx, dy) + 1
      f.vx += (dx / d) * 18
      f.vy += (dy / d) * 18
    }
  }
  const pull = 0.22 + A.bass * 0.6
  const swirl = 0.12 + A.mid * 0.4
  const ringR = Math.min(s.w, s.h) * 0.3
  const out = []
  flies.forEach((f, i) => {
    let gx, gy
    if (s.down) { gx = s.mx; gy = s.my }
    else if (A.calm > 0.5) {
      const a = (i / flies.length) * Math.PI * 2 + s.t * 0.2
      gx = s.cx + Math.cos(a) * ringR
      gy = s.cy + Math.sin(a) * ringR
    } else if (A.snap > 0.2 && i % 2) { gx = bx; gy = by }
    else { gx = ax; gy = ay }
    const dx = gx - f.x, dy = gy - f.y, d = Math.hypot(dx, dy) + 1
    const p = A.calm > 0.5 ? 0.08 : pull
    f.vx += (dx / d) * p - (dy / d) * swirl * (1 - A.calm) + Math.sin(f.y * 0.01 + s.t) * 0.1
    f.vy += (dy / d) * p + (dx / d) * swirl * (1 - A.calm) + Math.cos(f.x * 0.01 + s.t) * 0.1
    f.vx *= A.calm > 0.5 ? 0.9 : 0.95
    f.vy *= A.calm > 0.5 ? 0.9 : 0.95
    f.x += f.vx
    f.y += f.vy
    const blink = 0.5 + 0.5 * Math.cos((A.phase + f.off) * Math.PI * 2)
    out.push({ k: "c", x: f.x, y: f.y, r: 1.2 + A.high * 3 + Math.min(4, Math.hypot(f.vx, f.vy) * 0.3),
      h: f.h + s.t * 20 + A.beats * 12, l: 45 + blink * 25, a: 0.6 + blink * 0.4 })
  })
  s = await frame(out, { trail: 0.93 + A.calm * 0.04, zoom: 1.003 + A.kick * 0.02, spin: 0.0015, hue: 0.8 + A.high * 2, mirror: A.dropAmt > 0.3 ? 10 : 6 })
}

// name: Lava lamp
// Big glowing wax blobs rise and sink like a lamp. Energy sets the lift, kicks swell the biggest blob, downbeats split it, snares pop bubbles, and a drop flips gravity for a moment.
let s = await frame([])
const rnd = (a, b) => a + Math.random() * (b - a)
const PAL = [[330, 350, 10, 300], [180, 200, 225, 160], [20, 38, 50, 5], [270, 292, 255, 310]]
const mk = (x, y, r, id) => ({ x, y, vx: 0, vy: 0, r, id, ph: rnd(0, 6.28), b: rnd(0.8, 1.2), hue: PAL[0][id % 4], split: 0 })
let blobs = []
for (let i = 0; i < 6; i++) blobs.push(mk(rnd(0.2, 0.8), rnd(0.35, 0.85), rnd(0.07, 0.11), i))
let nextId = 6
let bubbles = []
let clock = 0
let dropT = -99

while (true) {
  const A = s.audio
  const bands = A.bands || []
  const beats = A.beats || 0
  const energy = A.energy || 0
  const calm = A.calm || 0
  const out = []
  const dt = Math.min(s.dt || 1 / 60, 0.05)
  const W = s.w, H = s.h
  const m = Math.min(W, H)
  const u = m / 800
  const speed = 1 - 0.55 * calm
  clock += dt * speed
  if (A.drop) dropT = s.t
  const falling = s.t - dropT < 1.3
  const pal = PAL[Math.floor(beats / 8) % 4]
  const up = 0.05 + 0.2 * energy

  // Split: on a downbeat in loud parts, the biggest blob sheds a child
  if (A.beat && A.bar === 0 && energy > 0.4 && blobs.length < 9) {
    let big = blobs[0]
    for (const b of blobs) if (b.r > big.r) big = b
    if (big.r > 0.07) {
      const dir = Math.random() < 0.5 ? -1 : 1
      const c = mk(big.x, big.y, big.r * 0.5, nextId++)
      c.hue = big.hue + 30
      c.vy = big.vy - 0.2
      c.vx = dir * 0.05
      big.r *= 0.75
      big.vx = -dir * 0.03
      big.split = 1
      blobs.push(c)
    }
  }

  // Weak attraction between nearby blobs so they drift together
  for (let i = 0; i < blobs.length; i++) for (let j = i + 1; j < blobs.length; j++) {
    const p = blobs[i], q = blobs[j]
    const dx = (q.x - p.x) * W, dy = (q.y - p.y) * H
    const d = Math.hypot(dx, dy) || 1
    if (d < (p.r + q.r) * m * 1.8) {
      const ux = dx / d, uy = dy / d
      p.vx += ux * 0.04 * dt; q.vx -= ux * 0.04 * dt
      p.vy += uy * 0.04 * dt; q.vy -= uy * 0.04 * dt
    }
  }

  // Buoyancy, drag, walls and palette drift for each blob
  for (const b of blobs) {
    const acc = falling ? 0.9 : 0.07 - up * b.b
    b.vy += acc * dt * speed
    b.vy = Math.max(-0.6, Math.min(0.6, b.vy * (1 - 0.8 * dt)))
    b.vx = Math.max(-0.2, Math.min(0.2, b.vx * (1 - 1.2 * dt) + Math.sin(clock * 0.3 + b.ph) * 0.01 * dt))
    b.y += b.vy * dt * speed
    b.x += b.vx * dt * speed
    b.split = Math.max(0, b.split - dt * 1.5)
    const rx = b.r * m / W * 1.3, ry = b.r * m / H * 1.3
    if (b.y < ry) { b.y = ry; b.vy = Math.abs(b.vy) * 0.3 }
    if (b.y > 1 - ry) { b.y = 1 - ry; b.vy = -Math.abs(b.vy) * 0.3 }
    if (b.x < rx) { b.x = rx; b.vx = Math.abs(b.vx) }
    if (b.x > 1 - rx) { b.x = 1 - rx; b.vx = -Math.abs(b.vx) }
    const target = pal[b.id % 4] + Math.sin(clock * 0.25 + b.ph) * 18
    b.hue += (((target - b.hue + 540) % 360) - 180) * Math.min(1, dt * 0.8)
  }

  // Merge one overlapping pair per frame (keep at least 3 blobs)
  if (blobs.length > 3) {
    let pi = -1, pj = -1
    for (let i = 0; i < blobs.length && pi < 0; i++) for (let j = i + 1; j < blobs.length && pi < 0; j++) {
      const p = blobs[i], q = blobs[j]
      const d = Math.hypot((p.x - q.x) * W, (p.y - q.y) * H)
      if (d < (p.r + q.r) * m * 0.7) { pi = i; pj = j }
    }
    if (pi >= 0) {
      const p = blobs[pi], q = blobs[pj]
      const big = p.r >= q.r ? p : q
      const small = big === p ? q : p
      const nr = Math.min(0.2, Math.sqrt(p.r * p.r + q.r * q.r) * 0.95)
      const tot = p.r + q.r
      const nx = (p.x * p.r + q.x * q.r) / tot
      const ny = (p.y * p.r + q.y * q.r) / tot
      const nvy = (p.vy + q.vy) / 2
      big.r = nr; big.x = nx; big.y = ny; big.vy = nvy
      blobs.splice(blobs.indexOf(small), 1)
    }
  }

  // Biggest blob swells on each kick
  let biggest = blobs[0]
  for (const b of blobs) if (b.r > biggest.r) biggest = b
  const wob = Math.sin((A.phase || 0) * Math.PI)
  const spread = 0.45 + (A.bass || 0) * 0.25
  const dirMid = 0.3 + (A.mid || 0) * 0.6

  for (const b of blobs) {
    const kick = b === biggest ? (A.kick || 0) : 0
    const R = b.r * m * (1 + 0.18 * kick)
    const cx = b.x * W, cy = b.y * H
    const sp = spread * (1 + b.split * 0.6) * (1 + kick * 0.3)
    const alpha = (0.3 + 0.3 * (bands[(b.id * 4) % 32] || 0)) * (1 - 0.4 * calm)
    out.push({ k: "c", x: cx, y: cy, r: R * 1.5, h: b.hue, s: 90, l: 42, a: alpha * 0.6 })
    for (let i = 0; i < 5; i++) {
      const dir = i % 2 ? 1 : -1
      const a = b.ph + clock * dirMid * dir * 0.5 + i * 1.2566
      const d = R * sp * (0.7 + 0.25 * Math.sin(clock * 1.3 + i * 2 + b.ph)) * (1 + wob * 0.3)
      out.push({
        k: "c",
        x: cx + Math.cos(a) * d,
        y: cy + Math.sin(a) * d * (1 + wob * 0.35),
        r: R * (0.5 + 0.1 * Math.sin(clock + i)),
        h: b.hue + i * 6, s: 90, l: 52, a: alpha
      })
    }
    out.push({ k: "c", x: cx, y: cy, r: R * 0.7, h: b.hue + 15, s: 90, l: 50, a: alpha })
    // Treble sparkle on the upper-left of each blob
    out.push({
      k: "c", x: cx - R * 0.25, y: cy - R * 0.3,
      r: R * (0.1 + (A.high || 0) * 0.12), h: b.hue + 40, s: 60, l: 62, a: 0.2 + (A.high || 0) * 0.2
    })
  }

  // Snare and hi-hat hits pop small bubbles off the blobs
  if (A.snapHit) {
    for (let i = 0; i < 3 && bubbles.length < 40 && blobs.length; i++) {
      const b = blobs[Math.floor(Math.random() * blobs.length)]
      const a = Math.random() * 6.28
      bubbles.push({
        x: b.x + Math.cos(a) * b.r * m / W * 1.1,
        y: b.y + Math.sin(a) * b.r * m / H * 1.1,
        vy: -rnd(0.15, 0.35), age: 0, life: rnd(0.5, 0.9), h: b.hue + rnd(-20, 20)
      })
    }
  }
  bubbles = bubbles.filter(q => q.age < q.life && q.y > -0.05)
  for (const q of bubbles) {
    q.age += dt
    q.y += q.vy * dt * speed
    q.x += Math.sin(clock * 3 + q.h) * 0.01 * dt
    const p = q.age / q.life
    if (p < 0.7) {
      out.push({ k: "c", x: q.x * W, y: q.y * H, r: (0.008 + 0.006 * p) * m, h: q.h, s: 90, l: 50, a: 0.45 })
    } else {
      const e = (p - 0.7) / 0.3
      out.push({ k: "c", x: q.x * W, y: q.y * H, r: (0.016 + 0.03 * e) * m, h: q.h, s: 90, l: 55, fill: false, lw: 2 * u, a: 0.45 * (1 - e) })
    }
  }

  s = await frame(out, {
    trail: 0.84 + 0.1 * calm,
    zoom: 1 + (A.kick || 0) * 0.004,
    spin: 0.002 * Math.sin(clock * 0.2),
    hue: 0.6
  })
}

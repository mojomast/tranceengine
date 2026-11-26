// name: Beat fireworks
// Each beat fires a shell that bursts into sparks; A.bar picks ring, star, heart or spiral.
// Snare hits crackle, drops fire a multicolour finale, and calm swaps shells for drifting embers.
let s = await frame([])
let A = s.audio
const MAX = 640
const BASE = [96, 100, 120, 120]
const POOL = []
const FREE = []
for (let i = 0; i < MAX; i++) {
  POOL.push({ alive: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, life: 0, max: 1, h: 0, sat: 90, l: 60, sz: 1, drag: 1.6, ember: false, sd: 0 })
  FREE.push(i)
}
let cursor = 0
const shells = []
const flashes = []
let G = 600
let finale = 0
let emberAcc = 0
let wasDown = false

function countFor(shape, mult) {
  return Math.round(BASE[shape] * mult / 3) * 3
}

// Reuse a dead slot if one exists; when the pool is full, overwrite the oldest slot in turn.
function spawn(x, y, vx, vy, life, h, sat, l, sz, drag, ember) {
  let i
  if (FREE.length > 0) i = FREE.pop()
  else { i = cursor; cursor = (cursor + 1) % MAX }
  const p = POOL[i]
  p.alive = true
  p.x = x; p.y = y; p.px = x; p.py = y
  p.vx = vx; p.vy = vy
  p.life = life; p.max = life
  p.h = h; p.sat = sat; p.l = l; p.sz = sz; p.drag = drag; p.ember = ember
  p.sd = Math.random() * 6.283
}

function step(dt, u, t) {
  for (let i = 0; i < MAX; i++) {
    const p = POOL[i]
    if (!p.alive) continue
    p.life -= dt
    if (p.life <= 0) { p.alive = false; FREE.push(i); continue }
    p.px = p.x; p.py = p.y
    p.vy += G * dt * (p.ember ? 0.12 : 0.35)
    if (p.ember) p.vx += Math.sin(t * 1.1 + p.sd) * 18 * u * dt
    const k = Math.exp(-p.drag * dt)
    p.vx *= k; p.vy *= k
    p.x += p.vx * dt; p.y += p.vy * dt
  }
}

function burst(x, y, shape, hue, power, count, bands, sparkle) {
  const v0 = s.h * 0.3 * power
  for (let i = 0; i < count; i++) {
    const f = i / count
    const th = f * Math.PI * 2
    let vx = 0
    let vy = 0
    if (shape === 0) {
      // ring: each spark's reach follows the spectrum at its angle
      const sp = v0 * (0.55 + bands[Math.floor(f * 32) % 32] * 0.9) * (0.9 + Math.random() * 0.1)
      vx = Math.cos(th) * sp; vy = Math.sin(th) * sp
    } else if (shape === 1) {
      // star: five tips
      const tip = Math.pow(Math.abs(Math.cos(2.5 * th)), 6)
      const sp = v0 * (0.25 + 0.75 * tip)
      vx = Math.cos(th) * sp; vy = Math.sin(th) * sp
    } else if (shape === 2) {
      // heart-ish: rays follow the heart curve
      const sa = Math.sin(th), ca = Math.cos(th)
      const hx = 16 * sa * sa * sa
      const hy = 13 * ca - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)
      const m = Math.hypot(hx, hy) || 1
      const sp = v0 * (0.35 + 0.65 * m / 17)
      vx = hx / m * sp; vy = -hy / m * sp
    } else {
      // spiral: three arms, each spark curls sideways as it flies
      const arm = i % 3
      const jf = Math.floor(i / 3) / (count / 3)
      const dir = arm * 2.094 + jf * 2.6
      const sp = v0 * (0.2 + 0.8 * jf)
      const c = Math.cos(dir), sn = Math.sin(dir)
      vx = c * sp - sn * sp * 0.5
      vy = sn * sp + c * sp * 0.5
    }
    const hh = hue < 0 ? Math.random() * 360 : hue + f * 90
    spawn(x, y, vx, vy, (0.9 + Math.random() * 0.7) * (0.7 + power * 0.3), hh, 95, 52 + sparkle * 14, 1.6, 1.6, false)
  }
  flashes.push({ x, y, t: 0, r: s.h * 0.07 * power, h: hue < 0 ? 40 : hue })
}

function launch(x, apexY, hue, power, shape) {
  if (shells.length >= 7) return
  const v0 = Math.sqrt(2 * G * Math.max(0.1 * s.h, s.h - apexY))
  shells.push({ x, y: s.h, vx: (Math.random() - 0.5) * s.h * 0.04, vy: -v0, h: hue, power, shape })
}

function ember(x, y) {
  const u = Math.min(s.w, s.h) / 800
  spawn(x, y, (Math.random() - 0.5) * 12 * u, -(8 + Math.random() * 20) * u,
    3.5 + Math.random() * 2.5, 12 + Math.random() * 30, 95, 58, 1.4, 0.9, true)
}

while (true) {
  A = s.audio
  const dt = Math.min(0.05, Math.max(0.001, s.dt || 1 / 60))
  const u = Math.min(s.w, s.h) / 800
  G = s.h * 0.9
  const shape = Math.max(0, Math.min(3, Math.floor(A.bar || 0)))
  const hueNow = (A.beats * 47 + Math.random() * 40) % 360
  const out = []

  // Drop: three huge multicolour bursts at once
  if (A.drop) {
    finale = 2.5
    for (let b = 0; b < 3; b++) {
      const bs = Math.floor(Math.random() * 4)
      burst(s.w * (0.25 + b * 0.25), s.h * (0.2 + 0.12 * (b % 2)), bs, -1, 1.6, countFor(bs, 1.3), A.bands, A.high)
    }
  }

  // Beat: a shell, or an ember puff when the music is calm
  if (A.beat) {
    if (A.calm > 0.5) {
      for (let e = 0; e < 14; e++) ember(s.w * (0.1 + Math.random() * 0.8), s.h * (0.5 + Math.random() * 0.4))
    } else {
      launch(s.w * (0.15 + Math.random() * 0.7), s.h * (0.16 + Math.random() * 0.38), hueNow, 0.8 + A.bass * 0.6 + A.kick * 0.2, shape)
    }
  }

  // Pointer press fires a shell at the pointer
  if (s.down && !wasDown) launch(s.mx, Math.min(s.my, s.h * 0.85), hueNow, 1, shape)
  wasDown = s.down

  // Snare or hi-hat hit: crackle sparks in the sky
  if (A.snapHit) {
    const n = 3 + Math.round(A.high * 4)
    for (let c = 0; c < n; c++) {
      const a = Math.random() * 6.283
      const sp = s.h * (0.05 + Math.random() * 0.12)
      spawn(s.w * (0.1 + Math.random() * 0.8), s.h * (0.1 + Math.random() * 0.5),
        Math.cos(a) * sp, Math.sin(a) * sp, 0.15 + Math.random() * 0.2, 40 + Math.random() * 25, 20, 95, 1.0, 5, false)
    }
  }

  // Calm: continuous slow ember drift, rate follows A.calm
  emberAcc += A.calm * 24 * dt
  while (emberAcc >= 1) {
    emberAcc -= 1
    ember(s.w * Math.random(), s.h * (0.55 + Math.random() * 0.45))
  }

  // Shells rise under gravity, leave a tail, and burst at the apex
  for (let i = shells.length - 1; i >= 0; i--) {
    const sh = shells[i]
    sh.vy += G * dt
    sh.x += sh.vx * dt
    sh.y += sh.vy * dt
    spawn(sh.x, sh.y, (Math.random() - 0.5) * 12 * u, (Math.random() - 0.5) * 12 * u, 0.35, sh.h, 100, 70, 1.0, 2.5, false)
    out.push({ k: 'c', x: sh.x, y: sh.y, r: 2.5 * u, h: sh.h, s: 100, l: 85, a: 1 })
    if (sh.vy >= 0) {
      burst(sh.x, sh.y, sh.shape, sh.h, sh.power, countFor(sh.shape, 1), A.bands, A.high)
      shells.splice(i, 1)
    }
  }

  step(dt, u, s.t)

  // Particles drawn as streaks from previous to current position
  for (let i = 0; i < MAX; i++) {
    const p = POOL[i]
    if (!p.alive) continue
    const f = p.life / p.max
    out.push({ k: 'l', x1: p.px, y1: p.py, x2: p.x, y2: p.y, h: p.h, s: p.sat, l: p.l,
      a: Math.min(0.9, 0.15 + f * 0.8), lw: Math.max(0.6, p.sz * u * (0.4 + f)) })
  }

  // Burst flashes
  for (let i = flashes.length - 1; i >= 0; i--) {
    const fl = flashes[i]
    fl.t += dt
    if (fl.t > 0.3) { flashes.splice(i, 1); continue }
    const q = fl.t / 0.3
    out.push({ k: 'c', x: fl.x, y: fl.y, r: fl.r * (0.5 + q), h: fl.h, s: 100, l: 75, a: 0.45 * (1 - q) })
  }

  // Ground line that pulses with the beat phase
  out.push({ k: 'l', x1: 0, y1: s.h - 1, x2: s.w, y2: s.h - 1, h: 30 + (A.phase || 0) * 60, s: 90, l: 50,
    a: 0.1 + 0.3 * (1 - (A.phase || 0)) * A.energy, lw: 2 * u })

  finale = Math.max(0, finale - dt)
  const fx = {
    trail: 0.8 + A.calm * 0.12,
    zoom: 1 + A.kick * 0.003,
    spin: Math.sin(s.t * 0.2) * 0.003,
    hue: 0.3 + A.calm * 0.7,
    mirror: finale > 0 ? 6 : 0
  }
  s = await frame(out, fx)
}

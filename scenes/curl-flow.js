// name: Curl flow
// Fluid-dye style after curl-noise flow visualisation: particles ride a curl-noise
// streamfunction of summed sines and leave short streaks. A seeded mulberry32 PRNG
// places the wave phases, kick vortices and hat sparkles, so rewinds, beat-repeats and
// replays redraw exactly the same frames. Streak and sparkle shapes live in pools that
// are rewritten in place, and each particle re-samples the streamfunction on alternate
// frames while integrating every frame. kickHit seeds a vortex for the bar; bass speeds
// the flow; hats sparkle; snare jolts a radial shock; keyHue colours streaks by speed;
// calm goes slow and laminar; build/toDrop add tension and fall back to 0/99 unmapped.
let s = await frame([])
const TAU = Math.PI * 2
let seed = 0x9e3779b9
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const N = 360, W = 4
const COSN = 2048, COS = [], INV_TAU = 1 / TAU
for (let i = 0; i <= COSN; i++) COS.push(Math.cos((i / COSN) * TAU))
const kx = [], ky = [], amp = [], ph0 = [], om = []
for (let i = 0; i < W / 2; i++) {
  const sx = (0.85 + rnd() * 1.3) * (rnd() < 0.5 ? -1 : 1)
  const sy = (0.85 + rnd() * 1.3) * (rnd() < 0.5 ? -1 : 1)
  const p = rnd() * TAU, q = rnd() * TAU
  const a = 0.3 + rnd() * 0.3
  const o = (1.2 + rnd() * 1.8) * (rnd() < 0.5 ? -1 : 1)
  kx.push(sx); ky.push(sy); amp.push(a); ph0.push(p + q); om.push(o)
  kx.push(sx); ky.push(-sy); amp.push(a); ph0.push(p - q); om.push(o)
}
const nx = [], ny = [], hoff = [], life = [], hx = [], hy = [], ptsArr = []
const uu = [], ww = [], sps = []
const streaks = [], out = []
let bx = 1, by = 1
const init = () => {
  const R = Math.min(s.w, s.h) * 0.5
  bx = (s.w * 0.5) / R
  by = (s.h * 0.5) / R
  for (let i = 0; i < N; i++) {
    nx[i] = (rnd() * 2 - 1) * bx
    ny[i] = (rnd() * 2 - 1) * by
    hoff[i] = (rnd() * 2 - 1) * 14
    life[i] = 0.12 + rnd() * 0.88
    const ha = rnd() * TAU
    hx[i] = Math.cos(ha); hy[i] = Math.sin(ha)
    uu[i] = 0; ww[i] = 0; sps[i] = 0.55
    ptsArr[i] = [0, 0, 0, 0]
    streaks[i] = { k: "p", pts: ptsArr[i], h: 0, s: 88, l: 50, a: 0, lw: 1 }
    out[i] = streaks[i]
  }
}
init()
let warm = false
const vorts = [], sparks = []
const vX = [], vY = [], vG = []
const sparkShapes = []
for (let i = 0; i < 80; i++) sparkShapes.push({ k: "c", x: 0, y: 0, r: 1, h: 0, s: 85, l: 64, a: 0 })
const fx = { trail: 0.8, zoom: 1, spin: 0, hue: 0.5, react: { punch: 0, sparkle: 0, shake: 0, tint: 0.15 } }
let shock = 0, burst = 0
while (true) {
  const A = s.audio, dt = s.dt
  const R = Math.min(s.w, s.h) * 0.5, U = Math.min(s.w, s.h) / 800
  const nbx = (s.w * 0.5) / R, nby = (s.h * 0.5) / R
  if (nbx !== bx || nby !== by) { bx = nbx; by = nby }
  const calm = A.calm || 0, bass = A.bass || 0, kick = A.kick || 0
  const hat = A.hat || 0, level = A.level || 0
  const hue0 = typeof A.keyHue === "number" ? A.keyHue : 200
  const bpm = A.bpm > 0 ? A.bpm : 120
  const barSec = 240 / bpm
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 10 ? 1 - toDrop / 10 : 0
  const tension = Math.max(build, near)
  const flow = (0.55 + bass * 1.5) * (1 - calm * 0.62) * (1 + tension * 0.45 + burst * 0.5)
  if (A.kickHit) {
    if (vorts.length > 3) vorts.shift()
    vorts.push({ x: (rnd() * 2 - 1) * bx * 0.8, y: (rnd() * 2 - 1) * by * 0.8,
      s: (0.8 + rnd() * 0.9) * (rnd() < 0.5 ? -1 : 1), life: 1 })
  }
  for (let j = vorts.length - 1; j >= 0; j--) {
    vorts[j].life -= dt / barSec
    if (vorts[j].life <= 0) vorts.splice(j, 1)
  }
  const vN = vorts.length
  for (let j = 0; j < vN; j++) {
    const q = vorts[j]
    vX[j] = q.x; vY[j] = q.y; vG[j] = q.s * q.life * 0.12
  }
  shock = Math.max(shock * Math.exp(-dt * 8), A.snareHit ? 1 : 0)
  burst = Math.max(burst * Math.exp(-dt * 2.2), A.drop ? 1 : 0)
  if (A.hatHit) {
    for (let k = 0; k < 5; k++) {
      const i = Math.floor(rnd() * N) % N
      if (sparks.length > 70) sparks.shift()
      sparks.push({ x: nx[i] + (rnd() - 0.5) * 0.06, y: ny[i] + (rnd() - 0.5) * 0.06,
        vx: (rnd() - 0.5) * 0.18, vy: (rnd() - 0.5) * 0.18, life: 1, h: rnd() * 90 })
    }
  }
  const t = s.t
  const p0 = ph0[0] + om[0] * t, p1 = ph0[1] + om[1] * t
  const p2 = ph0[2] + om[2] * t, p3 = ph0[3] + om[3] * t
  const x0 = kx[0], y0 = ky[0], a0 = amp[0]
  const x1 = kx[1], y1 = ky[1], a1 = amp[1]
  const x2 = kx[2], y2 = ky[2], a2 = amp[2]
  const x3 = kx[3], y3 = ky[3], a3 = amp[3]
  const fdt = flow * dt, dtLife = dt / 1.6
  const swirl = 0.14 + bass * 0.08
  const lwF = (1 + bass * 1.5 + kick * 1.1 + level * 0.6) * U
  const hueB = hue0 + burst * 20, lB = 44 + level * 4, aB = 0.5 + kick * 0.1
  const tlS = (1 + calm * 0.9) * R
  const cxR = s.cx, cyR = s.cy
  const parity = s.frame & 1
  for (let i = 0; i < N; i++) {
    let x = nx[i], y = ny[i]
    let lf = life[i] - dtLife
    if (lf <= 0) { x = (rnd() * 2 - 1) * bx; y = (rnd() * 2 - 1) * by; lf = 1 }
    life[i] = lf
    let fade = 1
    if (lf > 0.9) fade = (1 - lf) * 10
    else if (lf < 0.18) fade = lf * 5.56
    let u, w, sp
    if (!warm || (i & 1) === parity) {
      u = 0; w = 0
      let q = (x0 * x + y0 * y + p0) * INV_TAU
      q -= q | 0
      let f = q * COSN
      if (f < 0) f += COSN
      let ii = f | 0
      let c = COS[ii] + (COS[ii + 1] - COS[ii]) * (f - ii)
      u += a0 * y0 * c; w -= a0 * x0 * c
      q = (x1 * x + y1 * y + p1) * INV_TAU
      q -= q | 0
      f = q * COSN
      if (f < 0) f += COSN
      ii = f | 0
      c = COS[ii] + (COS[ii + 1] - COS[ii]) * (f - ii)
      u += a1 * y1 * c; w -= a1 * x1 * c
      q = (x2 * x + y2 * y + p2) * INV_TAU
      q -= q | 0
      f = q * COSN
      if (f < 0) f += COSN
      ii = f | 0
      c = COS[ii] + (COS[ii + 1] - COS[ii]) * (f - ii)
      u += a2 * y2 * c; w -= a2 * x2 * c
      q = (x3 * x + y3 * y + p3) * INV_TAU
      q -= q | 0
      f = q * COSN
      if (f < 0) f += COSN
      ii = f | 0
      c = COS[ii] + (COS[ii + 1] - COS[ii]) * (f - ii)
      u += a3 * y3 * c; w -= a3 * x3 * c
      u -= y * swirl; w += x * swirl
      for (let j = 0; j < vN; j++) {
        const dx = x - vX[j], dy = y - vY[j]
        const g = vG[j] / (dx * dx + dy * dy + 0.06)
        u -= dy * g; w += dx * g
      }
      if (shock > 0.01) {
        const g = shock * 0.35 / (x * x + y * y + 0.35)
        u += x * g; w += y * g
      }
      const raw = Math.sqrt(u * u + w * w)
      sp = raw < 0.55 ? 0.55 : raw > 2.4 ? 2.4 : raw
      if (raw < 0.001) { u = hx[i] * 0.55; w = hy[i] * 0.55 }
      else { const sc = sp / raw; u *= sc; w *= sc }
      uu[i] = u; ww[i] = w; sps[i] = sp
    } else {
      u = uu[i]; w = ww[i]; sp = sps[i]
    }
    x += u * fdt
    y += w * fdt
    if (x > bx) x -= bx * 2; else if (x < -bx) x += bx * 2
    if (y > by) y -= by * 2; else if (y < -by) y += by * 2
    nx[i] = x; ny[i] = y
    const px = cxR + x * R, py = cyR + y * R
    const spn = sp < 0.001 ? 0.001 : sp
    const tl = (0.024 + sp * 0.034) * tlS * (0.4 + fade * 0.6)
    const hs0 = sp * 0.55, hs = hs0 > 1 ? 1 : hs0
    const pts = ptsArr[i]
    const dxs = u / spn, dys = w / spn
    pts[0] = px - dxs * tl; pts[1] = py - dys * tl
    pts[2] = px; pts[3] = py
    const al = (aB + hs * 0.3) * fade
    const o = streaks[i]
    o.h = hueB + hs * 150 + hoff[i]
    o.l = lB + hs * 15
    o.a = al > 0.9 ? 0.9 : al
    o.lw = lwF
  }
  warm = true
  const rB = (1.1 + hat * 1.6) * U
  let sc = 0
  for (let j = sparks.length - 1; j >= 0; j--) {
    const q = sparks[j]
    q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt * 3.2
    if (q.life <= 0) { sparks.splice(j, 1); continue }
    const o = sparkShapes[sc]
    o.x = cxR + q.x * R; o.y = cyR + q.y * R
    o.r = rB * (0.35 + q.life * 0.65)
    o.h = hue0 + 150 + q.h
    o.a = q.life * 0.72
    out[N + sc] = o
    sc++
  }
  out.length = N + sc
  fx.trail = 0.82 + calm * 0.11
  fx.zoom = 1.004 + kick * 0.012 + burst * 0.01
  fx.spin = 0.0006 * (1 - calm)
  fx.hue = 0.5 + tension * 0.6
  fx.react.punch = 0.25 + kick * 0.35
  fx.react.sparkle = hat * 0.5
  fx.react.shake = (A.snare || 0) * 0.25
  s = await frame(out, fx)
}

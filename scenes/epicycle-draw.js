// name: Epicycle draw
// Fourier epicycle math art, after the old "circle drawing machine": a closed star/flower
// is sampled once, its DFT gives rotating circles of shrinking radius, and the largest-first
// chain traces the curve. A seeded mulberry32 PRNG (Math.imul) picks the flower, so rewinds,
// beat repeats and replays redraw identical frames. Kick adds the next harmonic (more detail),
// snare reverses the draw direction, hats leave glints at the pen, bass sets circle weight,
// keyHue colours the trace, calm fades the machinery, build/toDrop speed it up and the drop
// spends that on full detail.
let s = await frame([])
const TAU = Math.PI * 2
const N = 64, G = 256, KMAX = 20, HMAX = 13, TAIL = 108
let rng = 0x5eed2026
const rnd = () => {
  rng = (rng + 0x6d2b79f5) | 0
  let z = rng
  z = Math.imul(z ^ (z >>> 15), z | 1)
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
  return ((z ^ (z >>> 14)) >>> 0) / 4294967296
}
const petal = 5 + Math.floor(rnd() * 4)
const petal2 = 3 + Math.floor(rnd() * 4)
const amp = 0.2 + rnd() * 0.2
const amp2 = 0.06 + rnd() * 0.1
const p1 = rnd() * TAU, p2 = rnd() * TAU, lean = rnd() * TAU
const sx = [], sy = []
for (let i = 0; i < N; i++) {
  const u = (i / N) * TAU
  const r = 1 + amp * Math.cos(petal * u + p1) + amp2 * Math.cos(petal2 * u + p2) + 0.05 * Math.cos(2 * u + lean)
  sx.push(Math.cos(u) * r)
  sy.push(Math.sin(u) * r)
}
let c0x = 0, c0y = 0
for (let i = 0; i < N; i++) { c0x += sx[i]; c0y += sy[i] }
c0x /= N
c0y /= N
const dr = [0], di = [0], dm = [0]
for (let k = 1; k <= KMAX; k++) {
  let re = 0, im = 0
  for (let i = 0; i < N; i++) {
    const a = (TAU * k * i) / N
    const c = Math.cos(a), sn = Math.sin(a)
    re += sx[i] * c + sy[i] * sn
    im += sy[i] * c - sx[i] * sn
  }
  dr.push(re / N)
  di.push(im / N)
  dm.push(Math.sqrt(dr[k] * dr[k] + di[k] * di[k]))
}
const order = []
for (let k = 1; k <= KMAX; k++) order.push(k)
order.sort((a, b) => dm[b] - dm[a])
const hr = [], him = [], hm = [], tc = [], ts = []
for (let h = 0; h < HMAX; h++) {
  const k = order[h]
  hr.push(dr[k])
  him.push(di[k])
  hm.push(dm[k])
  const ca = new Array(G), sa = new Array(G)
  for (let j = 0; j < G; j++) {
    const a = (TAU * k * j) / G
    ca[j] = Math.cos(a)
    sa[j] = Math.sin(a)
  }
  tc.push(ca)
  ts.push(sa)
}
let levels = null, curS = 0, curCx = 0, curCy = 0
const build = (cx, cy, S) => {
  const lv = []
  const cur = new Array(G * 2)
  for (let j = 0; j < G; j++) {
    cur[j * 2] = cx + c0x * S
    cur[j * 2 + 1] = cy + c0y * S
  }
  lv.push(cur.slice())
  for (let h = 0; h < HMAX; h++) {
    const cr = hr[h], ci = him[h]
    for (let j = 0; j < G; j++) {
      const c = tc[h][j], sn = ts[h][j]
      cur[j * 2] += 2 * (cr * c - ci * sn) * S
      cur[j * 2 + 1] += 2 * (ci * c + cr * sn) * S
    }
    lv.push(cur.slice())
  }
  levels = lv
  curS = S
  curCx = cx
  curCy = cy
}
const gl = []
for (let i = 0; i < 12; i++) gl.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, h: 0 })
let gi = 0, dir = 1, headF = G * 0.18, level = 5
while (true) {
  const A = s.audio, out = [], dt = s.dt
  const span = Math.min(s.w, s.h), U = span / 800, S = span * 0.3
  if (Math.abs(S - curS) > 1e-4 || s.cx !== curCx || s.cy !== curCy) build(s.cx, s.cy, S)
  const calm = A.calm || 0, bass = A.bass || 0, kick = A.kick || 0, hat = A.hat || 0
  const buildA = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 8 ? Math.max(0, 1 - toDrop / 8) : 0
  const drive = Math.max(buildA, near)
  const drops = A.dropAmt || 0
  const hue0 = typeof A.keyHue === "number" ? A.keyHue : 200
  if (A.kickHit) level = Math.min(HMAX, level + 1)
  if (A.drop) level = HMAX
  if (A.snareHit) dir = -dir
  const spd = (0.55 + drive * 0.7 + drops * 0.25) * (1 - calm * 0.5)
  headF += dir * spd * dt * G
  headF = headF % G
  if (headF < 0) headF += G
  const h1 = Math.floor(headF) % G, h2 = (h1 + 1) % G, frac = headF - Math.floor(headF)
  const L = Math.max(1, level)
  const lp = levels[L]
  const trace = new Array(TAIL * 2)
  let j = h1
  if (dir > 0) {
    for (let p = 0; p < TAIL; p++) {
      trace[p * 2] = lp[j * 2]
      trace[p * 2 + 1] = lp[j * 2 + 1]
      j--
      if (j < 0) j += G
    }
  } else {
    for (let p = 0; p < TAIL; p++) {
      trace[p * 2] = lp[j * 2]
      trace[p * 2 + 1] = lp[j * 2 + 1]
      j++
      if (j >= G) j -= G
    }
  }
  out.push({ k: "p", pts: lp, h: hue0 + 18, s: 62, l: 45, lw: 1.1 * U + 0.4, a: 0.14 + (1 - calm) * 0.08 })
  out.push({ k: "p", pts: trace, close: false, h: hue0, s: 88, l: 60, lw: (1.4 + bass * 2.2 + kick * 1.6) * U * (1 - calm * 0.25), a: 0.88 })
  let px = s.cx + c0x * S, py = s.cy + c0y * S
  const circA = Math.max(0.06, 0.52 - calm * 0.4) * (0.7 + drive * 0.3)
  const circLw = (0.7 + bass * 1.4) * U
  for (let h = 0; h < L; h++) {
    out.push({ k: "c", x: px, y: py, r: 2 * hm[h] * S, fill: false, h: hue0 + h * 11 + (dir < 0 ? 40 : 0), s: 75, l: 50 + h, a: circA, lw: circLw })
    const c = tc[h][h1] * (1 - frac) + tc[h][h2] * frac
    const sn = ts[h][h1] * (1 - frac) + ts[h][h2] * frac
    px += 2 * (hr[h] * c - him[h] * sn) * S
    py += 2 * (him[h] * c + hr[h] * sn) * S
  }
  out.push({ k: "c", x: px, y: py, r: (2.6 + hat * 4 + kick * 2) * U, h: hue0 + (dir < 0 ? 50 : 0), s: 90, l: 64, a: 0.95 })
  if (A.hatHit) {
    const g = gl[gi]
    gi = (gi + 1) % gl.length
    const dx = px - s.cx, dy = py - s.cy, dd = Math.sqrt(dx * dx + dy * dy) || 1
    g.on = true
    g.x = px
    g.y = py
    g.vx = (dx / dd) * 30 * U
    g.vy = (dy / dd) * 30 * U
    g.life = 1
    g.h = hue0 + 120 + ((A.hats || 0) % 6) * 12
  }
  for (let i = 0; i < gl.length; i++) {
    const g = gl[i]
    if (!g.on) continue
    g.x += g.vx * dt
    g.y += g.vy * dt
    g.life -= dt * 2.4
    if (g.life <= 0) { g.on = false; continue }
    out.push({ k: "c", x: g.x, y: g.y, r: (1.5 + g.life * 5) * U, h: g.h, s: 80, l: 60, a: g.life * 0.7 })
  }
  s = await frame(out, {
    trail: 0.82 + calm * 0.08 + (1 - calm) * 0.04,
    zoom: 1.004 + kick * 0.02 + drops * 0.01,
    spin: 0.0012 * dir,
    hue: 0.6,
    react: { punch: 0.6 + drive * 0.5, slice: 0.2, sparkle: 0.5, tint: 0.3 },
  })
}

// name: Hilbert trace
// Style: generative plotter art after Hilbert's space-filling curve - one light pen
// crawling an order-5 lattice (order 4 on phones) as a single glowing polyline.
// Psychoscript: generator choreography, each actor is a function* coroutine stepped
// once per frame; bar cues swap its routine (direction and orientation) and a snare
// spawns a catch-up echo walker that draws the parallel offset copy.
// Reactions: kick/build/toDrop/drop speed the crawl, snareHit adds the offset copy,
// hatHit drops glints at the head, bass sets stroke weight, keyHue walks the hue,
// calm slows and thins, and a completed order fades out before the next one starts.
let s = await frame([])
const TAU = Math.PI * 2
const mulberry32 = (a) => () => {
  a |= 0
  a = a + 0x6D2B79F5 | 0
  let t = Math.imul(a ^ a >>> 15, 1 | a)
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
  return ((t ^ t >>> 14) >>> 0) / 4294967296
}
const rnd = mulberry32(0x48545243)

// One function* actor per curve: it yields Hilbert indices and is pulled by the loop.
function* hilbertWalker(len, dir) {
  if (dir > 0) {
    for (let i = 0; i < len; i++) yield i
  } else {
    for (let i = len - 1; i >= 0; i--) yield i
  }
}

// Static lattice geometry, built once: the classic d2xy rotation, normalised to a
// unit square and replicated in four orientations so a reset costs no maths.
function buildOrder(ord) {
  const n = 1 << ord, N = n * n
  const xs = [], ys = []
  for (let d = 0; d < N; d++) {
    let x = 0, y = 0, t = d
    for (let q = 1; q < n; q <<= 1) {
      const rx = 1 & (t >> 1), ry = 1 & (t ^ rx)
      if (ry === 0) {
        if (rx === 1) { x = q - 1 - x; y = q - 1 - y }
        const sw = x
        x = y
        y = sw
      }
      x += q * rx
      y += q * ry
      t >>= 2
    }
    xs.push(x)
    ys.push(y)
  }
  const den = n > 1 ? n - 1 : 1
  const vars = []
  for (let v = 0; v < 4; v++) {
    const ang = v * Math.PI / 2, c = Math.cos(ang), sn = Math.sin(ang)
    const px = [], py = []
    for (let i = 0; i < N; i++) {
      let lx = xs[i] / den - 0.5
      const ly = ys[i] / den - 0.5
      if (v > 1) lx = -lx
      px.push(lx * c - ly * sn)
      py.push(lx * sn + ly * c)
    }
    vars.push({ px, py })
  }
  return { n: N, vars }
}

const span0 = Math.min(s.w, s.h)
const orders = span0 < 560 ? [4] : [5, 4]
const geo = []
for (let i = 0; i < orders.length; i++) geo.push(buildOrder(orders[i]))

let oi = 0
let variant = Math.floor(rnd() * 4)
let dir = 1
let routine = 0
let nextDir = 1
let nextVariant = Math.floor(rnd() * 4)
let gen = hilbertWalker(geo[0].n, dir)
let seq = []
let acc = 0
let fading = false
let fadeT = 0
let echo = null
let lastBar = typeof s.audio.bar === "number" ? s.audio.bar : 0
const glints = []
let glintAt = 0
for (let i = 0; i < 12; i++) glints.push({ life: 0, x: 0, y: 0, h: 0, r: 0 })

const BANDS = 6
while (true) {
  const A = s.audio, dt = s.dt > 0 ? s.dt : 1 / 60, out = []
  const span = Math.min(s.w, s.h), U = span / 800
  const calm = typeof A.calm === "number" ? A.calm : 0
  const kick = A.kick || 0
  const bass = A.bass || 0
  const build = typeof A.build === "number" ? A.build : 0
  const dropAmt = A.dropAmt || 0
  const keyHue = typeof A.keyHue === "number" ? A.keyHue : 200
  const bar = typeof A.bar === "number" ? A.bar : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 8 ? Math.max(0, 1 - toDrop / 8) : 0

  // Bar cue: choose the next actor routine (orientation + direction).
  if (bar !== lastBar) {
    lastBar = bar
    routine = (routine + 1) & 3
    nextDir = routine & 1 ? -1 : 1
    nextVariant = (routine + 1) & 3
  }

  const P = geo[oi], len = P.n, V = P.vars[variant], vx = V.px, vy = V.py
  const speedUp = 1 + kick * 1.4 + build * 1.2 + near * 0.8 + dropAmt * 0.5
  const dur = Math.max(0.5, 1.45 / speedUp + calm * 0.9)
  acc += (len / dur) * dt
  let steps = Math.floor(acc)
  acc -= steps
  if (steps > 64) steps = 64
  if (!fading && seq.length === 0) steps = Math.max(steps, 4)

  if (!fading) {
    for (let k = 0; k < steps; k++) {
      const r = gen.next()
      if (r.done) break
      seq.push(r.value)
    }
    if (seq.length >= len) { fading = true; fadeT = 0 }
  } else {
    fadeT += dt
    if (fadeT > 0.55) {
      fading = false
      fadeT = 0
      oi = (oi + 1) % geo.length
      variant = nextVariant
      dir = nextDir
      gen = hilbertWalker(geo[oi].n, dir)
      seq = []
      acc = 0
      echo = null
    }
  }

  // Snare: spawn a catch-up echo walker, a parallel offset copy of the trace.
  if (A.snareHit && seq.length > 4 && !fading) {
    const eg = hilbertWalker(len, dir > 0 ? -1 : 1)
    const eseq = []
    for (let k = 0; k < seq.length; k++) {
      const r = eg.next()
      if (r.done) break
      eseq.push(r.value)
    }
    const ang = rnd() * TAU
    const sep = span * (0.045 + 0.025 * (0.5 + 0.5 * Math.sin((A.snares || 0) * 1.7)))
    echo = { gen: eg, seq: eseq, ox: Math.cos(ang) * sep, oy: Math.sin(ang) * sep, hue: keyHue + 145, life: 1 }
  }
  if (echo) {
    echo.life -= dt / 0.55
    for (let k = 0; k < steps; k++) {
      const r = echo.gen.next()
      if (r.done) break
      echo.seq.push(r.value)
    }
    if (echo.life <= 0 || fading) echo = null
  }

  const fade = fading ? Math.max(0, 1 - fadeT / 0.55) : 1
  const R = span * (0.72 + kick * 0.02 + dropAmt * 0.02 - calm * 0.02)
  const total = seq.length
  const hueDir = dir > 0 ? 1 : -1
  const lw = (1 + bass * 1.8 + kick * 1.6) * U * (1 - calm * 0.35)

  for (let b = 0; b < BANDS; b++) {
    const i0 = Math.floor(total * b / BANDS)
    const i1 = Math.floor(total * (b + 1) / BANDS)
    if (i1 <= i0) continue
    const pts = []
    for (let k = i0; k < i1; k++) {
      const d = seq[k]
      pts.push(s.cx + vx[d] * R, s.cy + vy[d] * R)
    }
    const frac = (b + 0.5) / BANDS
    out.push({
      k: "p", pts, close: false,
      h: keyHue + frac * 200 * hueDir + routine * 20,
      s: 82, l: 44 + frac * 14 + bass * 4, lw,
      a: 0.85 * fade,
    })
  }

  if (total > 0) {
    const d = seq[total - 1]
    const hx = s.cx + vx[d] * R, hy = s.cy + vy[d] * R
    const headHue = keyHue + 200 * hueDir + routine * 20
    out.push({ k: "c", x: hx, y: hy, r: (3 + kick * 4 + bass * 2) * U, h: headHue, s: 90, l: 62, a: 0.9 * fade })
    out.push({ k: "c", x: hx, y: hy, r: (8 + kick * 8) * U, h: headHue + 20, s: 85, l: 46, a: 0.3 * fade, fill: false, lw: 1.4 * U })
    const tail = Math.min(total, 20)
    const tp = []
    for (let k = total - tail; k < total; k++) {
      const td = seq[k]
      tp.push(s.cx + vx[td] * R, s.cy + vy[td] * R)
    }
    out.push({ k: "p", pts: tp, close: false, h: headHue, s: 88, l: 62, lw: (2.2 + kick * 2) * U, a: 0.9 * fade })
  }

  if (echo && echo.seq.length > 2) {
    const ep = []
    for (let k = 0; k < echo.seq.length; k += 2) {
      const d = echo.seq[k]
      ep.push(s.cx + echo.ox + vx[d] * R, s.cy + echo.oy + vy[d] * R)
    }
    out.push({
      k: "p", pts: ep, close: false,
      h: echo.hue + (1 - echo.life) * 60, s: 80, l: 52,
      lw: (1 + bass * 1.2) * U * 0.8, a: 0.5 * Math.max(0, echo.life),
    })
  }

  // Hats: glints at the pen head.
  if (A.hatHit && total > 0) {
    const g = glints[glintAt]
    glintAt = (glintAt + 1) % glints.length
    const d = seq[total - 1]
    const ang = rnd() * TAU
    g.x = s.cx + vx[d] * R + Math.cos(ang) * 6 * U
    g.y = s.cy + vy[d] * R + Math.sin(ang) * 6 * U
    g.h = keyHue + 150 + rnd() * 80
    g.r = (2.2 + (A.hat || 0) * 2) * U
    g.life = 1
  }
  for (let i = 0; i < glints.length; i++) {
    const g = glints[i]
    if (g.life <= 0) continue
    g.life -= dt * 2.2
    if (g.life <= 0) { g.life = 0; continue }
    out.push({ k: "c", x: g.x, y: g.y, r: g.r * (0.5 + g.life), h: g.h, s: 80, l: 58, a: g.life * 0.8 })
  }

  s = await frame(out, {
    trail: 0.9 - Math.min(0.16, (A.energy || 0) * 0.06) + calm * 0.05,
    zoom: 1 + kick * 0.01 + (fading ? 0.004 : 0),
    spin: hueDir * 0.0012 * (1 - calm * 0.7),
    hue: 0.6 + (A.high || 0) * 1.4 + dropAmt * 1.5,
  })
}

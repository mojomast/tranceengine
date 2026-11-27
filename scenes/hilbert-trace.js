// name: Hilbert trace
// Style: generative plotter art after Hilbert's space-filling curve - one light pen
// crawling an order-5 lattice (order 4 on phones), drawn as a single glowing polyline.
// Psychoscript: generator choreography - the pen is a function* coroutine advanced
// once per frame, and bar cues swap its routine (direction and lattice orientation).
// A snare forks a parallel offset copy of the plot.
// Reactions: kick/build/toDrop/drop speed the crawl, snareHit adds the offset copy,
// hatHit drops glints at the head, bass sets stroke weight, keyHue walks the hue
// along the curve, calm slows and thins, and a completed order fades before the next.
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

// One function* actor per trace: it yields Hilbert indices and the loop pulls
// a few per frame. The reverse routine walks the same lattice backwards.
function* hilbertWalker(len, dir) {
  if (dir > 0) {
    for (let i = 0; i < len; i++) yield i
  } else {
    for (let i = len - 1; i >= 0; i--) yield i
  }
}

// Static lattice: the classic d2xy rotation, normalised to a unit square and
// stored in four orientations, so plotting a point is one multiply-add per axis.
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
    vars.push({ px: px, py: py })
  }
  return { n: N, vars: vars }
}

const BANDS = 6
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
let R = 0
let seq = []
let bands = []
let acc = 0
let fading = false
let fadeT = 0
let echo = null
let lastBar = typeof s.audio.bar === "number" ? s.audio.bar : 0
let lastSpan = 0, lastCx = 0, lastCy = 0
let headX = 0, headY = 0
const glints = []
let glintAt = 0
for (let i = 0; i < 12; i++) glints.push({ life: 0, x: 0, y: 0, h: 0, r: 0 })

// Start a fresh curve: fix its radius (so the plotted points never move) and
// clear the per-band polylines. Also used when the drawing area changes.
function startCurve() {
  const span = Math.min(s.w, s.h)
  R = span * 0.72
  seq = []
  bands = []
  for (let b = 0; b < BANDS; b++) bands.push([])
  lastSpan = span
  lastCx = s.cx
  lastCy = s.cy
  acc = 0
  fading = false
  fadeT = 0
  echo = null
  headX = s.cx
  headY = s.cy
  gen = hilbertWalker(geo[oi].n, dir)
}
startCurve()

while (true) {
  const A = s.audio, dt = s.dt > 0 ? s.dt : 1 / 60, out = []
  const span = Math.min(s.w, s.h), U = span / 800
  if (span !== lastSpan || s.cx !== lastCx || s.cy !== lastCy) startCurve()
  const calm = typeof A.calm === "number" ? A.calm : 0
  const kick = A.kick || 0
  const bass = A.bass || 0
  const build = typeof A.build === "number" ? A.build : 0
  const dropAmt = A.dropAmt || 0
  const keyHue = typeof A.keyHue === "number" ? A.keyHue : 200
  const bar = typeof A.bar === "number" ? A.bar : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 8 ? Math.max(0, 1 - toDrop / 8) : 0

  // Bar cue: swap the walker routine (direction + next lattice orientation).
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
  // Seed each new curve so the downbeat already reads as a Hilbert path.
  if (!fading && seq.length === 0) steps = Math.floor(len * 0.24)
  if (steps > 320) steps = 320

  // Pull points from the actor and append them to the band polylines only once.
  if (!fading) {
    for (let k = 0; k < steps; k++) {
      const r = gen.next()
      if (r.done) break
      const d = r.value
      seq.push(d)
      const x = s.cx + vx[d] * R, y = s.cy + vy[d] * R
      let b = d * BANDS / len | 0
      if (b >= BANDS) b = BANDS - 1
      bands[b].push(x, y)
      if (echo) echo.bands[b].push(x + echo.ox, y + echo.oy)
      headX = x
      headY = y
    }
    if (seq.length >= len) { fading = true; fadeT = 0 }
  } else {
    fadeT += dt
    if (fadeT > 0.55) {
      oi = (oi + 1) % geo.length
      variant = nextVariant
      dir = nextDir
      startCurve()
    }
  }

  // Snare: fork a parallel offset copy of everything plotted so far.
  if (A.snareHit && seq.length > 4 && !fading) {
    const ang = rnd() * TAU
    const sep = span * (0.045 + 0.025 * (0.5 + 0.5 * Math.sin((A.snares || 0) * 1.7)))
    const ox = Math.cos(ang) * sep, oy = Math.sin(ang) * sep
    const ob = []
    for (let b = 0; b < BANDS; b++) {
      const src = bands[b], dst = []
      for (let k = 0; k < src.length; k += 2) dst.push(src[k] + ox, src[k + 1] + oy)
      ob.push(dst)
    }
    echo = { bands: ob, ox: ox, oy: oy, hue: keyHue + 145, life: 1 }
  }
  if (echo) {
    echo.life -= dt / 0.55
    if (echo.life <= 0 || fading) echo = null
  }

  const fade = fading ? Math.max(0, 1 - fadeT / 0.55) : 1
  const hueDir = dir > 0 ? 1 : -1
  const lw = (1 + bass * 1.8 + kick * 1.6) * U * (1 - calm * 0.35)
  for (let b = 0; b < BANDS; b++) {
    const pts = bands[b]
    if (pts.length < 4) continue
    const frac = (b + 0.5) / BANDS
    out.push({
      k: "p", pts: pts, close: false,
      h: keyHue + frac * 200 * hueDir + routine * 20,
      s: 82, l: 44 + frac * 14 + bass * 4, lw: lw, a: 0.85 * fade,
    })
  }

  const total = seq.length
  if (total > 0) {
    let hb = seq[total - 1] * BANDS / len | 0
    if (hb >= BANDS) hb = BANDS - 1
    const headHue = keyHue + ((hb + 0.5) / BANDS) * 200 * hueDir + routine * 20
    out.push({ k: "c", x: headX, y: headY, r: (3 + kick * 4 + bass * 2) * U, h: headHue, s: 90, l: 62, a: 0.9 * fade })
    out.push({ k: "c", x: headX, y: headY, r: (8 + kick * 8) * U, h: headHue + 20, s: 85, l: 46, a: 0.3 * fade, fill: false, lw: 1.4 * U })
    const tail = Math.min(total, 20)
    const tp = []
    for (let k = total - tail; k < total; k++) {
      const td = seq[k]
      tp.push(s.cx + vx[td] * R, s.cy + vy[td] * R)
    }
    out.push({ k: "p", pts: tp, close: false, h: headHue, s: 88, l: 62, lw: (2.2 + kick * 2) * U, a: 0.9 * fade })
  }

  if (echo) {
    for (let b = 0; b < BANDS; b++) {
      const pts = echo.bands[b]
      if (pts.length < 4) continue
      out.push({
        k: "p", pts: pts, close: false,
        h: echo.hue + (1 - echo.life) * 60 + b * 8, s: 80, l: 52,
        lw: (1 + bass * 1.2) * U * 0.8, a: 0.5 * Math.max(0, echo.life),
      })
    }
  }

  // Hats: glints at the pen head.
  if (A.hatHit && total > 0) {
    const g = glints[glintAt]
    glintAt = (glintAt + 1) % glints.length
    const ang = rnd() * TAU
    g.x = headX + Math.cos(ang) * 6 * U
    g.y = headY + Math.sin(ang) * 6 * U
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
    zoom: 1 + kick * 0.01 + dropAmt * 0.02 + (fading ? 0.004 : 0),
    spin: hueDir * 0.0012 * (1 - calm * 0.7),
    hue: 0.6 + (A.high || 0) * 1.4 + dropAmt * 1.5,
  })
}

// name: Glyph rain
// Columns of geometric glyphs fall with bright heads and fading tails. Energy and bass set the fall speed and density,
// beats switch on fresh columns, snare hits flip glyphs to a gold highlight, and drops sweep a horizontal wave in a new colour family.
let s = await frame([])
const GL = ["◇", "○", "△", "▽", "✦", "+", "×", "0", "1", "7"]
const MAXLEN = 12
const HOT_HUE = 45
const LIMIT = 470
let slots = []
let slotCount = 0
let fam = 165, famT = 165, holdT = 0
let sweepX = 0, sweeping = false

const rnd = (a, b) => a + Math.random() * (b - a)
const pick = () => GL[Math.floor(Math.random() * GL.length)]
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))

function makeSlot(i) {
  const g = []
  for (let j = 0; j < MAXLEN; j++) g.push(pick())
  return { i, on: false, y: 0, v: 1, len: 6, g, hot: [] }
}

while (true) {
  const A = s.audio
  const W = s.w, H = s.h
  const dt = Math.min(s.dt || 1 / 60, 0.05)
  const u = Math.min(W, H) / 800
  const cs = Math.max(16, 24 * u)
  const n = Math.max(4, Math.floor(W / cs))
  const colW = W / n
  const size = cs * 0.8
  if (n !== slotCount) {
    slots = []
    for (let i = 0; i < n; i++) slots.push(makeSlot(i))
    slotCount = n
  }
  const bands = A.bands || []
  const bandN = bands.length || 1

  // Drop: switch colour family and start a horizontal sweep
  if (A.drop) {
    holdT = 6
    sweeping = true
    sweepX = -cs * 2
  }
  if (holdT > 0) { holdT -= dt; famT = 292 } else { famT = 165 + A.high * 12 }
  fam += (famT - fam) * Math.min(1, dt * 1.2)
  if (sweeping) {
    sweepX += W * 1.1 * dt
    if (sweepX > W + cs * 2) sweeping = false
  }

  // Density and speed: quiet parts thin out, loud parts fill and fall faster
  const calm = A.calm || 0
  const density = clamp((0.22 + A.energy * 0.5 + A.dropAmt * 0.25) * (1 - calm * 0.75), 0.05, 0.95)
  const target = Math.round(density * n)
  const spd = (50 + A.energy * 200 + A.bass * 180) * u * (1 - calm * 0.7)
  const lenBase = 4 + A.energy * 3

  // Advance active columns
  let active = 0
  for (const sl of slots) {
    if (!sl.on) continue
    active++
    sl.y += sl.v * spd * dt * (1 + A.dropAmt * 1.5)
    if (sl.y - sl.len * gap(cs) > H + cs) { sl.on = false; active--; continue }
    if (Math.random() < 0.05) sl.g[Math.floor(Math.random() * MAXLEN)] = pick()
    sl.hot = sl.hot.filter(h => (h.t -= dt) > 0)
  }

  // Spawn: fill toward the density target, and every beat drops in two more
  const offs = slots.filter(sl => !sl.on)
  let k = Math.max(0, target - active)
  if (A.beat) k += 2
  k = Math.min(k, 6)
  for (let q = 0; q < k && offs.length; q++) {
    const sl = offs.splice(Math.floor(Math.random() * offs.length), 1)[0]
    sl.on = true
    sl.y = -cs - rnd(0, H * 0.3)
    sl.v = rnd(0.6, 1.4)
    sl.len = Math.round(lenBase + rnd(0, 3))
    sl.hot = []
  }

  // Snare or clap: flip a couple of tail glyphs to the highlight colour
  if (A.snapHit) {
    const live = slots.filter(sl => sl.on && sl.y > 0)
    for (let q = 0; q < 2 && live.length; q++) {
      const sl = live[Math.floor(Math.random() * live.length)]
      const j = 1 + Math.floor(Math.random() * Math.max(1, sl.len - 1))
      sl.g[j] = pick()
      sl.hot.push({ i: j, t: 0.25 })
    }
  }

  const out = []

  // Horizontal sweep row left behind the drop front
  if (sweeping) {
    for (let x = cs * 0.5; x < sweepX && x < W; x += cs) {
      if (out.length >= LIMIT) break
      out.push({ k: "t", text: GL[Math.floor(x / cs) % GL.length], x, size,
        y: H * 0.5 + Math.sin(x * 0.02 + s.t * 6) * cs * 0.5,
        h: fam, s: 70, l: 68, a: 0.9 })
    }
  }

  // Columns: band index sets brightness, head is bright, tail fades
  for (const sl of slots) {
    if (!sl.on || out.length >= LIMIT) continue
    const x = (sl.i + 0.5) * colW
    const bi = Math.min(bandN - 1, Math.floor(sl.i / n * bandN))
    const bright = 0.3 + 0.7 * clamp(bands[bi] || 0, 0, 1)
    const near = sweeping && Math.abs(x - sweepX) < cs * 2
    const hy = sl.y
    if (hy > -cs && hy < H + cs) {
      out.push({ k: "t", text: sl.g[0], x, y: hy,
        size: size * (1 + A.kick * 0.25 + (1 - A.phase) * 0.06),
        h: fam, s: 40, l: 86, a: clamp(bright + A.kick * 0.3, 0, 1) })
    }
    for (let j = 1; j < sl.len; j++) {
      if (out.length >= LIMIT) break
      const y = hy - j * cs
      if (y < -cs || y > H + cs) continue
      let hot = false
      for (const hh of sl.hot) if (hh.i === j) hot = true
      if (hot) {
        out.push({ k: "t", text: sl.g[j], x, y, size, h: HOT_HUE, s: 95, l: 62, a: 0.95 })
        continue
      }
      const fade = Math.pow(1 - j / sl.len, 1.4)
      out.push({ k: "t", text: sl.g[j], x, y, size, h: fam, s: 70,
        l: 30 + 30 * bright * fade + (near ? 15 : 0),
        a: clamp(0.85 * fade * bright, 0.04, 1) })
    }
  }

  s = await frame(out, { trail: 0.8 + calm * 0.14, zoom: 1 + A.dropAmt * 0.003 })
}

function gap(cs) { return cs }

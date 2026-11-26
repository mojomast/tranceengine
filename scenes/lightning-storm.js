// name: Lightning storm
// Branching bolts strike from a glowing cloud ceiling whose underside follows the spectrum.
// Beats fire main bolts (at the pointer while pressed), snares throw sparks, a drop starts a two-second storm,
// and calm passages add distant flickers and falling rain. Bolts are thin and short-lived, so nothing fills the screen.
let s = await frame([])

let bolts = []
let now = 0
let stormStart = -100
let lastMain = null
let lastMainT = -100

const rnd = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// underside of the cloud ceiling at horizontal position x
function cloudY(x, w, h, A, t) {
  const i = clamp(Math.floor((x / w) * 32), 0, 31)
  const b = (A.bands && A.bands[i]) || 0
  return h * (0.07 + 0.12 * b) + h * 0.012 * Math.sin(x * 0.011 + t * 0.7)
}

// recursive midpoint displacement; some midpoints spawn smaller forked bolts
function buildBolt(ax, ay, bx, by, depth, disp, lvl, bag) {
  const pts = [ax, ay]
  const forks = []
  const rec = (x1, y1, x2, y2, d, dep) => {
    if (dep === 0) { pts.push(x2, y2); return }
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.hypot(dx, dy) || 1
    const off = rnd(-1, 1) * d
    const mx = (x1 + x2) / 2 - (dy / len) * off
    const my = (y1 + y2) / 2 + (dx / len) * off
    rec(x1, y1, mx, my, d * 0.5, dep - 1)
    if (lvl < 2 && dep >= 3 && Math.random() < 0.08) forks.push([mx, my, dx, dy, d])
    rec(mx, my, x2, y2, d * 0.5, dep - 1)
  }
  rec(ax, ay, bx, by, disp, depth)
  bag.push({ pts, lvl })
  const L0 = Math.hypot(bx - ax, by - ay) || 1
  for (const f of forks) {
    const a = Math.atan2(f[3], f[2]) + (Math.random() < 0.5 ? -1 : 1) * rnd(0.45, 1.0)
    const L = L0 * rnd(0.25, 0.45)
    buildBolt(f[0], f[1], f[0] + Math.cos(a) * L, f[1] + Math.sin(a) * L, 3, f[4] * 0.8, lvl + 1, bag)
  }
}

function strike(ax, ay, bx, by, o) {
  const bag = []
  buildBolt(ax, ay, bx, by, o.depth, Math.hypot(bx - ax, by - ay) * 0.2, 0, bag)
  bolts.push({ born: now, life: o.life, peak: o.peak, hue: o.hue, w: o.w, glow: o.glow, bag })
  if (bolts.length > 22) bolts.shift()
  return bag[0].pts
}

while (true) {
  const A = s.audio
  const out = []
  const w = s.w, h = s.h
  const u = Math.min(w, h) / 800
  const uu = Math.max(0.6, u)
  now = s.t
  const px = typeof s.mx === "number" ? s.mx : s.cx
  const py = typeof s.my === "number" ? s.my : s.cy

  if (A.drop) stormStart = s.t
  const since = s.t - stormStart
  const storm = since < 2.5 ? 1 - since / 2.5 : 0

  // main bolt on every beat: pointer-targeted while pressed, otherwise cloud-to-cloud or cloud-to-ground
  if (A.beat) {
    const hue = 200 + (A.beats % 4) * 22
    const peak = 0.7 + 0.25 * A.kick
    let ax, ay, bx, by
    if (s.down) {
      ax = clamp(px + rnd(-0.06, 0.06) * w, 0, w)
      ay = cloudY(ax, w, h, A, s.t)
      bx = px; by = py
    } else if (Math.random() < 0.3) {
      ax = rnd(0.05, 0.4) * w
      ay = cloudY(ax, w, h, A, s.t) + h * 0.03
      bx = ax + rnd(0.3, 0.5) * w
      by = ay + rnd(-0.03, 0.03) * h
    } else {
      ax = rnd(0.1, 0.9) * w
      ay = cloudY(ax, w, h, A, s.t)
      bx = ax + rnd(-0.2, 0.2) * w
      by = h * rnd(0.6, 0.92)
    }
    const pts = strike(ax, ay, bx, by, { life: rnd(0.2, 0.4), peak, hue, w: 1 + A.kick * 0.8, glow: true, depth: 6 })
    lastMain = pts
    lastMainT = s.t
  }

  // drop: a two-second storm of extra bolts that thins out over time
  if (storm > 0 && Math.random() < 0.09 * storm + 0.02 * A.dropAmt) {
    const x0 = rnd(0.02, 0.98) * w
    strike(x0, cloudY(x0, w, h, A, s.t), x0 + rnd(-0.25, 0.25) * w, h * rnd(0.5, 0.95),
      { life: rnd(0.2, 0.4), peak: 0.7, hue: rnd(190, 280), w: 1 + A.dropAmt * 0.6, glow: true, depth: 6 })
  }

  // snare or hi-hat transient: small side sparks off the latest bolt
  if (A.snapHit) {
    let sx, sy
    if (lastMain && s.t - lastMainT < 0.5) {
      const k = Math.floor(Math.random() * (lastMain.length / 2)) * 2
      sx = lastMain[k]; sy = lastMain[k + 1]
    } else {
      sx = rnd(0.1, 0.9) * w
      sy = cloudY(sx, w, h, A, s.t)
    }
    for (let k = 0; k < 3; k++) {
      const a = rnd(0, Math.PI * 2)
      const L = rnd(30, 90) * u
      strike(sx, sy, sx + Math.cos(a) * L, sy + Math.sin(a) * L,
        { life: rnd(0.2, 0.25), peak: 0.75, hue: 45, w: 0.6, glow: false, depth: 3 })
    }
  }

  // calm passages: faint distant flickers inside the cloud
  if (A.calm > 0.2 && Math.random() < 0.04 * A.calm) {
    const x0 = rnd(0, 1) * w, y0 = rnd(0.02, 0.1) * h
    const dir = Math.random() < 0.5 ? -1 : 1
    strike(x0, y0, x0 + dir * rnd(0.08, 0.2) * w, y0 + rnd(-0.02, 0.02) * h,
      { life: rnd(0.25, 0.35), peak: 0.25 + 0.2 * A.calm, hue: 215, w: 0.6, glow: false, depth: 4 })
  }

  // draw live bolts: quick ramp-in, then fade out over their lifetime
  const live = []
  for (const b of bolts) {
    const dt = s.t - b.born
    const age = dt / b.life
    if (age >= 1) continue
    live.push(b)
    const a = b.peak * clamp(dt / 0.04, 0, 1) * Math.pow(1 - age, 1.3)
    for (const p of b.bag) {
      if (b.glow && p.lvl === 0) {
        out.push({ k: "p", pts: p.pts, close: false, lw: 7 * b.w * uu, h: b.hue, s: 90, l: 50, a: a * 0.22 })
      }
      out.push({ k: "p", pts: p.pts, close: false, lw: (p.lvl ? 1 : 1.8) * b.w * uu,
        h: b.hue, s: 60, l: 88, a: a * (p.lvl ? 0.6 : 0.9) })
    }
  }
  bolts = live

  // glowing cloud ceiling shaped by the spectrum
  const N = 32
  const edge = []
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * w
    edge.push(x, cloudY(x, w, h, A, s.t))
  }
  out.push({ k: "p", pts: edge.concat([w, 0, 0, 0]), fill: true, h: 225, s: 60, l: 20, a: 0.14 + 0.05 * A.energy })
  out.push({ k: "p", pts: edge, close: false, lw: (1.5 + 2 * A.kick) * uu, h: 210, s: 85, l: 55,
    a: 0.08 + 0.1 * A.level + 0.08 * A.kick })
  for (let i = 0; i <= N; i += 2) {
    const b = (A.bands && A.bands[Math.min(i, 31)]) || 0
    out.push({ k: "c", x: edge[2 * i], y: edge[2 * i + 1], r: (5 + 14 * b) * uu, h: 215, s: 80, l: 55, a: 0.04 + 0.12 * b })
  }

  // rain of faint slanted lines; more visible when calm
  const ra = 0.03 + 0.2 * A.calm
  for (let i = 0; i < 70; i++) {
    const x = ((i * 0.618034 + 0.13) % 1) * w
    const y = ((i * 0.381966 + s.t * (0.25 + (i % 5) * 0.06)) % 1) * h
    out.push({ k: "l", x1: x, y1: y, x2: x - 6 * uu, y2: y + 16 * uu, lw: 0.8 * uu, h: 205, s: 50, l: 75, a: ra })
  }

  s = await frame(out, { trail: 0.8 + 0.08 * A.calm, zoom: 1, spin: 0, hue: 0.5 })
}

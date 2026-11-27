// name: Plasma lattice
// Demoscene plasma: the classic sum of sines sampled on a coarse lattice of soft rounded
// squares, drawn as thick round-joined quads whose hue cycles out from the key. A seeded
// mulberry32 PRNG fixes every cell's jitter and glint, so a cut, rewind, beat-repeat or
// replay redraws precisely the same field.
// Kick jumps the plasma phase a quarter turn, bass widens the cells, hats add a fine ripple,
// snare throws a bright ring, build (or a near drop) speeds the time term, drop rotates the
// palette 180 degrees while dropAmt fades it back; keyHue seeds the hue, level and energy
// set brightness, and calm slows and dims the lattice.
let s = await frame([])
const TAU = Math.PI * 2
const mulberry32 = (a) => {
  a = a >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
let W = 0, H = 0, span = 1, cols = 1, rows = 1, cw = 1, ch = 1
let cells = [], ring = null, ringU = []
let sx = [], sy = [], hx = [], hy = []
const layout = () => {
  W = s.w
  H = s.h
  span = Math.min(W, H)
  const phone = span < 500
  cols = phone ? 13 : 35
  rows = phone ? 24 : 21
  const m = span * 0.045
  const gw = W - m * 2, gh = H - m * 2
  cw = gw / cols
  ch = gh / rows
  const xs = [], ys = []
  cells = []
  for (let i = 0; i < cols; i++) xs.push(s.cx - gw / 2 + cw * (i + 0.5))
  for (let j = 0; j < rows; j++) ys.push(s.cy - gh / 2 + ch * (j + 0.5))
  const invSpan2 = 1 / (span * span)
  const minCell = Math.min(cw, ch)
  const rand = mulberry32(0x5eed1234)
  for (let j = 0; j < rows; j++) {
    const dy = ys[j] - s.cy
    for (let i = 0; i < cols; i++) {
      const dx = xs[i] - s.cx
      const rr = (dx * dx + dy * dy) * invSpan2
      const r = rand(), f = 0.86 + r * 0.2
      cells.push({
        k: "p", fill: false, close: true, x: xs[i], y: ys[j],
        rs: Math.sin(rr * 7.5), rc: Math.cos(rr * 7.5),
        w0: minCell * 0.22 * f, h0: minCell * 0.22 * f, lw: minCell * 0.62 * f,
        hj: r * 9, g: r > 0.88,
        pts: [0, 0, 0, 0, 0, 0, 0, 0], h: 0, s: 84, l: 0, a: 0,
      })
    }
  }
  ringU = []
  for (let k = 0; k <= 36; k++) {
    const a = k / 36 * TAU
    ringU.push(Math.cos(a), Math.sin(a))
  }
  ring = { k: "p", pts: [], close: true, h: 0, s: 90, l: 58, a: 0, lw: Math.max(1, span * 0.004) }
  for (let k = 0; k < ringU.length; k++) ring.pts.push(0)
  cells.push(ring)
}
layout()
let phase = 0, pulse = 0, ringR = 0, ringA = 0
while (true) {
  const A = s.audio, dt = s.dt
  if (s.w !== W || s.h !== H) layout()
  const calm = A.calm || 0
  const kick = A.kick || 0
  const bass = A.bass || 0
  const hat = A.hat || 0
  const level = A.level || 0
  const energy = A.energy || 0
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const drops = A.dropAmt || 0
  const hue0 = typeof A.keyHue === "number" ? A.keyHue : 200
  if (A.kickHit) phase += Math.PI * 0.5
  const near = toDrop < 8 ? 1 - toDrop / 8 : 0
  const drive = Math.max(build, near * 0.7)
  phase += dt * (0.5 + drive * 2.4) * (1 - calm * 0.6)
  pulse = Math.max(pulse * Math.exp(-dt * 6), kick)
  if (A.snareHit) {
    ringR = 0.08
    ringA = 1
  }
  ringR += dt * 0.9
  ringA *= Math.exp(-dt * 2.1)
  const scale = 1 + bass * 0.3 + pulse * 0.05
  const lBase = 15 + level * 14 + energy * 9
  const lAmp = 19 + energy * 7
  const aBase = (0.3 + energy * 0.16 + pulse * 0.07) * (1 - calm * 0.24)
  const pal = hue0 + s.t * 9 + drops * 180
  const cp = Math.cos(phase * 1.15), sp = Math.sin(phase * 1.15)
  for (let i = 0; i < cols; i++) {
    const u = i / cols
    sx[i] = Math.sin(u * TAU * 2.3 + phase)
    hx[i] = Math.sin(u * TAU * 7.1 + phase * 2.2)
  }
  for (let j = 0; j < rows; j++) {
    const v = j / rows
    sy[j] = Math.sin(v * TAU * 1.7 - phase * 0.7)
    hy[j] = Math.cos(v * TAU * 6.3 - phase * 1.7)
  }
  let n = 0
  const glintOn = hat > 0.2
  for (let j = 0; j < rows; j++) {
    const syj = sy[j], hyj = hy[j] * hat * 0.6
    for (let i = 0; i < cols; i++) {
      const c = cells[n]
      n++
      let v = sx[i] + syj + (c.rs * cp + c.rc * sp) * 0.95 + hx[i] * hyj
      let l = lBase + v * lAmp
      if (l < 10) l = 10
      else if (l > 64) l = 64
      let a = aBase * (0.78 + (v < 0 ? -v : v) * 0.14)
      if (c.g && glintOn) a += hat * 0.08
      const w = c.w0 * scale, h = c.h0 * scale
      c.pts[0] = c.x - w
      c.pts[1] = c.y - h
      c.pts[2] = c.x + w
      c.pts[3] = c.y - h
      c.pts[4] = c.x + w
      c.pts[5] = c.y + h
      c.pts[6] = c.x - w
      c.pts[7] = c.y + h
      c.l = l
      c.h = pal + v * 58 + c.hj
      c.a = a > 0.82 ? 0.82 : a
    }
  }
  if (ringA > 0.02) {
    const rr = ringR * span, pts = ring.pts
    for (let k = 0; k < ringU.length; k += 2) {
      pts[k] = s.cx + ringU[k] * rr
      pts[k + 1] = s.cy + ringU[k + 1] * rr
    }
    ring.a = ringA * 0.55
    ring.h = pal + 45
    ring.s = 86
    ring.l = 58
    ring.lw = Math.max(1, span * (0.003 + ringA * 0.004))
  } else ring.a = 0
  s = await frame(cells, {
    trail: 0.42 + calm * 0.28,
    zoom: 1.004 + pulse * 0.012,
    react: { punch: 0.35 + pulse * 0.5, sparkle: hat * 0.5, tint: 0.35 },
  })
}

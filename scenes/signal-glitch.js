// name: Signal glitch
// Style: glitch art by way of datamoshed signage and misregistered RGB print — a composition
// of geometric blocks and bars cut into horizontal strips. Psychoscript technique: a seeded
// mulberry32 PRNG picks every strip offset, kick block and scanline, so rewinds, beat-repeats
// and replays redraw exactly the same frames.
// Music: snareHit tears the strips sideways with seeded offsets, kick stretches one random
// block, hats add thin scanline noise rows, bass adds weight and sideways chaos, build raises
// the slice count, keyHue/note tint the three low-alpha RGB copies, calm quiets it and a drop
// widens the split. It never inverts or flashes the screen.
let s = await frame([])
const mulberry32 = (a) => () => {
  a = (a + 0x6D2B79F5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const R = mulberry32(0x51A6B10C)
const LAY = [
  [-0.42, -0.30, 0.10, 0.60, 14],
  [-0.30, -0.30, 0.20, 0.16, 5],
  [-0.30, -0.12, 0.20, 0.22, 6],
  [-0.30, 0.12, 0.20, 0.18, 5],
  [-0.08, -0.30, 0.18, 0.34, 9],
  [-0.08, 0.06, 0.18, 0.24, 6],
  [0.12, -0.30, 0.20, 0.18, 5],
  [0.12, -0.10, 0.20, 0.20, 5],
  [0.12, 0.12, 0.20, 0.18, 5],
  [0.34, -0.30, 0.08, 0.60, 14],
]
const bx = [], by = [], bw = [], bh = [], br = [], bo = [], bhu = []
for (let i = 0; i < LAY.length; i++) {
  const q = LAY[i]
  bx.push(q[0])
  by.push(q[1])
  bw.push(q[2])
  bh.push(q[3])
  br.push(q[4])
  bhu.push((R() * 2 - 1) * 24)
  const o = []
  for (let j = 0; j < 16; j++) o.push((R() * 2 - 1) * 0.008)
  bo.push(o)
}
const SN = 14
const sy = [], sx = [], sl = []
for (let i = 0; i < SN; i++) {
  sy.push(-0.38 + R() * 0.76)
  sx.push((R() * 2 - 1) * 0.12)
  sl.push(0.2 + R() * 0.7)
}
let stretchIdx = 0, stretch = 0, tear = 0
while (true) {
  const A = s.audio, dt = s.dt, out = []
  const S = Math.max(1, Math.min(s.w, s.h))
  const U = S / 800
  const calm = A.calm || 0
  const bass = A.bass || 0
  const kick = A.kick || 0
  const snare = A.snare || 0
  const hat = A.hat || 0
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 10 ? Math.max(0, 1 - toDrop / 10) : 0
  const charge = Math.max(build, near)
  const drop = A.dropAmt || 0
  const hue0 = (typeof A.keyHue === "number" ? A.keyHue : 192) + (A.note || 0) * 3
  if (A.kickHit) {
    stretchIdx = (R() * bx.length) | 0
    stretch = 1
  }
  if (A.snareHit || A.drop) {
    const mag = 0.02 + snare * 0.09 + drop * 0.07
    for (let i = 0; i < bo.length; i++) {
      const o = bo[i]
      for (let j = 0; j < 16; j++) o[j] = (R() * 2 - 1) * mag
    }
  }
  if (A.drop) tear = 1
  stretch *= Math.exp(-dt * 7)
  tear *= Math.exp(-dt * 2.2)
  const fade = Math.exp(-dt * 3)
  for (let i = 0; i < bo.length; i++) {
    const o = bo[i]
    for (let j = 0; j < 16; j++) o[j] *= fade
  }
  const sf = Math.max(0.65, Math.min(2.2, 1 + charge * 1.15 + tear * 0.5 - calm * 0.3))
  const mag = (1 + bass * 0.9 + charge * 0.5 + tear * 0.9) * (1 - calm * 0.55)
  const sep = (0.004 + snare * 0.012 + tear * 0.018 + drop * 0.008) * S
  const drift = s.t * (0.22 + calm * 0.03)
  for (let i = 0; i < bx.length; i++) {
    const rows = Math.max(2, Math.round(br[i] * sf))
    const rowH = bh[i] * S / rows
    const st = i === stretchIdx ? 1 + stretch * 0.55 : 1
    const hw = bw[i] * S * st * 0.5
    const xc = s.cx + (bx[i] + bw[i] * 0.5) * S
    const wob = Math.sin(drift + i * 1.7) * (0.003 + bass * 0.008) * S
    const baseH = hue0 + bhu[i] + Math.sin(drift * 0.7 + i * 0.8) * 7
    const o = bo[i]
    const top = s.cy + by[i] * S
    for (let j = 0; j < rows; j++) {
      const k = (j * 16 / rows) | 0
      const jag = Math.sin(i * 1.9 + j * 1.1 + bhu[i] * 0.05) * (0.002 + bass * 0.002) * S
      const dx = o[k] * mag * S + jag
      const y = top + j * rowH
      const g = Math.max(0.6, rowH * 0.8)
      for (let c = 0; c < 3; c++) {
        const x = xc + wob + dx + (c - 1) * sep
        out.push({ k: "p", close: true, fill: true,
          pts: [x - hw, y, x + hw, y, x + hw, y + g, x - hw, y + g],
          h: baseH + c * 120, s: 86, l: c === 1 ? 54 : 46,
          a: (c === 1 ? 0.3 : 0.23) * (1 - calm * 0.4) })
      }
    }
  }
  if (hat > 0.02) {
    const nScan = Math.min(SN, 3 + Math.floor(hat * 8 + charge * 4))
    const lw = Math.max(1, 1.6 * U)
    for (let i = 0; i < nScan; i++) {
      const yy = s.cy + sy[i] * S
      const half = sl[i] * S * (0.3 + hat * 0.6)
      out.push({ k: "l", x1: s.cx + sx[i] * S - half, y1: yy, x2: s.cx + sx[i] * S + half, y2: yy,
        h: hue0 + 150 + i * 3, s: 48, l: 62, a: (0.07 + hat * 0.26) * (1 - calm * 0.5), lw })
    }
  }
  s = await frame(out, {
    trail: 0.52 + calm * 0.16 + drop * 0.04,
    zoom: 1,
    spin: 0,
    hue: 0,
    react: { punch: 0.5 + kick * 0.5, slice: 0.8 + snare * 0.6, shake: 0.3 + tear * 0.7, tint: 0.4 + drop * 0.4 },
  })
}

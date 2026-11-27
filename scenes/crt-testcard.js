// name: Test card
// Style: retro CRT broadcast test card, after 1970s station clocks and convergence patterns:
// colour bars, a counting circle, a centre cross and a timing grid under phosphor scanlines.
// Psychoscript technique: bytes as pattern - "TRANCE".charCodeAt reads six bytes, and their 48 bits
// become the bars and gaps of the station-ID barcode strip below the call sign.
// A seeded mulberry32 PRNG places the tube dust, scanline jitter and tick lengths, so a rewind,
// beat-repeat or replay redraws exactly the same card.
// Reactions: kick wobbles the barrel, snare rolls the picture vertically with a damped spring, hats
// tick the seconds hand, bass thickens the tube, note lights a colour bar, keyHue tints the grid and
// ring, build/toDrop close the focus ring, calm slows the scan drift, drop zooms into the centre circle.
let s = await frame([])
const TAU = Math.PI * 2
const mulberry32 = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(0x54455354)
const WORD = "TRANCE"
const BITS = []
for (let i = 0; i < WORD.length; i++) {
  const by = WORD.charCodeAt(i) & 255
  for (let b = 7; b >= 0; b--) BITS.push((by >> b) & 1)
}
const NBITS = BITS.length
const COS = [], SIN = [], TICKL = []
for (let i = 0; i < 60; i++) {
  const a = (i / 60) * TAU
  COS.push(Math.cos(a))
  SIN.push(Math.sin(a))
  TICKL.push(0.8 + rnd() * 0.5)
}
const SPECKS = [], JIT = []
for (let i = 0; i < 16; i++) SPECKS.push({ x: rnd() * 2 - 1, y: rnd() * 2 - 1, r: 0.25 + rnd() * 0.8, a: 0.08 + rnd() * 0.22, p: rnd() * TAU })
for (let i = 0; i < 30; i++) JIT.push(0.45 + rnd() * 0.55)
const BH = [0, 52, 178, 120, 300, 0, 222]
const BS = [0, 82, 70, 62, 55, 82, 72]
const BL = [56, 56, 50, 48, 50, 50, 48]
const cam = { cx: 0, cy: 0, hw: 1, hh: 1, k: 0, z: 1, roll: 0 }
const wx = (x, y) => {
  const nx = (x - cam.cx) / cam.hw, ny = (y - cam.cy) / cam.hh
  return cam.cx + (x - cam.cx) * cam.z * (1 + cam.k * (nx * nx + ny * ny))
}
const wy = (x, y) => {
  const nx = (x - cam.cx) / cam.hw, ny = (y - cam.cy) / cam.hh
  return cam.cy + (y - cam.cy) * cam.z * (1 + cam.k * (nx * nx + ny * ny)) + cam.roll
}
const wpt = (a, x, y) => {
  const nx = (x - cam.cx) / cam.hw, ny = (y - cam.cy) / cam.hh
  const f = cam.z * (1 + cam.k * (nx * nx + ny * ny))
  a.push(cam.cx + (x - cam.cx) * f, cam.cy + (y - cam.cy) * f + cam.roll)
}
let hand = 0, handT = 0, roll = 0, rollV = 0, rollDir = 1, dropP = 0
while (true) {
  const A = s.audio, dt = s.dt || 1 / 60, out = []
  const S = Math.min(s.w, s.h), U = S / 800
  const hw = Math.max(1, S * 0.45), hh = Math.max(1, S * 0.3275)
  const cx = s.cx, cy = s.cy
  const CW = hw * 2, CH = hh * 2
  const top = cy - hh, bottom = cy + hh, left = cx - hw, right = cx + hw
  const calm = A.calm || 0, kick = A.kick || 0, bass = A.bass || 0
  const high = A.high || 0
  const hue0 = typeof A.keyHue === "number" ? A.keyHue : 160
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 8 ? Math.max(0, 1 - toDrop / 8) : 0
  const tension = Math.max(build, near)
  if (A.drop) dropP = 1
  dropP *= Math.exp(-dt * 1.35)
  const dropAmt = Math.max(A.dropAmt || 0, dropP)
  cam.cx = cx
  cam.cy = cy
  cam.hw = hw
  cam.hh = hh
  cam.k = 0.008 + kick * kick * 0.05 + tension * 0.004
  cam.z = 1 + dropAmt * 1.55
  if (A.snareHit) {
    rollDir = -rollDir
    rollV += rollDir * S * 0.22
  }
  rollV += (-roll * 120 - rollV * 11) * dt
  roll += rollV * dt
  cam.roll = roll
  const rx = S * 0.018
  const bez = []
  const bp = [[left + rx, top], [right - rx, top], [right, top + rx], [right, bottom - rx],
    [right - rx, bottom], [left + rx, bottom], [left, bottom - rx], [left, top + rx]]
  for (let i = 0; i < bp.length; i++) wpt(bez, bp[i][0], bp[i][1])
  out.push({ k: "p", pts: bez, close: true, fill: true, h: hue0 + 10, s: 30, l: 9, a: 0.5 })
  for (let i = 0; i < 9; i++) {
    const x = left + CW * (0.07 + i * 0.086), pts = []
    for (let j = 0; j <= 4; j++) wpt(pts, x, top + CH * (0.04 + j * 0.23))
    out.push({ k: "p", pts, h: hue0 + 30, s: 35, l: 32, a: 0.16, lw: 0.8 * U })
  }
  for (let i = 0; i < 7; i++) {
    const y = top + CH * (0.06 + i * 0.14), pts = []
    for (let j = 0; j <= 4; j++) wpt(pts, left + CW * (0.02 + j * 0.24), y)
    out.push({ k: "p", pts, h: hue0 + 30, s: 35, l: 32, a: 0.16, lw: 0.8 * U })
  }
  const bwArea = CW * 0.82, bw = bwArea / 7, bh = S * 0.105
  const by0 = top + S * 0.045
  const note = typeof A.note === "number" ? Math.floor(A.note) : 0
  for (let i = 0; i < 7; i++) {
    const x0 = cx - bwArea / 2 + i * bw + bw * 0.04, x1 = x0 + bw * 0.92
    const y1 = by0 + bh, pts = []
    wpt(pts, x0, by0)
    wpt(pts, (x0 + x1) / 2, by0)
    wpt(pts, x1, by0)
    wpt(pts, x1, y1)
    wpt(pts, (x0 + x1) / 2, y1)
    wpt(pts, x0, y1)
    const hot = i === ((note % 7) + 7) % 7
    out.push({ k: "p", pts, close: true, fill: true, h: BH[i], s: BS[i],
      l: hot ? Math.min(60, BL[i] + 5) : BL[i], a: hot ? 0.64 : 0.5 })
  }
  out.push({ k: "l", x1: wx(cx - bwArea / 2, by0 + bh), y1: wy(cx - bwArea / 2, by0 + bh),
    x2: wx(cx + bwArea / 2, by0 + bh), y2: wy(cx + bwArea / 2, by0 + bh), h: hue0, s: 25, l: 56, a: 0.55, lw: 1 * U })
  const R = S * (0.155 + bass * 0.006) * (1 - tension * 0.06)
  for (let ring = 0; ring < 2; ring++) {
    const rr = R * (ring ? 0.8 : 1), pts = []
    for (let i = 0; i < 60; i++) wpt(pts, cx + COS[i] * rr, cy + SIN[i] * rr)
    out.push({ k: "p", pts, close: true, h: ring ? hue0 + 30 : hue0, s: 70,
      l: ring ? 40 : 54, a: ring ? 0.5 : 0.8, lw: (1 + ring * 0.2 + bass * 1.4) * U })
  }
  if (dropAmt > 0.02) {
    const pts = []
    for (let i = 0; i < 60; i++) wpt(pts, cx + COS[i] * R * 1.16, cy + SIN[i] * R * 1.16)
    out.push({ k: "p", pts, close: true, h: hue0 + 20, s: 70, l: 58, a: dropAmt * 0.55, lw: 1.6 * U })
  }
  for (let i = 0; i < 60; i++) {
    const long = i % 5 === 0
    const r1 = R * 1.05, r2 = R * (1.05 + (long ? 0.1 : 0.055) * TICKL[i])
    const x1 = cx + COS[i] * r1, y1 = cy + SIN[i] * r1
    const x2 = cx + COS[i] * r2, y2 = cy + SIN[i] * r2
    out.push({ k: "l", x1: wx(x1, y1), y1: wy(x1, y1), x2: wx(x2, y2), y2: wy(x2, y2),
      h: hue0 + 40, s: 50, l: long ? 54 : 38, a: long ? 0.65 : 0.35, lw: (long ? 1.1 : 0.7) * U })
  }
  const arm = R * 1.32
  out.push({ k: "l", x1: wx(cx - arm, cy), y1: wy(cx - arm, cy), x2: wx(cx + arm, cy), y2: wy(cx + arm, cy),
    h: hue0, s: 55, l: 48, a: 0.45, lw: 0.9 * U })
  out.push({ k: "l", x1: wx(cx, cy - arm), y1: wy(cx, cy - arm), x2: wx(cx, cy + arm), y2: wy(cx, cy + arm),
    h: hue0, s: 55, l: 48, a: 0.45, lw: 0.9 * U })
  if (A.hatHit) {
    handT += TAU / 60
    if (handT > TAU) handT -= TAU
  }
  let hd = ((handT - hand + TAU * 1.5) % TAU) - TAU * 0.5
  hand += hd * Math.min(1, dt * 14)
  const ha = hand - Math.PI / 2
  const tipX = cx + Math.cos(ha) * R * 0.82, tipY = cy + Math.sin(ha) * R * 0.82
  const backX = cx - Math.cos(ha) * R * 0.16, backY = cy - Math.sin(ha) * R * 0.16
  out.push({ k: "l", x1: wx(backX, backY), y1: wy(backX, backY), x2: wx(tipX, tipY), y2: wy(tipX, tipY),
    h: 38, s: 82, l: 56, a: 0.92, lw: 2.4 * U })
  out.push({ k: "c", x: wx(tipX, tipY), y: wy(tipX, tipY), r: (2.2 + bass * 1.5) * U, h: 38, s: 85, l: 58, a: 0.9 })
  out.push({ k: "c", x: wx(cx, cy), y: wy(cx, cy), r: (2.6 + kick * 1.6) * U, h: 38, s: 80, l: 58, a: 0.9 })
  const ty = bottom - S * 0.115
  out.push({ k: "t", text: WORD, x: wx(cx, ty), y: wy(cx, ty), size: S * 0.052, h: hue0 + 10, s: 45, l: 60, a: 0.88 })
  out.push({ k: "t", text: "TEST CARD", x: wx(left + CW * 0.075, ty + S * 0.002),
    y: wy(left + CW * 0.075, ty + S * 0.002), size: S * 0.017, h: hue0 + 30, s: 30, l: 46, a: 0.6 })
  const bcW = CW * 0.54, bx0 = cx - bcW / 2, bitW = bcW / NBITS
  const bcY = bottom - S * 0.075, bcH = S * 0.032
  out.push({ k: "l", x1: wx(bx0, bcY + bcH), y1: wy(bx0, bcY + bcH),
    x2: wx(bx0 + bcW, bcY + bcH), y2: wy(bx0 + bcW, bcY + bcH), h: hue0, s: 25, l: 42, a: 0.38, lw: 0.8 * U })
  for (let i = 0; i < NBITS; i++) {
    if (!BITS[i]) {
      if (i % 2 === 0) {
        const x = bx0 + i * bitW + bitW * 0.35
        out.push({ k: "l", x1: wx(x, bcY + bcH * 0.55), y1: wy(x, bcY + bcH * 0.55),
          x2: wx(x, bcY + bcH), y2: wy(x, bcY + bcH), h: hue0, s: 35, l: 36, a: 0.28, lw: 0.6 * U })
      }
      continue
    }
    const x0 = bx0 + i * bitW + bitW * 0.14, x1 = x0 + bitW * 0.72, pts = []
    wpt(pts, x0, bcY)
    wpt(pts, x1, bcY)
    wpt(pts, x1, bcY + bcH)
    wpt(pts, x0, bcY + bcH)
    out.push({ k: "p", pts, close: true, fill: true, h: hue0, s: 20, l: 58, a: 0.78 })
  }
  for (let i = 0; i < SPECKS.length; i++) {
    const p = SPECKS[i]
    const sx = cx + p.x * hw * 0.8 + Math.sin(s.t * 0.2 + p.p) * 2 * U
    const sy = cy + p.y * hh * 0.8
    out.push({ k: "c", x: wx(sx, sy), y: wy(sx, sy), r: p.r * U, h: hue0 + 50, s: 40, l: 50, a: p.a })
  }
  const drift = (s.t * (0.025 + (1 - calm) * 0.035)) % 1
  for (let i = 0; i < 30; i++) {
    const f = (i / 30 + drift) % 1
    const y = top + CH * (0.02 + f * 0.96), pts = []
    for (let j = 0; j <= 4; j++) wpt(pts, left + CW * (0.015 + j * 0.2425), y)
    out.push({ k: "p", pts, h: hue0 + 20, s: 30, l: 44, a: 0.07 + high * 0.06 + (JIT[i] - 0.45) * 0.03, lw: 0.7 * U })
  }
  const bd = []
  for (let i = 0; i < bp.length; i++) wpt(bd, bp[i][0], bp[i][1])
  out.push({ k: "p", pts: bd, close: true, h: hue0, s: 45, l: 46, a: 0.7, lw: 1.2 * U })
  s = await frame(out, {
    trail: 0.62 + calm * 0.14 - dropAmt * 0.2,
    zoom: 1 + kick * 0.006 + dropAmt * 0.01,
    spin: 0,
    hue: 0.4,
  })
}

// name: Interruptions
// Style: generative op-art after Vera Molnar's "Interruptions" (1968-69): a grid of
// short strokes whose angles and gaps are seeded, with rectangular patches wiped out
// and restored so the order keeps breaking. It is a one-bar insert, no phases.
// Psychoscript technique: a seeded mulberry32 PRNG (Math.imul) fixes every stroke's
// angle, length, width and gap at start-up, and each beat's patch is re-derived from
// the beat counter, so a rewind, beat repeat or replay redraws exactly the same grid.
// The 728 line shapes are pooled once and rewritten in place, each stroke recomputed
// on alternate frames while visibility still follows every beat.
// Reactions: kickHit and bass roughen the angles, snareHit punches a rectangular hole,
// hats twitch seeded strokes, keyHue colours them, calm thins and cools the grid,
// build/toDrop gather it slightly, and the drop snaps every line upright before the
// disorder returns. Downbeats add a short width-and-scale pulse on the first frame.
let s = await frame([])
const COLS = 26, ROWS = 28, N = COLS * ROWS, ASPECT = 1.08
const mulberry32 = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hsh = (i) => (Math.imul((i | 0) ^ 0x27d4eb2f, 0x85ebca6b) >>> 0)
const rnd = mulberry32(0x1a2b3c4d)
const nx = [], ny = [], lx = [], ly = [], ln = [], gap = [], hj11 = [], sw = [], rank = [], l9 = []
const resB = [], hidB = [], pRest = [], inSn = []
const lines = [], out = []
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c
    nx.push((c + 0.5) / COLS)
    ny.push((r + 0.5) / ROWS)
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.7
    const len = 0.72 + rnd() * 0.52
    lx.push(Math.cos(a) * len)
    ly.push((Math.sin(a) + 1) * len)
    ln.push(len)
    gap.push(rnd() < 0.09)
    const hj = (rnd() - 0.5) * 26
    sw.push(0.8 + rnd() * 0.5)
    rank.push(rnd())
    l9.push(i % 9 === 0 ? 5 : 0)
    hj11.push(hj + (i % 11 === 0 ? 8 : 0))
    resB.push(0); hidB.push(0); pRest.push(0); inSn.push(0)
    lines.push({ k: "l", x1: 0, y1: 0, x2: 0, y2: 0, h: 0, s: 52, l: 50, a: 0, lw: 1 })
  }
}
const patches = [{ x: 0, y: 0, w: 0, h: 0, m: 0 }, { x: 0, y: 0, w: 0, h: 0, m: 0 }, { x: 0, y: 0, w: 0, h: 0, m: 0 }]
let pBeat = -99999, sNum = -1, hNum = -1
const hole = { x: 0, y: 0, w: 0, h: 0 }
const HOTN = 5
const hotMark = new Array(N).fill(0), hotScale = new Array(N).fill(1)
let hotTok = 0
const setPatch = (p, seed) => {
  const rr = mulberry32(seed)
  p.x = 0.03 + rr() * 0.57
  p.y = 0.03 + rr() * 0.62
  p.w = 0.15 + rr() * 0.25
  p.h = 0.14 + rr() * 0.25
  p.m = rr() < 0.6 ? 1 : 0
}
const fx = { trail: 0.1, zoom: 1, spin: 0, hue: 0, blend: "source-over" }
let disorder = 0.42, remap = true, lastSat = -1, warm = false
while (true) {
  const A = s.audio, dt = Math.min(0.05, s.dt || 0.016)
  const span = Math.max(1, Math.min(s.w || 1, s.h || 1)), U = span / 800
  const kick = A.kick || 0, bass = A.bass || 0, calm = A.calm || 0
  const hat = A.hat || 0, snare = A.snare || 0, dropAmt = A.dropAmt || 0
  const energy = A.energy || 0, bright = A.bright || 0
  const hue0 = typeof A.keyHue === "number" ? A.keyHue : 205
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 10 ? Math.max(0, 1 - toDrop / 10) : 0
  const gather = Math.max(build, near) * (1 - Math.min(1, dropAmt * 1.5))
  if (A.kickHit) disorder = Math.min(1, disorder + 0.32 + bass * 0.22)
  const base = 0.26 + bass * 0.3 - calm * 0.16
  disorder += (base - disorder) * Math.min(1, dt * (2.4 + calm * 2))
  if (A.drop) disorder = 0
  const dis = Math.max(0, disorder * (1 - Math.min(1, dropAmt * 1.6)))
  const beat = typeof A.beats === "number" ? A.beats | 0 : 0
  if (beat !== pBeat) {
    pBeat = beat
    for (let k = 0; k < 3; k++) setPatch(patches[k], hsh(beat - k))
    remap = true
  }
  const sn = typeof A.snares === "number" ? A.snares | 0 : 0
  if (sn !== sNum) {
    sNum = sn
    const rr = mulberry32(hsh(sn) ^ 0x5bd1e995)
    hole.x = 0.06 + rr() * 0.56
    hole.y = 0.05 + rr() * 0.6
    hole.w = 0.12 + rr() * 0.2
    hole.h = 0.1 + rr() * 0.22
    remap = true
  }
  const hn = typeof A.hats === "number" ? A.hats | 0 : 0
  if (hn !== hNum) {
    hNum = hn
    const rr = mulberry32(hsh(hn) ^ 0x9e3779b9)
    hotTok++
    for (let k = 0; k < HOTN; k++) {
      const idx = (rr() * N) | 0
      hotMark[idx] = hotTok
      hotScale[idx] = 0.6 + rr() * 0.8
    }
  }
  const tw = hat > 0.05 ? 0.25 + hat * 0.85 : 0
  const tc = Math.cos(tw), ts = Math.sin(tw)
  const twOn = tw > 0.05
  const snareOn = snare > 0.16
  const holeStr = snareOn ? 0.55 + snare * 0.45 : 0
  const hx0 = hole.x, hy0 = hole.y, hx1 = hole.x + hole.w, hy1 = hole.y + hole.h
  const p0 = patches[0], p1 = patches[1], p2 = patches[2]
  const p0x = p0.x, p0y = p0.y, p0x2 = p0.x + p0.w, p0y2 = p0.y + p0.h, p0m = p0.m
  const p1x = p1.x, p1y = p1.y, p1x2 = p1.x + p1.w, p1y2 = p1.y + p1.h, p1m = p1.m
  const p2x = p2.x, p2y = p2.y, p2x2 = p2.x + p2.w, p2y2 = p2.y + p2.h, p2m = p2.m
  if (remap) {
    remap = false
    for (let i = 0; i < N; i++) {
      const x = nx[i], y = ny[i]
      let hS = 0, rS = 0
      if (x > p0x && x < p0x2 && y > p0y && y < p0y2) { if (p0m) hS = 1; else rS = 1 }
      if (x > p1x && x < p1x2 && y > p1y && y < p1y2) {
        if (p1m) { if (hS < 0.73) hS = 0.73 } else if (rS < 0.73) rS = 0.73
      }
      if (x > p2x && x < p2x2 && y > p2y && y < p2y2) {
        if (p2m) { if (hS < 0.46) hS = 0.46 } else if (rS < 0.46) rS = 0.46
      }
      const rb = rS > hS ? 1 : 0
      resB[i] = rb
      hidB[i] = !rb && (hS > 0.01 || gap[i]) ? 1 : 0
      pRest[i] = rS
      inSn[i] = x > hx0 && x < hx1 && y > hy0 && y < hy1 ? 1 : 0
    }
  }
  const barP = typeof A.barPhase === "number" ? A.barPhase : 0
  const pulse = Math.exp(-barP * 5)
  const db = A.downbeat ? 1 : 0
  const GW = Math.min(span * (0.86 - gather * 0.05), Math.max(1, (s.h || 1) * 0.9) / ASPECT)
  const GH = GW * ASPECT
  const ox = s.cx - GW / 2, oy = s.cy - GH / 2
  const ch = GH / ROWS
  const lenScale = ch * 0.48 * (1 + kick * 0.18 + bass * 0.1) * (1 + pulse * 0.03 + db * 0.05)
  const lw0 = (1 + bass * 1.3 + energy * 0.5 + db * 0.6) * U * (1 - calm * 0.16)
  const sat = 52 - calm * 18
  const dens = 1 - calm * 0.35
  const disL = dis * lenScale
  const lB = 50 + bright * 7 - calm * 9 + pulse * 2
  const aB = 0.5 + energy * 0.18
  if (sat !== lastSat) {
    lastSat = sat
    for (let i = 0; i < N; i++) lines[i].s = sat
  }
  const parity = s.frame & 1
  let m = 0
  for (let i = 0; i < N; i++) {
    if (rank[i] > dens) continue
    let restored = resB[i]
    if (snareOn && inSn[i]) {
      if (pRest[i] > holeStr) restored = 1
      else continue
    } else if (hidB[i]) continue
    const o = lines[i]
    if (!warm || (i & 1) === parity) {
      let hx = disL * lx[i]
      let hy = disL * ly[i] - ln[i] * lenScale
      let lw = lw0 * sw[i]
      if (twOn && hotMark[i] === hotTok) {
        const sc = hotScale[i]
        const rx = (hx * tc - hy * ts) * sc
        hy = (hx * ts + hy * tc) * sc
        hx = rx
        lw *= 1.8
      }
      const px = ox + nx[i] * GW, py = oy + ny[i] * GH
      let li = lB + l9[i]
      let al = aB
      let hb = hue0 + hj11[i]
      if (restored) { li += 5; al += 0.08; hb += 16 }
      if (li > 64) li = 64
      if (al > 0.85) al = 0.85
      o.x1 = px - hx; o.y1 = py - hy; o.x2 = px + hx; o.y2 = py + hy
      o.h = hb
      o.l = li
      o.a = al
      o.lw = lw
    }
    out[m] = o
    m++
  }
  out.length = m
  warm = true
  fx.trail = 0.08 + calm * 0.12
  fx.zoom = 1 + kick * 0.012 + db * 0.006
  s = await frame(out, fx)
}

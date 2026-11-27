// name: Interruptions
// Style: generative op-art after Vera Molnar's "Interruptions" (1968-69): a grid of
// short strokes whose angles and gaps are seeded, with rectangular patches wiped out
// and restored so the order keeps breaking. It is a one-bar insert, no phases.
// Psychoscript technique: a seeded mulberry32 PRNG (Math.imul) fixes every stroke's
// angle, length, width and gap at start-up, and each beat's patch is re-derived from
// the beat counter, so a rewind, beat repeat or replay redraws exactly the same grid.
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
const nx = [], ny = [], lx = [], ly = [], ln = [], gap = [], hj = [], sw = [], rank = []
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    nx.push((c + 0.5) / COLS)
    ny.push((r + 0.5) / ROWS)
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.7
    const len = 0.72 + rnd() * 0.52
    lx.push(Math.cos(a) * len)
    ly.push((Math.sin(a) + 1) * len)
    ln.push(len)
    gap.push(rnd() < 0.09)
    hj.push((rnd() - 0.5) * 26)
    sw.push(0.8 + rnd() * 0.5)
    rank.push(rnd())
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
let disorder = 0.42
while (true) {
  const A = s.audio, out = [], dt = Math.min(0.05, s.dt || 0.016)
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
  }
  const sn = typeof A.snares === "number" ? A.snares | 0 : 0
  if (sn !== sNum) {
    sNum = sn
    const rr = mulberry32(hsh(sn) ^ 0x5bd1e995)
    hole.x = 0.06 + rr() * 0.56
    hole.y = 0.05 + rr() * 0.6
    hole.w = 0.12 + rr() * 0.2
    hole.h = 0.1 + rr() * 0.22
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
  const snareOn = snare > 0.16
  const holeStr = snareOn ? 0.55 + snare * 0.45 : 0
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
  for (let i = 0; i < N; i++) {
    if (rank[i] > dens) continue
    const x = nx[i], y = ny[i]
    let holeS = 0, restS = 0
    for (let k = 0; k < 3; k++) {
      const p = patches[k]
      if (x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) {
        const wgt = 1 - k * 0.27
        if (p.m) { if (wgt > holeS) holeS = wgt } else if (wgt > restS) restS = wgt
      }
    }
    if (snareOn && x > hole.x && x < hole.x + hole.w && y > hole.y && y < hole.y + hole.h) holeS = holeStr
    const restored = restS > holeS
    if (!restored) {
      if (holeS > 0.01 || gap[i]) continue
    }
    let hx = dis * lx[i] * lenScale
    let hy = (dis * ly[i] - ln[i]) * lenScale
    let lw = lw0 * sw[i]
    if (tw > 0.05 && hotMark[i] === hotTok) {
      const sc = hotScale[i]
      const rx = (hx * tc - hy * ts) * sc
      hy = (hx * ts + hy * tc) * sc
      hx = rx
      lw *= 1.8
    }
    const px = ox + x * GW, py = oy + y * GH
    const li = Math.min(64, 50 + bright * 7 + (i % 9 === 0 ? 5 : 0) - calm * 9 + (restored ? 5 : 0) + pulse * 2)
    out.push({
      k: "l", x1: px - hx, y1: py - hy, x2: px + hx, y2: py + hy,
      h: hue0 + hj[i] + (restored ? 16 : 0) + (i % 11 === 0 ? 8 : 0),
      s: sat, l: li, a: Math.min(0.85, 0.5 + energy * 0.18 + (restored ? 0.08 : 0)),
      lw: lw,
    })
  }
  s = await frame(out, {
    trail: 0.08 + calm * 0.12,
    zoom: 1 + kick * 0.012 + db * 0.006,
    spin: 0,
    hue: 0,
    blend: "source-over",
  })
}

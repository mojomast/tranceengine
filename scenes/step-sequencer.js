// name: Step sequencer
// Style: psychoscript-native hardware sequencer, inspired by tracker readouts and sixteen-pad
//   drum machines: a bare 16x4 grid, a moving playhead, and nothing else.
// Technique: the async generator `sequencer()` yields the playhead step from A.barPhase and the
//   main loop consumes it with `for await`, drawing one frame per yield.
// Reactions: kick -> lane 1 pad and a playhead pulse, snare -> lane 2 pad, hat -> lane 3 pad,
//   bass -> lane 4 weight; keyHue paints the lanes, barPhase drives the playhead, build/toDrop
//   tighten the grid, calm softens and lengthens the glow, dropAmt lifts only the rails and beam;
//   pad cells fade over two bars.
let s = await frame([])
const TAU = Math.PI * 2
const COLS = 16, ROWS = 4, CELLS = COLS * ROWS
const mulberry32 = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(0x51e9c0de)
const cells = [], seeds = [], rad = []
for (let i = 0; i < CELLS; i++) {
  cells.push(rnd() < 0.2 ? 0.1 + rnd() * 0.16 : 0)
  seeds.push(rnd() * TAU)
  rad.push(0.84 + rnd() * 0.3)
}
const xs = [], ys = [], hues = [0, 0, 0, 0]
for (let c = 0; c < COLS; c++) xs.push(0)
for (let r = 0; r < ROWS; r++) ys.push(0)
let lastW = 0, lastH = 0, cellW = 8, rowH = 10, baseR = 3, span = 100, U = 1
const place = () => {
  span = Math.min(s.w, s.h)
  U = span / 800
  cellW = span * 0.8 / COLS
  rowH = cellW * 1.25
  baseR = Math.min(cellW, rowH) * 0.3
  const x0 = s.cx - cellW * COLS * 0.5
  const y0 = s.cy - rowH * ROWS * 0.5
  for (let c = 0; c < COLS; c++) xs[c] = x0 + cellW * (c + 0.5)
  for (let r = 0; r < ROWS; r++) ys[r] = y0 + rowH * (r + 0.5)
  lastW = s.w
  lastH = s.h
}
async function* sequencer() {
  while (true) {
    const A = s.audio
    let p = typeof A.barPhase === "number" ? A.barPhase : 0
    p = p - Math.floor(p)
    if (!(p >= 0)) p = 0
    yield Math.min(COLS - 1, Math.floor(p * COLS))
  }
}
let prevStep = -1
for await (const step of sequencer()) {
  const A = s.audio, out = []
  if (s.w !== lastW || s.h !== lastH) place()
  const dt = s.dt > 0 ? s.dt : 1 / 60
  const calm = A.calm || 0
  const bass = A.bass || 0
  const kick = A.kick || 0
  const dropAmt = A.dropAmt || 0
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 8 ? Math.max(0, 1 - toDrop / 8) : 0
  const tension = Math.max(build, near)
  const bpm = A.bpm > 20 ? A.bpm : 120
  const decay = dt * bpm / 480
  const kh = typeof A.keyHue === "number" ? A.keyHue : 200
  hues[0] = kh
  hues[1] = kh + 55
  hues[2] = kh + 140
  hues[3] = kh + 235
  if (A.kickHit) cells[step] = 1
  if (A.snareHit) cells[COLS + step] = 1
  if (A.hatHit) cells[COLS * 2 + step] = 1
  if (step !== prevStep && bass > 0.4) cells[COLS * 3 + step] = Math.max(cells[COLS * 3 + step], 0.5 + bass * 0.5)
  prevStep = step
  for (let i = 0; i < CELLS; i++) {
    const v = cells[i] - decay
    cells[i] = v > 0 ? v : 0
  }
  const tight = 1 - tension * 0.06
  const left = s.cx + (xs[0] - cellW * 0.5 - s.cx) * tight
  const right = s.cx + (xs[COLS - 1] + cellW * 0.5 - s.cx) * tight
  const top = s.cy + (ys[0] - rowH * 0.5 - s.cy) * tight
  const bottom = s.cy + (ys[ROWS - 1] + rowH * 0.5 - s.cy) * tight
  const railA = 0.16 + bass * 0.18 + tension * 0.14 + dropAmt * 0.22
  const xBase = xs[0] - cellW * 0.5
  const yBase = ys[0] - rowH * 0.5
  for (let i = 0; i <= 4; i++) {
    const x = s.cx + (xBase + cellW * 4 * i - s.cx) * tight
    out.push({ k: "l", x1: x, y1: top, x2: x, y2: bottom, h: kh + i * 9, s: 55,
      l: 38 + dropAmt * 12, a: i === 0 || i === 4 ? railA : railA * 0.55,
      lw: (i === 0 || i === 4 ? 1.2 : 0.7) * U })
  }
  for (let i = 0; i <= ROWS; i++) {
    const y = s.cy + (yBase + rowH * i - s.cy) * tight
    out.push({ k: "l", x1: left, y1: y, x2: right, y2: y, h: kh + 20 + i * 25, s: 50,
      l: 36 + dropAmt * 10, a: railA * (i === 0 || i === 4 ? 1 : 0.6), lw: U })
  }
  const px = s.cx + (xs[step] - s.cx) * tight
  const pw = cellW * tight * 0.84
  out.push({ k: "p", pts: [px - pw * 0.5, top, px + pw * 0.5, top,
    px + pw * 0.5, bottom, px - pw * 0.5, bottom], fill: true, close: true,
    h: kh + 30, s: 85, l: 30 + tension * 8 + dropAmt * 10,
    a: 0.07 + bass * 0.05 + dropAmt * 0.05 })
  out.push({ k: "l", x1: px, y1: top - 4 * U, x2: px, y2: bottom + 4 * U, h: kh + 40,
    s: 90, l: 58, a: 0.3 + kick * 0.25 + dropAmt * 0.2, lw: (1.4 + kick * 1.2) * U })
  for (let r = 0; r < ROWS; r++) {
    const y = s.cy + (ys[r] - s.cy) * tight
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c
      const v = cells[i]
      const x = s.cx + (xs[c] - s.cx) * tight
      const tw = 0.5 + 0.5 * Math.sin(s.t * (1.3 + calm * 0.7) + seeds[i])
      const rr = baseR * rad[i] * (0.9 + tw * 0.12 + v * 0.55) * tight
      const hue = hues[r] + (c % 4) * 4
      const lit = v > 0.03
      out.push({ k: "c", x, y, r: rr, h: hue, s: 70 + v * 20, fill: lit,
        l: lit ? 46 + v * 16 : 32 + tw * 6, lw: U,
        a: lit ? 0.28 + v * 0.62 : 0.14 + tw * 0.1 })
      if (v > 0.32) out.push({ k: "c", x, y, r: rr * (1.5 + v * 0.5), fill: false,
        h: hue + 8, s: 60, l: 58, a: 0.12 + v * 0.3, lw: 1.1 * U })
    }
  }
  for (let r = 0; r < ROWS; r++) {
    const y = s.cy + (ys[r] - s.cy) * tight
    out.push({ k: "c", x: px, y, r: baseR * 1.5 * tight, fill: false, h: hues[r] + 10,
      s: 85, l: 60, a: 0.35 + kick * 0.2, lw: 1.2 * U })
  }
  out.push({ k: "t", text: "STEP " + (step < 9 ? "0" : "") + (step + 1) + "/16",
    x: s.cx, y: top - 22 * U, size: 16 * U, h: kh + 25, s: 75, l: 58, a: 0.65 })
  s = await frame(out, {
    trail: 0.66 + calm * 0.16,
    zoom: 1.002 + kick * 0.008 + dropAmt * 0.004,
    spin: 0,
    hue: 0.2 + (A.high || 0) * 0.3,
  })
}

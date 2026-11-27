// name: Rule 30 loom
// Style: elementary cellular automata as woven textile, after Wolfram's Rule 30 rugs and Jacquard punch cards.
// Technique: Psychoscript BigInt bitboards. Each row of 64 cells is one BigInt word; the next row is
//   produced with shifts plus AND/OR/XOR, so one whole row evolves per handful of operations. The draw loop
//   reads cached 32-bit halves of each row, visits only the set bits (ctz via Math.clz32), and writes into a
//   reused pool of quad objects, so a steady frame allocates nothing.
// Music: snareHit swaps the weave between rules 30, 90, 110 and 150; kickHit punches a seeded bit into
//   the warp; hats glint; bass widens the cloth; keyHue and bands tint the weft; calm slows and thins it;
//   build/toDrop tighten the weave and a drop throws a bright seed row. Zero/99 map values fall back safely.
let s = await frame([])
const W = 64, ROWS = 14
const MASK = (1n << 64n) - 1n
const RULES = [30, 90, 110, 150]
let rule = 30, ruleIdx = 0
let seed = 0x9e3779b9 >>> 0
const rnd = () => {
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const evolve = (x) => {
  const l = (x << 1n) & MASK, r = x >> 1n
  if (rule === 30) return (l ^ (x | r)) & MASK
  if (rule === 90) return (l ^ r) & MASK
  if (rule === 110) {
    const nl = MASK ^ l, nc = MASK ^ x, nr = MASK ^ r
    return ((nl & x) | (nl & r) | (x & nr) | (l & nc & r)) & MASK
  }
  return (l ^ x ^ r) & MASK
}
const bandOf = []
for (let c = 0; c < W; c++) bandOf.push(Math.floor(c * 32 / W) % 32)
let first = 0n
for (let i = 0; i < 10; i++) first |= 1n << BigInt(4 + i * 6)
first |= 1n << BigInt(Math.floor(rnd() * W))
const rows = [], rowCols = []
let state = first
for (let i = 0; i < ROWS; i++) { rows.push(state); state = evolve(state) }
for (let i = 0; i < ROWS; i++) rowCols.push([])
// Column cache: the ascending set-bit columns of each row slot, rebuilt only when the row's bits change,
// so the per-frame draw loop just walks plain arrays.
const syncRow = (i) => {
  const r = rows[i]
  const cols = rowCols[i]
  cols.length = 0
  let b = Number(r & 0xffffffffn)
  while (b !== 0) { cols.push(31 - Math.clz32(b & -b)); b &= b - 1 }
  b = Number((r >> 32n) & 0xffffffffn)
  while (b !== 0) { cols.push(63 - Math.clz32(b & -b)); b &= b - 1 }
}
for (let i = 0; i < ROWS; i++) syncRow(i)
let head = 0, acc = 0, dropGlow = 0
const glints = []
for (let i = 0; i < 12; i++) glints.push({ on: false, x: 0, y: 0, v: 0, life: 0, o: { k: "c", x: 0, y: 0, r: 1, h: 0, s: 82, l: 62, a: 0 } })
let gi = 0
const quads = [], out = [], xL = [], xR = []
for (let i = 0; i < ROWS * W; i++) quads.push({ k: "p", pts: [0, 0, 0, 0, 0, 0, 0, 0], fill: true, close: true, h: 0, s: 76, l: 40, a: 0.5 })
for (let i = 0; i < W; i++) { xL.push(0); xR.push(0) }
const fx = { trail: 0.54, zoom: 1.003, hue: 0.7, mirror: 0 }
while (true) {
  const A = s.audio, dt = s.dt
  const span = Math.min(s.w, s.h), U = span / 800
  const calm = A.calm || 0
  const bass = A.bass || 0
  const kick = A.kick || 0
  const snare = A.snare || 0
  const hat = A.hat || 0
  const level = A.level || 0
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 12 ? Math.max(0, 1 - toDrop / 12) : 0
  const tension = Math.max(build, near) * (1 - Math.min(1, (A.dropAmt || 0) * 1.5))
  const hue0 = typeof A.keyHue === "number" ? A.keyHue : 205
  const bands = A.bands || []
  const bandsOk = bands.length >= 32
  const newest = (head + ROWS - 1) % ROWS
  if (A.snareHit) { ruleIdx = (ruleIdx + 1) % RULES.length; rule = RULES[ruleIdx] }
  if (A.kickHit) {
    const p = Math.floor(rnd() * W)
    rows[newest] = rows[newest] ^ (1n << BigInt(p))
    syncRow(newest)
  }
  if (A.drop) {
    rows[newest] = MASK
    syncRow(newest)
    dropGlow = 1
  }
  dropGlow = Math.max(0, dropGlow - dt * 1.6)
  if (A.hatHit) {
    const g = glints[gi]
    gi = (gi + 1) % glints.length
    g.on = true
    g.x = s.cx + (rnd() - 0.5) * span * 0.82
    g.y = s.cy + (rnd() - 0.5) * span * 0.66
    g.v = span * (0.22 + rnd() * 0.3)
    g.life = 1
  }
  const step = (3.2 + bass * 3.4 + tension * 5.5) * (1 - calm * 0.62) * dt
  acc += step
  while (acc >= 1) {
    const last = (head + ROWS - 1) % ROWS
    rows[head] = evolve(rows[last])
    syncRow(head)
    head = (head + 1) % ROWS
    acc -= 1
  }
  const cellW = span * 0.87 / W
  const rowH = span * (0.048 + bass * 0.008 + tension * 0.006) * (1 + dropGlow * 0.06)
  const halfH = rowH * 0.31
  const halfW = cellW * (0.32 + bass * 0.08)
  const baseX = s.cx - (W - 1) * 0.5 * cellW
  const baseY = s.cy - (ROWS - 1) * 0.5 * rowH - acc * rowH
  const a0 = Math.min(0.82, 0.38 + level * 0.2 + kick * 0.1) * (1 - calm * 0.28)
  const l0 = 40 + level * 8 + kick * 4 + snare * 4 + dropGlow * 6 - calm * 8
  const sp = calm > 0.45
  const hueK = hue0 + dropGlow * 40, hat5 = hat * 5
  for (let c = 0; c < W; c++) {
    const x = baseX + c * cellW
    xL[c] = x - halfW
    xR[c] = x + halfW
  }
  let n = 0
  for (let i = 0; i < ROWS; i++) {
    const cols = rowCols[(head + i) % ROWS]
    const y = baseY + i * rowH
    const y0 = y - halfH, y1 = y + halfH
    const lh = hueK + i * 2.5
    for (let j = 0; j < cols.length; j++) {
      const c = cols[j]
      if (sp && ((c + i) & 1)) continue
      const band = bandsOk ? bands[bandOf[c]] : 0.32
      const q = quads[n], pts = q.pts
      const xl = xL[c], xr = xR[c]
      pts[0] = xl
      pts[1] = y0
      pts[2] = xr
      pts[3] = y0
      pts[4] = xr
      pts[5] = y1
      pts[6] = xl
      pts[7] = y1
      const l = l0 + band * 16 + hat5
      q.h = lh + (band - 0.5) * 86
      q.l = l > 64 ? 64 : l
      q.a = a0
      out[n++] = q
    }
  }
  for (let i = 0; i < glints.length; i++) {
    const g = glints[i]
    if (!g.on) continue
    g.life -= dt * 2.1
    g.y -= g.v * dt
    if (g.life <= 0) { g.on = false; continue }
    const o = g.o
    o.x = g.x
    o.y = g.y
    o.r = (1.2 + hat * 2.2) * U
    o.h = hue0 + 150
    o.a = g.life * 0.7
    out[n++] = o
  }
  out.length = n
  fx.trail = 0.54 + calm * 0.16
  fx.zoom = 1.003 + kick * 0.012 + tension * 0.003
  fx.hue = 0.7 + dropGlow * 1.2
  s = await frame(out, fx)
}

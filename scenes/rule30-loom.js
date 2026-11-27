// name: Rule 30 loom
// Style: elementary cellular automata as woven textile, after Wolfram's Rule 30 rugs and Jacquard punch cards.
// Technique: Psychoscript BigInt bitboards. Each row of 64 cells is one BigInt word; the next row is
//   produced with shifts plus AND/OR/XOR, so one whole row evolves per handful of operations.
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
const rows = []
let state = first
for (let i = 0; i < ROWS; i++) { rows.push(state); state = evolve(state) }
let head = 0, acc = 0, dropGlow = 0
const glints = []
for (let i = 0; i < 12; i++) glints.push({ on: false, x: 0, y: 0, v: 0, life: 0 })
let gi = 0
while (true) {
  const A = s.audio, dt = s.dt, out = []
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
  }
  if (A.drop) {
    rows[newest] = MASK
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
  for (let i = 0; i < ROWS; i++) {
    const r = rows[(head + i) % ROWS]
    const y = baseY + i * rowH
    const lo = Number(r & 0xffffffffn), hi = Number((r >> 32n) & 0xffffffffn)
    let x = baseX
    for (let c = 0; c < W; c++) {
      const on = c < 32 ? (lo & (1 << c)) !== 0 : (hi & (1 << (c - 32))) !== 0
      if (on && !(sp && ((c + i) & 1))) {
        const band = bandsOk ? bands[bandOf[c]] : 0.32
        const h = hue0 + (band - 0.5) * 86 + i * 2.5 + dropGlow * 40
        const l = Math.min(64, l0 + band * 16 + hat * 5)
        out.push({ k: "p", pts: [x - halfW, y - halfH, x + halfW, y - halfH, x + halfW, y + halfH, x - halfW, y + halfH],
          fill: true, close: true, h, s: 76, l, a: a0 })
      }
      x += cellW
    }
  }
  for (let i = 0; i < glints.length; i++) {
    const g = glints[i]
    if (!g.on) continue
    g.life -= dt * 2.1
    g.y -= g.v * dt
    if (g.life <= 0) { g.on = false; continue }
    out.push({ k: "c", x: g.x, y: g.y, r: (1.2 + hat * 2.2) * U, h: hue0 + 150, s: 82, l: 62, a: g.life * 0.7 })
  }
  s = await frame(out, {
    trail: 0.54 + calm * 0.16,
    zoom: 1.003 + kick * 0.012 + tension * 0.003,
    hue: 0.7 + dropGlow * 1.2,
    mirror: 0,
  })
}

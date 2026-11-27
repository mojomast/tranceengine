// name: Life pulse
// Conway's Game of Life as a one-bar insert: a soup of cells that visibly evolves with the drums.
// Inspired by classic cellular-automata screens and VJ insert clips: it must read from its very first frame.
// Psychoscript technique: BigInt bitboards — each board row is one BigInt word, so shifts and AND/OR/XOR move a
// whole row per op and bit-parallel half/full adders count all 8 neighbours of every cell in one pass; a seeded
// mulberry32 PRNG (Math.imul) is the only randomness, so rewinds, beat-repeats and replays redraw the same frames.
// Reactions: kick stamps a glider and pulses the cells; snare advances an extra generation; hats drop glints on
// live cells; bass swells the dots; build and the run-up to a drop simmer the board faster; the drop stamps a
// glider burst; calm slows it down; keyHue sets the palette and every cell tints by its age.

let s = await frame([])
const TAU = Math.PI * 2
const portrait = s.h > s.w
const COLS = portrait ? 36 : 64
const ROWS = portrait ? 64 : 36
const CELLS = COLS * ROWS
const QB = (COLS + 7) >> 3
const MASK = (1n << BigInt(COLS)) - 1n
const SHIFTS = []
for (let q = 0; q < QB; q++) SHIFTS.push(BigInt(q * 8))

// seeded mulberry32 PRNG
let rngState = 0x1b873593
const rnd = () => {
  rngState = (rngState + 0x6d2b79f5) | 0
  let z = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState)
  z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z
  return ((z ^ (z >>> 14)) >>> 0) / 4294967296
}

// precomputed set-bit positions per byte value, for cheap row scans
const BYTE_BITS = []
for (let v = 0; v < 256; v++) {
  const bits = []
  for (let b = 0; b < 8; b++) if (v & (1 << b)) bits.push(b)
  BYTE_BITS.push(bits)
}

let rows = []
const ages = []
const live = []
let liveCount = 0
for (let i = 0; i < ROWS; i++) rows.push(0n)
for (let i = 0; i < CELLS; i++) ages.push(0)

// diff current rows against the next ones, refresh ages and the live-cell list
const rebuild = (next) => {
  let n = 0
  for (let y = 0; y < ROWS; y++) {
    const row = next[y], cur = rows[y]
    const born = row & (MASK ^ cur)
    const died = cur & (MASK ^ row)
    const yb = y * COLS
    for (let q = 0; q < QB; q++) {
      const sh = SHIFTS[q]
      const dv = Number((died >> sh) & 255n)
      if (dv !== 0) {
        const db = BYTE_BITS[dv]
        for (let k = 0; k < db.length; k++) ages[yb + q * 8 + db[k]] = 0
      }
      const v = Number((row >> sh) & 255n)
      if (v !== 0) {
        const bv = Number((born >> sh) & 255n)
        const vb = BYTE_BITS[v]
        for (let k = 0; k < vb.length; k++) {
          const bit = vb[k], idx = yb + q * 8 + bit
          live[n++] = idx
          ages[idx] = (bv & (1 << bit)) !== 0 ? 1 : ages[idx] + 1
        }
      }
    }
  }
  liveCount = n
  rows = next
}

// one generation: bit-parallel neighbour counts with half/full adders on shifted rows
const step = () => {
  const next = []
  for (let y = 0; y < ROWS; y++) {
    const a = y > 0 ? rows[y - 1] : 0n
    const b = rows[y]
    const c = y < ROWS - 1 ? rows[y + 1] : 0n
    const al = (a << 1n) & MASK, ar = a >> 1n
    const bl = (b << 1n) & MASK, br = b >> 1n
    const cl = (c << 1n) & MASK, cr = c >> 1n
    let x = al ^ bl
    const sumL = x ^ cl, carryL = (al & bl) | (x & cl)
    const sumM = a ^ c, carryM = a & c
    x = ar ^ br
    const sumR = x ^ cr, carryR = (ar & br) | (x & cr)
    x = sumL ^ sumM
    const t0 = x ^ sumR, tc = (sumL & sumM) | (x & sumR)
    x = carryL ^ carryM
    const u0 = x ^ carryR, uc = (carryL & carryM) | (x & carryR)
    const p0 = t0, p1 = tc ^ u0, w1 = tc & u0
    const p2 = w1 ^ uc, p3 = w1 & uc
    // born where the count is 3, survive where alive and the count is 2
    next.push((p0 & p1 & (MASK ^ p2) & (MASK ^ p3)) | (b & (MASK ^ p0) & p1 & (MASK ^ p2) & (MASK ^ p3)))
  }
  rebuild(next)
}

// the five cells of a glider, rotated in quarter turns inside its 3x3 box
const GLIDER = [1, 0, 2, 1, 0, 2, 1, 2, 2, 2]
const stampGlider = (gx, gy, rot) => {
  for (let i = 0; i < 5; i++) {
    let dx = GLIDER[i * 2], dy = GLIDER[i * 2 + 1]
    for (let r = 0; r < rot; r++) { const t = dx; dx = dy; dy = 2 - t }
    const x = gx + dx, y = gy + dy
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue
    const bit = 1n << BigInt(x)
    if ((rows[y] & bit) === 0n) {
      rows[y] = rows[y] | bit
      const idx = y * COLS + x
      ages[idx] = 1
      live[liveCount++] = idx
    }
  }
}

// a fresh seeded soup, so the insert reads on its first frame
const DENSITY = 0.15
const soup = []
for (let y = 0; y < ROWS; y++) {
  let row = 0n
  for (let q = 0; q < QB; q++) {
    let v = 0
    for (let b = 0; b < 8; b++) if (rnd() < DENSITY) v |= 1 << b
    row = row | (BigInt(v) << SHIFTS[q])
  }
  soup.push(row & MASK)
}
rebuild(soup)
for (let i = 0; i < 3; i++) stampGlider(6 + ((rnd() * (COLS - 15)) | 0), 5 + ((rnd() * (ROWS - 13)) | 0), i)

let genAcc = 0
const glints = []
for (let i = 0; i < 16; i++) glints.push({ idx: 0, life: 0 })
let gi = 0
while (true) {
  const A = s.audio, dt = Math.min(s.dt, 0.1), out = []
  const cell = Math.min(s.w / COLS, s.h / ROWS) * 0.92
  const ox = s.cx - cell * COLS / 2, oy = s.cy - cell * ROWS / 2
  const calm = A.calm || 0, bass = A.bass || 0, kick = A.kick || 0
  const energy = A.energy || 0, build = A.build || 0, dropAmt = A.dropAmt || 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 8 ? 1 - toDrop / 8 : 0
  const baseHue = typeof A.keyHue === "number" ? A.keyHue : 190

  // the simulation clock: generations ride the tempo, snares add an extra one
  const rate = ((A.bpm || 120) / 60) * (0.85 + energy * 0.7 + build * 1.5 + near * 0.8) * (1 - calm * 0.5)
  genAcc += dt * rate
  if (A.snareHit) genAcc += 1
  if (A.drop) {
    genAcc += 1.5
    for (let i = 0; i < 4; i++) stampGlider(8 + ((rnd() * (COLS - 19)) | 0), 6 + ((rnd() * (ROWS - 15)) | 0), i)
  }
  let steps = Math.floor(genAcc)
  genAcc -= steps
  if (steps > 3) steps = 3
  for (let i = 0; i < steps; i++) step()

  // kick stamps a glider somewhere new
  if (A.kickHit) stampGlider(4 + ((rnd() * (COLS - 11)) | 0), 4 + ((rnd() * (ROWS - 11)) | 0), (A.kicks || 0) % 4)
  // life finds a way: reseed the centre if the board dies out
  if (liveCount < 10) stampGlider((COLS >> 1) - 1, (ROWS >> 1) - 1, (A.beats || 0) % 4)
  // hats scatter glints across live cells
  if (A.hatHit && liveCount > 0) {
    const nG = 1 + ((A.hats || 0) % 3)
    for (let i = 0; i < nG; i++) {
      const g = glints[gi]
      gi = (gi + 1) % glints.length
      g.idx = live[(rnd() * liveCount) | 0]
      g.life = 1
    }
  }

  // board frame so the insert reads instantly
  const bw = cell * COLS, bh = cell * ROWS
  out.push({ k: "l", x1: ox, y1: oy, x2: ox + bw, y2: oy, h: baseHue, s: 60, l: 40, a: 0.3, lw: 1 })
  out.push({ k: "l", x1: ox, y1: oy + bh, x2: ox + bw, y2: oy + bh, h: baseHue, s: 60, l: 40, a: 0.3, lw: 1 })
  out.push({ k: "l", x1: ox, y1: oy, x2: ox, y2: oy + bh, h: baseHue, s: 60, l: 40, a: 0.3, lw: 1 })
  out.push({ k: "l", x1: ox + bw, y1: oy, x2: ox + bw, y2: oy + bh, h: baseHue, s: 60, l: 40, a: 0.3, lw: 1 })

  // cells as dots, tinted by age, breathing on the beat phase
  const pulse = 1 + kick * 0.4 + bass * 0.18 + 0.08 * Math.cos((A.phase || 0) * TAU)
  const cw = cell / 2
  for (let i = 0; i < liveCount; i++) {
    const idx = live[i]
    const age = ages[idx]
    const young = age < 2
    out.push({ k: "c", x: ox + (idx % COLS) * cell + cw, y: oy + ((idx / COLS) | 0) * cell + cw,
      r: cell * (young ? 0.4 : 0.32) * pulse,
      h: baseHue + Math.min(age, 28) * 5 + (young ? 30 : 0), s: 80,
      l: young ? 62 : 62 - Math.min(age, 20) * 0.8, a: 0.85 })
  }
  for (let i = 0; i < glints.length; i++) {
    const g = glints[i]
    if (g.life <= 0) continue
    g.life -= dt * 3
    out.push({ k: "c", x: ox + (g.idx % COLS) * cell + cw, y: oy + ((g.idx / COLS) | 0) * cell + cw,
      r: cell * 0.5 * g.life, h: baseHue + 150, s: 70, l: 64, a: Math.min(0.8, g.life) })
  }
  s = await frame(out, {
    trail: 0.74 + calm * 0.14 + dropAmt * 0.05,
    zoom: 1.002 + kick * 0.006 + dropAmt * 0.008,
    hue: 0.5,
    spin: 0,
  })
}

// name: Byte poem
// Style: typography - a concrete-poetry byte grid inspired by ASCII bitmap type and
// early computer art, where a word is legible through the bits of its characters.
// Technique: bytes as pattern - TextEncoder (or charCodeAt) turns the word into bytes,
// and every bit becomes a block cell, so the 8-bit pattern itself is the poem.
// Reactions: the downbeat flips the grid to the section's word (PULSE, RISE, DROP, or
// TRANCE when unmapped); kick lights the current byte row; snare scrambles bits; hats
// flick a single bit; bass sets cell weight; keyHue and note colour the grid; calm slows
// and thins it; build and toDrop pull it inward; drop bursts it outward; and the bar's
// last beat slides the bits together into readable kinetic text.
let s = await frame([])
const WORDS = ["PULSE", "RISE", "DROP", "TRANCE"]
const enc = typeof TextEncoder === "function" ? new TextEncoder() : null
const toBytes = (w) => {
  if (enc) {
    const u = enc.encode(w), a = []
    for (let i = 0; i < u.length; i++) a.push(u[i])
    return a
  }
  const a = []
  for (let i = 0; i < w.length; i++) a.push(w.charCodeAt(i) & 255)
  return a
}
const BYTES = {}
for (let i = 0; i < WORDS.length; i++) BYTES[WORDS[i]] = toBytes(WORDS[i])
let seed = 0x9e3779b9 | 0
const rnd = () => {
  seed = seed + 0x6d2b79f5 | 0
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
  return ((t ^ t >>> 14) >>> 0) / 4294967296
}
const hbit = (i, k) => {
  let x = (i * 374761393 + k * 668265263) | 0
  x = Math.imul(x ^ x >>> 13, 1274126177)
  return (x >>> 31) & 1
}
let word = "", nRows = 0, bits = [], tgt = [], flipAt = [], wordAge = 0
let flickIdx = 0, flickT = 0, burst = 0, started = false
const loadWord = (w, instant) => {
  const src = BYTES[w], nb = []
  for (let c = 0; c < src.length; c++)
    for (let b = 0; b < 8; b++) nb.push((src[c] >> (7 - b)) & 1)
  const old = bits, next = [], ft = []
  for (let i = 0; i < nb.length; i++) {
    next.push(instant || i >= old.length ? nb[i] : old[i])
    ft.push(rnd() * 0.24)
  }
  bits = next
  tgt = nb
  flipAt = ft
  nRows = src.length
  word = w
  wordAge = 0
}
const pick = (sec) => sec === "build" ? "RISE" : (sec === "drop" || sec === "main") ? "DROP"
  : (sec === "intro" || sec === "verse") ? "PULSE" : "TRANCE"
while (true) {
  const A = s.audio, dt = s.dt || 1 / 60, out = []
  const span = Math.min(s.w, s.h), U = span / 800
  const sec = A.section || ""
  if (!started) { loadWord(pick(sec), true); started = true }
  else if (A.downbeat) { const nw = pick(sec); if (nw !== word) loadWord(nw, false) }
  wordAge += dt
  for (let i = 0; i < bits.length; i++) if (wordAge >= flipAt[i]) bits[i] = tgt[i]
  const calm = A.calm || 0
  const kick = A.kick || 0
  const bass = A.bass || 0
  const snare = A.snare || 0
  const dropAmt = A.dropAmt || 0
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 10 ? Math.max(0, 1 - toDrop / 10) : 0
  const tension = Math.max(build, near)
  const barPhase = typeof A.barPhase === "number" ? A.barPhase
    : (((A.beats || 0) % 4) + (typeof A.phase === "number" ? A.phase : 0)) / 4
  const bpm = typeof A.bpm === "number" && A.bpm > 0 ? A.bpm : 138
  if (A.drop) burst = 1
  burst = Math.max(burst * Math.exp(-dt * 2.4), dropAmt * 0.6)
  if (A.hatHit) { flickIdx = Math.floor(rnd() * Math.max(1, nRows * 8)); flickT = 0.14 }
  flickT = Math.max(0, flickT - dt)
  const row = nRows > 0 ? Math.min(nRows - 1, Math.floor(barPhase * nRows)) : 0
  const scr = snare > 0.3
  const hue0 = typeof A.keyHue === "number" ? A.keyHue : 190
  const hue = hue0 + (A.note || 0) * 5 + barPhase * 24 + burst * 40
  let g = barPhase > 0.72 ? (barPhase - 0.72) / 0.22 : 0
  g = Math.max(0, Math.min(1, g))
  const gather = g * g * (3 - 2 * g)
  const base = span * 0.078
  const spread = 1 + burst * 0.55 - tension * 0.14 - gather * 0.55
  const cs = base * (1 + bass * 0.12 + kick * 0.05 + burst * 0.25) * (1 - gather * 0.35) * (1 - calm * 0.05)
  const gap = cs * 1.18
  const cell0 = cs * 0.74
  const n = bits.length
  const textW = Math.min(s.w * 0.72, nRows * base * 2)
  const fs = Math.max(18, Math.min(s.w * 0.2, span * 0.16) * (1 + kick * 0.05 + burst * 0.12))
  const gatherT = barPhase > 0.72 ? (barPhase - 0.72) * 240 / bpm : 0
  if (gather < 0.9) {
    const ry = s.cy + (row - (nRows - 1) * 0.5) * gap * 1.08 * spread
    const half = 4.2 * gap * spread
    out.push({ k: "p", pts: [s.cx - half, ry, s.cx + half, ry], close: false,
      h: hue, s: 55, l: 54, a: (0.1 + kick * 0.16) * (1 - gather), lw: 1.5 * U + 0.5 })
  }
  for (let i = 0; i < n; i++) {
    const c = Math.floor(i / 8), b = i % 8
    const x0 = s.cx + (b - 3.5) * gap * spread
    const y0 = s.cy + (c - (nRows - 1) * 0.5) * gap * 1.08 * spread
    const gx = s.cx + (i / Math.max(1, n - 1) - 0.5) * textW
    const x = x0 + (gx - x0) * gather
    const y = y0 + (s.cy - y0) * gather
    let on = bits[i]
    if (scr) on ^= hbit(i, A.snares || 0)
    const flick = flickT > 0 && i === flickIdx
    const lit = on === 1 || flick
    const rowLit = c === row
    const cell = cell0 * (1 + burst * 0.35) * (flick ? 1.5 : 1) * (rowLit ? 1 + kick * 0.1 : 1)
    const al = (lit ? 0.6 + kick * 0.16 + bass * 0.08 + (rowLit ? kick * 0.12 : 0) + (flick ? 0.18 : 0) : 0.1)
      * (1 - gather * 0.95)
    const l = lit ? Math.min(65, 46 + bass * 8 + kick * 8 + (rowLit ? 6 : 0)) : 30
    out.push({ k: "p", pts: [x - cell * 0.5, y - cell * 0.5, x + cell * 0.5, y - cell * 0.5,
      x + cell * 0.5, y + cell * 0.5, x - cell * 0.5, y + cell * 0.5], fill: true,
      h: hue + b * 4 + c * 9 + (flick ? 60 : 0), s: lit ? 78 : 40, l,
      a: Math.max(0, Math.min(0.95, al)) })
  }
  if (gather > 0.15) {
    out.push({ k: "w", text: word, x: s.cx, y: s.cy, size: fs, fx: "punch", t: gatherT,
      font: "mono", h: hue + 20, s: 84, l: Math.min(65, 58 + kick * 5),
      a: Math.min(0.92, (gather - 0.15) / 0.85), seed: nRows })
  }
  s = await frame(out, {
    trail: 0.44 + calm * 0.1 + gather * 0.1,
    zoom: 1.004 + kick * 0.016 + burst * 0.01,
    spin: 0,
    hue: 1.2,
    react: { punch: 0.9 + kick * 0.5, slice: 0.3, sparkle: 0.5, shake: 0.3, tint: 0.4 },
  })
}

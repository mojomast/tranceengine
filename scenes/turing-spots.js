// name: Turing spots
// Gray-Scott reaction-diffusion after Karl Sims' feed/kill values, on a coarse grid (~28x16 on a
// widescreen, fewer on phones) stepped once per frame (twice while boiling into a drop), drawn as
// circles sized by the B chemical. A seeded mulberry32 PRNG (Math.imul) picks every
// seed point, so a rewind, beat-repeat or replay redraws exactly the same frames; plain preallocated
// arrays only. kickHit seeds a fresh spot at a PRNG point, snareHit eats a hole that slowly heals,
// bass slides the feed rate between spots (F=0.030) and stripes/coral (F=0.0545), keyHue sets the
// palette, hats add glints, calm slows the chemistry, and build/toDrop make it boil toward the drop,
// which splashes a burst of seeds. Unmapped songs (build 0, toDrop 99) just follow the bass.
let s = await frame([])
const DA = 0.21, DB = 0.105, KILL = 0.062, F_SPOT = 0.03, F_STRIPE = 0.0545
let rngState = 0x2F6E2B1
const rnd = () => {
  rngState |= 0
  rngState = (rngState + 0x6D2B79F5) | 0
  let z = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState)
  z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z
  return ((z ^ (z >>> 14)) >>> 0) / 4294967296
}
let GW = 0, GH = 0, W = 0, cw = 1
let u = [], v = [], u2 = [], v2 = [], cellX = [], cellY = [], pool = []
const out = []
const buildGrid = () => {
  const target = Math.min(s.w, s.h) < 500 ? 480 : 460
  const aspect = s.w / Math.max(1, s.h)
  GH = Math.max(14, Math.min(60, Math.round(Math.sqrt(target / Math.max(0.2, aspect)))))
  GW = Math.max(14, Math.min(60, Math.round(GH * aspect)))
  W = GW + 2
  const N = W * (GH + 2)
  u = []
  v = []
  u2 = []
  v2 = []
  cellX = []
  cellY = []
  pool = []
  for (let i = 0; i < N; i++) {
    u.push(1)
    v.push(0)
    u2.push(1)
    v2.push(0)
  }
  cw = Math.min(s.w / GW, s.h / GH)
  const ox = s.cx - (cw * GW) / 2, oy = s.cy - (cw * GH) / 2
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      cellX.push(ox + (x + 0.5) * cw)
      cellY.push(oy + (y + 0.5) * cw)
    }
  }
  for (let i = 0; i < GW * GH; i++) pool.push({ k: "c", x: 0, y: 0, r: 1, h: 200, s: 82, l: 50, a: 0.5 })
}
const seedDisc = (cx0, cy0, r, val) => {
  for (let y = Math.max(1, cy0 - r); y <= Math.min(GH, cy0 + r); y++) {
    for (let x = Math.max(1, cx0 - r); x <= Math.min(GW, cx0 + r); x++) {
      if ((x - cx0) * (x - cx0) + (y - cy0) * (y - cy0) <= r * r) v[y * W + x] = val
    }
  }
}
const step = (F) => {
  for (let y = 0; y <= GH + 1; y++) {
    const r = y * W
    u[r] = u[r + GW]
    u[r + GW + 1] = u[r + 1]
    v[r] = v[r + GW]
    v[r + GW + 1] = v[r + 1]
  }
  for (let x = 0; x <= GW + 1; x++) {
    u[x] = u[GH * W + x]
    u[(GH + 1) * W + x] = u[W + x]
    v[x] = v[GH * W + x]
    v[(GH + 1) * W + x] = v[W + x]
  }
  for (let y = 1; y <= GH; y++) {
    let i = y * W + 1
    for (let x = 1; x <= GW; x++, i++) {
      const a = u[i], b = v[i]
      const la = 0.25 * (u[i - 1] + u[i + 1] + u[i - W] + u[i + W]) - a
      const lb = 0.25 * (v[i - 1] + v[i + 1] + v[i - W] + v[i + W]) - b
      const r = a * b * b
      u2[i] = a + (DA * la - r + F * (1 - a))
      v2[i] = b + (DB * lb + r - (F + KILL) * b)
    }
  }
  const tu = u
  u = u2
  u2 = tu
  const tv = v
  v = v2
  v2 = tv
}
const seedField = () => {
  for (let n = 0; n < 14; n++) {
    seedDisc(1 + Math.floor(rnd() * (GW - 2)), 1 + Math.floor(rnd() * (GH - 2)), 1 + Math.floor(rnd() * 2), 1)
  }
}
buildGrid()
seedField()
for (let i = 0; i < 260; i++) step(0.042)
let lastW = s.w, lastH = s.h
let drive = 0.3, pulse = 0, glint = 0, thr = 0.16, flip = false
while (true) {
  const A = s.audio, dt = s.dt
  if (s.w !== lastW || s.h !== lastH) {
    lastW = s.w
    lastH = s.h
    buildGrid()
    seedField()
    for (let i = 0; i < 120; i++) step(0.042)
  }
  const bass = A.bass || 0, calm = A.calm || 0, dropAmt = A.dropAmt || 0
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const hue0 = typeof A.keyHue === "number" ? A.keyHue : 200
  const near = toDrop < 8 ? 1 - toDrop / 8 : 0
  const target = Math.min(1, bass * 0.85 + build * 0.35 + near * 0.3) * (1 - calm * 0.45)
  drive += (target - drive) * Math.min(1, dt * 1.6)
  const F = F_SPOT + drive * (F_STRIPE - F_SPOT)
  let steps = build > 0.55 || near > 0.6 ? 2 : 1
  if (calm > 0.5) {
    flip = !flip
    if (flip) steps = 0
  }
  for (let st = 0; st < steps; st++) step(F)
  if (A.kickHit) {
    pulse = 1
    seedDisc(1 + Math.floor(rnd() * (GW - 2)), 1 + Math.floor(rnd() * (GH - 2)), rnd() < 0.4 ? 2 : 1, 0.9)
  }
  if (A.snareHit) {
    seedDisc(2 + Math.floor(rnd() * (GW - 4)), 2 + Math.floor(rnd() * (GH - 4)), 2 + Math.floor(rnd() * 2), 0)
  }
  if (A.drop) {
    for (let n = 0; n < 8; n++) {
      seedDisc(1 + Math.floor(rnd() * (GW - 2)), 1 + Math.floor(rnd() * (GH - 2)), 1 + Math.floor(rnd() * 2), 1)
    }
  }
  if (A.hatHit) glint = 1
  pulse *= Math.exp(-dt * 7)
  glint *= Math.exp(-dt * 10)
  const boost = 1 + pulse * 0.3 + dropAmt * 0.25
  const sparkling = glint > 0.2
  let j = 0
  for (let y = 0; y < GH; y++) {
    const rowB = (y + 1) * W + 1, rowC = y * GW, glRow = (y * 3) % 9
    for (let x = 0; x < GW; x++) {
      const b = v[rowB + x]
      if (b > thr) {
        const o = pool[j]
        const bb = b > 1 ? 1 : b
        o.x = cellX[rowC + x]
        o.y = cellY[rowC + x]
        o.r = cw * (0.1 + bb * 0.5) * boost
        o.h = hue0 + (bb - 0.15) * 100
        o.l = 40 + bb * 16 + (sparkling && (x + glRow) % 9 === 0 ? glint * 9 : 0)
        o.a = 0.3 + bb * 0.35
        out[j] = o
        j++
      }
    }
  }
  out.length = j
  if (j > 280) thr = Math.min(0.45, thr + 0.02)
  else if (j < 200) thr = Math.max(0.15, thr - 0.01)
  s = await frame(out, {
    trail: 0.5 + calm * 0.25 + dropAmt * 0.08,
    zoom: 1.003 + pulse * 0.006 - calm * 0.002,
    hue: 0.4,
    react: { punch: 0.7, slice: 0.3, sparkle: 0.6, shake: 0.2, tint: 0.6 },
  })
}

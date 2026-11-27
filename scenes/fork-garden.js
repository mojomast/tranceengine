// name: Forking paths
// A bonsai that grows a new ring of branches on every kick, built for the engine's fork transition,
// where one running VM is suspended and resumed twice. Style: generative ink-tree VJ insert — one
// recognisable plant that must read from its very first frame, started fresh mid-song.
// Psychoscript technique — fork divergence: the trunk and main limbs (generations below FORK_GEN) are
// grown from a seeded mulberry32 PRNG, so both forked copies replay the same trunk out of the same
// snapshot bytes; every branch decision past the fork point calls Math.random on purpose, and host
// randomness is not captured in a snapshot, so the two copies grow visibly different futures from the
// same trunk. Accumulated state: branches, leaves and falling foliage persist and build up over many
// frames, so beat-repeat stutters and resumed memory stay visible in the picture.
// Reactions: kick sprouts a branch generation, snare shakes leaves loose, hats glint on the tips,
// bass thickens the trunk, the downbeat pulses the roots, build/toDrop gather the canopy and the drop
// releases a leaf burst, calm slows the sway and lengthens trails, keyHue sets the palette.
let s = await frame([])
const TAU = Math.PI * 2
const UP = -Math.PI / 2
const MAXD = 8 // deepest generation
const FORK_GEN = 4 // generations below this are seeded: the trunk every fork shares
const LEAF_D = 3 // tips from this depth carry leaves
const MAXB = 460 // branch cap keeps the frame inside budget

// seeded mulberry32 PRNG: the trunk's decisions, replayed exactly by every forked copy
let rngState = 0x2f6e2b1
const rnd = () => {
  rngState = (rngState + 0x6d2b79f5) | 0
  let z = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState)
  z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z
  return ((z ^ (z >>> 14)) >>> 0) / 4294967296
}
// one branch decision: seeded before the fork point, host-random after it
const pick = (depth) => (depth < FORK_GEN ? rnd() : Math.random())

const branches = []
let tips = []
const spawn = (bx, by, ang, len, depth, mature) => {
  if (branches.length >= MAXB) return
  branches.push({
    bx, by,
    ex: bx + Math.cos(ang) * len,
    ey: by + Math.sin(ang) * len,
    ang, len, depth,
    grow: mature ? 1 : 0,
    leafy: depth >= LEAF_D, kids: 0, re: 0,
    ph: pick(depth) * TAU, k2: depth * depth * 0.02,
  })
}
// every mature tip forks into children; the decision randomness is what the fork splits
const sproutAll = () => {
  const next = []
  for (let i = 0; i < tips.length; i++) {
    const b = branches[tips[i]]
    if (b.grow < 1 || b.depth >= MAXD || branches.length >= MAXB) { next.push(tips[i]); continue }
    const n = b.depth < 2 ? 3 : 2
    let made = 0
    for (let k = 0; k < n; k++) {
      if (branches.length >= MAXB) break
      const r1 = pick(b.depth), r2 = pick(b.depth)
      const dir = n === 2 ? (k === 0 ? -1 : 1) : k - 1
      const ang = b.ang + dir * (0.3 + r1 * 0.32) + (UP - b.ang) * 0.1 + (r2 - 0.5) * 0.12
      spawn(b.ex, b.ey, ang, b.len * (0.68 + r2 * 0.12), b.depth + 1, false)
      next.push(branches.length - 1)
      made++
    }
    if (made > 0) { b.kids += made; b.leafy = false }
    else next.push(tips[i])
  }
  tips = next
}

// the trunk every fork shares, standing before the first frame so the insert reads at once
spawn(0, 0, UP, 0.36, 0, true)
tips.push(0)
for (let g = 0; g < FORK_GEN; g++) {
  for (let i = 0; i < branches.length; i++) branches[i].grow = 1
  sproutAll()
}
for (let i = 0; i < branches.length; i++) branches[i].grow = 1

// falling leaves and tip glints live in fixed pools: no allocation in the loop
const falls = []
for (let i = 0; i < 56; i++) falls.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, ph: 0, life: 0, h: 0 })
let fi = 0
const spawnFall = (x, y, h) => {
  const p = falls[fi]
  fi = (fi + 1) % falls.length
  const u = Math.min(s.w, s.h) / 800
  p.on = true
  p.x = x
  p.y = y
  p.vx = (Math.random() - 0.5) * 44 * u
  p.vy = (14 + Math.random() * 26) * u
  p.ph = Math.random() * TAU
  p.life = 1
  p.h = h
}
const glints = []
for (let i = 0; i < 12; i++) glints.push({ on: false, x: 0, y: 0, life: 0, h: 0 })
let gli = 0
const spawnGlint = (x, y, h) => {
  const g = glints[gli]
  gli = (gli + 1) % glints.length
  g.on = true
  g.x = x
  g.y = y
  g.life = 1
  g.h = h
}

let kickEnv = 0, dp = 0, burst = 0, wantDrop = 0, wantGlint = 0
while (true) {
  const A = s.audio, dt = Math.min(s.dt || 1 / 60, 0.05), out = []
  const span = Math.min(s.w, s.h), U = span / 800
  const calm = A.calm || 0, bass = A.bass || 0, kick = A.kick || 0
  const hat = A.hat || 0, rel = A.dropAmt || 0
  const baseHue = typeof A.keyHue === "number" ? A.keyHue : 200
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 8 ? 1 - toDrop / 8 : 0
  const pull = Math.max(build, near) * (1 - Math.min(1, rel * 2))

  if (A.kickHit) { kickEnv = 1; sproutAll() }
  if (A.downbeat) dp = 1
  if (A.snareHit) wantDrop = 6 + ((A.snares || 0) % 4) * 2
  if (A.hatHit) wantGlint = 1 + ((A.hats || 0) % 2)
  if (A.drop) { wantDrop = 26; wantGlint = 8; burst = 1 }
  kickEnv *= Math.exp(-dt * 5)
  dp *= Math.exp(-dt * 6)
  burst *= Math.exp(-dt * 2.4)

  const H = span * 0.58 * (1 + pull * 0.1 + burst * 0.05)
  const squeeze = 1 - pull * 0.18 + burst * 0.1
  const sway = (0.012 + pull * 0.02 + kickEnv * 0.02) * (1 - calm * 0.65) + 0.004
  const lean = Math.sin(s.t * 0.6) * 0.012 * (1 - calm) + pull * 0.03
  const growV = dt * (2.4 + pull * 3.2 + rel * 1.5) * (1 - calm * 0.35)
  const bx0 = s.cx, by0 = s.cy + span * 0.38
  const ph0 = s.t * 1.4

  // ground glow and the root pulse on the downbeat
  out.push({ k: "c", x: bx0, y: by0 + 4 * U, r: span * 0.15, h: baseHue + 20, s: 60, l: 42, a: 0.1 + dp * 0.08 + kickEnv * 0.05 })
  out.push({ k: "c", x: bx0, y: by0, r: (10 + dp * 10 + kickEnv * 6) * U, h: baseHue + 30, s: 70, l: 50, a: 0.22 + dp * 0.2 })

  for (let i = 0; i < branches.length; i++) {
    const b = branches[i]
    if (b.grow < 1) b.grow = Math.min(1, b.grow + growV)
    else if (!b.leafy && b.re > 0 && s.t >= b.re && b.kids === 0) { b.leafy = true; b.re = 0 }
    const bend = (lean + Math.sin(ph0 + b.ph) * sway) * b.k2
    const gx = b.grow < 1 ? b.bx + (b.ex - b.bx) * b.grow : b.ex
    const gy = b.grow < 1 ? b.by + (b.ey - b.by) * b.grow : b.ey
    const x1 = bx0 + (b.bx * squeeze + bend) * H
    const y1 = by0 + b.by * H
    const x2 = bx0 + (gx * squeeze + bend) * H
    const y2 = by0 + gy * H
    out.push({ k: "l", x1, y1, x2, y2, h: baseHue + b.depth * 7, s: 72,
      l: Math.min(62, 42 + b.depth * 2.2 + kickEnv * 5 + dp * 3), a: 0.82,
      lw: Math.max(0.6, (4.6 - b.depth * 0.5) * U * (1 + bass * (b.depth < 2 ? 0.6 : 0.15) + kickEnv * 0.2)) })
    if (b.leafy) {
      if (wantDrop > 0 && i % 2 === 0) {
        wantDrop--
        b.leafy = false
        b.re = s.t + 2 + Math.random() * 2
        spawnFall(x2, y2, baseHue + 50 + b.depth * 5)
      } else {
        out.push({ k: "c", x: x2, y: y2, r: (2 + b.depth * 0.28 + kickEnv * 1.1 + rel * 1.2) * U * (1 + dp * 0.15),
          h: baseHue + 50 + b.depth * 5 + rel * 20, s: 78, l: Math.min(64, 52 + hat * 5 + dp * 3), a: 0.68 })
      }
      if (wantGlint > 0 && i % 5 === 0) {
        wantGlint--
        spawnGlint(x2, y2, baseHue + 90)
      }
    }
  }
  for (let i = 0; i < falls.length; i++) {
    const p = falls[i]
    if (!p.on) continue
    p.life -= dt * 0.75
    if (p.life <= 0) { p.on = false; continue }
    p.vy += 55 * U * dt
    p.x += (p.vx + Math.sin(s.t * 5 + p.ph) * 14 * U) * dt
    p.y += p.vy * dt
    out.push({ k: "c", x: p.x, y: p.y, r: 2.2 * U * (0.5 + p.life * 0.5), h: p.h, s: 75, l: 58, a: Math.min(0.7, p.life) })
  }
  for (let i = 0; i < glints.length; i++) {
    const g = glints[i]
    if (!g.on) continue
    g.life -= dt * 2.6
    if (g.life <= 0) { g.on = false; continue }
    out.push({ k: "c", x: g.x, y: g.y, r: (1.4 + hat * 2.2) * U * g.life + 0.4, h: g.h, s: 80, l: 64, a: g.life * 0.8 })
  }
  s = await frame(out, {
    trail: 0.74 + calm * 0.14 + rel * 0.05,
    zoom: 1.002 + kick * 0.006 + rel * 0.008 + dp * 0.003,
    spin: 0,
    hue: 0.5,
    react: { punch: kickEnv * 0.7, slice: 0, sparkle: hat * 0.5, shake: (A.snare || 0) * 0.4, tint: 0 },
  })
}

// name: Coroutine dancers
// Style: psychoscript-native. A neon dance line of glowing stick figures, inspired by
// late-night robot dance troupes and 80s stage choreography, drawn as one live system.
// Technique: generator choreography. Each dancer owns a function* coroutine advanced
// exactly once per frame; on every downbeat its routine is swapped by yield* delegation.
// Kick: all sixteen dancers hop and flash. Snare: a body wave rolls across the rows.
// Hats: sparks glint above a head. Bass: limb weight and stance width. keyHue colours
// each costume, chroma/note bends it. calm slows the routines; build/toDrop crouches the
// line and the drop throws it open. It opens on a full pose, so the first beat reads.
let s = await frame([])
const TAU = Math.PI * 2
const N = 16
let seed = 0x9e3779b9
const rng = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

let A = null, DT = 0.016

function* spinStep(d) {
  let p = d.ph
  while (!d.swap) {
    p += (0.14 + (A.bass || 0) * 0.14) * (1 - (A.calm || 0) * 0.4)
    d.tilt = Math.sin(p * 0.5) * 0.26
    d.armL = Math.PI * 0.5 + Math.sin(p) * 0.75
    d.armR = Math.PI * 0.5 - Math.sin(p) * 0.75
    d.legL = 0.15 + Math.sin(p) * 0.12
    d.legR = 0.15 - Math.sin(p) * 0.12
    d.air = 0
    d.drift = 0
    d.spin = Math.sin(p)
    yield 0
  }
}

function* hopStep(d) {
  let p = d.ph
  while (!d.swap) {
    p += (0.26 + (A.bass || 0) * 0.1) * (1 - (A.calm || 0) * 0.45)
    const up = Math.pow(Math.abs(Math.sin(p)), 0.7) * (0.12 + (A.bass || 0) * 0.14)
    d.air = up
    d.armL = 2.15 + Math.sin(p) * 0.2
    d.armR = 2.15 - Math.sin(p) * 0.2
    d.legL = 0.15 + up * 1.3
    d.legR = 0.15 + up * 1.3
    d.tilt = 0
    d.drift = 0
    d.spin = 0
    yield 0
  }
}

function* waveStep(d) {
  let p = d.ph
  while (!d.swap) {
    p += (0.18 + (A.bass || 0) * 0.08) * (1 - (A.calm || 0) * 0.45)
    d.tilt = Math.sin(p * 0.4) * 0.16
    d.armL = 2.5 + Math.sin(p * 2) * 0.4
    d.armR = 0.35 + Math.sin(p) * 0.25
    d.legL = 0.2
    d.legR = 0.2
    d.air = Math.abs(Math.sin(p * 0.5)) * 0.04
    d.drift = 0
    d.spin = 0
    yield 0
  }
}

function* slideStep(d) {
  let p = d.ph
  while (!d.swap) {
    p += (0.12 + (A.bass || 0) * 0.06) * (1 - (A.calm || 0) * 0.45)
    d.tilt = Math.sin(p) * 0.45
    d.drift = Math.sin(p) * 0.3
    d.armL = 0.7 + Math.sin(p) * 0.6
    d.armR = 0.7 - Math.sin(p) * 0.6
    d.legL = 0.36 + Math.abs(Math.sin(p)) * 0.26
    d.legR = 0.36 + Math.abs(Math.cos(p)) * 0.26
    d.air = 0
    d.spin = 0
    yield 0
  }
}

const ROUTINES = [spinStep, hopStep, waveStep, slideStep]

function* choreograph(d) {
  let r = d.routine
  while (true) {
    d.swap = false
    yield* ROUTINES[r](d)
    r = d.want
    d.routine = r
  }
}

const dancers = []
for (let i = 0; i < N; i++) {
  const col = i % 8, row = i < 8 ? 0 : 1
  dancers.push({
    i, row, ord: col * 2 + row,
    nx: (col - 3.5) * 0.095 + (row ? 0.0475 : 0),
    ny: row ? 0.1 : -0.055,
    ph: rng() * TAU, hueOff: rng() * 40,
    tilt: 0, armL: 0.2, armR: 0.2, legL: 0.2, legR: 0.2,
    air: 0, drift: 0, pop: 0, spin: 0,
    routine: i % 4, want: i % 4, swap: false, gen: null,
  })
  dancers[i].gen = choreograph(dancers[i])
}

const glints = []
for (let i = 0; i < 10; i++) glints.push({ life: 0, x: 0, y: 0, vx: 0, vy: 0, h: 200 })
let gi = 0, waveT = 9

while (true) {
  const view = s
  A = view.audio
  DT = view.dt
  const dt = view.dt, out = []
  const calm = A.calm || 0
  const bass = A.bass || 0
  const kick = A.kick || 0
  const span = Math.min(view.w, view.h), U = span / 800
  const hue0 = typeof A.keyHue === "number" ? A.keyHue : 200
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 8 ? Math.max(0, 1 - toDrop / 8) : 0
  const rel = Math.min(1, (A.dropAmt || 0) * 1.6)
  const tension = Math.max(build, near) * (1 - rel) * (1 - calm * 0.5)
  const down = A.downbeat || (A.beat && (A.bar || 0) === 0)

  if (A.kickHit) for (let i = 0; i < N; i++) dancers[i].pop = 1
  if (A.snareHit) waveT = 0
  waveT += dt

  if (down && view.frame > 2) {
    for (let i = 0; i < N; i++) {
      const d = dancers[i]
      let r = Math.floor(rng() * 4)
      if (r === d.routine) r = (r + 1) % 4
      d.want = r
      d.swap = true
    }
  }
  if (A.hatHit) {
    const g = glints[gi]
    gi = (gi + 1) % glints.length
    const d = dancers[Math.floor(rng() * N)]
    g.life = 1
    g.x = view.cx + d.nx * span + (rng() - 0.5) * span * 0.03
    g.y = view.cy + d.ny * span - span * 0.155
    g.vx = (rng() - 0.5) * 120 * U
    g.vy = -(80 + rng() * 90) * U
    g.h = hue0 + d.hueOff
  }

  for (let i = 0; i < N; i++) {
    const d = dancers[i]
    d.pop *= Math.exp(-dt * 7)
    d.gen.next()
    const w = waveT > d.ord * 0.035 ? Math.exp(-(waveT - d.ord * 0.035) * 5) : 0
    const H = span * 0.1575
    const air = d.air + d.pop * 0.34 + w * 0.15 - tension * 0.14
    const x = view.cx + d.nx * span * (1 - tension * 0.2) + d.drift * H
    const y = view.cy + d.ny * span * (1 - tension * 0.2) - air * H
    const tilt = d.tilt + w * 0.2
    const sinT = Math.sin(tilt), cosT = Math.cos(tilt)
    const hipX = x + sinT * 0.3 * H, hipY = y - cosT * 0.44 * H
    const shX = hipX + sinT * 0.34 * H, shY = hipY - cosT * 0.34 * H
    const lL = d.legL + w * 0.35 + bass * 0.16
    const lR = d.legR + w * 0.35 + bass * 0.16
    const aL = d.armL + w * 1.1 + rel * 0.7
    const aR = d.armR + w * 1.1 + rel * 0.7
    const footLX = hipX - Math.sin(lL) * 0.44 * H
    const footLY = hipY + Math.cos(lL) * 0.44 * H
    const footRX = hipX + Math.sin(lR) * 0.44 * H
    const footRY = hipY + Math.cos(lR) * 0.44 * H
    const handLX = shX - Math.sin(aL) * 0.36 * H
    const handLY = shY + Math.cos(aL) * 0.36 * H
    const handRX = shX + Math.sin(aR) * 0.36 * H
    const handRY = shY + Math.cos(aR) * 0.36 * H
    const headX = shX + sinT * 0.12 * H, headY = shY - cosT * 0.12 * H
    const hue = hue0 + d.hueOff + i * 3 + w * 50 + rel * 25
    const baseA = Math.min(0.92, (0.62 + bass * 0.12 + d.pop * 0.14) * (d.row ? 0.86 : 1))
    const lw = Math.max(0.9, (1.2 + bass * 1.6 + d.pop) * U)

    out.push({ k: "p", pts: [footLX, footLY, hipX, hipY, footRX, footRY], close: false, h: hue, s: 78, l: 56, a: baseA, lw })
    out.push({ k: "l", x1: hipX, y1: hipY, x2: shX, y2: shY, h: hue, s: 80, l: 58, a: baseA, lw: lw * 1.5 })
    out.push({ k: "p", pts: [handLX, handLY, shX, shY, handRX, handRY], close: false, h: hue, s: 88, l: 58, a: baseA, lw })
    out.push({ k: "c", x: headX, y: headY, r: 0.095 * H + d.pop * 0.03 * H, h: hue + 8, s: 92, l: 62, a: Math.min(0.9, baseA + 0.08) })
    if (d.routine === 0) out.push({ k: "c", x: shX, y: (hipY + shY) * 0.5, r: (0.3 + Math.abs(d.spin) * 0.05) * H, fill: false, h: hue + 40, s: 80, l: 60, a: 0.4, lw: lw * 0.7 })
  }

  for (let i = 0; i < glints.length; i++) {
    const g = glints[i]
    if (g.life <= 0) continue
    g.life -= dt * 1.7
    if (g.life <= 0) continue
    g.x += g.vx * dt
    g.y += g.vy * dt
    g.vy += 30 * U * dt
    out.push({ k: "c", x: g.x, y: g.y, r: (1.6 + g.life * 2.4) * U, h: g.h + 140, s: 85, l: 62, a: g.life * 0.75 })
  }

  s = await frame(out, {
    trail: 0.78 + calm * 0.1 + rel * 0.04,
    zoom: 1.002 + kick * 0.012 + rel * 0.006,
    spin: 0.0012 * (1 - calm * 0.7),
    hue: 0.5,
    react: { punch: 0.6 + kick * 0.4, slice: 0.2 + rel * 0.3, sparkle: 0.5, shake: 0.1 + rel * 0.5, tint: 0.3 },
  })
}

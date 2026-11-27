// name: Time echo
// Style: psychoscript-native delay-vector echoes, inspired by optical delay lines and
// early analogue video feedback. Technique: on every kick the full current shape list
// of a rotating polygon star and its orbiting dots is structuredClone'd into an
// eight-slot ring buffer, then redrawn as progressively larger, dimmer echoes.
// Kick captures an echo and punches the star; bass sets the echo scale; snare steps the
// echo hue; hats throw glints; keyHue colours the figure; calm keeps more echoes; a
// mapped build or toDrop tightens the star and the drop releases the echo burst.
let s = await frame([])
const TAU = Math.PI * 2
const SLOTS = 8
const STAR = 12
const ORBS = 12
const GLINTS = 6
let seed = 1337
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const starC = [], starS = []
for (let i = 0; i < STAR; i++) {
  const a = (i / STAR) * TAU - Math.PI / 2
  const f = i % 2 === 0 ? 1 : 0.46
  starC.push(Math.cos(a) * f)
  starS.push(Math.sin(a) * f)
}
const orbR = [], orbA = [], orbSp = [], orbSz = [], orbHue = []
for (let i = 0; i < ORBS; i++) {
  orbR.push(0.58 + rand() * 0.72)
  orbA.push(rand() * TAU)
  orbSp.push((rand() < 0.5 ? -1 : 1) * (0.22 + rand() * 0.55))
  orbSz.push(0.55 + rand() * 0.8)
  orbHue.push(Math.floor(rand() * 90))
}
const glints = []
for (let i = 0; i < GLINTS; i++) glints.push({ on: false, a: 0, r: 0, life: 0 })
let gi = 0
const ring = []
for (let i = 0; i < SLOTS; i++) ring.push(null)
let head = -1, primed = false
let spin = 0, tension = 0, burst = 0, echoShift = 0
while (true) {
  const A = s.audio, dt = Math.min(0.05, Math.max(0.008, s.dt || 0.016)), out = []
  const span = Math.min(s.w, s.h), U = span / 800
  const calm = A.calm > 0 ? Math.min(1, A.calm) : 0
  const bass = A.bass > 0 ? Math.min(1, A.bass) : 0
  const kick = A.kick > 0 ? Math.min(1, A.kick) : 0
  const hat = A.hat > 0 ? Math.min(1, A.hat) : 0
  const high = A.high > 0 ? Math.min(1, A.high) : 0
  const bright = A.bright > 0 ? Math.min(1, A.bright) : 0
  const dropAmt = A.dropAmt > 0 ? Math.min(1, A.dropAmt) : 0
  const build = A.build > 0 ? Math.min(1, A.build) : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop >= 0 && toDrop < 12 ? 1 - toDrop / 12 : 0
  const hue0 = typeof A.keyHue === "number" && A.keyHue === A.keyHue ? A.keyHue : 200
  if (A.snareHit) {
    echoShift += 27
    if (echoShift >= 360) echoShift -= 360
  }
  if (A.hatHit) {
    const g = glints[gi]
    gi = (gi + 1) % GLINTS
    g.on = true
    g.a = rand() * TAU
    g.r = 0.35 + rand() * 0.9
    g.life = 1
  }
  const tensionTarget = Math.max(build, near)
  tension += (tensionTarget - tension) * Math.min(1, dt * 3)
  if (A.drop) {
    tension = 0
    burst = 1
  }
  burst *= Math.exp(-dt * 2.4)
  spin += dt * (0.24 + bass * 0.42 + dropAmt * 0.2) * (1 - calm * 0.62)
  if (A.beat) spin += 0.06 * (1 - calm * 0.5)
  const R = span * 0.205 * (1 + kick * 0.12 + burst * 0.18) * (1 - tension * 0.3) * (1 + calm * 0.04)
  const rr = R * (1 + 0.05 * Math.cos((A.phase || 0) * TAU))
  const c0 = Math.cos(spin), s0 = Math.sin(spin)
  const fig = [], pts = []
  for (let i = 0; i < STAR; i++) {
    const x = starC[i], y = starS[i]
    pts.push(s.cx + (x * c0 - y * s0) * rr, s.cy + (x * s0 + y * c0) * rr)
  }
  fig.push({ k: "p", pts, h: hue0, s: 88, l: 62, a: 0.9, lw: (1.15 + bass * 1.7 + kick * 2.2) * U * (1 - calm * 0.2) + 0.4 })
  for (let i = 0; i < ORBS; i++) {
    const a = orbA[i] + spin * orbSp[i] * 1.4 + s.t * orbSp[i] * 0.5
    const d = R * orbR[i] * (1 + bass * 0.08) * (1 - tension * 0.22)
    fig.push({ k: "c", x: s.cx + Math.cos(a) * d, y: s.cy + Math.sin(a) * d,
      r: (1.9 + orbSz[i] * 2.2 + high * 1.8 + kick * 1.6) * U,
      h: hue0 + orbHue[i], s: 86, l: 57 + bright * 6, a: 0.88 })
  }
  for (let i = 0; i < GLINTS; i++) {
    const g = glints[i]
    if (!g.on) continue
    g.life -= dt * 2.1
    g.a += dt * 1.4
    if (g.life <= 0) { g.on = false; continue }
    const d = R * g.r * (1.08 + 0.1 * Math.sin(s.t * 3 + i))
    fig.push({ k: "c", x: s.cx + Math.cos(g.a) * d, y: s.cy + Math.sin(g.a) * d,
      r: (1.1 + hat * 1.8 + g.life * 1.1) * U, h: hue0 + 150 + i * 12, s: 80, l: 64,
      a: Math.min(0.9, 0.3 + g.life * 0.6) })
  }
  fig.push({ k: "c", x: s.cx, y: s.cy, r: (2 + kick * 3.5 + bass * 1.8) * U,
    h: hue0 + 24, s: 90, l: 64, a: 0.92 })
  if (A.kickHit) {
    head = (head + 1) % SLOTS
    ring[head] = { shapes: structuredClone(fig), cx: s.cx, cy: s.cy }
  }
  if (!primed) {
    for (let i = 0; i < SLOTS; i++) ring[i] = { shapes: structuredClone(fig), cx: s.cx, cy: s.cy }
    head = SLOTS - 1
    primed = true
  }
  const keep = 3 + Math.round(calm * 5)
  const grow = 0.115 + bass * 0.055
  for (let i = keep - 1; i >= 0; i--) {
    const snap = ring[(head - i + SLOTS) % SLOTS]
    if (!snap) continue
    const age = i + 1
    const k = (1 + age * grow) * (1 + burst * 0.16)
    const ea = 0.3 * Math.pow(1 - i / (keep + 1), 1.5) * (0.75 + calm * 0.25)
    const eHue = echoShift + i * 7
    const shapes = snap.shapes
    for (let j = 0; j < shapes.length; j++) {
      const sh = shapes[j]
      if (sh.k === "p") {
        const src = sh.pts, np = []
        for (let p = 0; p < src.length; p += 2) {
          np.push(s.cx + (src[p] - snap.cx) * k, s.cy + (src[p + 1] - snap.cy) * k)
        }
        out.push({ k: "p", pts: np, h: sh.h + eHue, s: 84, l: 56, a: ea, lw: (sh.lw || 1) * (1 + i * 0.09) })
      } else {
        out.push({ k: "c", x: s.cx + (sh.x - snap.cx) * k, y: s.cy + (sh.y - snap.cy) * k,
          r: sh.r * k, h: sh.h + eHue, s: 84, l: 55, a: ea })
      }
    }
  }
  for (let i = 0; i < fig.length; i++) out.push(fig[i])
  s = await frame(out, {
    trail: 0.78 + calm * 0.14 - dropAmt * 0.04,
    zoom: 1.003 + kick * 0.012 + burst * 0.01,
    spin: 0.001 + bass * 0.0012,
    hue: 0.5 + hat * 1.5,
    react: { punch: 0.4 + kick * 0.5, sparkle: 0.3 + hat * 0.6, tint: 0.2 },
  })
}

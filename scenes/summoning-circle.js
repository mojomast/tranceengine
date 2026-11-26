// name: Summoning circle
// A ritual circle seen in perspective, in four phases. I: chalk lines draw themselves, one heptagram stroke per beat,
// candles light one by one and runes appear on hi-hats. II: the rings counter-rotate, the star pulses on kicks, sparks
// rise on snares. III: a masked figure rises from the centre, its slit eye opening with the energy, threads running to
// it from every candle. IV: overflow, with kaleidoscope folds, candle beams on every beat, shockwave rings and runes
// scattering outward.
let s = await frame([])
const TAU = Math.PI * 2
const PHASES = ["I. Chalk", "II. Ignition", "III. The presence", "IV. Overflow"]
const clampP = (p) => Math.max(0, Math.min(PHASES.length - 1, Math.floor(p) || 0))
let phase = clampP(s.entry), phaseT = 0
const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ".split("")
let strokes = phase > 0 ? 7 : 0, lit = phase > 0 ? 7 : 0, runesShown = phase > 0 ? 24 : 0
let rotA = 0, rotB = 0, rise = phase >= 2 ? 1 : 0, scatter = 0
const sparks = [], waves = []

while (true) {
  const A = s.audio
  const dt = Math.min(0.05, s.dt || 1 / 60)
  if (typeof s.cue === "number" && s.cue >= 0 && s.cue !== phase) {
    phase = clampP(s.cue); phaseT = 0
    if (phase === 0) { strokes = 0; lit = 0; runesShown = 0 } else { strokes = 7; lit = 7; runesShown = 24 }
  }
  phaseT += dt
  const W = s.w, H = s.h, U = Math.min(W, H) / 800
  const ccx = s.cx, ccy = s.cy + H * 0.1
  const rx = Math.min(W * 0.36, H * 0.62), ry = rx * 0.42
  const hue = 12 + (A.keyHue || 0) * 0.2, gold = 42, out = []
  const ell = (k, a) => [ccx + Math.cos(a) * rx * k, ccy + Math.sin(a) * ry * k]

  // Chalk build-up in phase I.
  const draw = phase === 0 ? Math.min(1, phaseT / 5) : 1
  if (phase === 0) {
    if (A.beat && strokes < 7) strokes++
    if (A.beat && lit < strokes) lit++
    if (A.hatHit && runesShown < 24) runesShown++
  }
  rotA += dt * (phase === 0 ? 0 : 0.12 + A.energy * 0.25) * (phase === 3 ? 2 : 1)
  rotB -= dt * (phase === 0 ? 0 : 0.18 + A.energy * 0.3) * (phase === 3 ? 2 : 1)
  if (A.drop) scatter = 1
  scatter = phase === 3 ? Math.max(scatter * 0.995, A.dropAmt) : scatter * 0.95

  // Rings, drawn progressively in phase I.
  ;[1, 0.8, 0.56].forEach((k, j) => {
    const pts = [], seg = Math.max(2, Math.floor(72 * Math.min(1, draw * 1.4 - j * 0.2)))
    for (let i = 0; i <= seg; i++) { const [x, y] = ell(k * (1 + A.kick * 0.02), (i / 72) * TAU + (j % 2 ? rotB : rotA)); pts.push(x, y) }
    if (seg > 2) out.push({ k: "p", pts, close: false, h: j === 1 ? gold : hue, s: 70, l: 55 + A.kick * 12, a: 0.85, lw: (j === 0 ? 2.6 : 1.6) * U })
  })

  // Heptagram {7/3}: one stroke per beat in phase I; pulses on kicks after.
  const V = []
  for (let i = 0; i < 7; i++) V.push(ell(0.8, (i / 7) * TAU - Math.PI / 2 + rotA))
  for (let i = 0; i < strokes; i++) {
    const a = V[(i * 3) % 7], b = V[((i + 1) * 3) % 7]
    out.push({ k: "l", x1: a[0], y1: a[1], x2: b[0], y2: b[1], h: gold, s: 80, l: 55 + A.kick * 20, a: 0.9, lw: (1.6 + A.kick * 2.5) * U })
  }

  // Candles at the star's points: flames flicker with the highs.
  for (let i = 0; i < 7; i++) {
    const [x, y] = V[i]
    out.push({ k: "l", x1: x, y1: y, x2: x, y2: y - 22 * U, h: 40, s: 20, l: 80, a: 0.7, lw: 4 * U })
    if (i < lit) {
      const fl = 1 + Math.sin(s.t * 13 + i * 2) * 0.15 + A.high * 0.4
      out.push({ k: "c", x, y: y - 28 * U, r: 5 * U * fl, h: 35, s: 95, l: 65, a: 0.95 })
      out.push({ k: "c", x, y: y - 30 * U, r: 14 * U * fl, h: 25, s: 90, l: 45, a: 0.2 })
      if (phase === 3 && A.beat) out.push({ k: "l", x1: x, y1: y - 30 * U, x2: x, y2: 0, h: hue + 20, l: 65, a: 0.5, lw: 5 * U })
    }
  }

  // Runes around the outer band: appear on hats in I, ride the ring after, scatter outward in IV.
  for (let i = 0; i < runesShown; i++) {
    const a = (i / 24) * TAU + rotB * 0.7
    const k = 0.9 + scatter * (0.4 + (i % 5) * 0.12)
    const [x, y] = ell(k, a)
    out.push({ k: "w", text: RUNES[i % RUNES.length], x, y, size: 20 * U * (1 + (A.hat > 0.5 && (i + A.hats) % 4 === 0 ? 0.5 : 0)), fx: "neon", t: phaseT + i, font: "sans", h: gold, l: 70, a: 0.9 })
  }

  // Sparks on snares (II onward).
  if (phase >= 1 && A.snareHit) for (let j = 0; j < 8; j++) { const [x, y] = V[(A.snares + j) % 7]; sparks.push({ x, y: y - 30 * U, vx: (Math.random() - 0.5) * 80 * U, vy: -(80 + Math.random() * 160) * U, life: 1 }) }
  for (let j = sparks.length - 1; j >= 0; j--) {
    const p = sparks[j]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * U * dt; p.life -= dt * 1.4
    if (p.life <= 0) { sparks.splice(j, 1); continue }
    out.push({ k: "c", x: p.x, y: p.y, r: 2 * U, h: 35, l: 70, a: p.life })
  }

  // The presence (III and IV): a mask rises from the centre, eye opening with the energy.
  rise += ((phase >= 2 ? 1 : 0) - rise) * Math.min(1, dt * 0.8)
  if (rise > 0.02) {
    const mh = H * 0.42 * rise, mw = rx * 0.22, top = ccy - mh
    const mask = []
    for (let i = 0; i <= 40; i++) { const a = (i / 40) * TAU; mask.push(ccx + Math.cos(a) * mw, top + mh * 0.45 + Math.sin(a) * mh * 0.45) }
    out.push({ k: "p", pts: mask, fill: true, h: hue, s: 40, l: 12, a: 0.25 * rise })
    out.push({ k: "p", pts: mask, h: hue, s: 60, l: 55, a: 0.8 * rise, lw: 2 * U })
    const eo = Math.min(1, 0.15 + A.energy * 0.9 + A.kick * 0.2) * rise, ey = top + mh * 0.35
    const eye = []
    for (let i = 0; i <= 16; i++) { const x = -1 + i / 8; eye.push(ccx + x * mw * 0.12 * eo, ey + Math.sign(x) * 0 + (i <= 8 ? -1 : 1) * Math.sqrt(Math.max(0, 1 - x * x)) * mw * 0.45) }
    out.push({ k: "p", pts: eye, fill: true, h: gold, s: 90, l: 60, a: 0.85 * rise })
    for (let i = 0; i < 7; i++) {
      const [x, y] = V[i]
      out.push({ k: "l", x1: x, y1: y - 30 * U, x2: ccx, y2: ey, h: gold, l: 60, a: (0.15 + A.kick * 0.4) * rise, lw: 1.2 * U })
    }
    if (phase === 2) out.push({ k: "w", text: "IT ANSWERS", x: ccx, y: H * 0.12, size: 46 * U, fx: "glitch", t: phaseT, h: hue, l: 70 })
  }

  // Overflow (IV): shockwave rings on kicks, and the word breaking apart.
  if (phase === 3) {
    if (A.kickHit || A.beat) waves.push({ k: 1, a: 0.9 })
    for (let j = waves.length - 1; j >= 0; j--) {
      const g = waves[j]; g.k += dt * 1.6; g.a -= dt * 0.9
      if (g.a <= 0) { waves.splice(j, 1); continue }
      const pts = []
      for (let i = 0; i <= 48; i++) { const [x, y] = ell(g.k, (i / 48) * TAU); pts.push(x, y) }
      out.push({ k: "p", pts, h: hue + 30, l: 60, a: g.a, lw: 3 * U })
    }
    out.push({ k: "w", text: "OVERFLOW", x: ccx, y: H * 0.12, size: 56 * U, fx: "split", t: phaseT, h: gold, l: 70, seed: 3 })
  } else if (phase === 1) {
    out.push({ k: "w", text: "the circle is open", x: ccx, y: H * 0.1, size: 30 * U, fx: "wave", t: phaseT, font: "mono", h: gold, s: 40, l: 75 })
  }

  s = await frame(out, {
    trail: [0.86, 0.84, 0.86, 0.82][phase] + A.calm * 0.05,
    zoom: phase === 3 ? 1.008 + A.kick * 0.015 : 1.001 + A.kick * 0.006,
    spin: phase === 3 ? 0.002 : 0, hue: phase === 3 ? 1 : 0.2, mirror: phase === 3 ? 6 : 0,
    phase, phases: PHASES.length, title: PHASES[phase], titleFx: "neon", titleHue: gold,
    react: { punch: 1.1, slice: 0.4, sparkle: 1, shake: 0.9, tint: 1.3 },
  })
}

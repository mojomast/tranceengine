// name: Eclipse temple
// A four-act music video built from a library of vector sprites: a stepped temple on a mirror lake,
// a watching eye whose iris is made of the spectrum, blooming lotuses, a moth procession, an orbiting
// ring of glyphs, comets and a crescent moon. Acts change every 16 beats (Dawn, Procession, Ascension,
// Eclipse); a drop jumps straight to the Eclipse, breakdowns fall back to Dawn.
let s = await frame([])
const TAU = Math.PI * 2

// ---------- Asset library: unit-sized vector sprites ----------
const ring = (n, r, ox, oy) => {
  const p = []
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; p.push(ox + Math.cos(a) * r, oy + Math.sin(a) * r) }
  return p
}
const ASSETS = {
  temple: [
    { pts: [-1, 0, -1, -0.16, -0.8, -0.16, -0.8, -0.32, -0.6, -0.32, -0.6, -0.48, -0.4, -0.48, -0.4, -0.64, -0.2, -0.64,
      -0.2, -0.8, 0.2, -0.8, 0.2, -0.64, 0.4, -0.64, 0.4, -0.48, 0.6, -0.48, 0.6, -0.32, 0.8, -0.32, 0.8, -0.16, 1, -0.16, 1, 0], close: true, role: "body" },
    { pts: [-0.13, 0, -0.13, -0.26, 0, -0.36, 0.13, -0.26, 0.13, 0], close: false, role: "door" },
    { pts: [-0.2, -0.8, -0.1, -0.95, 0.1, -0.95, 0.2, -0.8], close: false, role: "crown" },
  ],
  petal: [{ pts: [0, 0, 0.26, -0.32, 0.2, -0.78, 0, -1, -0.2, -0.78, -0.26, -0.32], close: true }],
  wing: [
    { pts: [0, 0, 0.3, -0.6, 0.85, -0.8, 1, -0.48, 0.72, -0.1], close: true, role: "upper" },
    { pts: [0, 0.05, 0.55, 0.14, 0.68, 0.48, 0.34, 0.6, 0.08, 0.32], close: true, role: "lower" },
    { pts: [0.32, -0.42, 0.62, -0.52], close: false, role: "vein" },
  ],
  body: [{ pts: [0, -0.5, 0.08, -0.2, 0.06, 0.45, 0, 0.6, -0.06, 0.45, -0.08, -0.2], close: true }],
  glyphs: [
    [{ pts: [0, -1, 0.87, 0.5, -0.87, 0.5], close: true }, { pts: ring(8, 0.22, 0, 0.1), close: true }],
    [{ pts: (() => { const p = []; for (let i = 0; i < 28; i++) { const a = i * 0.45, r = 0.05 + i * 0.034; p.push(Math.cos(a) * r, Math.sin(a) * r) } return p })(), close: false }],
    [{ pts: [0, -1, 0.22, -0.22, 1, 0, 0.22, 0.22, 0, 1, -0.22, 0.22, -1, 0, -0.22, -0.22], close: true }],
    [{ pts: ring(16, 0.9, 0, 0), close: true }, { pts: [-0.9, 0, 0.9, 0], close: false }, { pts: [0, -0.9, 0, 0.9], close: false }],
  ],
}
// Draw a sprite: position, x/y scale (negative mirrors), rotation, style, optional water ripple.
const put = (out, asset, x, y, sx, sy, rot, st, ripple) => {
  const c = Math.cos(rot), sn = Math.sin(rot)
  for (const part of asset) {
    if (st.only && part.role !== st.only) continue
    const p = part.pts, pts = []
    for (let i = 0; i < p.length; i += 2) {
      const px = p[i] * sx, py = p[i + 1] * sy
      let X = x + px * c - py * sn
      const Y = y + px * sn + py * c
      if (ripple) X += Math.sin(Y * 0.09 + s.t * 4) * ripple
      pts.push(X, Y)
    }
    out.push({ k: "p", pts, close: part.close, fill: !!st.fill, h: st.h, s: st.s, l: st.l, a: st.a, lw: st.lw })
  }
}

// ---------- State ----------
const ACTS = ["I. Dawn", "II. Procession", "III. Ascension", "IV. Eclipse"]
const PAL = [[28, 345], [300, 190], [185, 45], [265, 45]]
// Phases are cued by the director (s.cue) and can start anywhere (s.entry).
let act = Math.max(0, Math.min(3, Math.floor(s.entry) || 0)), phaseT = 0
let hueA = 28, hueB = 345, open = 0.15, camY = 0, glyphTurn = 0, glyphTurnTo = 0, moonX = -1.6
const stars = []
for (let i = 0; i < 70; i++) stars.push({ x: Math.random(), y: Math.random() * 0.62, tw: Math.random() * TAU, r: 0.6 + Math.random() * 1.4 })
const moths = []
for (let i = 0; i < 16; i++) moths.push({ x: s.cx, y: s.h * 0.4, vx: 0, vy: 0, ph: i / 16, hue: (i * 23) % 60 })
const comets = []
const ridge = new Array(64).fill(0)
let rays = 0

while (true) {
  const A = s.audio
  const dt = Math.min(0.05, s.dt || 1 / 60)
  const W = s.w, H = s.h, U = Math.min(W, H) / 1000

  // ---------- Choreography ----------
  if (typeof s.cue === "number" && s.cue >= 0 && s.cue !== act) { act = Math.max(0, Math.min(3, Math.floor(s.cue))); phaseT = 0; if (act === 3) moonX = -1.6 }
  phaseT += dt
  const ease = Math.min(1, dt * 1.5)
  // Each act's palette is shifted toward the song's key colour.
  const keyShift = (A.keyHue || 0) * 0.35
  hueA += (PAL[act][0] + keyShift - hueA) * ease
  hueB += (PAL[act][1] + keyShift - hueB) * ease
  const openTo = A.calm > 0.55 ? 0.08 : [0.18, 0.45, 0.8, 1][act]
  // The eye squints just before each beat (anticip) and pops open on the kick.
  open += (openTo + A.kick * 0.08 - (A.anticip || 0) * 0.12 - open) * Math.min(1, dt * 6)
  camY += ([0, 0, 0.07, 0.03][act] * H - camY) * Math.min(1, dt * 1.2)
  if (A.beat) glyphTurnTo += TAU / 20
  glyphTurn += (glyphTurnTo - glyphTurn) * 0.12
  rays = Math.max(rays * Math.exp(-dt * 5), act >= 1 && A.beat ? 1 : 0)

  const horizon = H * 0.66 + camY
  const eyeX = s.cx, eyeY = H * 0.3 + camY * 0.4
  const eyeW = Math.min(W * 0.2, H * 0.24) * (1 + A.dropAmt * 0.15)
  const out = []

  // Layer 1: stars (parallax: they move less than the camera).
  for (const st of stars) {
    const tw = Math.min(1, 0.5 + 0.5 * Math.sin(st.tw + s.t * (1.5 + A.high * 4)) + (A.hat || 0) * 0.5 * (st.r > 1.4 ? 1 : 0))
    out.push({ k: "c", x: st.x * W, y: st.y * H + camY * 0.2, r: st.r * U * 1.6 * (0.6 + tw * 0.6 + A.snap * 0.5), h: hueB, s: 30, l: 70, a: 0.25 + tw * 0.5 })
  }

  // Layer 2: corona rays from the spectrum (acts III and IV).
  if (act >= 2) {
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU + s.t * 0.05
      const r1 = eyeW * 1.25, r2 = r1 + eyeW * (0.15 + A.bands[i] * 0.9)
      out.push({ k: "l", x1: eyeX + Math.cos(a) * r1, y1: eyeY + Math.sin(a) * r1 * 0.9, x2: eyeX + Math.cos(a) * r2, y2: eyeY + Math.sin(a) * r2 * 0.9,
        h: hueB + i * 2, l: 50 + A.bands[i] * 20, a: 0.55, lw: 2 * U + A.bands[i] * 4 * U })
    }
  }

  // Layer 3: the eye. Lids are a parametric sprite; the iris is 32 fibres, one per band; it watches the pointer.
  const lids = (oy, sign) => {
    const p = []
    for (let i = 0; i <= 24; i++) { const x = -1 + (i / 24) * 2; p.push(eyeX + x * eyeW, oy + sign * (1 - x * x) * open * eyeW * 0.55) }
    return p
  }
  const eyeHue = hueA
  out.push({ k: "p", pts: lids(eyeY, -1), close: false, h: eyeHue, l: 62, lw: 3 * U + A.kick * 3 * U, a: 0.95 })
  out.push({ k: "p", pts: lids(eyeY, 1), close: false, h: eyeHue, l: 62, lw: 3 * U + A.kick * 3 * U, a: 0.95 })
  if (open > 0.22) {
    const look = Math.min(1, Math.hypot(s.mx - eyeX, s.my - eyeY) / (W * 0.5))
    const la = Math.atan2(s.my - eyeY, s.mx - eyeX)
    const ix = eyeX + Math.cos(la) * look * eyeW * 0.28, iy = eyeY + Math.sin(la) * look * eyeW * 0.1 * open
    const vis = Math.min(1, (open - 0.22) / 0.3)
    const rI = eyeW * 0.36 * Math.min(1, open * 1.3) * (1 + A.bass * 0.1)
    const rP = rI * (0.32 + A.dropAmt * 0.3 - A.kick * 0.06)
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU
      const r2 = rP + (rI - rP) * (0.55 + A.bands[i] * 0.45)
      out.push({ k: "l", x1: ix + Math.cos(a) * rP, y1: iy + Math.sin(a) * rP, x2: ix + Math.cos(a) * r2, y2: iy + Math.sin(a) * r2,
        h: hueB + A.bands[i] * 40, l: 55, a: vis * 0.8, lw: 1.6 * U })
    }
    out.push({ k: "c", x: ix, y: iy, r: rI, fill: false, h: hueA, l: 60, a: vis, lw: 2 * U })
    out.push({ k: "c", x: ix, y: iy, r: rP, fill: false, h: 50, l: 70, a: vis, lw: (2 + A.kick * 3) * U })
    out.push({ k: "c", x: ix - rP * 0.6, y: iy - rP * 0.6, r: rP * 0.25, h: 50, s: 20, l: 85, a: vis * 0.8 })
  }

  // Layer 4: crescent moon crossing the eye during the eclipse.
  if (act === 3) {
    moonX = Math.min(1.6, moonX + dt * 0.12)
    const mx = eyeX + moonX * eyeW * 1.4, mr = eyeW * 0.62, pts = []
    for (let i = 0; i <= 20; i++) { const a = -Math.PI / 2 + (i / 20) * Math.PI; pts.push(mx + Math.cos(a) * mr, eyeY + Math.sin(a) * mr) }
    for (let i = 20; i >= 0; i--) { const a = -Math.PI / 2 + (i / 20) * Math.PI; pts.push(mx + Math.cos(a) * mr * 0.45, eyeY + Math.sin(a) * mr * 0.92) }
    out.push({ k: "p", pts, fill: true, h: 45, s: 60, l: 55, a: 0.35 })
    out.push({ k: "p", pts, h: 45, s: 70, l: 70, a: 0.9, lw: 2 * U })
  }

  // Layer 5: glyph ring orbiting the eye (acts II–IV); snares flare one glyph.
  if (act >= 1) {
    const n = 10, gr = eyeW * 1.75
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + glyphTurn
      const flare = i === A.snaps % n ? A.snap : 0
      const g = ASSETS.glyphs[(i + A.bar) % ASSETS.glyphs.length]
      put(out, g, eyeX + Math.cos(a) * gr, eyeY + Math.sin(a) * gr * 0.62, (9 + flare * 8) * U, (9 + flare * 8) * U, a,
        { h: hueA + 20, l: 58 + flare * 20, a: 0.7 + flare * 0.3, lw: 1.5 * U })
    }
  }

  // Layer 6: mountain ridge made from the spectrum, smoothed, with its reflection.
  for (let i = 0; i < 64; i++) ridge[i] += (A.bands[Math.floor(i / 2)] - ridge[i]) * 0.08
  const ridgePts = [], ridgeRef = []
  for (let i = 0; i < 64; i++) {
    const x = (i / 63) * W
    const edge = Math.sin((i / 63) * Math.PI)
    const hgt = (0.03 + ridge[(i * 7) % 64] * 0.12 * (1 - A.calm * 0.6)) * H * (0.4 + edge * 0.6)
    ridgePts.push(x, horizon - hgt)
    ridgeRef.push(x + Math.sin(i + s.t * 3) * 2 * U, horizon + hgt * 0.6)
  }
  out.push({ k: "p", pts: ridgePts, close: false, h: hueB, l: 45, a: 0.7, lw: 1.5 * U })
  out.push({ k: "p", pts: ridgeRef, close: false, h: hueB, l: 40, a: 0.25, lw: 1.2 * U })
  out.push({ k: "l", x1: 0, y1: horizon, x2: W, y2: horizon, h: hueA, l: 55, a: 0.6, lw: 1.2 * U })

  // Layer 7: the temple, its beat rays, and its reflection on the lake.
  const tW = Math.min(W * 0.2, H * 0.32), tH = tW * 0.9
  if (rays > 0.02) {
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.16
      const len = H * (0.25 + 0.2 * A.bands[i * 3])
      out.push({ k: "l", x1: s.cx, y1: horizon - tH * 0.95, x2: s.cx + Math.cos(a) * len, y2: horizon - tH * 0.95 + Math.sin(a) * len,
        h: hueA + 30, l: 65, a: rays * 0.6, lw: 3 * U })
    }
  }
  put(out, ASSETS.temple, s.cx, horizon, tW, tH, 0, { h: hueA, l: 52 + A.kick * 12, a: 0.95, lw: 2.2 * U })
  put(out, ASSETS.temple, s.cx, horizon, tW, tH, 0, { only: "body", fill: true, h: hueA, l: 22, a: 0.035 })
  put(out, ASSETS.temple, s.cx, horizon, tW, tH, 0, { only: "door", h: 48, l: 60 + A.kick * 25, a: 1, lw: (3 + A.kick * 5) * U })
  put(out, ASSETS.temple, s.cx, horizon, tW, -tH * 0.7, 0, { h: hueA, l: 45, a: 0.22, lw: 1.6 * U }, (1.5 + A.bass * 4) * U)

  // Layer 8: lotuses along the water line; they open with the bar and the energy.
  const bloom = A.calm > 0.55 ? 0.1 : Math.min(1, 0.25 + A.bar * 0.2 + A.energy * 0.3)
  for (let j = 0; j < 5; j++) {
    const lx = W * (0.1 + j * 0.2)
    if (Math.abs(lx - s.cx) < tW * 1.05) continue
    const ly = horizon + H * 0.1 + (j % 2) * H * 0.05
    const size = (34 + (j % 2) * 10) * U * (1 + A.kick * 0.1)
    for (let k = 0; k < 7; k++) {
      const ang = (k - 3) * 0.32 * bloom
      put(out, ASSETS.petal, lx, ly, size * 0.55, size * (0.85 + 0.15 * Math.cos(A.phase * TAU)), ang,
        { h: hueB + k * 6, l: 55 + (k === 3 ? 10 : 0), a: 0.75, lw: 1.6 * U })
    }
  }

  // Layer 9: the moth procession, flying a figure-eight around the eye; wings flap twice per beat.
  for (let i = 0; i < moths.length; i++) {
    const m = moths[i]
    if (A.drop) { const a = Math.random() * TAU; m.vx += Math.cos(a) * 14; m.vy += Math.sin(a) * 14 }
    const th = s.t * (0.25 + A.energy * 0.35) + m.ph * TAU
    const spread = act === 0 ? 0.6 : 1
    const tx = eyeX + Math.cos(th) * eyeW * 2.3 * spread
    const ty = eyeY + Math.sin(th * 2) * eyeW * 0.8 * spread + eyeW * 0.2
    m.vx += (tx - m.x) * 0.02; m.vy += (ty - m.y) * 0.02
    m.vx *= 0.9; m.vy *= 0.9
    m.x += m.vx; m.y += m.vy
    const flap = 0.25 + 0.75 * Math.abs(Math.cos((A.phase * 2 + m.ph) * Math.PI))
    const head = Math.atan2(m.vy, m.vx) + Math.PI / 2
    const ms = (14 + A.mid * 6) * U
    const st = { h: hueA + m.hue, l: 60, a: act === 0 ? 0.5 : 0.85, lw: 1.3 * U }
    put(out, ASSETS.wing, m.x, m.y, ms * flap, ms, head, st)
    put(out, ASSETS.wing, m.x, m.y, -ms * flap, ms, head, st)
    put(out, ASSETS.body, m.x, m.y, ms, ms, head, { h: 45, l: 70, a: 0.9, lw: 1.2 * U })
  }

  // Layer 10: comets on snares (acts III–IV).
  if (A.snapHit && act >= 2 && comets.length < 6) {
    comets.push({ x: Math.random() * W, y: -10, vx: (Math.random() - 0.5) * 6 * U * 60, vy: (5 + Math.random() * 4) * U * 60, life: 1 })
  }
  for (let j = comets.length - 1; j >= 0; j--) {
    const c = comets[j]
    c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt * 0.6
    if (c.life <= 0 || c.y > horizon) { comets.splice(j, 1); continue }
    out.push({ k: "l", x1: c.x, y1: c.y, x2: c.x - c.vx * 0.18, y2: c.y - c.vy * 0.18, h: hueB + 40, l: 70, a: c.life * 0.7, lw: 2 * U })
    out.push({ k: "c", x: c.x, y: c.y, r: 3 * U + 2, h: 50, l: 80, a: c.life })
  }


  s = await frame(out, {
    trail: [0.86, 0.84, 0.82, 0.88][act] + A.calm * 0.06,
    zoom: 1.002 + A.kick * 0.012 + A.dropAmt * 0.01,
    spin: 0,
    hue: 0.3,
    mirror: act === 3 && A.dropAmt > 0.5 ? 6 : 0,
    phase: act, phases: 4, title: ACTS[act], titleFx: "rise", titleHue: hueA,
  })
}

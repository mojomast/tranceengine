// name: Phosphor odyssey
// Retro vector, after oscilloscope music (Jerobeam Fenderson's XY art on a green phosphor tube): one beam travels
// through four tableaux. I. Signal: a circle breathing with the bass while a radar sweep steps round on the beats.
// II. Lissajous: ratio figures steered by the song's note. III. Wireframe: rotating vector solids drawn in one
// stroke. IV. Bloom: a vector flower field with beam echoes.
// Psychoscript technique: a seeded mulberry32 PRNG (Math.imul) lays out the flowers, the tear tables and the solid
// order, and a fresh stream seeded from the frame number picks glints and jolts, so a rewind, beat-repeat or replay
// redraws exactly the same frames.
// Reactions: kick punches the beam, snare disrupts it (ring tear, phase jump, axis jolt, petal spin), hats drop
// glints along the trace, bass sets its weight, note picks the ratio, keyHue warms the phosphor, build/toDrop
// gather it tight, the drop bursts it open, calm slows it and stretches the phosphor decay (fx.trail).
let s = await frame([])
const TAU = Math.PI * 2
const PHASES = ["I. Signal", "II. Lissajous", "III. Wireframe", "IV. Bloom"]
const clampP = (p) => Math.max(0, Math.min(3, Math.floor(p) || 0))
let phase = clampP(s.entry), phaseT = 0

// Seeded mulberry32 PRNG: the only randomness in the scene.
const mulberry32 = (seed) => {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6D2B79F5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(0x0B055C0D)

// Signal: ring directions and a per-point tear table, precomputed once.
const N1 = 96
const ringC = [], ringS = [], tearT = []
for (let i = 0; i < N1; i++) {
  const a = (i / N1) * TAU
  ringC.push(Math.cos(a)); ringS.push(Math.sin(a)); tearT.push(rnd() * 2 - 1)
}
// Lissajous: curve parameter and the ratio table the note picks from.
const N2 = 150
const liU = []
for (let i = 0; i < N2; i++) liU.push((i / N2) * TAU)
const RATIOS = [[1, 2], [2, 3], [3, 4], [3, 5], [4, 5], [5, 6], [1, 3], [2, 5], [3, 7], [4, 7], [5, 7], [5, 8]]
let ra = 3, rb = 4, dPhase = 0
// Wireframe: four solids, each drawn as one continuous stroke (the index walk retraces edges to stay in one line).
const SOLIDS = [
  { name: "TETRA", v: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], st: [0, 1, 2, 3, 0, 2, 1, 3] },
  { name: "CUBE", v: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], st: [0, 1, 2, 3, 0, 4, 5, 1, 5, 6, 2, 6, 7, 3, 7, 4] },
  { name: "OCTA", v: [[0, 1.3, 0], [0, -1.3, 0], [1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1]], st: [0, 2, 1, 3, 0, 4, 1, 5, 0, 2, 3, 4, 5, 2] },
  { name: "STAR", v: [[0, 0, 0], [1.5, 0, 0], [-1.5, 0, 0], [0, 1.5, 0], [0, -1.5, 0], [0, 0, 1.5], [0, 0, -1.5]], st: [1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6] },
]
const ORDER = [0, 1, 2, 3]
for (let i = 3; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const tmp = ORDER[i]; ORDER[i] = ORDER[j]; ORDER[j] = tmp }
let solidStep = 0, rotX = 0.6, rotY = 0.2, morph = 0
const proX = [], proY = [], proXi = [], proYi = []
// Bloom: a field of vector flowers, each a precomputed rose curve (petal count from the PRNG).
const NF = 14, NM = 26
const flowers = []
for (let i = 0; i < NF; i++) {
  const p = 3 + Math.floor(rnd() * 5)
  const ux = [], uy = []
  for (let j = 0; j < NM; j++) {
    const th = (j / NM) * TAU
    const rr = 0.25 + 0.75 * Math.cos(p * th) * Math.cos(p * th)
    ux.push(rr * Math.cos(th)); uy.push(rr * Math.sin(th))
  }
  flowers.push({ x: (rnd() * 2 - 1) * 0.9, y: (rnd() * 2 - 1) * 0.72, r: 0.055 + rnd() * 0.05, sp: (rnd() - 0.5) * 1.7, ph: rnd() * TAU, ux, uy })
}
// Live state: envelopes shared by every tableau, so phase changes stay continuous.
let punch = 0, snr = 0, burst = 0, tear = 0, gatherS = 0, hue = 125
const glints = []
const PHASE_HUE = [0, 22, -14, 34]

while (true) {
  const A = s.audio, dt = Math.min(0.05, s.dt || 1 / 60)
  if (typeof s.cue === "number" && s.cue >= 0 && s.cue !== phase) { phase = clampP(s.cue); phaseT = 0; tear = 0; morph = 0 }
  phaseT += dt
  const W = s.w, H = s.h, minWH = Math.min(W, H), U = minWH / 800, out = []
  const calm = A.calm || 0, bass = A.bass || 0, energy = A.energy || 0
  punch = Math.max(punch * Math.exp(-dt * 7), A.kickHit ? 1 : 0)
  if (A.downbeat) punch = Math.max(punch, 0.45)
  snr = Math.max(snr * Math.exp(-dt * 5), A.snareHit ? 1 : 0)
  burst = Math.max(burst * Math.exp(-dt * 2.2), A.drop ? 1 : 0)
  let gather = A.build || 0
  if (A.toDrop > 0 && A.toDrop < 8) gather = Math.max(gather, 1 - A.toDrop / 8)
  gatherS += (gather - gatherS) * Math.min(1, dt * 4)
  hue += (125 + ((A.keyHue || 90) - 90) * 0.1 - hue) * Math.min(1, dt * 0.6)
  const hb = hue + PHASE_HUE[phase]
  // This frame's deterministic stream: same frame number, same picks, on every replay.
  const rf = mulberry32(((s.frame | 0) * 2654435761 + 0x9E3779B9) >>> 0)
  if (A.hatHit) for (let q = 0; q < 2; q++) { if (glints.length < 12) glints.push({ u: rf(), v: rf(), life: 1 }) }
  const breathe = 1 + bass * 0.16 + punch * 0.1 - gatherS * 0.14 + burst * 0.3
  const G = minWH * 0.37
  // Graticule: the dim tube face every tableau is drawn on.
  out.push({ k: "c", x: s.cx, y: s.cy, r: G, fill: false, h: hb, s: 55, l: 24, a: 0.4, lw: 1 })
  out.push({ k: "c", x: s.cx, y: s.cy, r: G * 0.5, fill: false, h: hb, s: 55, l: 20, a: 0.32, lw: 1 })
  out.push({ k: "l", x1: s.cx - G, y1: s.cy, x2: s.cx + G, y2: s.cy, h: hb, s: 55, l: 20, a: 0.3, lw: 1 })
  out.push({ k: "l", x1: s.cx, y1: s.cy - G, x2: s.cx, y2: s.cy + G, h: hb, s: 55, l: 20, a: 0.3, lw: 1 })
  const lwB = (1.4 + bass * 1.6 + punch * 1.2) * U
  let label = ""
  if (phase === 0) {
    // I. Signal: a circle breathing with the bass; the snare tears it, the sweep steps on beats.
    tear = Math.max(tear * Math.exp(-dt * 6), A.snareHit ? 1 : 0)
    const R = minWH * 0.3 * breathe
    const bands = A.bands || []
    const shift = Math.floor(s.t * 3) % 32
    const pts = []
    for (let i = 0; i < N1; i++) {
      const rr = R * (1 + ((bands[(i + shift) & 31] || 0) - 0.5) * 0.16 + tear * tearT[i] * 0.22)
      pts.push(s.cx + ringC[i] * rr, s.cy + ringS[i] * rr)
    }
    out.push({ k: "p", pts, h: hb, s: 90, l: 55 + punch * 8, a: 0.85, lw: lwB })
    const pts2 = []
    for (let i = 0; i < N1; i += 2) pts2.push(s.cx + ringC[i] * R * 1.13, s.cy + ringS[i] * R * 1.13)
    out.push({ k: "p", pts: pts2, h: hb, s: 80, l: 42, a: 0.3, lw: 1 * U })
    const swA = (A.beats || 0) * 2.39996 + (A.phase || 0) * 0.5
    const sx = s.cx + Math.cos(swA) * R, sy = s.cy + Math.sin(swA) * R
    out.push({ k: "l", x1: s.cx, y1: s.cy, x2: sx, y2: sy, h: hb, s: 70, l: 45, a: 0.5, lw: 1.2 * U })
    out.push({ k: "c", x: sx, y: sy, r: (3 + punch * 3) * U, h: hb, s: 80, l: 60, a: 0.8 })
    label = "SIGNAL · BASS BREATH"
  } else if (phase === 1) {
    // II. Lissajous: the note picks a ratio; the figures morph toward it, the snare jumps their phase.
    const ratio = RATIOS[Math.max(0, Math.min(11, Math.floor(A.note || 0)))]
    ra += (ratio[0] - ra) * Math.min(1, dt * 1.6)
    rb += (ratio[1] - rb) * Math.min(1, dt * 1.6)
    if (A.snareHit) dPhase += (rf() - 0.5) * 2.4
    dPhase += dt * (0.5 + energy * 0.9) * (calm > 0.5 ? 0.4 : 1)
    const amp = minWH * 0.3 * breathe, h3 = snr * 0.22
    const pts = []
    for (let i = 0; i < N2; i++) {
      const tt = liU[i]
      let x = Math.sin(ra * tt + dPhase), y = Math.sin(rb * tt)
      if (h3 > 0.01) x += Math.sin(3 * ra * tt + dPhase) * h3
      pts.push(s.cx + x * amp, s.cy + y * amp * 0.8)
    }
    out.push({ k: "p", pts, close: false, h: hb, s: 90, l: 55 + punch * 8, a: 0.85, lw: lwB })
    const gh = []
    for (let i = 0; i < pts.length; i += 2) gh.push(pts[i] + 7 * U, pts[i + 1] - 5 * U)
    out.push({ k: "p", pts: gh, close: false, h: hb, s: 75, l: 40, a: 0.28, lw: 1 * U })
    label = "LISSAJOUS · " + ratio[0] + ":" + ratio[1]
  } else if (phase === 2) {
    // III. Wireframe: one-stroke vector solids; the downbeat swaps the solid, the snare jolts the axes.
    if (A.downbeat) { solidStep++; morph = 1 }
    morph *= Math.exp(-dt * 6)
    if (A.snareHit) { rotX += (rf() - 0.5) * 1.6; rotY += (rf() - 0.5) * 1.6 }
    const spd = (0.5 + energy * 0.7 + gatherS * 1.6) * (calm > 0.5 ? 0.45 : 1)
    rotX += dt * spd; rotY += dt * spd * 0.7
    const so = SOLIDS[ORDER[solidStep % 4]]
    const SC = minWH * 0.21 * breathe * (1 - morph * 0.45)
    const cxr = Math.cos(rotX), sxr = Math.sin(rotX), cyr = Math.cos(rotY), syr = Math.sin(rotY)
    const cyr2 = Math.cos(-rotY * 1.3), syr2 = Math.sin(-rotY * 1.3)
    const nv = so.v.length
    for (let i = 0; i < nv; i++) {
      const vx = so.v[i][0], vy = so.v[i][1], vz = so.v[i][2]
      const x1 = vx * cyr + vz * syr, z1 = vz * cyr - vx * syr
      const y2 = vy * cxr - z1 * sxr, z2 = vy * sxr + z1 * cxr
      const k = 3.4 / (3.4 + z2 * 0.8)
      proX[i] = s.cx + x1 * SC * k; proY[i] = s.cy + y2 * SC * k
      const ix = vx * cyr2 + vz * syr2, iz = vz * cyr2 - vx * syr2
      const iy = vy * cxr - iz * sxr, iz2 = vy * sxr + iz * cxr
      const k2 = 3.4 / (3.4 + iz2 * 0.8)
      proXi[i] = s.cx + ix * SC * 0.45 * k2; proYi[i] = s.cy + iy * SC * 0.45 * k2
    }
    const st = so.st, pts = [], ptsIn = []
    for (let i = 0; i < st.length; i++) { const vi = st[i]; pts.push(proX[vi], proY[vi]); ptsIn.push(proXi[vi], proYi[vi]) }
    out.push({ k: "p", pts, close: false, h: hb, s: 90, l: 55 + punch * 8, a: 0.85, lw: lwB })
    out.push({ k: "p", pts: ptsIn, close: false, h: hb + 30, s: 80, l: 45, a: 0.4, lw: 1 * U })
    if (punch > 0.25) for (let i = 0; i < nv; i++) out.push({ k: "c", x: proX[i], y: proY[i], r: (2 + punch * 2.5) * U, h: hb, s: 70, l: 60, a: punch * 0.7 })
    label = "WIREFRAME · " + so.name
  } else {
    // IV. Bloom: a field of vector roses; kicks make them bloom, the drop throws them open, each has a beam echo.
    const bloomK = Math.max(0.15, (0.6 + bass * 0.35 + punch * 0.2 + burst * 0.5 - gatherS * 0.2) * (calm > 0.5 ? 0.8 : 1))
    const spread = minWH * 0.33
    for (let i = 0; i < NF; i++) {
      const f = flowers[i]
      const fx = s.cx + f.x * spread, fy = s.cy + f.y * spread
      const rot = f.ph + s.t * f.sp * (0.4 + energy * 0.8) * (calm > 0.5 ? 0.4 : 1) + snr * f.sp * 1.5
      const cs = Math.cos(rot), sn = Math.sin(rot)
      const sc = f.r * minWH * bloomK
      const pts = [], ech = []
      for (let j = 0; j < NM; j++) {
        const px = f.ux[j], py = f.uy[j]
        const X = (px * cs - py * sn) * sc, Y = (px * sn + py * cs) * sc
        pts.push(fx + X, fy + Y)
        ech.push(fx + X * 1.22 - Y * 0.1, fy + Y * 1.22 + X * 0.1)
      }
      out.push({ k: "p", pts, h: hb + i * 3, s: 85, l: 50 + punch * 8, a: 0.75, lw: lwB * 0.8 })
      out.push({ k: "p", pts: ech, h: hb + i * 3 + 20, s: 70, l: 40, a: 0.26, lw: 1 * U })
    }
    label = "BLOOM · " + NF + " FLOWERS"
  }
  // Hat glints: bright specks along whatever figure is on the tube.
  for (let gi = glints.length - 1; gi >= 0; gi--) {
    const g = glints[gi]
    g.life -= dt * 2.6
    if (g.life <= 0) { glints.splice(gi, 1); continue }
    let gx = s.cx, gy = s.cy
    if (phase === 0) {
      const a = g.u * TAU, rr = minWH * 0.3 * breathe * (0.85 + g.v * 0.3)
      gx += Math.cos(a) * rr; gy += Math.sin(a) * rr
    } else if (phase === 1) {
      const tt = g.u * TAU, amp = minWH * 0.3 * breathe
      gx += Math.sin(ra * tt + dPhase) * amp; gy += Math.sin(rb * tt) * amp * 0.8
    } else if (phase === 2) {
      const so = SOLIDS[ORDER[solidStep % 4]]
      const vi = Math.min(so.v.length - 1, Math.floor(g.u * so.v.length))
      gx = proX[vi]; gy = proY[vi]
    } else {
      const f = flowers[Math.min(NF - 1, Math.floor(g.u * NF))]
      const j = Math.min(NM - 1, Math.floor(g.v * NM))
      const rot = f.ph + s.t * f.sp, cs = Math.cos(rot), sn = Math.sin(rot), sc = f.r * minWH
      const px = f.ux[j], py = f.uy[j]
      gx = s.cx + f.x * minWH * 0.33 + (px * cs - py * sn) * sc
      gy = s.cy + f.y * minWH * 0.33 + (px * sn + py * cs) * sc
    }
    out.push({ k: "c", x: gx, y: gy, r: (1.5 + g.life * 2.5) * U, h: hb + 40, s: 60, l: 62, a: g.life * 0.85 })
  }
  out.push({ k: "w", text: label, x: s.cx, y: Math.min(H - 18 * U, s.cy + G + 24 * U), size: Math.max(9, 15 * U), fx: "neon", t: phaseT, font: "mono", h: hb, s: 45, l: 42, a: 0.65 })

  s = await frame(out, {
    trail: Math.max(0.5, Math.min(0.93, 0.8 + calm * 0.1 + gatherS * 0.05 - burst * 0.22)),
    zoom: 1 + punch * 0.004 - gatherS * 0.003,
    spin: 0,
    hue: 0.3,
    mirror: 0,
    phase, phases: PHASES.length, title: PHASES[phase], titleFx: phase === 3 ? "neon" : "rise", titleHue: hb,
    react: { punch: 1.2, slice: 0.5, sparkle: 1.2, shake: 0.5, tint: 0.9 },
  })
}

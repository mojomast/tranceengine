// name: Polytope chapel
// Four-dimensional solids rotating through 4D and projected down to the screen, in four phases.
// I. Tesseract: a single hypercube turning inside out. II. Compound: tesseract, 16-cell and 24-cell nested together,
// each turning at its own rate (a polyrhythm). III. Cathedral: a ring of hypercubes around a 24-cell, circling faster
// and closing in as the build rises. IV. 600-cell: 120 vertices and 720 edges unfold on the drop.
// Motion is quantised to the music: every beat turns the XW plane an eighth of a turn, every snare flips the ZW plane,
// kicks inflate the fourth dimension, hats light vertices, and the edges are coloured by how far into 4D they sit.
let s = await frame([])
const TAU = Math.PI * 2
const PHI = (1 + Math.sqrt(5)) / 2
const PHASES = ["I. Tesseract", "II. Compound", "III. Cathedral", "IV. 600-cell"]
const clampP = (p) => Math.max(0, Math.min(PHASES.length - 1, Math.floor(p) || 0))
let phase = clampP(s.entry), phaseT = 0
const norm = (v) => { const n = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2] + v[3] * v[3]); return v.map((x) => x / n) }
const edgesOf = (V, len) => {
  const E = []
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
    const d = Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2], V[i][3] - V[j][3])
    if (Math.abs(d - len) < 0.02) E.push(i, j)
  }
  return E
}
// Tesseract: (±½, ±½, ±½, ±½), edge 1.
const TV = []; for (let m = 0; m < 16; m++) TV.push([m & 1 ? 0.5 : -0.5, m & 2 ? 0.5 : -0.5, m & 4 ? 0.5 : -0.5, m & 8 ? 0.5 : -0.5])
// 16-cell: (±1, 0, 0, 0) and permutations, edge √2.
const XV = []; for (let a = 0; a < 4; a++) for (const sg of [1, -1]) { const v = [0, 0, 0, 0]; v[a] = sg; XV.push(v) }
// 24-cell: permutations of (±1, ±1, 0, 0), scaled to unit radius; edge 1.
const FV = []
for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) for (const sa of [1, -1]) for (const sb of [1, -1]) { const v = [0, 0, 0, 0]; v[a] = sa / Math.SQRT2; v[b] = sb / Math.SQRT2; FV.push(v) }
// 600-cell: 8 + 16 + 96 vertices on the unit 3-sphere; edges of length 1/φ.
const SV = []
for (const v of XV) SV.push(v)
for (let m = 0; m < 16; m++) SV.push([m & 1 ? 0.5 : -0.5, m & 2 ? 0.5 : -0.5, m & 4 ? 0.5 : -0.5, m & 8 ? 0.5 : -0.5])
const EVEN = [[0, 1, 2, 3], [0, 2, 3, 1], [0, 3, 1, 2], [1, 0, 3, 2], [1, 2, 0, 3], [1, 3, 2, 0], [2, 0, 1, 3], [2, 1, 3, 0], [2, 3, 0, 1], [3, 0, 2, 1], [3, 1, 0, 2], [3, 2, 1, 0]]
for (const pm of EVEN) for (let m = 0; m < 8; m++) {
  const base = [(m & 1 ? -1 : 1) * PHI / 2, (m & 2 ? -1 : 1) * 0.5, (m & 4 ? -1 : 1) / (2 * PHI), 0]
  const v = [0, 0, 0, 0]; for (let q = 0; q < 4; q++) v[pm[q]] = base[q]
  SV.push(v)
}
const SOLIDS = {
  tess: { V: TV, E: edgesOf(TV, 1) },
  cross: { V: XV, E: edgesOf(XV, Math.SQRT2) },
  icosi: { V: FV, E: edgesOf(FV, 1) },
  hex: { V: SV, E: edgesOf(SV, 1 / PHI) },
}
// Rotation state per plane, chasing targets that step on the beat.
const ang = { xw: 0, yw: 0, zw: 0, xy: 0 }, tgt = { xw: 0, yw: 0, zw: 0, xy: 0 }
let inflate = 0, hue = 260, unfold = phase === 3 ? 1 : 0, yaw = 0, ring = 0, lit = new Array(120).fill(0)
let beatCount = 0
const project = (V, rot, dW, scale, ox, oy, oz, cyw, syw) => {
  const out = []
  const c1 = Math.cos(rot.xw), s1 = Math.sin(rot.xw), c2 = Math.cos(rot.yw), s2 = Math.sin(rot.yw), c3 = Math.cos(rot.zw), s3 = Math.sin(rot.zw), c4 = Math.cos(rot.xy), s4 = Math.sin(rot.xy)
  for (const v of V) {
    let x = v[0], y = v[1], z = v[2], w = v[3]
    let t = x * c1 - w * s1; w = x * s1 + w * c1; x = t
    t = y * c2 - w * s2; w = y * s2 + w * c2; y = t
    t = z * c3 - w * s3; w = z * s3 + w * c3; z = t
    t = x * c4 - y * s4; y = x * s4 + y * c4; x = t
    const k4 = 1 / (dW - w)
    x *= k4; y *= k4; z *= k4
    const xr = x * cyw - z * syw, zr = x * syw + z * cyw
    const X = xr * scale + ox, Y = y * scale + oy, Z = zr * scale + oz
    const k = 900 / (900 + Z)
    out.push([s.cx + X * k, s.cy + Y * k, w, k])
  }
  return out
}

while (true) {
  const A = s.audio
  const dt = Math.min(0.05, s.dt || 1 / 60)
  if (typeof s.cue === "number" && s.cue >= 0 && s.cue !== phase) { phase = clampP(s.cue); phaseT = 0 }
  phaseT += dt
  const W = s.w, H = s.h, M = Math.min(W, H), out = []
  const build = A.build || 0
  // Quantised motion: each beat turns XW an eighth; every other beat YW a sixteenth; snares flip ZW a quarter.
  if (A.beat) { beatCount++; tgt.xw += TAU / 8; if (beatCount % 2 === 0) tgt.yw += TAU / 16 }
  if (A.snareHit) tgt.zw += TAU / 4 * (Math.random() < 0.5 ? 1 : -1)
  tgt.xy += dt * (0.05 + build * 0.4)
  for (const k in ang) ang[k] += (tgt[k] - ang[k]) * Math.min(1, dt * (6 + build * 6))
  inflate = Math.max(inflate * Math.exp(-dt * 5), A.kickHit ? 1 : 0)
  if (A.drop || (phase === 3 && phaseT < 0.05)) unfold = 0
  unfold += (1 - unfold) * Math.min(1, dt * 1.2)
  if (A.hatHit) for (let q = 0; q < 10; q++) lit[Math.floor(Math.random() * 120)] = 1
  hue += ((((A.note || 0) * 30 + 220) % 360) - hue) * Math.min(1, dt * 0.4)
  yaw += dt * (0.1 + build * 0.6)
  const cyw = Math.cos(yaw), syw = Math.sin(yaw)
  const dW = 2.2 - inflate * 0.35 - build * 0.3
  const U = M / 800
  const drawSolid = (sol, rot, scale, ox, oy, oz, hshift, alpha, lw, vertexGlow) => {
    const P = project(sol.V, rot, dW, scale, ox, oy, oz, cyw, syw), E = sol.E
    for (let e = 0; e < E.length; e += 2) {
      const a = P[E[e]], b = P[E[e + 1]], w = (a[2] + b[2]) / 2, k = (a[3] + b[3]) / 2
      out.push({ k: "l", x1: a[0], y1: a[1], x2: b[0], y2: b[1], h: hue + hshift + w * 110, s: 75, l: 42 + (w + 1) * 15 + inflate * 8, a: alpha * (0.35 + (w + 1) * 0.3), lw: lw * k * U })
    }
    if (vertexGlow) for (let i = 0; i < P.length; i++) {
      const g = lit[i % 120]
      if (g > 0.08) out.push({ k: "c", x: P[i][0], y: P[i][1], r: (2.5 + g * 6) * P[i][3] * U, h: hue + hshift + 40, s: 50, l: 80, a: g * alpha })
    }
  }
  const sc = M * 0.55 * (1 + inflate * 0.05)
  if (phase === 0) {
    drawSolid(SOLIDS.tess, ang, sc * 1.1, 0, 0, 0, 0, 1, 3.2, true)
  } else if (phase === 1) {
    drawSolid(SOLIDS.icosi, { xw: ang.xw * 0.5, yw: ang.yw, zw: ang.zw * 0.5, xy: ang.xy }, sc * 1.15, 0, 0, 0, 60, 0.7, 2, false)
    drawSolid(SOLIDS.cross, { xw: -ang.xw * 0.75, yw: ang.zw, zw: ang.yw, xy: -ang.xy }, sc * 0.75, 0, 0, 0, 160, 0.9, 2.4, false)
    drawSolid(SOLIDS.tess, ang, sc * 0.55, 0, 0, 0, 0, 1, 2.8, true)
  } else if (phase === 2) {
    // The cathedral: hypercubes standing in a ring, circling the 24-cell; the build tightens and speeds the ring.
    ring += dt * (0.25 + build * 2.2)
    const n = 6, rr = M * (0.42 - build * 0.12)
    drawSolid(SOLIDS.icosi, ang, sc * 0.7, 0, 0, 0, 90, 0.9, 2.4, true)
    for (let j = 0; j < n; j++) {
      const a = ring + (j / n) * TAU
      drawSolid(SOLIDS.tess, { xw: ang.xw + j, yw: ang.yw - j * 0.5, zw: ang.zw, xy: ang.xy + j }, sc * 0.28, Math.cos(a) * rr, Math.sin(a * 2) * M * 0.04, Math.sin(a) * rr, j * 25, 0.85, 1.8, false)
    }
  } else {
    // The 600-cell unfolds from its centre on the drop.
    drawSolid(SOLIDS.hex, { xw: ang.xw * 0.5, yw: ang.yw * 0.5, zw: ang.zw * 0.25, xy: ang.xy }, sc * 1.25 * (0.2 + unfold * 0.8), 0, 0, 0, 0, 0.55 + unfold * 0.4, 1.3, true)
  }
  for (let i = 0; i < 120; i++) lit[i] *= 0.9

  s = await frame(out, {
    trail: phase === 3 ? 0.8 : 0.7 + build * 0.15, zoom: 1 + inflate * 0.005, spin: phase === 2 ? 0.001 + build * 0.004 : 0, hue: 0.2, mirror: 0,
    phase, phases: PHASES.length, title: PHASES[phase], titleFx: "neon", titleHue: hue,
    react: { punch: 1.2, slice: 0.5, sparkle: 1.1, shake: 0.6, tint: 0.7 },
  })
}

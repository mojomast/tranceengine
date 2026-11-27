// name: Megademo
// Style: a four-part demoscene megademo in the spirit of Amiga copper bars, dot tunnels, vector bobs and
// plasma lattices. Psychoscript technique: each phase is a generator coroutine advanced once per frame, and
// every random choice comes from a seeded mulberry32 PRNG, so rewinds, beat-repeats and replays redraw exactly
// the same frames. Musical reactions: kickHit/kick pulse the bodies, snareHit flips and jolts, hats and hatHit
// add glints, bass gives weight and dot size, build/toDrop gather tension, drop releases it, keyHue/note tint
// the palette, calm slows and thins, energy/high set density and sparkle.
let s = await frame([])
const TAU = Math.PI * 2
const PHASES = ["I. Copper", "II. Tunnel", "III. Vectors", "IV. Finale"]
const clampP = (p) => Math.max(0, Math.min(PHASES.length - 1, Math.floor(p) || 0))
const mulberry32 = (a) => () => {
  a = (a + 0x6D2B79F5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const rnd = mulberry32(0x0badf00d)
const NB = 16
const SCROLL = "GENERATOR CHOREOGRAPHY  //  MEGADEMO  "
const NT = 150
const tA = [], tD = [], tJ = []
for (let i = 0; i < NT; i++) {
  tA.push(rnd() * TAU)
  tD.push(0.08 + rnd() * 1.1)
  tJ.push(0.7 + rnd() * 0.8)
}
const NV = 20
const vA = [], vR = [], vS = [], vY = [], vP = [], vSz = []
for (let i = 0; i < NV; i++) {
  vA.push(rnd() * TAU)
  vR.push(0.2 + rnd() * 0.26)
  vS.push((0.5 + rnd() * 0.9) * (rnd() < 0.5 ? -1 : 1))
  vY.push(rnd() * TAU)
  vP.push(rnd() * TAU)
  vSz.push(3 + rnd() * 5)
}
const CUBE = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
const GW = 18, GH = 12, GN = GW * GH
const gx = [], gy = []
for (let i = 0; i < GN; i++) { gx.push(i % GW); gy.push(Math.floor(i / GW)) }

// I. Copper: raster bars breathe with the bass and sin scroller letters ride the hats.
function* copper() {
  let gain = 1
  gain = yield []
  let glint = 0
  while (true) {
    const A = s.audio, W = s.w, H = s.h, U = Math.min(W, H) / 800
    const out = []
    const t = s.t, calm = A.calm || 0, bass = A.bass || 0, kick = A.kick || 0
    const amp = (14 + bass * 34 + kick * 26) * U
    const hit = A.kickHit ? 1 : 0
    if (A.hatHit) glint = 1
    glint *= 0.9
    const hue = (A.keyHue || 0) + 30
    const step = (H * 0.8) / (NB - 1)
    for (let i = 0; i < NB; i++) {
      if (calm > 0.55 && i % 2) continue
      const pos = i - (NB - 1) / 2
      const yc = s.cy + pos * step + Math.sin(t * 1.3 + i * 0.55) * amp + (A.snare || 0) * 14 * U * (i % 2 ? 1 : -1)
      const th = step * 0.34 * (0.5 + bass * 0.7 + kick * 0.3 + hit * 0.12)
      const halfW = W * 0.43 * (1 - calm * 0.35)
      const pts = []
      for (let k = 0; k <= 12; k++) {
        const x = s.cx - halfW + (2 * halfW * k) / 12
        pts.push(x, yc + Math.sin(x * 0.012 / U + t * 2 + i) * amp * 0.18)
      }
      for (let k = 12; k >= 0; k--) {
        const x = s.cx - halfW + (2 * halfW * k) / 12
        pts.push(x, yc + th + Math.sin(x * 0.012 / U + t * 2 + i) * amp * 0.18)
      }
      out.push({ k: "p", pts, fill: true, h: hue + i * 13 + t * 18, s: 65, l: Math.min(60, 34 + (i % 4) * 5 + kick * 10), a: (0.4 + bass * 0.18) * gain })
    }
    if (glint > 0.05) for (let k = 0; k < 8; k++) {
      const gi = (k * 3 + (A.hats || 0)) % NB
      out.push({ k: "c", x: s.cx + Math.cos(k * 2.4 + t) * W * 0.4, y: s.cy + (gi - (NB - 1) / 2) * step, r: (2 + glint * 4) * U, h: hue + 90, s: 70, l: 62, a: glint * 0.55 * gain })
    }
    const cw = 15 * U, total = SCROLL.length * cw, spd = 90 * U * (0.6 + (A.energy || 0) * 0.8)
    const off = (t * spd) % total, baseY = H * 0.86 + Math.sin(t * 0.8) * 6 * U
    for (let i = 0; i < SCROLL.length; i++) {
      const ch = SCROLL[i]
      if (ch === " ") continue
      const x = s.cx - total / 2 + (i * cw + off) % total
      out.push({ k: "t", text: ch, x, y: baseY + Math.sin(i * 0.55 + t * 3.2) * 14 * U, size: 18 * U, h: hue + i * 6, s: 55, l: 62, a: 0.78 * gain })
    }
    gain = yield out
  }
}

// II. Tunnel: a spiralling dot tunnel; snares reverse it and kick the depth forward.
function* tunnel() {
  let gain = 1
  gain = yield []
  let twist = 0, dir = 1, burst = 0
  while (true) {
    const A = s.audio, dt = Math.min(0.05, s.dt || 1 / 60), W = s.w, H = s.h, U = Math.min(W, H) / 800
    const out = []
    const build = Math.max(0, Math.min(1, A.build || 0))
    if (A.snareHit) { dir = -dir; burst = 1 }
    twist += dt * (0.3 + build * 2.2 + (A.kick || 0) * 1.4) * dir
    burst *= Math.exp(-dt * 1.8)
    const calm = A.calm || 0, bass = A.bass || 0
    const spd = (0.3 + (A.energy || 0) * 0.55 + (A.kick || 0) * 0.55 + build * 0.9) * dt * (1 - calm * 0.5)
    const squeeze = 1 - build * 0.22 + bass * 0.12 + burst * 0.18
    const hue = (A.keyHue || 0) + 120
    for (let i = 0; i < NT; i++) {
      if (calm > 0.6 && i % 2) continue
      let d = tD[i] - spd * tJ[i]
      if (d < 0.12) d += 1.1
      tD[i] = d
      const k = 0.36 / (d + 0.05), rr = k * U * 190 * squeeze
      const a = tA[i] + twist + d * 1.7
      const x = s.cx + Math.cos(a) * rr, y = s.cy + Math.sin(a) * rr * 0.9
      if (x < -W * 0.2 || x > W * 1.2 || y < -H * 0.2 || y > H * 1.2) continue
      const near = Math.max(0, Math.min(1, (0.55 - d) * 2.2))
      out.push({ k: "c", x, y, r: (1.1 + near * 5.5 + bass * 2) * U, h: hue + a * 30 + near * 70, s: 65, l: Math.min(64, 36 + near * 22 + (A.hat || 0) * 8), a: (0.32 + near * 0.38) * gain })
    }
    if (burst > 0.05) out.push({ k: "c", x: s.cx, y: s.cy, r: (40 + (1 - burst) * 300) * U, fill: false, h: hue + 180, s: 70, l: 60, a: burst * 0.5 * gain, lw: 2 + burst * 3 })
    out.push({ k: "c", x: s.cx, y: s.cy, r: (20 + (A.kick || 0) * 40) * U, h: hue + 40, s: 70, l: 50, a: 0.4 * gain })
    gain = yield out
  }
}

// III. Vectors: vector bobs and a wireframe cube with analytic delay echoes.
function* vectors() {
  let gain = 1
  gain = yield []
  let spin = 0, flip = 1, glint = 0
  while (true) {
    const A = s.audio, dt = Math.min(0.05, s.dt || 1 / 60), W = s.w, H = s.h, U = Math.min(W, H) / 800
    const out = []
    const t = s.t, build = Math.max(0, Math.min(1, A.build || 0))
    const calm = A.calm || 0, kick = A.kick || 0, bass = A.bass || 0
    if (A.snareHit) { flip = -flip; glint = 1 }
    glint *= Math.exp(-dt * 3)
    spin += dt * (0.6 + build * 2.6 + kick * 1.2) * (1 - calm * 0.6)
    const hue = (A.keyHue || 0) + 190
    const scale = (1 + kick * 0.18 + bass * 0.1 - build * 0.15 + (A.dropAmt || 0) * 0.4) * U
    const unit = Math.min(W, H)
    for (let i = 0; i < NV; i++) {
      const rr = vR[i] * unit * (1 - build * 0.18) * (1 + kick * 0.08)
      const spd = vS[i] * flip * (0.7 + build * 0.5) * (1 - calm * 0.5)
      const pts = []
      let x0 = 0, y0 = 0
      for (let e = 2; e >= 0; e--) {
        const tt = t - e * 0.07
        const a = vA[i] + tt * spd
        const x = s.cx + Math.cos(a) * rr
        const y = s.cy + Math.sin(a * 1.3 + vY[i]) * rr * 0.48 + Math.sin(tt * 1.7 + vP[i]) * 24 * U
        pts.push(x, y)
        if (e === 0) { x0 = x; y0 = y }
      }
      out.push({ k: "p", pts, close: false, h: hue + i * 9, s: 65, l: Math.min(62, 40 + vSz[i] * 2 + kick * 8), a: (0.4 - calm * 0.16) * gain, lw: 1.4 * U })
      out.push({ k: "c", x: x0, y: y0, r: vSz[i] * scale * (1 + kick * 0.3), h: hue + i * 9 + glint * 60, s: 62, l: Math.min(64, 44 + vSz[i] * 2.5 + kick * 8 + glint * 8), a: (0.52 + glint * 0.2) * gain })
    }
    const ex = [], ey = []
    for (let pass = 0; pass < 2; pass++) {
      const yaw = spin - pass * 0.22, cy = Math.cos(yaw), sy = Math.sin(yaw)
      const pit = spin * 0.7, cp = Math.cos(pit), sp = Math.sin(pit)
      const cs = scale * 130 * (1 - pass * 0.1)
      for (let i = 0; i < 8; i++) {
        const v = CUBE[i]
        const x1 = v[0] * cy - v[2] * sy, z1 = v[0] * sy + v[2] * cy
        const y1 = v[1] * cp - z1 * sp, z2 = v[1] * sp + z1 * cp
        const kk = 3.2 / (3.2 + z2)
        ex[i] = s.cx + x1 * cs * kk
        ey[i] = s.cy + y1 * cs * kk
      }
      for (let i = 0; i < EDGES.length; i++) {
        const e = EDGES[i]
        out.push({ k: "l", x1: ex[e[0]], y1: ey[e[0]], x2: ex[e[1]], y2: ey[e[1]], h: hue + 40 + pass * 25, s: 62, l: Math.min(58, 46 - pass * 8 + kick * 8), a: (0.55 - pass * 0.28) * gain, lw: (1.4 - pass * 0.5) * U })
      }
    }
    gain = yield out
  }
}

// IV. Finale: every layer at once - copper bars, tunnel dots, vector echoes and a plasma lattice.
function* finale() {
  let gain = 1
  gain = yield []
  const lx = [], ly = [], lh = []
  for (let i = 0; i < GN; i++) { lx.push(0); ly.push(0); lh.push(0) }
  const fd = []
  for (let i = 0; i < 60; i++) fd.push(0.08 + rnd() * 1.1)
  let jolt = 0
  while (true) {
    const A = s.audio, dt = Math.min(0.05, s.dt || 1 / 60), W = s.w, H = s.h, U = Math.min(W, H) / 800
    const out = []
    const t = s.t, build = Math.max(0, Math.min(1, A.build || 0))
    const calm = A.calm || 0, kick = A.kick || 0, bass = A.bass || 0
    if (A.snareHit) jolt = 1
    jolt *= Math.exp(-dt * 2.2)
    const hue = (A.keyHue || 0) + 40
    const pulse = 1 + kick * 0.35 + (A.dropAmt || 0) * 0.5
    const amp = (18 + kick * 26 + bass * 14 + build * 18) * (1 - calm * 0.35)
    for (let i = 0; i < 7; i++) {
      const yc = H * (0.2 + i * 0.1) + Math.sin(t * 1.1 + i) * amp * 0.2
      const pts = []
      for (let k = 0; k <= 8; k++) {
        const x = s.cx - W * 0.4 + W * 0.8 * k / 8
        pts.push(x, yc + Math.sin(x * 0.01 / U + t * 2 + i) * 8 * U)
      }
      for (let k = 8; k >= 0; k--) {
        const x = s.cx - W * 0.4 + W * 0.8 * k / 8
        pts.push(x, yc + (8 + bass * 16) * U + Math.sin(x * 0.01 / U + t * 2 + i) * 8 * U)
      }
      out.push({ k: "p", pts, fill: true, h: hue + i * 16 + t * 10, s: 65, l: Math.min(60, 36 + i * 3 + kick * 8), a: (0.2 + bass * 0.14) * gain })
    }
    const spd = (0.3 + (A.energy || 0) * 0.5 + build * 0.7) * dt
    for (let i = 0; i < 60; i++) {
      let d = fd[i] - spd
      if (d < 0.1) d += 1.1
      fd[i] = d
      const k = 0.3 / (d + 0.06), rr = k * U * 210 * (1 - build * 0.2)
      const a = tA[i] + t * (0.4 + build) + d * 1.6
      const x = s.cx + Math.cos(a) * rr, y = s.cy + Math.sin(a) * rr
      if (x < -W * 0.15 || x > W * 1.15 || y < -H * 0.15 || y > H * 1.15) continue
      const near = Math.max(0, Math.min(1, (0.6 - d) * 2))
      out.push({ k: "c", x, y, r: (1 + near * 4) * U, h: hue + a * 25 + near * 60, s: 65, l: Math.min(62, 38 + near * 20), a: (0.24 + near * 0.24) * gain })
    }
    for (let i = 0; i < GN; i++) {
      const u = gx[i] / (GW - 1) - 0.5, v = gy[i] / (GH - 1) - 0.5
      const pl = Math.sin(u * 9 + t * 1.5 + jolt * 2) + Math.cos(v * 8 - t * 1.2) + Math.sin((u + v) * 5 + t * 2.1)
      const wob = Math.sin(t * 0.8 + v * 4) * amp * 0.35
      const x = s.cx + u * W * 0.84 + wob
      const y = s.cy + v * H * 0.72 + Math.cos(t * 0.9 + u * 5) * amp * 0.28
      lx[i] = x
      ly[i] = y
      lh[i] = hue + pl * 22 + gx[i] * 2.5 - gy[i] * 2
      out.push({ k: "c", x, y, r: (1.6 + bass * 2.6 + kick * 2.4 + (pl + 3) * 0.45) * U * pulse, h: lh[i], s: 68, l: Math.max(30, Math.min(64, 36 + (pl + 3) * 4.5 + kick * 6)), a: (0.32 + build * 0.22) * gain })
    }
    for (let row = 0; row < GH; row++) {
      const pts = []
      for (let col = 0; col < GW; col++) {
        const i = row * GW + col
        pts.push(lx[i], ly[i])
      }
      out.push({ k: "p", pts, close: false, h: hue + row * 4, s: 60, l: Math.min(58, 34 + row * 2), a: (0.16 + build * 0.14) * gain, lw: 0.8 * U })
    }
    for (let col = 0; col < GW; col++) {
      const pts = []
      for (let row = 0; row < GH; row++) {
        const i = row * GW + col
        pts.push(lx[i], ly[i])
      }
      out.push({ k: "p", pts, close: false, h: hue + col * 3 + 60, s: 62, l: Math.min(56, 32 + col * 1.6), a: (0.12 + build * 0.1) * gain, lw: 0.7 * U })
    }
    for (let i = 0; i < 5; i++) {
      const rr = vR[i] * Math.min(W, H) * (0.9 - build * 0.2)
      for (let e = 1; e >= 0; e--) {
        const a = vA[i] + (t - e * 0.08) * vS[i] * 1.2
        out.push({ k: "c", x: s.cx + Math.cos(a) * rr, y: s.cy + Math.sin(a * 1.3 + vY[i]) * rr * 0.5, r: vSz[i] * 0.8 * U, h: hue + 80 + i * 12, s: 62, l: Math.min(62, 40 + e * 6 + kick * 8), a: (0.38 - e * 0.14) * gain })
      }
    }
    gain = yield out
  }
}

const ROUTINES = [copper, tunnel, vectors, finale]
const makeGen = (p) => { const g = ROUTINES[p](); g.next(); return g }
let phase = clampP(s.entry)
let gen = makeGen(phase), fromGen = null, mix = 1, halfBar = 120 / 124
while (true) {
  const A = s.audio
  const dt = Math.min(0.05, s.dt || 1 / 60)
  if (typeof s.cue === "number" && s.cue >= 0 && s.cue !== phase) {
    fromGen = gen
    phase = clampP(s.cue)
    gen = makeGen(phase)
    mix = 0
    halfBar = 120 / ((A.bpm && A.bpm > 30) ? A.bpm : 124)
  }
  const out = []
  if (fromGen && mix < 1) {
    mix = Math.min(1, mix + dt / halfBar)
    const e = mix * mix * (3 - 2 * mix)
    for (const o of fromGen.next(1 - e).value) out.push(o)
    for (const o of gen.next(e).value) out.push(o)
    if (mix >= 1) fromGen = null
  } else {
    for (const o of gen.next(1).value) out.push(o)
  }
  const calm = A.calm || 0, build = Math.max(0, Math.min(1, A.build || 0)), drop = A.dropAmt || 0
  let trail = phase === 0 ? 0.8 : phase === 1 ? 0.83 : phase === 2 ? 0.78 : 0.86
  trail = Math.min(0.94, trail + calm * 0.06 + build * 0.03)
  s = await frame(out, {
    trail, zoom: 1 + (A.kick || 0) * 0.006 + build * 0.008 + drop * 0.01 - calm * 0.004,
    spin: phase === 1 ? 0.002 * (1 + build) : phase === 3 ? 0.001 : 0, hue: 0.2 + (A.high || 0) * 0.5, mirror: 0,
    phase, phases: PHASES.length, title: PHASES[phase],
    titleFx: phase === 3 ? "split" : "rise", titleHue: (A.keyHue || 0) + 120,
    react: { punch: 0.8 + (A.kick || 0) * 0.4, slice: 0.5, sparkle: 0.8 + (A.high || 0) * 0.8, shake: 0.4 + build * 0.6, tint: 0.8 },
  })
}

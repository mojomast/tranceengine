// name: Megademo
// Style: a four-part demoscene megademo in the spirit of Amiga copper bars, dot tunnels, vector bobs and
// plasma lattices. Psychoscript technique: each phase is a generator coroutine advanced once per frame and
// drawing from its own reused pool of shape objects and point arrays, so a steady frame allocates nothing;
// the bar edges and the finale's plasma run on angle-sum recurrences and precomputed sine tables, and every
// random choice comes from a seeded mulberry32 PRNG, so rewinds, beat-repeats and replays redraw exactly the
// same frames. Musical reactions: kickHit/kick pulse the bodies, snareHit flips and jolts, hats and hatHit
// add glints, bass gives weight and dot size, build/toDrop gather tension, drop releases it, keyHue/note
// tint the palette, calm slows and thins, energy/high set density and sparkle.
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
// Finale plasma tables: sin/cos of the column, row and column+row phases, so each cell's plasma value is
// plain arithmetic through the angle-sum identities instead of three trig calls per cell per frame.
const UC = [], VR = [], S9 = [], C9 = [], S5 = [], C5 = [], S8 = [], C8 = [], S4 = [], C4 = [], SUV = [], CUV = []
for (let c = 0; c < GW; c++) {
  const u = c / (GW - 1) - 0.5
  UC.push(u)
  S9.push(Math.sin(u * 9))
  C9.push(Math.cos(u * 9))
  S5.push(Math.sin(u * 5))
  C5.push(Math.cos(u * 5))
}
for (let r = 0; r < GH; r++) {
  const v = r / (GH - 1) - 0.5
  VR.push(v)
  S8.push(Math.sin(v * 8))
  C8.push(Math.cos(v * 8))
  S4.push(Math.sin(v * 4))
  C4.push(Math.cos(v * 4))
}
for (let i = 0; i < GN; i++) {
  const uv = (UC[gx[i]] + VR[gy[i]]) * 5
  SUV.push(Math.sin(uv))
  CUV.push(Math.cos(uv))
}

// I. Copper: raster bars breathe with the bass and sin scroller letters ride the hats.
function* copper() {
  let gain = 1
  gain = yield []
  let glint = 0
  const bars = [], glints = [], chars = [], out = []
  for (let i = 0; i < NB; i++) {
    const pts = []
    for (let k = 0; k < 52; k++) pts.push(0)
    bars.push({ k: "p", pts, fill: true, h: 0, s: 65, l: 40, a: 0.4 })
  }
  for (let i = 0; i < 8; i++) glints.push({ k: "c", x: 0, y: 0, r: 1, h: 0, s: 70, l: 62, a: 0 })
  for (let i = 0; i < SCROLL.length; i++) chars.push({ k: "t", text: SCROLL[i], x: 0, y: 0, size: 18, h: 0, s: 55, l: 62, a: 0.78 })
  while (true) {
    const A = s.audio, W = s.w, H = s.h, U = Math.min(W, H) / 800
    const t = s.t, calm = A.calm || 0, bass = A.bass || 0, kick = A.kick || 0
    const amp = (14 + bass * 34 + kick * 26) * U
    const hit = A.kickHit ? 1 : 0
    if (A.hatHit) glint = 1
    glint *= 0.9
    const hue = (A.keyHue || 0) + 30
    const step = (H * 0.8) / (NB - 1)
    const halfW = W * 0.43 * (1 - calm * 0.35)
    const x0 = s.cx - halfW, dx = halfW / 6, q = 0.012 / U
    const sn = (A.snare || 0) * 14 * U, ampO = amp * 0.18
    const th = step * 0.34 * (0.5 + bass * 0.7 + kick * 0.3 + hit * 0.12)
    const barA = (0.4 + bass * 0.18) * gain
    const dphi = dx * q, cds = Math.cos(dphi), sds = Math.sin(dphi)
    let n = 0
    for (let i = 0; i < NB; i++) {
      if (calm > 0.55 && i % 2) continue
      const yc = s.cy + (i - (NB - 1) / 2) * step + Math.sin(t * 1.3 + i * 0.55) * amp + sn * (i % 2 ? 1 : -1)
      const phi = x0 * q + t * 2 + i
      let sv = Math.sin(phi), cv = Math.cos(phi)
      const bar = bars[i], pts = bar.pts
      for (let k = 0; k <= 12; k++) {
        const x = x0 + dx * k, off = sv * ampO
        pts[k * 2] = x
        pts[k * 2 + 1] = yc + off
        pts[50 - k * 2] = x
        pts[51 - k * 2] = yc + th + off
        const ns = sv * cds + cv * sds
        cv = cv * cds - sv * sds
        sv = ns
      }
      bar.h = hue + i * 13 + t * 18
      bar.l = Math.min(60, 34 + (i % 4) * 5 + kick * 10)
      bar.a = barA
      out[n++] = bar
    }
    if (glint > 0.05) for (let k = 0; k < 8; k++) {
      const gi = (k * 3 + (A.hats || 0)) % NB
      const g = glints[k]
      g.x = s.cx + Math.cos(k * 2.4 + t) * W * 0.4
      g.y = s.cy + (gi - (NB - 1) / 2) * step
      g.r = (2 + glint * 4) * U
      g.h = hue + 90
      g.a = glint * 0.55 * gain
      out[n++] = g
    }
    const cw = 15 * U, total = SCROLL.length * cw, spd = 90 * U * (0.6 + (A.energy || 0) * 0.8)
    const off = (t * spd) % total, baseY = H * 0.86 + Math.sin(t * 0.8) * 6 * U
    const size = 18 * U, cha = 0.78 * gain
    for (let i = 0; i < SCROLL.length; i++) {
      if (SCROLL[i] === " ") continue
      const o = chars[i]
      o.x = s.cx - total / 2 + (i * cw + off) % total
      o.y = baseY + Math.sin(i * 0.55 + t * 3.2) * 14 * U
      o.size = size
      o.h = hue + i * 6
      o.a = cha
      out[n++] = o
    }
    out.length = n
    gain = yield out
  }
}

// II. Tunnel: a spiralling dot tunnel; snares reverse it and kick the depth forward.
function* tunnel() {
  let gain = 1
  gain = yield []
  let twist = 0, dir = 1, burst = 0
  const dots = [], out = []
  for (let i = 0; i < NT; i++) dots.push({ k: "c", x: 0, y: 0, r: 1, h: 0, s: 65, l: 40, a: 0.3 })
  const ring = { k: "c", x: 0, y: 0, r: 1, fill: false, h: 0, s: 70, l: 60, a: 0, lw: 2 }
  const core = { k: "c", x: 0, y: 0, r: 1, h: 0, s: 70, l: 50, a: 0.4 }
  while (true) {
    const A = s.audio, dt = Math.min(0.05, s.dt || 1 / 60), W = s.w, H = s.h, U = Math.min(W, H) / 800
    const build = Math.max(0, Math.min(1, A.build || 0))
    if (A.snareHit) { dir = -dir; burst = 1 }
    twist += dt * (0.3 + build * 2.2 + (A.kick || 0) * 1.4) * dir
    burst *= Math.exp(-dt * 1.8)
    const calm = A.calm || 0, bass = A.bass || 0
    const spd = (0.3 + (A.energy || 0) * 0.55 + (A.kick || 0) * 0.55 + build * 0.9) * dt * (1 - calm * 0.5)
    const squeeze = 1 - build * 0.22 + bass * 0.12 + burst * 0.18
    const hue = (A.keyHue || 0) + 120
    const rrK = U * 190 * squeeze, hat8 = (A.hat || 0) * 8
    const xl = -W * 0.2, xr = W * 1.2, yt = -H * 0.2, yb = H * 1.2
    let n = 0
    for (let i = 0; i < NT; i++) {
      if (calm > 0.6 && i % 2) continue
      let d = tD[i] - spd * tJ[i]
      if (d < 0.12) d += 1.1
      tD[i] = d
      const rr = (0.36 / (d + 0.05)) * rrK
      const a = tA[i] + twist + d * 1.7
      const x = s.cx + Math.cos(a) * rr, y = s.cy + Math.sin(a) * rr * 0.9
      if (x < xl || x > xr || y < yt || y > yb) continue
      const near = Math.max(0, Math.min(1, (0.55 - d) * 2.2))
      const o = dots[i]
      o.x = x
      o.y = y
      o.r = (1.1 + near * 5.5 + bass * 2) * U
      o.h = hue + a * 30 + near * 70
      o.l = Math.min(64, 36 + near * 22 + hat8)
      o.a = (0.32 + near * 0.38) * gain
      out[n++] = o
    }
    if (burst > 0.05) {
      ring.x = s.cx
      ring.y = s.cy
      ring.r = (40 + (1 - burst) * 300) * U
      ring.h = hue + 180
      ring.a = burst * 0.5 * gain
      ring.lw = 2 + burst * 3
      out[n++] = ring
    }
    core.x = s.cx
    core.y = s.cy
    core.r = (20 + (A.kick || 0) * 40) * U
    core.h = hue + 40
    core.a = 0.4 * gain
    out[n++] = core
    out.length = n
    gain = yield out
  }
}

// III. Vectors: vector bobs and a wireframe cube with analytic delay echoes.
function* vectors() {
  let gain = 1
  gain = yield []
  let spin = 0, flip = 1, glint = 0
  const trails = [], heads = [], edges = [], ex = [], ey = [], out = []
  for (let i = 0; i < NV; i++) {
    trails.push({ k: "p", pts: [0, 0, 0, 0, 0, 0], close: false, h: 0, s: 65, l: 40, a: 0.4, lw: 1 })
    heads.push({ k: "c", x: 0, y: 0, r: 1, h: 0, s: 62, l: 44, a: 0.5 })
  }
  for (let i = 0; i < 24; i++) edges.push({ k: "l", x1: 0, y1: 0, x2: 0, y2: 0, h: 0, s: 62, l: 46, a: 0.5, lw: 1 })
  for (let i = 0; i < 8; i++) { ex.push(0); ey.push(0) }
  while (true) {
    const A = s.audio, dt = Math.min(0.05, s.dt || 1 / 60), W = s.w, H = s.h, U = Math.min(W, H) / 800
    const t = s.t, build = Math.max(0, Math.min(1, A.build || 0))
    const calm = A.calm || 0, kick = A.kick || 0, bass = A.bass || 0
    if (A.snareHit) { flip = -flip; glint = 1 }
    glint *= Math.exp(-dt * 3)
    spin += dt * (0.6 + build * 2.6 + kick * 1.2) * (1 - calm * 0.6)
    const hue = (A.keyHue || 0) + 190
    const scale = (1 + kick * 0.18 + bass * 0.1 - build * 0.15 + (A.dropAmt || 0) * 0.4) * U
    const unit = Math.min(W, H)
    let n = 0
    for (let i = 0; i < NV; i++) {
      const rr = vR[i] * unit * (1 - build * 0.18) * (1 + kick * 0.08)
      const spd = vS[i] * flip * (0.7 + build * 0.5) * (1 - calm * 0.5)
      const tr = trails[i], pts = tr.pts
      let x0 = 0, y0 = 0
      for (let e = 2; e >= 0; e--) {
        const tt = t - e * 0.07
        const a = vA[i] + tt * spd
        const x = s.cx + Math.cos(a) * rr
        const y = s.cy + Math.sin(a * 1.3 + vY[i]) * rr * 0.48 + Math.sin(tt * 1.7 + vP[i]) * 24 * U
        pts[(2 - e) * 2] = x
        pts[(2 - e) * 2 + 1] = y
        if (e === 0) { x0 = x; y0 = y }
      }
      tr.h = hue + i * 9
      tr.l = Math.min(62, 40 + vSz[i] * 2 + kick * 8)
      tr.a = (0.4 - calm * 0.16) * gain
      tr.lw = 1.4 * U
      out[n++] = tr
      const hd = heads[i]
      hd.x = x0
      hd.y = y0
      hd.r = vSz[i] * scale * (1 + kick * 0.3)
      hd.h = hue + i * 9 + glint * 60
      hd.l = Math.min(64, 44 + vSz[i] * 2.5 + kick * 8 + glint * 8)
      hd.a = (0.52 + glint * 0.2) * gain
      out[n++] = hd
    }
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
        const ln = edges[pass * 12 + i]
        ln.x1 = ex[e[0]]
        ln.y1 = ey[e[0]]
        ln.x2 = ex[e[1]]
        ln.y2 = ey[e[1]]
        ln.h = hue + 40 + pass * 25
        ln.l = Math.min(58, 46 - pass * 8 + kick * 8)
        ln.a = (0.55 - pass * 0.28) * gain
        ln.lw = (1.4 - pass * 0.5) * U
        out[n++] = ln
      }
    }
    out.length = n
    gain = yield out
  }
}

// IV. Finale: every layer at once - copper bars, tunnel dots, vector echoes and a plasma lattice.
function* finale() {
  let gain = 1
  gain = yield []
  const bars = [], dots = [], lat = [], rowsP = [], colsP = [], echoes = [], out = []
  for (let i = 0; i < 7; i++) {
    const pts = []
    for (let k = 0; k < 36; k++) pts.push(0)
    bars.push({ k: "p", pts, fill: true, h: 0, s: 65, l: 40, a: 0.2 })
  }
  for (let i = 0; i < 60; i++) dots.push({ k: "c", x: 0, y: 0, r: 1, h: 0, s: 65, l: 40, a: 0.2 })
  for (let i = 0; i < GN; i++) lat.push({ k: "c", x: 0, y: 0, r: 1, h: 0, s: 68, l: 40, a: 0.3 })
  for (let i = 0; i < GH; i++) {
    const pts = []
    for (let k = 0; k < GW * 2; k++) pts.push(0)
    rowsP.push({ k: "p", pts, close: false, h: 0, s: 60, l: 36, a: 0.16, lw: 1 })
  }
  for (let i = 0; i < GW; i++) {
    const pts = []
    for (let k = 0; k < GH * 2; k++) pts.push(0)
    colsP.push({ k: "p", pts, close: false, h: 0, s: 62, l: 34, a: 0.12, lw: 1 })
  }
  for (let i = 0; i < 10; i++) echoes.push({ k: "c", x: 0, y: 0, r: 1, h: 0, s: 62, l: 44, a: 0.3 })
  const fd = []
  for (let i = 0; i < 60; i++) fd.push(0.08 + rnd() * 1.1)
  let jolt = 0
  while (true) {
    const A = s.audio, dt = Math.min(0.05, s.dt || 1 / 60), W = s.w, H = s.h, U = Math.min(W, H) / 800
    const t = s.t, build = Math.max(0, Math.min(1, A.build || 0))
    const calm = A.calm || 0, kick = A.kick || 0, bass = A.bass || 0
    if (A.snareHit) jolt = 1
    jolt *= Math.exp(-dt * 2.2)
    const hue = (A.keyHue || 0) + 40
    const pulse = 1 + kick * 0.35 + (A.dropAmt || 0) * 0.5
    const amp = (18 + kick * 26 + bass * 14 + build * 18) * (1 - calm * 0.35)
    let n = 0
    const bx0 = s.cx - W * 0.4, bdx = W * 0.1, bq = 0.01 / U
    const bth = (8 + bass * 16) * U, bamp = 8 * U
    const bdphi = bdx * bq, bcds = Math.cos(bdphi), bsds = Math.sin(bdphi)
    const barA = (0.2 + bass * 0.14) * gain
    for (let i = 0; i < 7; i++) {
      const yc = H * (0.2 + i * 0.1) + Math.sin(t * 1.1 + i) * amp * 0.2
      const phi = bx0 * bq + t * 2 + i
      let sv = Math.sin(phi), cv = Math.cos(phi)
      const bar = bars[i], pts = bar.pts
      for (let k = 0; k <= 8; k++) {
        const x = bx0 + bdx * k, off = sv * bamp
        pts[k * 2] = x
        pts[k * 2 + 1] = yc + off
        pts[34 - k * 2] = x
        pts[35 - k * 2] = yc + bth + off
        const ns = sv * bcds + cv * bsds
        cv = cv * bcds - sv * bsds
        sv = ns
      }
      bar.h = hue + i * 16 + t * 10
      bar.l = Math.min(60, 36 + i * 3 + kick * 8)
      bar.a = barA
      out[n++] = bar
    }
    const spd = (0.3 + (A.energy || 0) * 0.5 + build * 0.7) * dt
    const rrK = U * 210 * (1 - build * 0.2), tw = t * (0.4 + build)
    const xl = -W * 0.15, xr = W * 1.15, yt = -H * 0.15, yb = H * 1.15
    for (let i = 0; i < 60; i++) {
      let d = fd[i] - spd
      if (d < 0.1) d += 1.1
      fd[i] = d
      const rr = (0.3 / (d + 0.06)) * rrK
      const a = tA[i] + tw + d * 1.6
      const x = s.cx + Math.cos(a) * rr, y = s.cy + Math.sin(a) * rr
      if (x < xl || x > xr || y < yt || y > yb) continue
      const near = Math.max(0, Math.min(1, (0.6 - d) * 2))
      const o = dots[i]
      o.x = x
      o.y = y
      o.r = (1 + near * 4) * U
      o.h = hue + a * 25 + near * 60
      o.l = Math.min(62, 38 + near * 20)
      o.a = (0.24 + near * 0.24) * gain
      out[n++] = o
    }
    const c1 = Math.cos(t * 1.5 + jolt * 2), s1 = Math.sin(t * 1.5 + jolt * 2)
    const c2 = Math.cos(t * 1.2), s2 = Math.sin(t * 1.2)
    const c3 = Math.cos(t * 2.1), s3 = Math.sin(t * 2.1)
    const c4 = Math.cos(t * 0.8), s4 = Math.sin(t * 0.8)
    const c5 = Math.cos(t * 0.9), s5 = Math.sin(t * 0.9)
    const latA = (0.32 + build * 0.22) * gain
    const wobK = amp * 0.35, ywK = amp * 0.28
    const uw = W * 0.84, vh = H * 0.72
    const rBase = 1.6 + bass * 2.6 + kick * 2.4, lBase = 36 + kick * 6
    for (let i = 0; i < GN; i++) {
      const c = gx[i], r = gy[i]
      const pl = S9[c] * c1 + C9[c] * s1 + C8[r] * c2 + S8[r] * s2 + SUV[i] * c3 + CUV[i] * s3
      const o = lat[i]
      o.x = s.cx + UC[c] * uw + (S4[r] * c4 + C4[r] * s4) * wobK
      o.y = s.cy + VR[r] * vh + (C5[c] * c5 - S5[c] * s5) * ywK
      o.r = (rBase + (pl + 3) * 0.45) * U * pulse
      o.h = hue + pl * 22 + c * 2.5 - r * 2
      o.l = Math.max(30, Math.min(64, lBase + (pl + 3) * 4.5))
      o.a = latA
      out[n++] = o
    }
    for (let row = 0; row < GH; row++) {
      const pl = rowsP[row], pts = pl.pts
      for (let col = 0; col < GW; col++) {
        const o = lat[row * GW + col]
        pts[col * 2] = o.x
        pts[col * 2 + 1] = o.y
      }
      pl.h = hue + row * 4
      pl.l = Math.min(58, 34 + row * 2)
      pl.a = (0.16 + build * 0.14) * gain
      pl.lw = 0.8 * U
      out[n++] = pl
    }
    for (let col = 0; col < GW; col++) {
      const pl = colsP[col], pts = pl.pts
      for (let row = 0; row < GH; row++) {
        const o = lat[row * GW + col]
        pts[row * 2] = o.x
        pts[row * 2 + 1] = o.y
      }
      pl.h = hue + col * 3 + 60
      pl.l = Math.min(56, 32 + col * 1.6)
      pl.a = (0.12 + build * 0.1) * gain
      pl.lw = 0.7 * U
      out[n++] = pl
    }
    const er = Math.min(W, H) * (0.9 - build * 0.2)
    for (let i = 0; i < 5; i++) {
      const rr = vR[i] * er
      for (let e = 1; e >= 0; e--) {
        const a = vA[i] + (t - e * 0.08) * vS[i] * 1.2
        const o = echoes[i * 2 + (1 - e)]
        o.x = s.cx + Math.cos(a) * rr
        o.y = s.cy + Math.sin(a * 1.3 + vY[i]) * rr * 0.5
        o.r = vSz[i] * 0.8 * U
        o.h = hue + 80 + i * 12
        o.l = Math.min(62, 40 + e * 6 + kick * 8)
        o.a = (0.38 - e * 0.14) * gain
        out[n++] = o
      }
    }
    out.length = n
    gain = yield out
  }
}

const ROUTINES = [copper, tunnel, vectors, finale]
const makeGen = (p) => { const g = ROUTINES[p](); g.next(); return g }
let phase = clampP(s.entry)
let gen = makeGen(phase), fromGen = null, mix = 1, halfBar = 120 / 124
const fx = {
  trail: 0.8, zoom: 1, spin: 0, hue: 0.2, mirror: 0,
  phase: 0, phases: PHASES.length, title: PHASES[0], titleFx: "rise", titleHue: 0,
  react: { punch: 0.8, slice: 0.5, sparkle: 0.8, shake: 0.4, tint: 0.8 },
}
const mixOut = []
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
  let out
  if (fromGen && mix < 1) {
    mix = Math.min(1, mix + dt / halfBar)
    const e = mix * mix * (3 - 2 * mix)
    const a = fromGen.next(1 - e).value, b = gen.next(e).value
    mixOut.length = 0
    for (let i = 0; i < a.length; i++) mixOut.push(a[i])
    for (let i = 0; i < b.length; i++) mixOut.push(b[i])
    out = mixOut
    if (mix >= 1) fromGen = null
  } else {
    out = gen.next(1).value
  }
  const calm = A.calm || 0, build = Math.max(0, Math.min(1, A.build || 0)), drop = A.dropAmt || 0
  let trail = phase === 0 ? 0.8 : phase === 1 ? 0.83 : phase === 2 ? 0.78 : 0.86
  trail = Math.min(0.94, trail + calm * 0.06 + build * 0.03)
  fx.trail = trail
  fx.zoom = 1 + (A.kick || 0) * 0.006 + build * 0.008 + drop * 0.01 - calm * 0.004
  fx.spin = phase === 1 ? 0.002 * (1 + build) : phase === 3 ? 0.001 : 0
  fx.hue = 0.2 + (A.high || 0) * 0.5
  fx.phase = phase
  fx.title = PHASES[phase]
  fx.titleFx = phase === 3 ? "split" : "rise"
  fx.titleHue = (A.keyHue || 0) + 120
  fx.react.punch = 0.8 + (A.kick || 0) * 0.4
  fx.react.sparkle = 0.8 + (A.high || 0) * 0.8
  fx.react.shake = 0.4 + build * 0.6
  s = await frame(out, fx)
}

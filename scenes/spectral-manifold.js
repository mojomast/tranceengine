// name: Spectral manifold
// A 3D wireframe surface that morphs between four forms every 16 beats: a sphere sculpted by the
// spectrum, a torus whose tube swells with the bass, a trefoil knot, and a bloom with one petal per
// beat of the bar. Beats jolt its spin, the beat phase breathes it, snares spark its vertices,
// a drop shatters it into flying points that spring back together, and breakdowns leave a slow ghost.
let s = await frame([])
const TAU = Math.PI * 2
const NU = 26
const NV = 18
const band = (A, x) => A.bands[Math.min(31, Math.max(0, Math.floor(x * 31)))]
const FORMS = [
  (u, v, A) => {
    const th = u * TAU, ph = v * Math.PI
    const r = 0.95 + band(A, v) * 0.5 + A.kick * 0.08
    return [Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r, Math.sin(ph) * Math.sin(th) * r]
  },
  (u, v, A) => {
    const th = u * TAU, ph = v * TAU
    const tube = 0.3 + A.bass * 0.22 + band(A, u) * 0.15
    const ring = 0.82 + (tube * Math.cos(ph))
    return [ring * Math.cos(th), tube * Math.sin(ph), ring * Math.sin(th)]
  },
  (u, v, A) => {
    const t = u * TAU, ph = v * TAU
    const kx = Math.sin(t) + 2 * Math.sin(2 * t), ky = Math.cos(t) - 2 * Math.cos(2 * t), kz = -Math.sin(3 * t)
    const len = Math.hypot(kx, ky) || 1
    const tube = 0.38 + A.mid * 0.25 + band(A, u) * 0.2
    return [(kx + (kx / len) * tube * Math.cos(ph)) * 0.36, (ky + (ky / len) * tube * Math.cos(ph)) * 0.36, (kz + tube * Math.sin(ph)) * 0.36]
  },
  (u, v, A) => {
    const th = u * TAU, ph = v * Math.PI
    const petals = 3 + A.bar
    const r = 0.78 + 0.34 * Math.sin(petals * th + s.t) * Math.sin(ph * 2) * (0.5 + A.high) + band(A, u) * 0.2
    return [Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r * 1.1, Math.sin(ph) * Math.sin(th) * r]
  },
]
const N = NU * NV
const off = []
for (let i = 0; i < N; i++) off.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 })
const sparks = []
const TITLES = ["I. Spectral sphere", "II. Bass torus", "III. Trefoil knot", "IV. Bloom"]
// Each form is a phase: the director cues the next (s.cue) and can start on any (s.entry).
let fi = Math.max(0, Math.min(3, Math.floor(s.entry) || 0)), fj = fi, morph = 1
let ry = 0, spinVel = 0, shattered = 0
const px = new Array(N).fill(0), py = new Array(N).fill(0), pz = new Array(N).fill(0)

while (true) {
  const A = s.audio
  const dt = Math.min(0.05, s.dt || 1 / 60)
  // Form changes when the director cues a new phase.
  if (typeof s.cue === "number" && s.cue >= 0 && s.cue !== fj) {
    fi = morph >= 1 ? fj : fi
    fj = Math.max(0, Math.min(FORMS.length - 1, Math.floor(s.cue)))
    morph = 0
  }
  morph = Math.min(1, morph + dt / 1.6)
  const e = morph * morph * (3 - 2 * morph)
  // Spin: steady drift from the energy plus a jolt on every beat; breakdowns slow it.
  if (A.beat) spinVel += 0.9 * (A.bar % 2 ? -1 : 1)
  spinVel *= Math.exp(-dt * 3)
  ry += dt * ((0.25 + A.energy * 0.7) * (1 - A.calm * 0.75) + spinVel)
  const rx = 0.45 + 0.35 * Math.sin(s.t * 0.23) + A.dropAmt * 0.6
  // Shatter on a drop: every vertex flies outward, then springs home.
  if (A.drop) {
    shattered = 1
    for (const o of off) {
      const a = Math.random() * TAU, b = Math.acos(Math.random() * 2 - 1), sp = 2 + Math.random() * 4
      o.vx += Math.sin(b) * Math.cos(a) * sp
      o.vy += Math.cos(b) * sp
      o.vz += Math.sin(b) * Math.sin(a) * sp
    }
  }
  shattered *= Math.exp(-dt * 0.9)
  const cY = Math.cos(ry), sY = Math.sin(ry), cX = Math.cos(rx), sX = Math.sin(rx)
  const D = 3.3 - A.kick * 0.3
  // Winds up in the last quarter-beat (anticip), pops on the kick, breathes with the phase.
  const scale = Math.min(s.w, s.h) * 0.25 * (1 + 0.07 * Math.cos(A.phase * TAU)) * (1 - A.calm * 0.2) * (1 - (A.anticip || 0) * 0.06 + A.kick * 0.05)
  const F = FORMS[fi], G = FORMS[fj]
  for (let iv = 0; iv < NV; iv++) {
    const v = iv / (NV - 1)
    for (let iu = 0; iu < NU; iu++) {
      const u = iu / NU
      const k = iv * NU + iu
      let p = F(u, v, A)
      if (e < 1) {
        const q = G(u, v, A)
        p = [p[0] + (q[0] - p[0]) * e, p[1] + (q[1] - p[1]) * e, p[2] + (q[2] - p[2]) * e]
      }
      const o = off[k]
      o.vx += (-o.x * 7 - o.vx * 2.4) * dt
      o.vy += (-o.y * 7 - o.vy * 2.4) * dt
      o.vz += (-o.z * 7 - o.vz * 2.4) * dt
      o.x += o.vx * dt
      o.y += o.vy * dt
      o.z += o.vz * dt
      const x = p[0] + o.x, y = p[1] + o.y, z = p[2] + o.z
      const x1 = x * cY - z * sY, z1 = x * sY + z * cY
      const y2 = y * cX - z1 * sX, z2 = y * sX + z1 * cX
      const persp = D / Math.max(0.4, D + z2)
      px[k] = s.cx + x1 * scale * persp
      py[k] = s.cy + y2 * scale * persp
      pz[k] = z2
    }
  }
  const out = []
  const ghost = A.calm > 0.5
  const hueBase = s.t * 12 + A.beats * 9 + fj * 70 + (A.keyHue || 0)
  const stepV = ghost ? 3 : 1
  const stepU = ghost ? 3 : 1
  // Rings around the surface (closed) ...
  for (let iv = 1; iv < NV - 1; iv += stepV) {
    const pts = []
    let zs = 0
    for (let iu = 0; iu < NU; iu++) { const k = iv * NU + iu; pts.push(px[k], py[k]); zs += pz[k] }
    const near = 1 - (zs / NU + 1.2) / 2.4
    out.push({ k: "p", pts, h: hueBase + iv * 9, l: 38 + near * 26 + A.kick * 8, a: ghost ? 0.4 : 0.55 + near * 0.35,
      lw: (1 + near * 1.6 + band(A, iv / NV) * 2) * (ghost ? 0.7 : 1) })
  }
  // ... and meridians from pole to pole (open).
  for (let iu = 0; iu < NU; iu += stepU) {
    const pts = []
    let zs = 0
    for (let iv = 0; iv < NV; iv++) { const k = iv * NU + iu; pts.push(px[k], py[k]); zs += pz[k] }
    const near = 1 - (zs / NV + 1.2) / 2.4
    out.push({ k: "p", pts, close: false, h: hueBase + 160 + iu * 4, l: 36 + near * 22, a: ghost ? 0.3 : 0.4 + near * 0.3, lw: 0.8 + near * 1.2 })
  }
  // Shattered vertices glow as sparks while they fly.
  if (shattered > 0.08) {
    for (let k = 0; k < N; k += 2) out.push({ k: "c", x: px[k], y: py[k], r: 1 + shattered * 3, h: hueBase + k, l: 65, a: shattered })
  }
  // Hi-hats light a few vertices; snares jolt the whole surface outward a little.
  if (A.hatHit) for (let j = 0; j < 4; j++) sparks.push({ k: Math.floor(Math.random() * N), life: 1 })
  if (A.snareHit) {
    for (let j = 0; j < 14; j++) sparks.push({ k: Math.floor(Math.random() * N), life: 1 })
    for (const o of off) { o.vx += (Math.random() - 0.5) * 0.9; o.vy += (Math.random() - 0.5) * 0.9; o.vz += (Math.random() - 0.5) * 0.9 }
  }
  for (let j = sparks.length - 1; j >= 0; j--) {
    const sp = sparks[j]
    sp.life -= dt * 3
    if (sp.life <= 0) { sparks.splice(j, 1); continue }
    out.push({ k: "c", x: px[sp.k], y: py[sp.k], r: 2 + sp.life * 6, h: hueBase + 60, l: 72, a: sp.life })
  }
  s = await frame(out, {
    trail: 0.8 + A.calm * 0.14 + shattered * 0.1,
    zoom: 1.003 + A.kick * 0.02 + A.dropAmt * 0.02,
    spin: 0,
    hue: 0.8 + A.dropAmt * 2,
    mirror: A.dropAmt > 0.5 ? 4 : 0,
    phase: fj, phases: FORMS.length, title: TITLES[fj], titleFx: "scramble", titleHue: hueBase,
  })
}

// name: Vector wireframe
// Retro vector-display wireframes, after the glowing-beam arcade monitors of the
// early 1980s: an icosahedron, a torus, then a cube, one per downbeat.
// Technique: a seeded mulberry32 PRNG (SEED below) drives the beam jitter and hat
// glints, so a rewind, beat-repeat or replay draws exactly the same frames.
// kick zooms the solid and thickens the bright beam; snare shatters every edge
// outward and lets it reassemble; hats spark glints on vertices; bass widens the
// dim glow; high adds CRT jitter. keyHue and note tint the rig, calm slows the
// spin, build/toDrop (with a 0/99 fallback) tighten it, and a drop flashes it open.
// Every edge is a wide dim stroke under a thin bright stroke, with per-frame beam
// jitter, scaled by the short side and centred so it reads on phone and 4K alike.
let s = await frame([])
const TAU = Math.PI * 2
const SEED = 0x2f6e2b1
let seed = SEED >>> 0
const rand = () => {
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const meshes = []
const addMesh = (v, e, tilt) => {
  const n = v.length / 3
  const sx = [], sy = [], sz = []
  for (let i = 0; i < n; i++) { sx.push(0); sy.push(0); sz.push(0) }
  meshes.push({ n, v, e, tilt, sx, sy, sz })
}
const PHI = (1 + Math.sqrt(5)) / 2, IN = Math.sqrt(1 + PHI * PHI)
const raw = [-1, PHI, 0, 1, PHI, 0, -1, -PHI, 0, 1, -PHI, 0, 0, -1, PHI, 0, 1, PHI,
  0, -1, -PHI, 0, 1, -PHI, PHI, 0, -1, PHI, 0, 1, -PHI, 0, -1, -PHI, 0, 1]
const icoV = [], icoE = []
for (let i = 0; i < 36; i++) icoV.push(raw[i] / IN)
for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) {
  const dx = icoV[i * 3] - icoV[j * 3], dy = icoV[i * 3 + 1] - icoV[j * 3 + 1]
  const dz = icoV[i * 3 + 2] - icoV[j * 3 + 2]
  if (dx * dx + dy * dy + dz * dz < 1.4) icoE.push(i, j)
}
addMesh(icoV, icoE, 0.34)
const TM = 10, TN = 6, TUBE = 0.36
const toV = [], toE = []
for (let i = 0; i < TM; i++) {
  const u = (i / TM) * TAU, cu = Math.cos(u), su = Math.sin(u)
  for (let j = 0; j < TN; j++) {
    const v = (j / TN) * TAU, rr = 1 + TUBE * Math.cos(v)
    toV.push(rr * cu, TUBE * Math.sin(v), rr * su)
  }
}
for (let i = 0; i < TM; i++) for (let j = 0; j < TN; j++) {
  toE.push(i * TN + j, ((i + 1) % TM) * TN + j)
  toE.push(i * TN + j, i * TN + (j + 1) % TN)
}
addMesh(toV, toE, 0.95)
const cbV = [-0.82, -0.82, -0.82, 0.82, -0.82, -0.82, 0.82, 0.82, -0.82, -0.82, 0.82, -0.82,
  -0.82, -0.82, 0.82, 0.82, -0.82, 0.82, 0.82, 0.82, 0.82, -0.82, 0.82, 0.82]
const cbE = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]
addMesh(cbV, cbE, 0.42)
const glints = []
for (let i = 0; i < 10; i++) glints.push({ on: false, vi: 0, life: 0, h: 0 })
let gi = 0, shape = 0, first = true, boost = 0, boom = 0
while (true) {
  const A = s.audio, dt = s.dt, out = []
  const span = Math.min(s.w, s.h), U = span / 800
  const cx = s.cx, cy = s.cy
  const calm = A.calm || 0, bass = A.bass || 0, high = A.high || 0
  const kick = A.kick || 0, snare = A.snare || 0, hat = A.hat || 0
  const hue0 = typeof A.keyHue === "number" ? A.keyHue : 190
  const note = typeof A.note === "number" ? A.note : 0
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 6 ? Math.max(0, 1 - toDrop / 6) : 0
  const release = A.dropAmt || 0
  const gather = Math.max(build, near) * (1 - Math.min(1, release * 2))
  boost = Math.max(boost * Math.exp(-dt * 7), kick)
  boom = Math.max(boom * Math.exp(-dt * 2.6), snare)
  if (A.snareHit) boom = 1
  if (first) {
    shape = (((typeof A.bars === "number" ? A.bars : 0) % 3) + 3) % 3
    first = false
  } else if (A.downbeat) {
    shape = (shape + 1) % 3
    boost = 1
    for (let i = 0; i < glints.length; i++) glints[i].on = false
  }
  const mesh = meshes[shape]
  if (A.hatHit) {
    const g = glints[gi]
    gi = (gi + 1) % glints.length
    g.on = true
    g.life = 1
    g.vi = Math.floor(rand() * mesh.n)
    g.h = (A.hats || 0) * 37
  }
  const rotSpd = 1 - calm * 0.78
  const yaw = s.t * 0.75 * rotSpd + (A.barPhase || 0) * 0.5
  const pitch = mesh.tilt + Math.sin(s.t * 0.37) * 0.1 * rotSpd
  const roll = Math.sin(s.t * 0.23) * 0.08 * rotSpd
  const cyw = Math.cos(yaw), syw = Math.sin(yaw)
  const cp = Math.cos(pitch), sp = Math.sin(pitch)
  const cr = Math.cos(roll), sr = Math.sin(roll)
  const scale = span * 0.3 * (1 + boost * 0.14 + release * 0.1 - gather * 0.07)
  const jit = (0.55 + high * 1.5) * U
  const sx = mesh.sx, sy = mesh.sy, sz = mesh.sz, v = mesh.v
  const hue = hue0 + note * 3
  const glowLw = (4.2 + bass * 3 + high * 1.4) * U
  const beamLw = (1 + bass * 1.4) * U
  for (let i = 0; i < mesh.n; i++) {
    const x0 = v[i * 3], y0 = v[i * 3 + 1], z0 = v[i * 3 + 2]
    const x1 = x0 * cyw + z0 * syw
    const z1 = z0 * cyw - x0 * syw
    const y2 = y0 * cp - z1 * sp
    const z2 = y0 * sp + z1 * cp
    const xr = x1 * cr - y2 * sr
    const yr = x1 * sr + y2 * cr
    const den = 3.4 + z2 * 0.9
    const pp = 3.4 / (den > 0.6 ? den : 0.6)
    sx[i] = cx + xr * scale * pp + (rand() * 2 - 1) * jit
    sy[i] = cy + yr * scale * pp + (rand() * 2 - 1) * jit
    sz[i] = z2
  }
  for (let k = 0; k < mesh.e.length; k += 2) {
    const a = mesh.e[k], b = mesh.e[k + 1]
    let x1 = sx[a], y1 = sy[a], x2 = sx[b], y2 = sy[b]
    const depth = Math.min(1, Math.max(0, (sz[a] + sz[b]) * 0.25 + 0.5))
    if (boom > 0.01) {
      const mx = (x1 + x2) * 0.5 - cx, my = (y1 + y2) * 0.5 - cy
      const len = Math.sqrt(mx * mx + my * my)
      const push = boom * span * (0.1 + rand() * 0.22)
      if (len > 0.001) {
        const ox = (mx / len) * push, oy = (my / len) * push
        x1 += ox; y1 += oy; x2 += ox; y2 += oy
      }
    }
    const h = hue + (k % 9) * 1.5 - 6
    const bl = 52 + depth * 9 + boost * 3
    out.push({ k: "l", x1, y1, x2, y2, h, s: 82, l: 38 + depth * 10, a: 0.1 + depth * 0.1, lw: glowLw })
    out.push({ k: "l", x1, y1, x2, y2, h: h + 6, s: 92, l: bl, a: (0.35 + depth * 0.5) * (1 - calm * 0.12), lw: beamLw + boost * 1.5 })
  }
  for (let i = 0; i < mesh.n; i++) {
    const depth = Math.min(1, Math.max(0, sz[i] * 0.5 + 0.5))
    out.push({ k: "c", x: sx[i], y: sy[i], r: (1.1 + bass * 1.6 + boost * 1.2) * U * (0.7 + depth * 0.6),
      h: hue + 12, s: 80, l: 55 + depth * 8, a: 0.5 + depth * 0.3 })
  }
  for (let i = 0; i < glints.length; i++) {
    const g = glints[i]
    if (!g.on) continue
    g.life -= dt * 4
    if (g.life <= 0) { g.on = false; continue }
    const vi = g.vi % mesh.n
    out.push({ k: "c", x: sx[vi], y: sy[vi], r: (2 + hat * 4) * U * g.life, h: hue + 150 + g.h, s: 95, l: 64, a: Math.min(0.85, g.life) })
    out.push({ k: "c", x: sx[vi], y: sy[vi], r: (5 + hat * 7) * U * g.life, h: hue + 150 + g.h, s: 85, l: 50, a: g.life * 0.16 })
  }
  s = await frame(out, { trail: 0.7 + calm * 0.14, zoom: 1 + kick * 0.012 + release * 0.01, spin: 0.0015 * rotSpd, hue: 0.6 })
}

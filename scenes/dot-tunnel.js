// name: Dot tunnel
// Style: early-90s demoscene dot tunnel, after the Amiga/PC wormholes of the era:
// 26 rings of dots receding down a lissajous-bent corridor.
// Technique: generator choreography. The tunnel body and the sparkle field are
// function* coroutines, each advanced exactly once per frame; the body routine
// swaps between swirl and drift on every new bar cue. Each ring is projected by
// the ringPoints coroutine, resumed once per ring, which turns the ring with an
// exact rotation recurrence and rewrites pooled dot shapes in place.
// Music: kick drives inflow speed, snareHit twists the rings, hatHit emits
// sparkle glints, bass sets dot weight, build/toDrop tighten ring spacing,
// drop bursts the near rings outward, keyHue colours it, calm slows it.
let s = await frame([])
const TAU = Math.PI * 2
const RINGS = 26
const SEED = 0x1a2b3c4d
const mulberry32 = (a) => () => {
  a |= 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const geo = mulberry32(SEED)
const DOTS = [], ROT = [], HUE = [], RAD = [], OFFS = []
let TOT = 0
for (let r = 0; r < RINGS; r++) {
  DOTS.push(13 + ((geo() * 6) | 0))
  ROT.push(r * 0.23 + (geo() - 0.5) * 0.4)
  HUE.push((geo() - 0.5) * 46 + r * 3)
  RAD.push(0.9 + geo() * 0.2)
  OFFS.push(TOT)
  TOT += DOTS[r]
}
const pool = [], out = []
for (let i = 0; i < TOT; i++) pool.push({ k: "c", x: 0, y: 0, r: 1, h: 0, s: 78, l: 50, a: 0 })
const S = {
  flow: 0, speed: 0.55, twist: 0, twistV: 0, twistPull: 0, spacing: 0.62, nearZ: 1.35,
  t: 0, dt: 1 / 60, w: 800, h: 800, cx: 400, cy: 400, span: 800, U: 1,
  hue: 210, swayX: 0, swayY: 0, high: 0, bass: 0, calm: 0, drop: 0, hat: 0,
  ring: 0, out, ol: 0, rnd: geo,
}

function* ringPoints() {
  while (true) {
    const z = yield
    const n = DOTS[S.ring]
    const rz = S.span * 0.5 / z * RAD[S.ring]
    const tw = S.twist * (0.35 + z * 0.07)
    const rot = ROT[S.ring] + z * 0.3 + tw
    const ox = S.cx + S.swayX * (0.35 + 0.9 / z) + Math.sin(S.t * 0.7 + z * 0.25) * S.span * 0.016
    const oy = S.cy + S.swayY * (0.35 + 0.9 / z) + Math.cos(S.t * 0.57 + z * 0.21) * S.span * 0.016
    const rr = rz * (1 + S.drop * 1.7 / (z + 0.5))
    const nf = Math.max(0, Math.min(1, 1.5 - z * 0.15))
    const l = Math.min(64, 44 + S.high * 8 + S.bass * 6 + S.drop * nf * 5 - S.calm * 6)
    const a = 0.4 + nf * 0.35
    const rb = (1.3 + 2.2 / z) * S.U * (0.8 + S.bass * 0.4 + S.drop * nf)
    const hueB = S.hue + HUE[S.ring] + z * 4
    const wx0 = -S.w * 0.12, wx1 = S.w * 1.12, wy0 = -S.h * 0.12, wy1 = S.h * 1.12
    const base = OFFS[S.ring]
    const step = TAU / n
    let ca = Math.cos(rot), sa = Math.sin(rot)
    const cd = Math.cos(step), sd = Math.sin(step)
    for (let i = 0; i < n; i++) {
      const x = ox + ca * rr
      const y = oy + sa * rr
      const nx2 = ca * cd - sa * sd
      sa = sa * cd + ca * sd
      ca = nx2
      if (x < wx0 || x > wx1 || y < wy0 || y > wy1) continue
      const o = pool[base + i]
      o.x = x; o.y = y
      o.r = rb
      o.h = hueB + i * 2
      o.l = l
      o.a = a
      S.out[S.ol] = o
      S.ol++
    }
  }
}
const rings = ringPoints()
rings.next()

function emit(st) {
  const zFar = st.spacing * RINGS
  for (let r = 0; r < RINGS; r++) {
    const z = st.nearZ + ((r * st.spacing - st.flow) % zFar + zFar) % zFar
    st.ring = r
    rings.next(z)
  }
}

function* tunnelSwirl() {
  let st = yield
  while (true) {
    st.twistV += st.twistPull
    st.twist += st.twistV * st.dt
    st.twistV *= Math.exp(-st.dt * 3.4)
    st.flow += st.speed * st.dt
    emit(st)
    st = yield
  }
}

function* tunnelDrift() {
  let st = yield
  while (true) {
    st.twistV += st.twistPull * 0.4
    st.twist += st.twistV * st.dt - st.dt * 0.12
    st.twistV *= Math.exp(-st.dt * 2.1)
    st.flow += st.speed * st.dt * 0.8
    emit(st)
    st = yield
  }
}

const SPARKS = []
for (let i = 0; i < 72; i++) SPARKS.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, h: 0, r: 0 })
const sparkShapes = []
for (let i = 0; i < 72; i++) sparkShapes.push({ k: "c", x: 0, y: 0, r: 1, h: 0, s: 80, l: 58, a: 0 })
let si = 0
function* sparkleActor() {
  let st = yield
  while (true) {
    if (st.hat) {
      const n = 1 + ((st.rnd() * 2) | 0)
      for (let k = 0; k < n; k++) {
        const p = SPARKS[si]
        si = (si + 1) % SPARKS.length
        const ang = st.rnd() * TAU
        const rr = st.span * (0.12 + st.rnd() * 0.3)
        p.on = true
        p.x = st.cx + Math.cos(ang) * rr
        p.y = st.cy + Math.sin(ang) * rr
        p.vx = Math.cos(ang) * st.span * (0.18 + st.rnd() * 0.28)
        p.vy = Math.sin(ang) * st.span * (0.18 + st.rnd() * 0.28)
        p.life = 1
        p.h = st.hue + 130 + st.rnd() * 80
        p.r = (1.5 + st.rnd() * 1.6) * st.U
      }
    }
    for (let i = 0; i < SPARKS.length; i++) {
      const p = SPARKS[i]
      if (!p.on) continue
      p.x += p.vx * st.dt
      p.y += p.vy * st.dt
      p.vx *= Math.exp(-st.dt * 1.4)
      p.vy *= Math.exp(-st.dt * 1.4)
      p.life -= st.dt * 1.6
      if (p.life <= 0) { p.on = false; continue }
      const o = sparkShapes[i]
      o.x = p.x; o.y = p.y
      o.r = p.r * (0.45 + p.life * 0.55)
      o.h = p.h
      o.a = p.life < 0.8 ? p.life : 0.8
      st.out[st.ol] = o
      st.ol++
    }
    st = yield
  }
}

let body = tunnelSwirl()
body.next()
const sparks = sparkleActor()
sparks.next()
let lastBar = -1
while (true) {
  const A = s.audio
  const span = Math.min(s.w, s.h)
  const calm = A.calm || 0
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 10 ? 1 - toDrop / 10 : 0
  const tight = Math.max(build, near * 0.7)
  const kick = A.kick || 0
  const bass = A.bass || 0
  const bar = typeof A.bar === "number" ? A.bar : 0
  S.t = s.t
  S.dt = s.dt > 0 ? s.dt : 1 / 60
  S.w = s.w
  S.h = s.h
  S.cx = s.cx
  S.cy = s.cy
  S.span = span
  S.U = span / 800
  S.hue = (typeof A.keyHue === "number" ? A.keyHue : 210) + s.t * 7
  S.swayX = Math.sin(s.t * 0.62) * span * 0.07 + Math.sin(s.t * 1.13 + 1.7) * span * 0.03
  S.swayY = Math.cos(s.t * 0.51 + 0.4) * span * 0.06 + Math.sin(s.t * 0.87 + 2.1) * span * 0.028
  S.high = A.high || 0
  S.bass = bass
  S.calm = calm
  S.drop = A.dropAmt || 0
  S.hat = A.hatHit ? 1 : 0
  S.speed = (0.55 + kick * 1.4 + bass * 0.4 + (A.level || 0) * 0.25) * (1 - calm * 0.55)
  S.spacing = 0.62 * (1 - 0.42 * tight)
  S.twistPull = A.snareHit ? 1.9 : 0
  S.ol = 0
  S.rnd = mulberry32((SEED ^ Math.imul(s.frame + 1, 0x9e3779b1)) >>> 0)
  if (bar !== lastBar) {
    lastBar = bar
    body = bar % 2 === 0 ? tunnelDrift() : tunnelSwirl()
    body.next()
  }
  body.next(S)
  sparks.next(S)
  out.length = S.ol
  s = await frame(out, {
    trail: 0.82 + calm * 0.1,
    zoom: 1.004 + kick * 0.02 + S.drop * 0.01,
    spin: 0.0016,
    hue: 0.7,
  })
}

// name: L-system garden
// Growth style after Prusinkiewicz and Lindenmayer: three grammar plants (fractal
// fern, bush, seaweed) unfold from a seed across one bar. Psychoscript technique:
// the grammars are rewritten with String.replace(/[FX]/g, fn), then a turtle walks
// the strings into depth-coloured polylines; every geometry level keeps its own
// reused pool of polyline and tip objects, so a frame only rewrites coordinates.
// Kick sways every branch angle, snare rotates which grammar is planted where,
// hats throw seed glints from the newest tips, bass thickens the trunks, keyHue
// colours by branch depth, calm slows the sway, and build/toDrop pull the garden
// inward before the drop releases it.
let s = await frame([])
const CAP = 450
const MAXG = 7
const clip = (v) => {
  if (v.length <= CAP) return v
  const k = v.lastIndexOf("]", CAP - 1)
  return k > 0 ? v.slice(0, k + 1) : v.slice(0, CAP)
}
const RULES = [
  { x: "F+[[X]-X]-F[-FX]+X", f: "FF", a: 0.44 },
  { x: "F[+X]F[-X]+X", f: "FF", a: 0.36 },
  { x: "F[+X]F[-X]X", f: "F", a: 0.20 },
]
const STRS = []
for (let g = 0; g < 3; g++) {
  const list = ["X"]
  let v = "X"
  for (let n = 1; n <= MAXG; n++) {
    v = clip(v.replace(/[FX]/g, (c) => (c === "F" ? RULES[g].f : RULES[g].x)))
    list.push(v)
  }
  STRS.push(list)
}
const mulberry32 = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(0x51de + 7)
const parse = (str, turn) => {
  const pls = [], tips = []
  let x = 0, y = 0, a = -Math.PI / 2, d = 0
  let lastA = 99
  const stack = []
  let pts = [x, y]
  for (let i = 0; i < str.length; i++) {
    const c = str[i]
    if (c === "F") {
      x += Math.cos(a)
      y += Math.sin(a)
      if (a === lastA && pts.length >= 4) {
        pts[pts.length - 2] = x
        pts[pts.length - 1] = y
      } else {
        pts.push(x, y)
        lastA = a
      }
    } else if (c === "+") a += turn
    else if (c === "-") a -= turn
    else if (c === "[") {
      if (pts.length > 2) pls.push({ p: pts, d })
      stack.push(x, y, a)
      d++
      pts = [x, y]
      lastA = 99
    } else if (c === "]") {
      if (pts.length > 2) {
        pls.push({ p: pts, d })
        tips.push({ x, y, d })
      }
      if (stack.length >= 3) {
        a = stack.pop()
        y = stack.pop()
        x = stack.pop()
      }
      if (d > 0) d--
      pts = [x, y]
      lastA = 99
    }
  }
  if (pts.length > 2) {
    pls.push({ p: pts, d })
    tips.push({ x, y, d })
  }
  let minX = 0, maxX = 0, minY = 0, maxY = 0
  for (let i = 0; i < pls.length; i++) {
    const p = pls[i].p
    for (let j = 0; j < p.length; j += 2) {
      if (p[j] < minX) minX = p[j]
      if (p[j] > maxX) maxX = p[j]
      if (p[j + 1] < minY) minY = p[j + 1]
      if (p[j + 1] > maxY) maxY = p[j + 1]
    }
  }
  const h = Math.max(0.0001, maxY - minY)
  const mx = (minX + maxX) * 0.5
  for (let i = 0; i < pls.length; i++) {
    const p = pls[i].p
    for (let j = 0; j < p.length; j += 2) {
      p[j] = (p[j] - mx) / h
      p[j + 1] = (p[j + 1] - maxY) / h
    }
  }
  for (let i = 0; i < tips.length; i++) {
    tips[i].x = (tips[i].x - mx) / h
    tips[i].y = (tips[i].y - maxY) / h
  }
  const keep = []
  const step = Math.max(1, Math.ceil(tips.length / 18))
  for (let i = 0; i < tips.length; i += step) keep.push(tips[i])
  return { pls, tips: keep }
}
const GEOM = []
for (let g = 0; g < 3; g++) {
  const list = []
  for (let n = 0; n <= MAXG; n++) list.push(parse(STRS[g][n], RULES[g].a))
  GEOM.push(list)
}
// One reused shape object per parsed polyline and per kept tip, for every grammar level, so a frame
// only rewrites coordinates and never allocates.
const POOL = []
for (let g = 0; g < 3; g++) {
  const list = []
  for (let n = 0; n <= MAXG; n++) {
    const gm = GEOM[g][n]
    const pls = [], tips = []
    for (let i = 0; i < gm.pls.length; i++) {
      const pts = []
      for (let k = 0; k < gm.pls[i].p.length; k++) pts.push(0)
      pls.push({ k: "p", pts, close: false, h: 0, s: 82, l: 50, a: 0.5, lw: 1 })
    }
    for (let i = 0; i < gm.tips.length; i++) tips.push({ k: "c", x: 0, y: 0, r: 1, h: 0, s: 88, l: 63, a: 0.5 })
    list.push({ pls, tips })
  }
  POOL.push(list)
}
const gen = [3, 4, 4]
const geoms = [GEOM[0][3], GEOM[1][4], GEOM[2][4]]
const pools = [POOL[0][3], POOL[1][4], POOL[2][4]]
const POS = [
  { x: -0.27, h: 0.56 },
  { x: 0, h: 0.72 },
  { x: 0.27, h: 0.56 },
]
let map = [0, 1, 2]
const glints = []
for (let i = 0; i < 16; i++) glints.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, h: 0, o: { k: "c", x: 0, y: 0, r: 1, h: 0, s: 86, l: 62, a: 0 } })
let gi = 0
const seeds = []
for (let i = 0; i < 3; i++) seeds.push({ k: "c", x: 0, y: 0, r: 1, h: 0, s: 70, l: 46, a: 0.16 })
const out = []
const fx = { trail: 0.56, zoom: 1, hue: 0.7, react: { punch: 0, slice: 0, sparkle: 0, shake: 0, tint: 0 } }
let sway = 0.05, bloom = 1, swap = 0
while (true) {
  const A = s.audio, dt = Math.min(s.dt || 1 / 60, 0.05)
  const span = Math.min(s.w, s.h), U = span / 800
  const calm = A.calm || 0
  const bass = A.bass || 0
  const kick = A.kick || 0
  const high = A.high || 0
  const hat = A.hat || 0
  const rel = A.dropAmt || 0
  const kh = typeof A.keyHue === "number" ? A.keyHue : 200
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 8 ? Math.max(0, 1 - toDrop / 8) : 0
  const pull = Math.max(build, near)
  const converge = pull * (1 - Math.min(1, rel * 2))
  const stretch = (1 + pull * 0.18 + rel * 0.14) * (1 - calm * 0.1)
  if (A.beat) {
    for (let g = 0; g < 3; g++) {
      if (gen[g] < MAXG) {
        gen[g]++
        geoms[g] = GEOM[g][gen[g]]
        pools[g] = POOL[g][gen[g]]
      }
    }
  }
  if (A.kickHit) sway = ((A.kicks || 0) % 2 ? -1 : 1) * (0.12 + bass * 0.06)
  if (A.snareHit) {
    map = [map[1], map[2], map[0]]
    swap = 1
    bloom = 1
  }
  if (A.downbeat) bloom = 1
  sway *= Math.exp(-dt * 3.4)
  swap *= Math.exp(-dt * 5)
  bloom *= Math.exp(-dt * 2.3)
  const lean = sway + Math.sin(s.t * 1.3) * 0.012 * (1 - calm)
  const la = lean * 0.34
  let n = 0
  for (let j = 0; j < 3; j++) {
    const gm = geoms[map[j]], gp = pools[map[j]]
    const P = POS[j]
    const H = span * P.h * stretch * (1 + bass * 0.04 + kick * 0.025)
    const px = s.cx + P.x * span * (1 - converge * 0.24 + rel * 0.2)
    const by = s.cy + span * 0.34
    const rot = (j - 1) * 0.055 + lean * (j === 1 ? 1 : 0.72) + swap * (j === 1 ? 0.13 : -0.13)
    const co = Math.cos(rot), si = Math.sin(rot)
    const tint = kh + j * 24
    const A1 = co * H, B1 = (la * co + si) * H, A2 = si * H, B2 = (co - la * si) * H
    const plA = Math.min(0.9, 0.44 + kick * 0.16 + rel * 0.1)
    const lwK = U * (0.8 + bass * 0.7)
    const lK = 46 + high * 8 + kick * 5
    for (let i = 0; i < gm.pls.length; i++) {
      const pl = gm.pls[i], src = pl.p, dep = pl.d
      const o = gp.pls[i], pts = o.pts
      for (let k = 0; k < src.length; k += 2) {
        const sx = src[k], sy = src[k + 1]
        pts[k] = px + sx * A1 - sy * B1
        pts[k + 1] = by + sx * A2 + sy * B2
      }
      const l = lK + dep * 2.1
      o.h = tint + dep * 15
      o.l = l > 65 ? 65 : l
      o.a = plA
      o.lw = Math.max(0.6, (2.3 - dep * 0.13) * lwK)
      out[n++] = o
    }
    const tipR = (1.4 + hat * 2 + rel * 2 + bloom * 1.5) * U * (1 - calm * 0.3)
    const tipA = 0.48 + hat * 0.24
    for (let i = 0; i < gm.tips.length; i++) {
      const tp = gm.tips[i]
      const sx = px + tp.x * A1 - tp.y * B1, sy = by + tp.x * A2 + tp.y * B2
      const o = gp.tips[i]
      o.x = sx
      o.y = sy
      o.r = tipR
      o.h = tint + tp.d * 15 + 34
      o.a = tipA
      out[n++] = o
      if (A.hatHit && j === (A.hats || 0) % 3 && i === gm.tips.length >> 1) {
        const gl = glints[gi]
        gi = (gi + 1) % glints.length
        gl.on = true
        gl.x = sx
        gl.y = sy
        gl.vx = (rng() - 0.5) * 70 * U
        gl.vy = -(20 + rng() * 60) * U
        gl.life = 1
        gl.h = tint + 46
      }
    }
    const sd = seeds[j]
    sd.x = px
    sd.y = by
    sd.r = (13 + kick * 9 + rel * 8) * U
    sd.h = tint + 18
    sd.a = 0.16 + kick * 0.1
    out[n++] = sd
  }
  for (let i = 0; i < glints.length; i++) {
    const gl = glints[i]
    if (!gl.on) continue
    gl.life -= dt * 1.7
    if (gl.life <= 0) {
      gl.on = false
      continue
    }
    gl.x += gl.vx * dt
    gl.y += gl.vy * dt
    gl.vy += 46 * U * dt
    gl.vx *= Math.exp(-dt * 1.4)
    const o = gl.o
    o.x = gl.x
    o.y = gl.y
    o.r = (1.2 + 1.8 * hat) * U * gl.life
    o.h = gl.h
    o.a = gl.life * 0.7
    out[n++] = o
  }
  out.length = n
  fx.trail = 0.56 + calm * 0.18
  fx.zoom = 1 + kick * 0.008
  fx.react.punch = kick * 0.5
  fx.react.sparkle = hat * 0.4
  fx.react.shake = swap * 0.35
  s = await frame(out, fx)
}

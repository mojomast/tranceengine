// name: Coral growth
// Style: growth — a coral fan grown by diffusion-limited aggregation, inspired by sea fans and radiolarians.
// Psychoscript technique: Map/Set graphs — an occupancy Set of grid cells is the coral, a child->parent Map is
// its branch graph, and the accumulated cluster is rewound by a beat-repeat stutter (resumed memory stays).
// KickHit releases walkers faster and swells the body; hats light branch tips; snares start a side branch and
// shift the hue; bass thickens the skeleton; keyHue/note colour it; calm slows and thins growth; build/toDrop
// gather walkers inward and a drop throws them wide, with a root flare on the downbeat.
let s = await frame([])
const TAU = Math.PI * 2
const span = Math.min(s.w, s.h)
const cell = Math.min(span * 0.019, s.w * 0.016)
const bx = Math.max(22, Math.floor((s.w * 0.44) / cell))
const byUp = Math.max(18, Math.floor((s.cy - span * 0.06) / cell))
const byDn = Math.max(8, Math.floor((s.h - s.cy - span * 0.06) / cell))
const NX = [1, -1, 0, 0], NY = [0, 0, 1, -1]
let seed = 0x1a2b3c4d
const rnd = () => {
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const key = (gx, gy) => (gy + 128) * 256 + gx + 128
const jx = (k) => Math.sin(k * 12.9898) * cell * 0.14
const jy = (k) => Math.cos(k * 7.233) * cell * 0.14
const occupied = new Set()
const parentOf = new Map()
const cells = []
const sx = [], sy = [], px = [], py = [], ch = []
const tips = new Set()
const ROOT = key(0, 0)
let sumGX = 0, sumGY = 0
const addCell = (gx, gy, pk) => {
  const k = key(gx, gy)
  if (occupied.has(k)) return 0
  occupied.add(k)
  parentOf.set(k, pk)
  cells.push(k)
  sumGX += gx
  sumGY += gy
  sx.push(s.cx + gx * cell + jx(k))
  sy.push(s.cy + gy * cell + jy(k))
  const pgx = (pk % 256) - 128, pgy = Math.floor(pk / 256) - 128
  px.push(s.cx + pgx * cell + jx(pk))
  py.push(s.cy + pgy * cell + jy(pk))
  ch.push(Math.atan2(gy, gx) * 14.3 + Math.sqrt(gx * gx + gy * gy) * 1.1)
  return k
}
addCell(0, 0, ROOT)
tips.add(ROOT)
let reach = 2
const stick = (gx, gy, pk) => {
  const k = addCell(gx, gy, pk)
  if (!k) return 0
  tips.delete(pk)
  tips.add(k)
  reach = Math.max(reach, Math.abs(gx), Math.abs(gy))
  return k
}
// Walkers are seeded just outside a branch tip, so they find the cluster quickly while still sticking randomly.
const seedWalk = (w) => {
  let k = cells[Math.floor(rnd() * cells.length)]
  let gx = (k % 256) - 128, gy = Math.floor(k / 256) - 128
  let climb = 0
  while (!tips.has(k) && climb++ < 48) {
    const pk = parentOf.get(k)
    if (pk === undefined || pk === k) break
    k = pk
    gx = (k % 256) - 128
    gy = Math.floor(k / 256) - 128
  }
  let a = Math.atan2(gy, gx)
  if (a > 0) a = -a
  a += (rnd() - 0.5) * 1.5
  const rr = 2 + rnd() * 3
  w.x = Math.round(gx + Math.cos(a) * rr)
  w.y = Math.round(gy + Math.sin(a) * rr)
  w.px = w.x
  w.py = w.y
  w.life = 150 + Math.floor(rnd() * 220)
}
// Seed the fan before the first visible frame, so the insert reads as coral on the downbeat.
let guard = 0
const seedW = { x: 0, y: 0, px: 0, py: 0, life: 0 }
while (cells.length < 240 && guard < 160000) {
  seedWalk(seedW)
  for (let st = 0; st < 700; st++) {
    guard++
    const r = rnd()
    if (r < 0.27) seedW.y -= 1
    else if (r < 0.5) seedW.y += 1
    else if (r < 0.75) seedW.x -= 1
    else seedW.x += 1
    if (seedW.x < -bx || seedW.x > bx || seedW.y < -byUp || seedW.y > byDn) break
    if (occupied.has(key(seedW.x, seedW.y))) break
    let pk = 0, nb = 0
    for (let d = 0; d < 4; d++) {
      const nk = key(seedW.x + NX[d], seedW.y + NY[d])
      if (occupied.has(nk)) { nb++; if (rnd() < 1 / nb) pk = nk }
    }
    if (pk && rnd() < (nb === 1 ? 0.4 : nb === 2 ? 0.11 : 0.025)) { stick(seedW.x, seedW.y, pk); break }
  }
}
const baseN = cells.length
const CAP = 468
const walkers = []
const launch = (w) => seedWalk(w)
for (let i = 0; i < 18; i++) {
  const w = { x: 0, y: 0, px: 0, py: 0, life: 0 }
  launch(w)
  walkers.push(w)
}
const pulses = []
const rewind = (n) => {
  let done = 0
  while (done < n && cells.length > baseN) {
    const k = cells.pop()
    const pk = parentOf.get(k)
    sumGX -= (k % 256) - 128
    sumGY -= Math.floor(k / 256) - 128
    parentOf.delete(k)
    occupied.delete(k)
    sx.pop(); sy.pop(); px.pop(); py.pop(); ch.pop()
    tips.delete(k)
    if (pk !== undefined) tips.add(pk)
    done++
  }
  if (done) pulses.push({ life: 1, dir: -1, h: 28 })
}
let lastBeatT = -1
let flare = 0
while (true) {
  const A = s.audio, dt = s.dt, out = []
  const calm = A.calm || 0, bass = A.bass || 0, kick = A.kick || 0, snare = A.snare || 0
  const hat = A.hat || 0, dropAmt = A.dropAmt || 0
  const note = typeof A.note === "number" ? A.note : 0
  const hue0 = (typeof A.keyHue === "number" ? A.keyHue : 196) + note * 5
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 8 ? Math.max(0, 1 - toDrop / 8) : 0
  const gather = Math.max(build, near) * (1 - Math.min(1, dropAmt * 1.5))
  const bpm = A.bpm || 138
  flare = Math.max(flare * Math.exp(-dt * 5), A.downbeat ? 1 : 0)
  if (A.beat && (lastBeatT < 0 || s.t - lastBeatT > 0.06)) {
    const gap = lastBeatT > 0 ? s.t - lastBeatT : 99
    if (gap < (60 / bpm) * 0.55) rewind(Math.min(56, Math.floor((cells.length - baseN) * 0.45)))
    lastBeatT = s.t
  }
  let release = 1 + (A.kickHit ? 5 : 0) + Math.floor(bass * 2) + (dropAmt > 0.25 ? 2 : 0)
  release = Math.floor(release * (1 - calm * 0.65))
  for (let i = 0; i < release && walkers.length < 30; i++) {
    const w = { x: 0, y: 0, px: 0, py: 0, life: 0 }
    launch(w)
    walkers.push(w)
  }
  if (A.snareHit && cells.length > baseN + 2 && walkers.length < 32) {
    const k = cells[baseN + Math.floor(rnd() * (cells.length - baseN))]
    const w = { x: (k % 256) - 128, y: Math.floor(k / 256) - 128 - 2, px: 0, py: 0, life: 130 }
    w.px = w.x
    w.py = w.y
    walkers.push(w)
  }
  if (A.drop) {
    pulses.push({ life: 1, dir: 1, h: hue0 + 160 })
    for (let i = 0; i < 8 && walkers.length < 34; i++) {
      const w = { x: 0, y: 0, px: 0, py: 0, life: 0 }
      launch(w)
      walkers.push(w)
    }
  }
  const steps = 2 + Math.floor(bass * 2.5) + (A.hatHit ? 1 : 0)
  const pull = gather * 0.22
  let grow = 1 + (A.kickHit ? 2 : 0) + (bass > 0.55 ? 1 : 0) + (dropAmt > 0.3 ? 2 : 0)
  for (let i = walkers.length - 1; i >= 0; i--) {
    const w = walkers[i]
    w.px = w.x
    w.py = w.y
    let stuckNow = 0
    for (let st = 0; st < steps; st++) {
      const r = rnd()
      if (r < 0.27) w.y -= 1
      else if (r < 0.5) w.y += 1
      else if (r < 0.75) w.x -= 1
      else w.x += 1
      if (pull > 0 && rnd() < pull) {
        if (w.x) w.x -= w.x > 0 ? 1 : -1
        if (w.y) w.y -= w.y > 0 ? 1 : -1
      }
      if (w.x < -bx || w.x > bx || w.y < -byUp || w.y > byDn) break
      let pk = 0
      for (let d = 0; d < 4; d++) {
        const nk = key(w.x + NX[d], w.y + NY[d])
        if (occupied.has(nk)) { pk = nk; break }
      }
      if (pk) {
        if (grow > 0 && cells.length < CAP && stick(w.x, w.y, pk)) { stuckNow = 1; grow-- }
        break
      }
    }
    w.life -= dt * (14 + calm * 14)
    if (stuckNow || w.life <= 0) {
      if (cells.length < CAP) launch(w)
      else walkers.splice(i, 1)
    }
  }
  for (let i = 0; i < pulses.length; i++) {
    const p = pulses[i]
    p.life -= dt * 1.8
    if (p.life <= 0) { pulses.splice(i, 1); i-- }
  }
  out.push({ k: "c", x: s.cx, y: s.cy - span * 0.05, r: span * 0.3, h: hue0 + 210, s: 65, l: 17, a: 0.15 })
  const n = cells.length
  const ox = n ? -(sumGX / n) * cell : 0, oy = n ? -(sumGY / n) * cell : 0
  const lw = (0.9 + bass * 2 + kick * 2 + dropAmt * 1.5) * (span / 800)
  const hueShift = snare * 26 + flare * 18
  const baseA = Math.min(0.68, 0.34 + bass * 0.2 + kick * 0.12)
  for (let i = 1; i < n; i++) {
    const fresh = i > n - 22
    out.push({
      k: "l", x1: px[i] + ox, y1: py[i] + oy, x2: sx[i] + ox, y2: sy[i] + oy,
      h: hue0 + ch[i] + hueShift, s: 74,
      l: fresh ? 60 + hat * 4 : 38 + (i / n) * 18,
      a: fresh ? Math.min(0.86, 0.62 + hat * 0.3) : baseA,
      lw: fresh ? lw * 1.55 : lw,
    })
  }
  out.push({ k: "c", x: s.cx + ox, y: s.cy + oy, r: (5 + bass * 4 + kick * 6 + flare * 5) * (span / 800), h: hue0 + 180, s: 80, l: 58, a: Math.min(0.85, 0.35 + kick * 0.35) })
  if (hat > 0.04) {
    let ci = 0
    for (const k of tips) {
      ci++
      if (ci % 3) continue
      if (ci > 48) break
      const gx = (k % 256) - 128, gy = Math.floor(k / 256) - 128
      out.push({
        k: "c", x: s.cx + ox + gx * cell + jx(k), y: s.cy + oy + gy * cell + jy(k),
        r: (1.4 + hat * 2.6) * (span / 800), h: hue0 + 145, s: 82, l: 62, a: Math.min(0.8, hat * 0.9),
      })
    }
  }
  for (let i = 0; i < walkers.length; i++) {
    const w = walkers[i]
    const x = s.cx + ox + w.x * cell, y = s.cy + oy + w.y * cell
    out.push({ k: "l", x1: s.cx + ox + w.px * cell, y1: s.cy + oy + w.py * cell, x2: x, y2: y, h: hue0 + 150, s: 70, l: 58, a: 0.2, lw: span / 800 })
    out.push({ k: "c", x, y, r: (1 + bass * 1.3) * (span / 800), h: hue0 + 160, s: 70, l: 62, a: 0.5 })
  }
  for (let i = 0; i < pulses.length; i++) {
    const p = pulses[i]
    const rr = span * (p.dir > 0 ? (1 - p.life) * 0.34 : p.life * 0.28)
    out.push({ k: "c", x: s.cx + ox, y: s.cy + oy, r: Math.max(2, rr), h: p.h, s: 76, l: 56, a: p.life * 0.34, fill: false, lw: 1.2 * (span / 800) })
  }
  for (let i = 0; i < 16; i++) {
    if (flare < 0.04) break
    const a = (i / 16) * TAU + s.t * 0.4
    const rr = span * (0.07 + flare * 0.13)
    out.push({ k: "c", x: s.cx + ox + Math.cos(a) * rr, y: s.cy + oy + Math.sin(a) * rr, r: 1.3 * (span / 800) * (0.4 + flare), h: hue0 + 195, s: 75, l: 60, a: flare * 0.45 })
  }
  s = await frame(out, {
    trail: 0.86 + calm * 0.08,
    zoom: 1 + kick * 0.008 + dropAmt * 0.018 + flare * 0.006,
    spin: 0.0007,
    hue: 0.6,
  })
}

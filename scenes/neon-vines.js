// name: Neon vines
// Glowing tendrils creep out from the centre, curling as they grow and leaving trails that fade and get recycled.
// Energy sets growth speed, beats branch new tips, snares pop buds at the tips, drops burst fresh vines outward, and calm curls them into slow spirals.
let s = await frame([])

const MAX_TIPS = 60
const MAX_STRANDS = 90
const MAX_PTS = 50
const strands = [] // each: { pts: [x, y, ...], hue, fade, tip: {x, y, a, age, life, ph, dir, bud} | null }

const liveCount = () => {
  let n = 0
  for (const st of strands) if (st.tip) n++
  return n
}

const recycleGhost = () => {
  let best = -1
  let bestLen = Infinity
  for (let i = 0; i < strands.length; i++) {
    const st = strands[i]
    if (!st.tip && st.pts.length < bestLen) { best = i; bestLen = st.pts.length }
  }
  if (best >= 0) strands.splice(best, 1)
  return best >= 0
}

const retireOldest = () => {
  let oldest = null
  for (const st of strands) {
    if (st.tip && (!oldest || st.tip.age > oldest.tip.age)) oldest = st
  }
  if (oldest) { oldest.tip = null; oldest.fade = 0 }
}

const spawn = (x, y, a, hue, life) => {
  if (liveCount() >= MAX_TIPS) return false
  if (strands.length >= MAX_STRANDS && !recycleGhost()) return false
  strands.push({
    pts: [x, y],
    hue,
    fade: 0,
    tip: { x, y, a, age: 0, life, ph: Math.random() * Math.PI * 2, dir: Math.random() < 0.5 ? -1 : 1, bud: 0 }
  })
  return true
}

const hueOf = (st, t, high) => st.hue + t * 4 + high * 30

while (true) {
  const A = s.audio
  const out = []
  const u = Math.min(s.w, s.h) / 800
  const k = Math.min(2, Math.max(0, s.dt) * 60) || 1
  const calm = Math.min(1, Math.max(0, A.calm || 0))
  const speed = (0.8 + A.energy * 2.4) * u * (1 - 0.6 * calm) * (1 + A.dropAmt * 1.2)

  // drop: burst many fresh vines out from the centre
  if (A.drop) {
    for (let i = 0; i < 24; i++) {
      if (liveCount() >= MAX_TIPS) retireOldest()
      spawn(s.cx, s.cy, (i / 24) * Math.PI * 2 + Math.random() * 0.2,
        150 + Math.random() * 150, 4 + Math.random() * 4)
    }
  }

  // beat: a live tip sprouts a branch
  if (A.beat) {
    const live = strands.filter(st => st.tip)
    if (live.length) {
      const parent = live[Math.floor(Math.random() * live.length)]
      const sign = Math.random() < 0.5 ? -1 : 1
      spawn(parent.tip.x, parent.tip.y, parent.tip.a + sign * (0.6 + Math.random() * 0.6),
        parent.hue + 30, 6 + Math.random() * 4)
    }
  }

  // snare/clap/hat: every tip pops a bud
  if (A.snapHit) {
    for (const st of strands) if (st.tip) st.tip.bud = 1
  }

  // keep a minimum of vines alive in quiet passages
  if (liveCount() < 3) {
    spawn(s.cx + (Math.random() - 0.5) * s.w * 0.1, s.cy + (Math.random() - 0.5) * s.h * 0.1,
      Math.random() * Math.PI * 2, 170 + Math.random() * 120, 8 + Math.random() * 6)
  }

  // grow tips and age ghosts
  for (const st of strands) {
    const tip = st.tip
    if (tip) {
      tip.age += s.dt || 0
      const wander = Math.sin(s.t * 1.7 + tip.ph) * 0.07 + (Math.random() - 0.5) * 0.09
      const spiral = tip.dir * 0.045
      tip.a += (wander * (1 - calm) + spiral * calm) * k
      tip.x += Math.cos(tip.a) * speed * k
      tip.y += Math.sin(tip.a) * speed * k
      tip.bud *= Math.pow(0.9, k)
      st.pts.push(tip.x, tip.y)
      if (st.pts.length > MAX_PTS * 2) st.pts.splice(0, 2)
      const off = tip.x < -20 || tip.x > s.w + 20 || tip.y < -20 || tip.y > s.h + 20
      if (off || tip.age > tip.life || !Number.isFinite(tip.x) || !Number.isFinite(tip.y)) {
        st.tip = null
        st.fade = 0
      }
    } else {
      // ghost: the trail recedes from its tail, tip-first fade
      st.fade += 1
      if (st.fade % 2 === 0) st.pts.splice(0, 2)
    }
  }
  for (let i = strands.length - 1; i >= 0; i--) {
    if (!strands[i].tip && strands[i].pts.length < 4) strands.splice(i, 1)
  }

  // draw trails (live ones bright, ghosts fading)
  for (const st of strands) {
    const n = st.pts.length
    if (n < 4) continue
    const live = !!st.tip
    const fadeF = live ? 1 : Math.max(0, n / (MAX_PTS * 2))
    const hue = hueOf(st, s.t, A.high)
    out.push({
      k: "p", pts: st.pts.slice(), close: false,
      h: hue, s: 100, l: 50 + A.bass * 12, a: 0.8 * fadeF,
      lw: (1.2 + A.bass * 2.5 + (live ? 0.8 : 0)) * u
    })
  }

  // buds at the tips, popping on snare hits
  for (const st of strands) {
    if (!st.tip) continue
    const tip = st.tip
    out.push({
      k: "c", x: tip.x, y: tip.y,
      r: (1.5 + tip.bud * 7 + A.snap * 2) * u,
      h: hueOf(st, s.t, A.high) + 40, s: 100, l: 75, a: 0.9
    })
  }

  s = await frame(out, {
    trail: 0.92 + calm * 0.04,
    zoom: 1 + (A.kick || 0) * 0.004,
    spin: 0.002,
    hue: 0.5,
    mirror: 6,
    blend: "lighter"
  })
}

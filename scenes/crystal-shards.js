// name: Crystal shards
// A faceted geode grows from the centre: energy sets how far each crystal reaches and the bands tint its facets.
// Beats spin and split the colours, a snare cracks one shard loose, a drop shatters the cluster, and calm leaves one slow crystal.
let s = await frame([])

const N = 14
const hash = (x) => { const v = Math.sin(x * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) }
const shards = []
for (let i = 0; i < N; i++) {
  shards.push({
    i,
    ang0: i === 0 ? 0 : (i / N) * Math.PI * 2 + (hash(i) - 0.5) * 0.35,
    len: i === 0 ? 1 : 0.35 + 0.65 * hash(i + 17),
    wid: i === 0 ? 0.14 : 0.05 + 0.05 * hash(i + 41),
    band: Math.floor(hash(i + 3) * 32),
    gr: 0.5, sc: 1, gone: false, regrow: 0,
    dx: 0, dy: 0, vx: 0, vy: 0, ph: 0, vph: 0
  })
}
let flying = []
let cm = 0
let rot = 0
let rotV = 0

// Adds one faceted crystal to out: four translucent facets, a silhouette and a ridge line.
// With ghost set, only a offset prism-coloured silhouette is added (the refraction echo).
function pushShard(out, ox, oy, a, L, W, h, fa, oa, lw, ghost) {
  const P = (lx, ly) => [ox + lx * Math.cos(a) - ly * Math.sin(a), oy + lx * Math.sin(a) + ly * Math.cos(a)]
  const b1 = P(0, -W), m1 = P(L * 0.55, -W * 1.05), tip = P(L, 0), m2 = P(L * 0.55, W * 1.05)
  const b2 = P(0, W), mc = P(L * 0.55, 0), o = P(0, 0)
  if (!ghost && fa > 0.01) {
    out.push({ k: "p", pts: [...b1, ...m1, ...mc, ...o], fill: true, h, s: 85, l: 62, a: fa })
    out.push({ k: "p", pts: [...o, ...mc, ...m2, ...b2], fill: true, h: h + 25, s: 85, l: 48, a: fa * 1.1 })
    out.push({ k: "p", pts: [...m1, ...tip, ...mc], fill: true, h: h + 50, s: 90, l: 66, a: fa * 0.9 })
    out.push({ k: "p", pts: [...mc, ...tip, ...m2], fill: true, h: h - 20, s: 85, l: 50, a: fa })
  }
  if (oa > 0.01) {
    out.push({ k: "p", pts: [...b1, ...m1, ...tip, ...m2, ...b2], fill: false, h: h + (ghost ? 120 : 30), s: 90, l: 74, a: oa, lw })
    if (!ghost) out.push({ k: "p", pts: [...o, ...mc, ...tip], close: false, fill: false, h: h + 60, s: 90, l: 80, a: oa * 0.6, lw: lw * 0.7 })
  }
}

while (true) {
  const A = s.audio
  const out = []
  const dt = Math.min(Math.max(s.dt || 0, 0), 1 / 30) || 1 / 60
  const u = Math.min(s.w, s.h) / 800
  const R = Math.min(s.w, s.h) * 0.34
  const bx = s.cx
  const by = s.cy
  const flashK = A.kick || 0
  const sn = A.snaps || 0

  cm += ((A.calm || 0) - cm) * Math.min(1, dt * 1.2)

  // Beats spin the cluster and a drop gives it a hard push; calm slows the turning.
  if (A.beat) rotV += 0.7
  if (A.drop) rotV += 1.2
  rotV *= Math.exp(-dt * 2.5)
  rot += (0.14 * (1 - cm) + 0.02 * cm + rotV) * dt

  const growT = Math.min(1, 0.35 + (A.energy || 0) * 0.75)

  // A snare or clap cracks one shard off; it flies away and spins until it fades.
  const attached = shards.filter(q => !q.gone).length
  if (A.snapHit && cm < 0.5 && attached > 6 && flying.length < 8) {
    let idx = -1
    for (let k = 0; k < N && idx < 0; k++) {
      const j = (sn + k) % N
      if (j !== 0 && !shards[j].gone) idx = j
    }
    if (idx > 0) {
      const q = shards[idx]
      const a = q.ang0 + rot + q.ph
      const L = q.len * R * q.gr * q.sc
      const W = q.wid * R
      const bvq = (A.bands && A.bands[q.band]) || 0
      const sp = (170 + hash(sn + 5) * 140) * u
      flying.push({
        x: bx + q.dx + Math.cos(a) * L * 0.5,
        y: by + q.dy + Math.sin(a) * L * 0.5,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        a, w: (hash(sn + 9) - 0.5) * 7, L, W,
        h: 185 + idx * 11 + bvq * 120 + s.t * 4,
        life: 2.6
      })
      q.gone = true
      q.regrow = 3.5
    }
  }

  // A drop shatters the whole crystal: every shard is thrown outward on a spring that pulls it back.
  if (A.drop) {
    for (const q of shards) {
      const k = (170 + hash(q.i * 3.1 + 2) * 200) * u
      const da = q.ang0 + (hash(q.i + 70) - 0.5) * 1.5
      q.vx = Math.cos(da) * k
      q.vy = Math.sin(da) * k
      q.vph = (hash(q.i + 80) - 0.5) * 10
    }
  }

  for (const q of shards) {
    q.vx += (-5 * q.dx - 1.8 * q.vx) * dt
    q.vy += (-5 * q.dy - 1.8 * q.vy) * dt
    q.dx += q.vx * dt
    q.dy += q.vy * dt
    q.vph += (-5 * q.ph - 1.8 * q.vph) * dt
    q.ph += q.vph * dt
    if (q.gone) {
      q.regrow -= dt
      if (q.regrow <= 0) q.gone = false
    }
    // Facets grow with the energy of the music, each shard with its own lag.
    q.gr += (Math.min(1, growT * (0.6 + 0.4 * q.len)) - q.gr) * Math.min(1, dt * 2)
    // In calm the other shards fade away and the main crystal stays.
    const tgt = q.gone ? 0 : (q.i === 0 ? 1 : 1 - 0.92 * cm)
    q.sc += (tgt - q.sc) * Math.min(1, dt * 3)
  }

  // Draw the attached crystal.
  for (const q of shards) {
    if (q.sc < 0.02) continue
    const bv = (A.bands && A.bands[q.band]) || 0
    const h = 185 + q.i * 11 + bv * 120 + s.t * 4 + flashK * 50
    const L = q.len * R * q.gr * (q.i === 0 ? 0.75 + 0.45 * cm : 1) * q.sc
    const W = q.wid * R * (q.i === 0 ? 1 + 0.4 * cm : 1) * (0.5 + 0.5 * q.sc)
    const a = q.ang0 + rot + q.ph
    const ox = bx + q.dx
    const oy = by + q.dy
    const fa = (0.16 + 0.12 * bv + 0.04 * flashK) * q.sc
    const oa = 0.75 * q.sc
    pushShard(out, ox, oy, a, L, W, h, fa, oa, 1.6 * u, false)
    if (flashK > 0.05) pushShard(out, ox, oy, a + 0.05 * flashK, L, W, h, 0, flashK * 0.6 * q.sc, 1.2 * u, true)
  }

  // Cracked-off shards fly, spin and fade.
  for (const f of flying) {
    f.x += f.vx * dt
    f.y += f.vy * dt
    f.vx *= Math.exp(-dt * 0.6)
    f.vy *= Math.exp(-dt * 0.6)
    f.a += f.w * dt
    f.life -= dt
  }
  flying = flying.filter(f => f.life > 0)
  for (const f of flying) {
    const al = Math.min(1, f.life / 0.8)
    pushShard(out, f.x, f.y, f.a, f.L, f.W, f.h, 0.26 * al, 0.9 * al, 1.8 * u, false)
  }

  // A soft core that flares on the kick.
  out.push({ k: "c", x: bx, y: by, r: R * (0.08 + 0.05 * flashK + 0.03 * (A.energy || 0)), h: 200 + flashK * 60, s: 90, l: 68, a: 0.18 + 0.2 * flashK })

  s = await frame(out, {
    trail: 0.86 + cm * 0.08,
    zoom: 1 + flashK * 0.006 - cm * 0.002,
    spin: 0.002,
    hue: 0.8,
    mirror: 6
  })
}

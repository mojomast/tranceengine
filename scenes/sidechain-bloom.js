// name: Sidechain bloom
// A flower of closed petals around the centre. Every kick ducks the petal radius and it
// blooms back over the beat; snares fling out a ring of shards, hats glint on the petal tips
// and the bass swells the inner core. Builds tighten and spin it, the drop bursts it open
// (mirror 8 while dropAmt is high), and calm slows the breathing with softer colours.
let s = await frame([])
const TAU = Math.PI * 2
const M = 10
const tpl = []
for (let i = 0; i < M; i++) {
  const a = (i / M) * TAU
  tpl.push(0.5 + Math.cos(a) * 0.5, Math.sin(a) * 0.42)
}
let lastPhrase = Math.floor((s.audio.bars || 0) / 8)
let petalCount = 6 + ((lastPhrase * 5 + 3) % 11)
const rings = []
while (true) {
  const A = s.audio
  const U = Math.min(s.w, s.h) / 800
  const out = []
  const calm = A.calm || 0
  const kick = A.kick || 0
  const bass = A.bass || 0
  const hat = A.hat || 0
  const snare = A.snare || 0
  const dropAmt = A.dropAmt || 0
  const build = A.build || 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 8 ? 1 - Math.min(1, Math.max(0, toDrop) / 8) : 0
  const pull = Math.max(build, near * 0.85)
  const hueBase = (A.keyHue || 200) + (A.note || 0) * 7
  const phrase = Math.floor((A.bars || 0) / 8)
  if (A.downbeat && phrase !== lastPhrase) {
    lastPhrase = phrase
    petalCount = 6 + ((phrase * 5 + 3) % 11)
  }
  const breathe = 1 + 0.04 * Math.cos((A.phase || 0) * TAU) * (0.4 + calm * 0.8)
  const R = Math.min(s.w, s.h) * 0.32 * (1 - 0.35 * kick) * (1 - 0.32 * pull) * (1 + 0.45 * dropAmt) * breathe
  const spin = s.t * (0.18 + pull * 1.1 + dropAmt * 1.4) * (1 - 0.7 * calm)
  const sat = 62 - calm * 22
  const light = 52 - calm * 6
  const width = (1.6 + kick * 2.4) * U
  for (let i = 0; i < petalCount; i++) {
    const ang = spin + (i / petalCount) * TAU
    const c = Math.cos(ang), sn = Math.sin(ang)
    const pts = []
    for (let j = 0; j < M; j++) {
      const lx = tpl[j * 2] * R
      const ly = tpl[j * 2 + 1] * R
      pts.push(s.cx + lx * c - ly * sn, s.cy + lx * sn + ly * c)
    }
    out.push({ k: "p", pts, h: hueBase + i * 9 + dropAmt * 40, s: sat, l: light, a: 0.72, lw: width })
  }
  const coreR = R * (0.10 + 0.16 * bass) * (1 + 0.3 * dropAmt)
  out.push({ k: "c", x: s.cx, y: s.cy, r: coreR, h: hueBase + 30, s: sat + 8, l: light + 4, a: 0.55 })
  out.push({ k: "c", x: s.cx, y: s.cy, r: coreR * 2.1, h: hueBase + 15, s: sat, l: light - 6, a: 0.14 })
  if (hat > 0.06) {
    for (let i = 0; i < petalCount; i++) {
      const ang = spin + (i / petalCount) * TAU
      const tw = 0.35 + 0.65 * Math.max(0, Math.sin(s.t * 9 + i * 1.7))
      const rr = R * (1.02 + 0.05 * tw)
      out.push({ k: "c", x: s.cx + Math.cos(ang) * rr, y: s.cy + Math.sin(ang) * rr,
        r: (1.1 + hat * 3.2 * tw) * U, h: hueBase + 60 + i * 9, s: 70, l: 63, a: 0.55 * hat })
    }
  }
  if (A.snareHit && rings.length < 4) rings.push({ r: R * 0.55, life: 1, h: hueBase + 150, spin: Math.random() * TAU })
  if (A.drop && rings.length < 5) rings.push({ r: R * 0.3, life: 1, h: hueBase + 190, spin: 0 })
  for (let j = rings.length - 1; j >= 0; j--) {
    const rg = rings[j]
    rg.r += (200 + 160 * snare) * U * s.dt * (1 - calm * 0.5)
    rg.life -= s.dt * 1.5
    if (rg.life <= 0) { rings.splice(j, 1); continue }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU + rg.spin + rg.r * 0.002
      const jit = 1 + 0.1 * Math.sin(i * 2.3)
      out.push({ k: "c", x: s.cx + Math.cos(a) * rg.r * jit, y: s.cy + Math.sin(a) * rg.r * jit,
        r: (1.4 + 1.6 * rg.life) * U, h: rg.h, s: 65, l: 62, a: rg.life * 0.8 })
    }
  }
  s = await frame(out, {
    trail: 0.8 + calm * 0.12 + pull * 0.05,
    zoom: 1 + kick * 0.02 - pull * 0.012 + dropAmt * 0.02,
    spin: 0.0025 * (1 + pull * 1.5) * (1 - calm * 0.7),
    hue: 0.8 + (A.energy || 0) * 1.4,
    mirror: dropAmt > 0.35 ? 8 : 0,
  })
}

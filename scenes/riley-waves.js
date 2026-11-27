// name: Riley waves
// Op-art after Bridget Riley's wave paintings: forty parallel horizontal bands
// bent by a sine whose frequency climbs toward the floor, so the whole surface
// seems to vibrate. Technique: a seeded mulberry32 PRNG (Math.imul) fixes every
// line's offset, frequency jitter and amplitude at start-up, so a rewind, beat
// repeat or replay redraws exactly the same frames. Reactions: kick deepens the
// displacement, bass slides the phase, snare eases the curvature the other way,
// hats glint along the bands, calm flattens the surface, the key hue tints the
// two mid-lightness colours, and build gathers before the drop lets go.
let s = await frame([])
const TAU = Math.PI * 2
const PI = Math.PI
const SIN = Math.sin
const NL = 40
let seed = 0x9e3779b9
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const linePhase = [], lineCyc = [], lineAmp = [], lineN = [], linePts = []
for (let i = 0; i < NL; i++) {
  linePhase.push((rand() - 0.5) * 0.8)
  lineCyc.push(0.9 + i * 0.12 + (rand() - 0.5) * 0.1)
  lineAmp.push(0.92 + rand() * 0.3)
  const n = 32 + Math.round(i * 2.1)
  lineN.push(n)
  linePts.push(new Array(n * 2))
}
let bend = 1, bendTarget = 1
while (true) {
  const A = s.audio, dt = s.dt, out = []
  const span = Math.min(s.w, s.h), U = span / 800
  const kick = A.kick || 0, bass = A.bass || 0, hat = A.hat || 0, calm = A.calm || 0
  if (A.snareHit) bendTarget = -bendTarget
  bend += (bendTarget - bend) * Math.min(1, dt * 4.5)
  const hue0 = typeof A.keyHue === "number" ? A.keyHue : 205
  const build = typeof A.build === "number" ? A.build : 0
  const toDrop = typeof A.toDrop === "number" ? A.toDrop : 99
  const near = toDrop < 8 ? 1 - toDrop / 8 : 0
  const dropAmt = A.dropAmt || 0
  const gather = Math.max(build, near) * (1 - Math.min(1, dropAmt * 1.4))
  const depth = (1 + kick * 0.9 + dropAmt * 0.25 + gather * 0.25 - calm * 0.62) * bend
  const phase = s.t * (0.6 + bass * 1.8) * (1 - calm * 0.55) + gather * 0.6
  const halfW = span * 0.46, y0 = s.cy - span * 0.4, step = span * 0.8 / (NL - 1)
  for (let i = 0; i < NL; i++) {
    const n = lineN[i], pts = linePts[i]
    const cyc = lineCyc[i] * (1 + gather * 0.1 - dropAmt * 0.06)
    const amp = (5 + i * 0.5) * U * lineAmp[i] * depth
    const ph = linePhase[i] + phase * (1 + i * 0.014)
    const aStep = TAU * cyc / (n - 1)
    let a = ph - PI * cyc
    const mid = y0 + i * step
    const x0 = s.cx - halfW, dx = (2 * halfW) / (n - 1)
    for (let j = 0; j < n; j++) {
      pts[j * 2] = x0 + j * dx
      pts[j * 2 + 1] = mid + amp * SIN(a)
      a += aStep
    }
    const glint = hat * (i % 5 === 2 ? 7 : 1.5)
    out.push({
      k: "p", pts, close: false,
      h: hue0 + (i % 2 ? 33 : 0) + hat * 2, s: 62,
      l: 50 + (i % 6 === 0 ? 5 : 0) + glint,
      lw: (1.1 + bass * 0.9) * U,
      a: 0.5 + (i % 8 === 0 ? 0.1 : 0),
    })
  }
  s = await frame(out, { trail: 0.3 + calm * 0.22, zoom: 1 + kick * 0.008, hue: 0.4 })
}

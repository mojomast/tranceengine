// name: Sacred geometry
// Flower-of-life rings and star polygons add one layer per bar and breathe with the phase.
// Each beat turns them a twelfth of a turn, snares draw chords, drops burst into a star field, and calm leaves one slow outline.
let s = await frame([])
const TAU = Math.PI * 2
const on = [0, 0, 0, 0]
let chordT = 0, burst = 0, beatFlash = 0, calmS = 0

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const fin = (v, d) => (Number.isFinite(v) ? v : d)
const easeIO = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

// vertices of the star polygon {n/k}, centred on (x, y); k = 1 gives a plain polygon
function poly(x, y, r, n, k, rot) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = rot + ((i * k) % n) / n * TAU
    pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r)
  }
  return pts
}

while (true) {
  const A = s.audio
  const out = []
  const dt = clamp(fin(s.dt, 1 / 60), 0, 0.1)
  const cx = s.cx, cy = s.cy
  const base = Math.min(s.w, s.h)
  const u = base / 800

  const bar = fin(A.bar, 0)
  const phase = clamp(fin(A.phase, 0), 0, 1)
  const bass = fin(A.bass, 0), high = fin(A.high, 0), energy = fin(A.energy, 0), kick = fin(A.kick, 0)
  const beats = fin(A.beats, 0)

  // layer i fades in once the bar reaches i, so the stack builds through each bar
  for (let i = 0; i < 4; i++) on[i] += ((bar >= i ? 1 : 0) - on[i]) * (1 - Math.exp(-dt * 3))

  // event envelopes
  if (A.snapHit) chordT = 1
  chordT *= Math.exp(-dt * 6)
  if (A.drop) burst = 1
  burst *= Math.exp(-dt * 0.7)
  if (A.beat) beatFlash = 1
  beatFlash *= Math.exp(-dt * 8)
  calmS += (clamp(fin(A.calm, 0), 0, 1) - calmS) * (1 - Math.exp(-dt * 1.5))
  const busy = 1 - calmS

  // breathing scale: phase drives a smooth pulse, bass and kick add a little size
  const sc = 0.92 + 0.14 * (0.5 - 0.5 * Math.cos(phase * TAU)) + kick * 0.05 + bass * 0.05
  const R = base * 0.085 * sc
  // one twelfth-turn per beat, eased across each beat; calm slows it down
  const ang = (beats - 1 + easeIO(phase)) * (Math.PI / 6) * (1 - 0.75 * calmS)
  const hueBase = 200 + s.t * 6 + energy * 40
  const lw = (1.2 + high * 1.6) * u
  const pulse = 0.5 * kick + 0.5 * beatFlash

  // centre glow flashes on kick and beat
  out.push({ k: "c", x: cx, y: cy, r: R * (0.2 + pulse * 0.4), h: hueBase + 40, s: 90, l: 60, a: 0.12 + pulse * 0.35 })

  // layer 0: seed flower, a centre circle and six around it
  const a0 = on[0] * busy * 0.8
  if (a0 > 0.01) {
    out.push({ k: "c", x: cx, y: cy, r: R, fill: false, h: hueBase, s: 90, l: 58, a: a0, lw })
    for (let i = 0; i < 6; i++) {
      const a = ang + i * TAU / 6
      out.push({ k: "c", x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, r: R, fill: false, h: hueBase, s: 90, l: 58, a: a0, lw })
    }
  }

  // layer 1: {7/3} star counter-rotating against the flower
  const a1 = on[1] * busy * 0.75
  if (a1 > 0.01) out.push({ k: "p", pts: poly(cx, cy, R * 2, 7, 3, -ang * 0.7), h: hueBase + 40, s: 85, l: 60, a: a1, lw })

  // layer 2: second flower ring, six circles at sqrt(3) R and six at 2R
  const a2 = on[2] * busy * 0.7
  if (a2 > 0.01) {
    for (let i = 0; i < 6; i++) {
      const a = ang * 0.5 + Math.PI / 6 + i * TAU / 6
      out.push({ k: "c", x: cx + Math.cos(a) * R * Math.sqrt(3), y: cy + Math.sin(a) * R * Math.sqrt(3), r: R, fill: false, h: hueBase + 80, s: 85, l: 60, a: a2, lw })
    }
    for (let i = 0; i < 6; i++) {
      const a = ang * 0.5 + i * TAU / 6
      out.push({ k: "c", x: cx + Math.cos(a) * R * 2, y: cy + Math.sin(a) * R * 2, r: R, fill: false, h: hueBase + 80, s: 85, l: 60, a: a2, lw })
    }
  }

  // layer 3: {12/5} star and a hexagon, turning the other way
  const a3 = on[3] * busy * 0.7
  if (a3 > 0.01) {
    out.push({ k: "p", pts: poly(cx, cy, R * 3, 12, 5, -ang * 1.3), h: hueBase + 100, s: 85, l: 60, a: a3, lw })
    out.push({ k: "p", pts: poly(cx, cy, R * 2.6, 6, 1, ang * 1.3 + Math.PI / 6), h: hueBase + 140, s: 85, l: 60, a: a3 * 0.8, lw })
  }

  // snare or hi-hat: chords across the 12 outer vertices, a new pattern for each hit
  if (chordT > 0.02) {
    const ring = poly(cx, cy, R * 3, 12, 1, -ang * 1.3)
    const kk = 2 + (Math.floor(fin(A.snaps, 0)) % 9)
    for (let m = 0; m < 12; m++) {
      const j = (m * kk + 5) % 12
      out.push({ k: "l", x1: ring[2 * m], y1: ring[2 * m + 1], x2: ring[2 * j], y2: ring[2 * j + 1], h: hueBase + 180, s: 90, l: 65, a: 0.7 * chordT, lw })
    }
  }

  // spectrum: 32 dots on an outer ring, each one's radius follows its band
  const bands = A.bands || []
  for (let i = 0; i < 32; i++) {
    const v = clamp(fin(bands[i], 0), 0, 1)
    const a = -ang * 0.4 + i * TAU / 32
    const rr = R * 3.7 + v * R * 0.8
    out.push({ k: "c", x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, r: (1 + v * 3) * u, h: hueBase + i * 5, s: 90, l: 60, a: 0.3 + 0.5 * v })
  }

  // drop: fourteen star polygons spread out from the centre, with spokes
  if (burst > 0.02) {
    const b = burst
    for (let j = 0; j < 14; j++) {
      const n = 7 + (j % 6) * 2
      const k = 2 + (j % 3)
      out.push({ k: "p", pts: poly(cx, cy, R * (0.6 + j * 0.3), n, k, -ang * 2 + j * 0.1), h: hueBase + j * 12 + 120, s: 95, l: 60, a: 0.55 * b, lw })
    }
    for (let i = 0; i < 24; i++) {
      const a = -ang * 2 + i * TAU / 24
      out.push({ k: "l", x1: cx, y1: cy, x2: cx + Math.cos(a) * R * 4.5, y2: cy + Math.sin(a) * R * 4.5, h: hueBase + 30, s: 90, l: 62, a: 0.4 * b, lw })
    }
  }

  // calm: everything else fades out and one slow 12-sided outline remains
  if (calmS > 0.02) {
    out.push({ k: "p", pts: poly(cx, cy, base * 0.4 * sc, 12, 1, ang * 0.3), h: hueBase + 60, s: 80, l: 62, a: 0.85 * calmS, lw: lw * 1.6 })
  }

  s = await frame(out, {
    trail: 0.86,
    zoom: 1.003 + kick * 0.004,
    spin: 0.0015 + burst * 0.003,
    hue: 0.6 + energy * 1.4,
    mirror: 6
  })
}

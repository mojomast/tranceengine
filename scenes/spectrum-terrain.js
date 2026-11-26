// name: Spectrum terrain
// The spectrum scrolls toward you as a wireframe landscape: each row is one snapshot of the bands. Energy sets the scroll speed, and each beat lays a pink accent ridge that rushes in with a bar-one kick.
// Snare hits sparkle along the far ridges, drops raise the camera and exaggerate the hills, and calm passages flatten into slow, gentle hills.
let s = await frame([])

const N = 24          // history rows
const C = 34          // columns per row
const ZN = 0.9        // depth of the nearest row
const SP = 0.42       // depth spacing between rows

const rows = []
for (let j = 0; j < N; j++) rows.push({ v: [], acc: 0, pts: null })

let off = 0           // scroll position in rows, 0..1 (a new row spawns each wrap)
let boost = 0         // extra scroll kick from beats, decays
let pendingAccent = false
let hm = 1            // smoothed height multiplier
let sparks = []

const clamp01 = x => Math.max(0, Math.min(1, x || 0))

while (true) {
  const A = s.audio
  const bands = A.bands || []
  const W = s.w, H = s.h
  const u = Math.min(W, H) / 800
  const dt = Math.min(0.05, Math.max(0, s.dt || 0.016))
  const calm = clamp01(A.calm)
  const drop = clamp01(A.dropAmt)
  const out = []

  // scroll: energy drives the speed, calm slows it, beats add a boost
  const speed = (0.35 + clamp01(A.energy) * 1.6) * (1 - calm * 0.6)
  boost *= Math.exp(-dt * 4)
  if (A.beat) {
    boost += A.bar === 0 ? 1.6 : 0.8
    pendingAccent = true
  }
  off += (speed + boost) * dt
  while (off >= 1) {
    off -= 1
    rows.shift()
    rows.push({ v: bands.slice(), acc: pendingAccent ? 1 : 0, pts: null })
    pendingAccent = false
  }

  // smoothed height exaggeration: drops stretch the hills, calm flattens them
  const hmT = (1 + drop * 0.8) * (1 - calm * 0.6)
  hm += (hmT - hm) * Math.min(1, dt * 3)
  const camH = 1.2 + drop * 0.2
  const horizon = H * (0.3 - drop * 0.03)
  const fy = H * 0.5
  const fx = W * 0.55

  const ridgeH = (r, c, X, j) => {
    const p = c / (C - 1) * 31
    const i0 = Math.floor(p)
    const i1 = Math.min(31, i0 + 1)
    const f = p - i0
    const a = r.v[i0] || 0
    const b = r.v[i1] || 0
    const v = a + (b - a) * f
    const cv = clamp01(v)
    const spec = cv * Math.sqrt(cv) * 0.7 * hm + 0.03
    if (calm < 0.01) return spec
    const hills = 0.12 + 0.1 * Math.sin(X * 2.6 + j * 0.4 + s.t * 0.2) * Math.cos(j * 0.21 - s.t * 0.08)
    return spec * (1 - calm) + hills * calm
  }

  // draw rows, far to near, as perspective polylines
  for (let j = 0; j < N; j++) {
    const r = rows[j]
    const z = ZN + j * SP - off * SP
    const depth = clamp01((z - ZN) / ((N - 1) * SP))
    const pts = new Array(C * 2)
    for (let c = 0; c < C; c++) {
      const X = c / (C - 1) * 2 - 1
      const hg = ridgeH(r, c, X, j)
      pts[2 * c] = s.cx + X * fx / z
      pts[2 * c + 1] = horizon + (camH - hg) * fy / z
    }
    r.pts = pts
    const acc = r.acc
    const hue = acc ? 330 : 200 + j * 3.2 + s.t * 2
    const alpha = Math.min(1, 0.18 + 0.7 * Math.pow(1 - depth, 1.2) + 0.2 * acc)
    out.push({
      k: "p", pts, close: false,
      h: hue, s: 90, l: acc ? 68 : 52, a: alpha,
      lw: (0.6 + 1.6 * (1 - depth)) * u
    })
  }

  // horizon line pulses with the bar phase
  out.push({ k: "l", x1: 0, y1: horizon, x2: W, y2: horizon,
    h: 290, s: 90, l: 60, a: 0.1 + 0.25 * (1 - A.phase) + 0.2 * clamp01(A.kick), lw: 1.2 * u })

  // snare or hi-hat hit: a sparkle on a random ridge; a drop bursts several
  if (A.snapHit) {
    sparks.push({ row: rows[6 + Math.floor(Math.random() * (N - 9))], c: Math.floor(C / 3) + Math.floor(Math.random() * (C - Math.floor(C / 3))), life: 1 })
  }
  if (A.drop) {
    for (let q = 0; q < 6; q++) {
      sparks.push({ row: rows[Math.floor(Math.random() * N)], c: Math.floor(Math.random() * C), life: 1 })
    }
  }
  if (sparks.length > 14) sparks = sparks.slice(sparks.length - 14)

  sparks = sparks.filter(sp => (sp.life -= dt * 3) > 0 && rows.indexOf(sp.row) >= 0)
  for (const sp of sparks) {
    const p = sp.row.pts
    const sx = p[2 * sp.c]
    const sy = p[2 * sp.c + 1]
    const L = sp.life
    out.push({ k: "c", x: sx, y: sy, r: (2 + 8 * L) * u, h: 50, s: 100, l: 75, a: L * 0.9 })
    for (let q = 0; q < 4; q++) {
      const ang = q * Math.PI / 2 + Math.PI / 4
      const r0 = 3 * u
      const r1 = (6 + 18 * L) * u
      out.push({ k: "l", x1: sx + Math.cos(ang) * r0, y1: sy + Math.sin(ang) * r0,
        x2: sx + Math.cos(ang) * r1, y2: sy + Math.sin(ang) * r1, h: 50, s: 100, l: 80, a: L * 0.8, lw: u })
    }
  }

  // no mirror: calm lengthens trails, energy shifts colour, beats nudge the zoom
  s = await frame(out, {
    trail: 0.72 + 0.2 * calm,
    zoom: 1 + clamp01(A.kick) * 0.003 + drop * 0.006,
    hue: 0.4 + clamp01(A.energy) * 1.2
  })
}

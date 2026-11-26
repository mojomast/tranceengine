// name: Hypno spiral
// Op-art log and Archimedean spiral arms rotate and pour inward. Energy sets the spin, each bar flips its direction,
// the beat within the bar sets the arm count, phase pulses arm width, snares invert one arm, drops add a counter-rotating double spiral, and calm leaves one slow line.
let s = await frame([])
let ang = 0, dirS = 1, nSm = 6, calmS = 0, denseAmt = 0, invAmt = 0, invIdx = 0, bars = 0
while (true) {
  const A = s.audio
  const out = []
  const dt = Math.min(s.dt || 1 / 60, 0.05)
  const u = Math.min(s.w, s.h) / 800
  const R = Math.min(s.w, s.h) * 0.75

  // bar counter and direction: flips every bar, eased through zero so it never jumps
  if (A.beat && Math.floor(A.bar) === 0) bars++
  const dirT = bars % 2 === 0 ? 1 : -1
  dirS += (dirT - dirS) * Math.min(1, dt * 2.5)

  // calm eases everything toward a single slow line
  calmS += (A.calm - calmS) * Math.min(1, dt * 0.8)

  // rotation speed follows energy, slowed by calm
  const speed = (0.12 + A.energy * 0.85) * (1 - 0.7 * calmS)
  ang += dt * speed * dirS

  // arm count follows the beat within the bar (4, 6, 8, 10), morphing smoothly to 1 in calm
  const nTarget = (4 + 2 * Math.floor(Math.min(A.bar, 3))) * (1 - calmS) + calmS
  nSm += (nTarget - nSm) * Math.min(1, dt * 2.5)

  // drop: dense counter-rotating spiral that fades over a few seconds
  if (A.drop) denseAmt = 1
  denseAmt = Math.max(denseAmt - dt / 3.5, A.dropAmt || 0) * (1 - calmS)

  // snare: invert the colour of one arm, chosen by the snare counter
  if (A.snapHit) {
    invAmt = 1
    invIdx = A.snaps % Math.max(1, Math.floor(nSm))
  }
  invAmt = Math.max(0, invAmt - dt * 2.5)

  // inward pour: the sample ring slides toward the centre at a rate set by energy
  const f = (s.t * (0.25 + A.energy * 0.4) * (1 - 0.6 * calmS)) % 1
  const h0 = (s.t * 6 + bars * 35) % 360
  const M = 36
  const q = 0.88
  const Rm = R * (1 + A.kick * 0.04)
  // arm width pulses with phase: thick on the beat, thinning toward the next one
  const wBase = (1 + 3.5 * (1 - A.phase)) * u * (1 + calmS * 0.6)

  // main logarithmic spiral arms, alternating hue and lightness
  const nInt = Math.ceil(nSm)
  for (let j = 0; j < nInt; j++) {
    const wgt = Math.min(1, nSm - j)
    if (wgt <= 0) continue
    const base = (j / nSm) * Math.PI * 2 + ang
    const pts = []
    for (let k = -1; k < M; k++) {
      const rho = Rm * Math.pow(q, k + f)
      const th = base + 2.2 * Math.log(rho / Rm)
      pts.push(s.cx + Math.cos(th) * rho, s.cy + Math.sin(th) * rho)
    }
    const odd = j % 2 === 1
    const inv = j === invIdx && invAmt > 0
    out.push({
      k: "p", pts, close: false,
      lw: wBase * (inv ? 1 + invAmt : 1),
      h: (odd ? h0 + 180 : h0) + (inv ? 180 : 0),
      s: 85, l: odd ? 60 : 48,
      a: (inv ? 0.8 + invAmt * 0.2 : 0.75) * wgt
    })
  }

  // drop: counter-rotating Archimedean spiral set, denser and interleaved
  if (denseAmt > 0.02) {
    const nD = Math.max(3, nInt)
    for (let j = 0; j < nD; j++) {
      const base = (j / nD) * Math.PI * 2 - ang * 1.5 + 0.5
      const pts = []
      for (let k = -1; k < M; k++) {
        const uu = (k + f) / M
        const rho = Rm * (1 - uu)
        const th = base + 7 * uu
        pts.push(s.cx + Math.cos(th) * rho, s.cy + Math.sin(th) * rho)
      }
      out.push({
        k: "p", pts, close: false,
        lw: wBase * 1.2,
        h: h0 + 90 + (j % 2) * 180, s: 90, l: 55, a: 0.6 * denseAmt
      })
    }
  }

  // hub glow: swells with bass and kick
  out.push({ k: "c", x: s.cx, y: s.cy, r: (3 + A.bass * 12 + A.kick * 5) * u, h: h0 + 60, s: 90, l: 70, a: 0.5 })

  s = await frame(out, {
    trail: 0.84 + calmS * 0.12,
    zoom: 0.984 - A.kick * 0.005 + calmS * 0.006,
    spin: 0,
    hue: 1,
    mirror: 0,
    blend: "screen"
  })
}

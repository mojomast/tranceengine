// name: Aurora ribbons
// Long curtains of light sway across the screen. Each ribbon's wave follows its own slice of the spectrum, A.phase ripples them sideways,
// every snare sends a shimmer travelling along one ribbon, and a drop fans them out into mirrored copies. Calm sections slow and thin them.
const clamp01 = v => Math.max(0, Math.min(1, Number(v) || 0))
const RIB = 7
const P = 56
let shims = []
let s = await frame([])
while (true) {
  const A = s.audio
  const bands = A.bands || []
  const out = []
  const u = Math.min(s.w, s.h) / 800
  const calm = clamp01(A.calm)
  const drop = clamp01(A.dropAmt)
  const energy = clamp01(A.energy)
  const kick = clamp01(A.kick)
  const sp = 1 - 0.55 * calm
  const T = s.t * sp
  const dt = Math.min(s.dt || 0.016, 0.05)
  const copies = 1 + Math.round(drop * 2)
  const fan = 1 + drop * 0.7
  const spacing = s.h * 0.085 * fan
  const thin = (1 - 0.55 * calm) * (0.8 + energy * 0.5)
  const phaseRip = Math.sin((Number(A.phase) || 0) * Math.PI * 2)

  // snare hits launch a shimmer on one ribbon; shimmers travel left to right and fade
  if (A.snapHit) shims.push({ r: (A.snaps || 0) % RIB, p: 0 })
  const speed = 0.7 - 0.4 * calm
  shims = shims.map(sh => ({ r: sh.r, p: sh.p + dt * speed })).filter(sh => sh.p <= 1.1)

  for (let c = 0; c < copies; c++) {
    const flip = c === 1 ? -1 : 1
    const xs = c === 2 ? s.w * 0.06 : 0
    const dim = c === 0 ? 1 : 0.45
    for (let i = 0; i < RIB; i++) {
      // each ribbon listens to its own slice of the spectrum (4 bands averaged)
      const b0 = Math.floor(i * 28 / RIB)
      let bv = 0
      for (let k = 0; k < 4; k++) bv += clamp01(bands[Math.min(31, b0 + k)])
      bv /= 4
      const amp = s.h * (0.03 + 0.11 * bv) * (1 + kick * 0.12)
      const baseY = s.cy + (i - (RIB - 1) / 2) * spacing
      const th = (s.h * 0.012 + s.h * 0.03 * bv) * thin
      const top = []
      const bot = []
      for (let j = 0; j < P; j++) {
        const f = j / (P - 1)
        const x = -20 + f * (s.w + 40) + xs
          + Math.sin(f * 5 + T * 0.7 + i) * 8 * u
          + Math.sin(f * 9 - T * 2 + i * 1.3) * 14 * u * phaseRip
        const wave = Math.sin(f * Math.PI * 2.2 + T * 0.9 + i * 0.8) * 0.6
          + Math.sin(f * Math.PI * 5.1 - T * 1.7 + i * 2.1) * 0.4
        let yT = baseY + amp * wave
        let yB = yT + th * (1 + 0.3 * Math.sin(f * 7 + T))
        if (flip < 0) {
          yT = 2 * s.cy - yT
          yB = 2 * s.cy - yB
        }
        top.push(x, yT)
        bot.push(x, yB)
      }
      const fill = top.slice()
      for (let j = P - 1; j >= 0; j--) fill.push(bot[2 * j], bot[2 * j + 1])

      const hue = 110 + i * 26 + Math.sin(s.t * 0.2 + i) * 18 + (Number(A.bar) || 0) * 9
      const bright = (0.8 + energy * 0.5 + drop * 0.6) * dim
      out.push({ k: "p", pts: fill, fill: true, h: hue, s: 85, l: 50, a: (0.06 + 0.07 * bv + energy * 0.04) * bright })
      out.push({ k: "p", pts: top, close: false, h: hue + 20, s: 95, l: 68, a: 0.5 * bright,
        lw: (1 + kick * 2.5 + clamp01(A.level) * 1.5) * u })

      if (c === 0) {
        for (const sh of shims) {
          if (sh.r !== i) continue
          const jc = Math.max(0, Math.min(P - 1, Math.round(sh.p * (P - 1))))
          const j0 = Math.max(0, jc - 8)
          const seg = []
          for (let j = j0; j <= jc; j++) seg.push(top[2 * j], top[2 * j + 1])
          const fade = clamp01(1 - sh.p * 0.4)
          if (seg.length >= 4) {
            out.push({ k: "p", pts: seg, close: false, fill: false, h: hue + 60, s: 60, l: 85, a: 0.9 * fade, lw: 4 * u })
          }
          out.push({ k: "c", x: top[2 * jc], y: top[2 * jc + 1], r: 9 * u, h: hue + 60, s: 60, l: 85, a: 0.8 * fade })
        }
      }
    }
  }

  s = await frame(out, {
    trail: 0.84 + calm * 0.1,
    zoom: 1.0015 + energy * 0.002,
    spin: Math.sin(s.t * 0.13) * 0.0015,
    hue: 0.5 + drop * 1.5
  })
}

// name: Moiré rings
// Three sets of concentric rings whose centres orbit and ease to a new spot on every beat, so their overlaps throw moiré. Ring spacing breathes with the beat phase, bands wobble the rings, snares flip one set's hue, and the drop pulls the centres in and adds a third set.
// Calm sections slow everything down, thin the trails and fade to two colours.
let s = await frame([])
const TAU = Math.PI * 2
const NR = 40
const mix = (a, b, t) => a + (b - a) * t
const sets = [
  { x: 0, y: 0, tx: 0, ty: 0, hue: 195, hOff: 0, hOffT: 0, ph: 0, sp: 0.23 },
  { x: 0, y: 0, tx: 0, ty: 0, hue: 325, hOff: 0, hOffT: 0, ph: 2.1, sp: -0.31 },
  { x: 0, y: 0, tx: 0, ty: 0, hue: 55, hOff: 0, hOffT: 0, ph: 4.2, sp: 0.17 }
]
let clock = 0

while (true) {
  const A = s.audio
  const out = []
  const dt = Math.min(0.05, s.dt || 0.016)
  const M = Math.max(1, Math.min(s.w, s.h))
  const u = M / 800
  const slow = 1 - A.calm * 0.75
  clock += dt * slow
  const ease = 1 - Math.exp(-dt * 4)
  const pull = 1 - A.dropAmt * 0.45
  const thirdAlpha = Math.min(1, A.dropAmt * 1.5) * (1 - A.calm)

  // every beat, each centre picks a new spot to ease toward
  if (A.beat) {
    for (const S of sets) {
      const ang = Math.random() * TAU
      const rad = M * (0.06 + Math.random() * 0.2)
      S.tx = Math.cos(ang) * rad
      S.ty = Math.sin(ang) * rad
    }
  }
  // a snare flips the hue of the middle set (eased)
  if (A.snapHit) sets[1].hOffT += 180

  const gap = M * 0.02 * (1 + 0.25 * Math.cos(A.phase * TAU)) * (1 + A.mid * 0.15)

  for (let i = 0; i < 3; i++) {
    const S = sets[i]
    S.x += (S.tx - S.x) * ease
    S.y += (S.ty - S.y) * ease
    S.hOff += (S.hOffT - S.hOff) * ease

    const oa = clock * S.sp + S.ph
    const orbR = M * (0.04 + 0.05 * (1 - A.calm)) * (1 + A.energy * 0.5)
    const ox = s.cx + (S.x + Math.cos(oa) * orbR) * pull
    const oy = s.cy + (S.y + Math.sin(oa) * orbR) * pull

    const baseHue = S.hue + S.hOff
    const hue = i < 2
      ? mix(baseHue, i === 0 ? 200 : 25, A.calm)
      : S.hue + clock * 12
    const alpha = (i < 2 ? 0.5 + A.level * 0.3 : 0.6 * thirdAlpha)
    if (alpha <= 0.01) continue

    for (let k = 1; k <= NR; k++) {
      const bi = Math.min(31, Math.floor(((k - 1) / NR) * 32))
      const b = A.bands[bi] || 0
      const rk = k * gap * (1 + b * 0.12 * Math.sin(k * 0.9 + clock * 2 + i * 1.7))
      out.push({
        k: "c", x: ox, y: oy, r: Math.max(0.5, rk), fill: false,
        lw: (0.8 + A.high * 1.6 + b * 1.2) * u,
        h: hue, s: 80, l: 50 + A.kick * 10, a: alpha
      })
    }
  }

  s = await frame(out, {
    trail: 0.7 - A.calm * 0.08,
    blend: "difference",
    zoom: 1 + A.kick * 0.006,
    spin: 0.002 * Math.sin(clock * 0.3)
  })
}

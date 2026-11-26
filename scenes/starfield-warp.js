// name: Starfield warp
// Hyperspace. The bass is the throttle and the spin swings with the bar.
// Snares fire lightning streaks, a drop kicks into a hyperjump with inverted colour,
// and in breakdowns the streaks slow into drifting points of light.
let s = await frame([])
const stars = []
const reset = (st) => {
  st.a = Math.random() * Math.PI * 2
  st.d = Math.random() * 20 + 1
  st.h = Math.random() * 60
}
for (let i = 0; i < 340; i++) {
  const st = {}
  reset(st)
  st.d = Math.random() * Math.max(s.w, s.h) * 0.6
  stars.push(st)
}
let hueBase = 200
const SPIN = [1, 0.4, -0.4, -1]
while (true) {
  const A = s.audio
  const out = []
  if (A.beat && A.beats % 8 === 0) hueBase = (hueBase + 120) % 360
  const jump = 1 + A.dropAmt * 4
  const speed = (2 + A.energy * 10 + A.bass * 14 + A.kick * 20) * jump * (1 - A.calm * 0.8)
  const maxD = Math.hypot(s.w, s.h) * 0.55
  const hue = hueBase + (A.dropAmt > 0.3 ? 180 : 0)
  const pulse = 1 + 0.6 * Math.max(0, Math.cos(A.phase * Math.PI * 2))
  for (const st of stars) {
    const d0 = st.d
    st.d += speed * (0.06 + st.d / 100)
    if (st.d > maxD) { reset(st); continue }
    const c = Math.cos(st.a)
    const sn = Math.sin(st.a)
    const depth = st.d / maxD
    if (A.calm > 0.6) {
      out.push({ k: "c", x: s.cx + c * st.d, y: s.cy + sn * st.d, r: 0.8 + depth * 2.5, h: hue + st.h, l: 60, a: 0.7 })
    } else {
      out.push({ k: "l", x1: s.cx + c * d0, y1: s.cy + sn * d0, x2: s.cx + c * st.d, y2: s.cy + sn * st.d,
        h: hue + st.h, lw: (0.6 + depth * 3.5) * pulse, l: 56 + A.high * 22 })
    }
  }
  if (A.snap > 0.4) {
    for (let i = 0; i < 6; i++) {
      const a = (A.snaps * 2.399 + i * 1.047) % (Math.PI * 2)
      out.push({ k: "l", x1: s.cx + Math.cos(a) * maxD * 0.1, y1: s.cy + Math.sin(a) * maxD * 0.1,
        x2: s.cx + Math.cos(a) * maxD, y2: s.cy + Math.sin(a) * maxD, h: hue + 30, lw: 3 * A.snap, l: 75, a: A.snap })
    }
  }
  s = await frame(out, {
    trail: 0.8 + A.calm * 0.15,
    zoom: 1.01 + A.kick * 0.02 + A.dropAmt * 0.03,
    spin: SPIN[A.bar] * 0.004,
    hue: 0.5 + A.dropAmt * 3,
  })
}

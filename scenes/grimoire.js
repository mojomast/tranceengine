// name: The Grimoire
// A spellbook in four phases. I: closed on its altar, breathing with the bass. II: it opens and incantations type
// themselves line by line while pages turn every two bars. III: the text glitches on snares and sigils lift off the
// page to orbit the book, sparking on hi-hats. IV: pages flip on every beat, a beam rises, portal rings pulse on
// kicks and words fly out of the book on snares.
let s = await frame([])
const TAU = Math.PI * 2
const PHASES = ["I. The book", "II. The writing", "III. The sigils", "IV. The opening"]
const clampP = (p) => Math.max(0, Math.min(PHASES.length - 1, Math.floor(p) || 0))
let phase = clampP(s.entry), phaseT = 0
const WORDS = ["slop", "operate", "ladle", "the", "grimoire", "of", "churn", "render", "summon", "loop", "repeat", "noise", "weight", "bind", "unfold", "echo", "sigil", "machine", "dream", "invert"]
const lineText = (k) => {
  let out = ""
  for (let j = 0; j < 3 + (k % 3); j++) out += (j ? " " : "") + WORDS[(k * 7 + j * 3) % WORDS.length]
  return out
}
// Sigil assets: a circle, a star polygon {n/k} and a crossbar, different for each index.
const sigil = (i) => {
  const n = 5 + (i % 4), k = 2 + (i % 2), pts = []
  for (let j = 0; j <= n; j++) { const a = ((j * k) / n) * TAU - Math.PI / 2; pts.push(Math.cos(a), Math.sin(a)) }
  return { star: pts, bar: (i * 37) % 180 }
}
const SIGILS = []
for (let i = 0; i < 7; i++) SIGILS.push(sigil(i))
const dust = []
for (let i = 0; i < 40; i++) dust.push({ x: Math.random(), y: Math.random(), v: 0.01 + Math.random() * 0.03, r: Math.random() })
let open = phase > 0 ? 1 : 0
const flips = [], rings = [], flyers = []
let spinStep = 0, spinTo = 0

while (true) {
  const A = s.audio
  const dt = Math.min(0.05, s.dt || 1 / 60)
  if (typeof s.cue === "number" && s.cue >= 0 && s.cue !== phase) { phase = clampP(s.cue); phaseT = 0 }
  phaseT += dt
  const W = s.w, H = s.h, U = Math.min(W, H) / 800
  const out = []
  const hue = 34 + (A.keyHue || 0) * 0.04, violet = 275 + (A.keyHue || 0) * 0.1
  open += ((phase > 0 ? 1 : 0) - open) * Math.min(1, dt * 1.6)
  const pw = Math.min(W * 0.28, H * 0.4), ph = pw * 1.12
  // Closed, the spine sits half a page left so the cover is centred; open, the spine is centred.
  const bx = s.cx - (pw / 2) * (1 - open), by = s.cy + H * 0.2
  const lerp = (a, b, t) => a + (b - a) * t
  // Page quad for side (-1 left, +1 right): u from spine (0) to outer edge (1), v from bottom (0) to top (1).
  const at = (side, u, v) => {
    const sx = bx, sy0 = by, sy1 = by - ph
    const ox0 = bx + side * pw, oy0 = by + pw * 0.06, ox1 = bx + side * pw * 0.92, oy1 = by - ph * 0.93
    const x0 = lerp(sx, ox0, u), y0 = lerp(sy0, oy0, u), x1 = lerp(sx, ox1, u), y1 = lerp(sy1, oy1, u)
    return [lerp(x0, x1, v), lerp(y0, y1, v)]
  }
  const quad = (side) => [...at(side, 0, 0), ...at(side, 0, 1), ...at(side, 1, 1), ...at(side, 1, 0)]

  // Dust motes drift up through the light; hats make them glint.
  for (const d of dust) {
    d.y -= d.v * dt * (1 + A.energy * 2); if (d.y < -0.05) { d.y = 1.05; d.x = Math.random() }
    out.push({ k: "c", x: d.x * W, y: d.y * H, r: (0.8 + d.r * 1.6) * U * (1 + A.hat * 1.5), h: hue, s: 50, l: 70, a: 0.25 + A.hat * 0.5 })
  }
  // Altar glow under the book.
  out.push({ k: "c", x: s.cx, y: by + pw * 0.12, r: pw * (1.1 + A.bass * 0.15), h: hue, s: 80, l: 25, a: 0.03 + A.kick * 0.02 })

  // Pages (right page always; left page once open).
  if (open > 0.5) {
    out.push({ k: "p", pts: quad(-1), fill: true, h: hue, s: 40, l: 25, a: 0.035 })
    out.push({ k: "p", pts: quad(-1), h: hue, s: 60, l: 62, a: 0.8, lw: 2 * U })
  }
  out.push({ k: "p", pts: quad(1), fill: true, h: hue, s: 40, l: 25, a: 0.035 })
  out.push({ k: "p", pts: quad(1), h: hue, s: 60, l: 62, a: 0.8, lw: 2 * U })
  out.push({ k: "l", x1: bx, y1: by, x2: bx, y2: by - ph, h: hue, l: 70, a: 0.9, lw: 3 * U })

  // Cover: lies over the right page when closed and swings over to the left as the book opens.
  if (open < 0.98) {
    const th = open * Math.PI, ox = bx + Math.cos(th) * pw, lift = Math.sin(th)
    const cover = [bx, by, bx, by - ph, ox, by - ph * 0.95 - lift * ph * 0.2, ox, by + pw * 0.06 - lift * pw * 0.3]
    out.push({ k: "p", pts: cover, fill: true, h: violet, s: 50, l: 22, a: 0.35 })
    out.push({ k: "p", pts: cover, h: hue, s: 70, l: 65, a: 0.95, lw: 2.5 * U })
    if (open < 0.3) {
      const ccx = bx + pw * 0.5, ccy = by - ph * 0.5, r = pw * 0.26 * (1 + A.bass * 0.08 + A.kick * 0.05)
      const sg = SIGILS[0]
      const star = []
      for (let j = 0; j < sg.star.length; j += 2) star.push(ccx + sg.star[j] * r, ccy + sg.star[j + 1] * r)
      out.push({ k: "p", pts: star, h: hue, l: 62 + A.kick * 15, a: 0.9, lw: 2 * U })
      out.push({ k: "c", x: ccx, y: ccy, r: r * 1.12, fill: false, h: hue, l: 60, a: 0.8, lw: 1.5 * U })
      out.push({ k: "w", text: "GRIMOIRE", x: ccx, y: by - ph * 0.86, size: pw * 0.12, fx: "neon", t: phaseT, h: hue, l: 70 })
      out.push({ k: "w", text: "of the sloperator", x: ccx, y: by - ph * 0.13, size: pw * 0.055, fx: "type", font: "mono", t: phaseT - 0.6, h: hue, s: 30, l: 80, speed: 12 })
    }
  }

  // Incantations written on the pages: typed in II, glitching in III, exploding outward in IV.
  if (phase >= 1 && open > 0.7) {
    const fxName = phase === 1 ? "type" : phase === 2 ? "glitch" : "split"
    for (let k = 0; k < 16; k++) {
      const side = k < 8 ? -1 : 1, row = k % 8
      const [x, y] = at(side, 0.5, 0.88 - row * 0.105)
      const tt = phase === 1 ? phaseT - k * 0.35 : phaseT + 1
      if (tt < 0) continue
      out.push({ k: "w", text: lineText(k + Math.floor(A.bars / 2) * 3), x, y, size: pw * 0.052, fx: fxName, t: tt, font: "mono", h: hue - 10, s: 45, l: 58, a: 0.7, speed: 18, seed: k })
    }
  }

  // Page turns: every two bars in II, every beat in IV.
  if ((phase === 1 && A.downbeat && A.bars % 2 === 0) || (phase === 3 && A.beat)) flips.push({ p: 0 })
  for (let j = flips.length - 1; j >= 0; j--) {
    const f = flips[j]
    f.p += dt / (phase === 3 ? 0.35 : 0.6)
    if (f.p >= 1) { flips.splice(j, 1); continue }
    const th = f.p * Math.PI, ox = bx + Math.cos(th) * pw, lift = Math.sin(th)
    const page = [bx, by, bx, by - ph, ox, by - ph * 0.95 - lift * ph * 0.16, ox, by + pw * 0.06 - lift * pw * 0.22]
    out.push({ k: "p", pts: page, fill: true, h: hue, s: 30, l: 35, a: 0.04 })
    out.push({ k: "p", pts: page, h: hue, s: 50, l: 75, a: 0.85, lw: 1.6 * U })
  }

  // Sigils rise off the pages and orbit above the book (III and IV).
  if (phase >= 2) {
    if (A.beat) spinTo += TAU / 14
    if (A.snareHit) spinTo += TAU / 28
    spinStep += (spinTo - spinStep) * 0.15
    const ocx = s.cx, ocy = by - ph * 1.2, R = pw * (phase === 3 ? 1.25 : 0.95)
    SIGILS.forEach((sg, i) => {
      const rise = Math.min(1, Math.max(0, phaseT * 0.6 - i * 0.12) * (phase === 3 ? 3 : 1))
      const a = (i / SIGILS.length) * TAU + spinStep + s.t * 0.15
      const [sx0, sy0] = at(i % 2 ? 1 : -1, 0.5, 0.3 + (i % 3) * 0.2)
      const x = lerp(sx0, ocx + Math.cos(a) * R, rise), y = lerp(sy0, ocy + Math.sin(a) * R * 0.45, rise)
      const r = pw * (0.05 + rise * 0.07) * (1 + A.kick * 0.15)
      const star = []
      for (let j = 0; j < sg.star.length; j += 2) {
        const c = Math.cos(spinStep * (i % 2 ? 1 : -1)), sn = Math.sin(spinStep * (i % 2 ? 1 : -1))
        const px = sg.star[j], py = sg.star[j + 1]
        star.push(x + (px * c - py * sn) * r, y + (px * sn + py * c) * r)
      }
      out.push({ k: "p", pts: star, h: violet + i * 8, l: 62, a: 0.9, lw: 1.8 * U })
      out.push({ k: "c", x, y, r: r * 1.15, fill: false, h: violet, l: 55, a: 0.7, lw: 1.2 * U })
      if (A.hat > 0.6 && (i + A.hats) % 3 === 0) out.push({ k: "c", x, y, r: r * 0.35 * A.hat, h: 50, l: 80, a: A.hat })
    })
    if (phase === 2) out.push({ k: "w", text: "SLOP · OPERATE · REPEAT · ", x: ocx, y: ocy, size: pw * 0.06, fx: "orbit", t: phaseT, font: "mono", h: violet, l: 70, a: 0.85 })
  }

  // The opening: a beam, portal rings on kicks, words flying out on snares.
  if (phase === 3) {
    const bw = pw * (0.18 + A.bass * 0.1)
    out.push({ k: "p", pts: [s.cx - bw * 0.3, by - ph * 0.5, s.cx + bw * 0.3, by - ph * 0.5, s.cx + bw, 0, s.cx - bw, 0], fill: true, h: hue + 10, s: 70, l: 55, a: 0.018 + A.kick * 0.015 })
    if (A.kickHit || A.beat) rings.push({ r: pw * 0.2, a: 1 })
    for (let j = rings.length - 1; j >= 0; j--) {
      const g = rings[j]; g.r += dt * pw * 1.6; g.a -= dt * 0.9
      if (g.a <= 0) { rings.splice(j, 1); continue }
      out.push({ k: "c", x: s.cx, y: by - ph * 1.2, r: g.r, fill: false, h: violet, l: 62, a: g.a * 0.8, lw: 3 * U })
    }
    if (A.snareHit && flyers.length < 10) flyers.push({ x: s.cx + (Math.random() - 0.5) * pw, y: by - ph * 0.5, vx: (Math.random() - 0.5) * 120 * U, vy: -(160 + Math.random() * 120) * U, t: 0, w: WORDS[(A.snares * 5) % WORDS.length] })
    for (let j = flyers.length - 1; j >= 0; j--) {
      const f = flyers[j]; f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt
      if (f.t > 2.4) { flyers.splice(j, 1); continue }
      out.push({ k: "w", text: f.w, x: f.x, y: f.y, size: pw * 0.09 * (1 + f.t * 0.6), fx: "rise", t: f.t * 3, h: hue + f.t * 60, l: 72, a: 1 - f.t / 2.4 })
    }
  }

  s = await frame(out, {
    trail: [0.84, 0.76, 0.8, 0.82][phase] + A.calm * 0.05,
    zoom: 1.002 + A.kick * 0.01 + (phase === 3 ? 0.006 : 0),
    spin: 0, hue: phase === 3 ? 0.6 : 0.15, mirror: 0,
    phase, phases: PHASES.length, title: PHASES[phase], titleFx: "type", titleHue: hue,
    react: { punch: 0.8, slice: phase === 2 ? 1.2 : 0.5, sparkle: 1.3, shake: 0.5, tint: 1.2 },
  })
}

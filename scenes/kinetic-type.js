// name: Kinetic type
// Words land on the beat, each with a different text effect: the page's kinetic text engine
// cycles type, scramble, wave, punch, split, glitch, stack, orbit, flap, neon, rise and flip.
// Snares scatter the letters, the bar position picks the layout, drops shout the word in pieces,
// and breakdowns whisper one word every four beats.
let s = await frame([])
const WORDS = ["nothing", "unusual", "is", "happening", "slop", "operate", "repeat", "the grimoire", "remain", "calm", "this", "is", "normal"]
const FXS = ["punch", "scramble", "wave", "glitch", "flap", "split", "neon", "rise", "flip", "stack", "type", "orbit"]
let w = 0, f = 0, wordT = 0
while (true) {
  const A = s.audio
  const whisper = A.calm > 0.5
  wordT += s.dt || 1 / 60
  if (A.beat && (!whisper || A.beats % 4 === 0)) { w = (w + 1) % WORDS.length; f = (f + 1) % FXS.length; wordT = 0 }
  const fx = A.dropAmt > 0.5 ? "split" : whisper ? "type" : FXS[f]
  const text = A.dropAmt > 0.5 ? WORDS[w].toUpperCase() : WORDS[w]
  const m = Math.min(s.w, s.h)
  const size = Math.min(s.w * 0.13, s.h * 0.24) * (whisper ? 0.45 : 1)
  const hue = (A.beats * 47 + (A.keyHue || 0)) % 360
  const out = []
  // Layout by beat in the bar: centred, offset pair, stacked trio, wide.
  const layout = whisper ? [[0, 0]] : [[[0, 0]], [[-0.18, -0.12], [0.18, 0.12]], [[0, -0.22], [0, 0], [0, 0.22]], [[0, 0]]][A.bar]
  layout.forEach(([dx, dy], j) => {
    out.push({ k: "w", text, x: s.cx + dx * s.w, y: s.cy + dy * s.h, size: size * (j === 0 ? 1 : 0.7), fx, t: wordT, h: hue + j * 40, l: whisper ? 55 : 65, a: j === 0 ? 1 : 0.6, seed: A.beats + j, hs: 6 })
  })
  // A ring of dots riding the highs.
  if (!whisper) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + s.t
      const r = size * 1.6 + A.high * 60
      out.push({ k: "c", x: s.cx + Math.cos(a) * r * 1.3, y: s.cy + Math.sin(a) * r * 0.6, r: 2.5 + A.hat * 5, h: i * 15 + s.t * 60, l: 60, a: 0.8 })
    }
  }
  s = await frame(out, { trail: whisper ? 0.9 : 0.74, zoom: 1.012 + A.kick * 0.03, spin: Math.sin(s.t * 0.5) * 0.004, hue: 2, react: { punch: 1.2, slice: 1.2, sparkle: 0.8, shake: 0.8, tint: 0.5 } })
}

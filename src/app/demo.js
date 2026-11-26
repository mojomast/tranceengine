const makeDemo = (ac, out) => {
  const BPM = 124, BEAT = 60 / BPM, STEP = BEAT / 4, BAR = BEAT * 4
  const bus = ac.createGain(); bus.gain.value = 0.85
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4
  bus.connect(comp); comp.connect(out)
  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), nd = noise.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
  const ir = ac.createBuffer(2, Math.floor(ac.sampleRate * 2.6), ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3) }
  const verb = ac.createConvolver(); verb.buffer = ir
  const verbOut = ac.createGain(); verbOut.gain.value = 0.38; verb.connect(verbOut); verbOut.connect(bus)
  const delay = ac.createDelay(1); delay.delayTime.value = STEP * 3
  const fb = ac.createGain(); fb.gain.value = 0.36; delay.connect(fb); fb.connect(delay)
  const dOut = ac.createGain(); dOut.gain.value = 0.3; delay.connect(dOut); dOut.connect(bus); dOut.connect(verb)
  const duck = ac.createGain(); duck.connect(bus); duck.connect(verb)
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d) }
  const osc = (type, f, t, end) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(t); o.stop(end); return o }
  const filt = (type, f, q) => { const x = ac.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x }
  const kick = (t) => {
    const o = osc("sine", 160, t, t + 0.5), g = ac.createGain()
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13)
    env(g, t, 0.003, 1, 0.42); o.connect(g); g.connect(bus)
    duck.gain.cancelScheduledValues(t); duck.gain.setValueAtTime(0.22, t); duck.gain.linearRampToValueAtTime(1, t + BEAT * 0.85)
  }
  const hit = (t, type, f, q, peak, d, dest) => {
    const s = ac.createBufferSource(); s.buffer = noise
    const x = filt(type, f, q), g = ac.createGain(); env(g, t, 0.002, peak, d)
    s.connect(x); x.connect(g); g.connect(dest || bus); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05)
  }
  const clap = (t) => { hit(t, "bandpass", 1600, 0.9, 0.5, 0.16); hit(t, "bandpass", 1500, 0.9, 0.2, 0.45, verb) }
  const hat = (t, open) => hit(t, "highpass", 8000, 0.7, open ? 0.11 : 0.06, open ? 0.2 : 0.04)
  const bass = (t, m, d) => {
    const o = osc("sawtooth", mtof(m), t, t + d + 0.05), x = filt("lowpass", 1400, 6), g = ac.createGain()
    x.frequency.setValueAtTime(1500, t); x.frequency.exponentialRampToValueAtTime(170, t + d)
    env(g, t, 0.005, 0.3, d); o.connect(x); x.connect(g); g.connect(bus)
  }
  const pad = (t, notes, d) => {
    for (const m of notes) for (const det of [-8, 8]) {
      const o = osc("sawtooth", mtof(m), t, t + d + 0.05); o.detune.value = det
      const x = filt("lowpass", 1000, 1), g = ac.createGain()
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 0.5); g.gain.setValueAtTime(0.035, t + d - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + d)
      o.connect(x); x.connect(g); g.connect(duck)
    }
  }
  const arp = (t, m) => {
    const o = osc("square", mtof(m), t, t + 0.25), x = filt("lowpass", 2400, 2), g = ac.createGain()
    env(g, t, 0.004, 0.06, 0.15); o.connect(x); x.connect(g); g.connect(duck); g.connect(delay)
  }
  const riser = (t, d) => {
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true
    const x = filt("bandpass", 300, 3), g = ac.createGain()
    x.frequency.setValueAtTime(300, t); x.frequency.exponentialRampToValueAtTime(7000, t + d)
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + d); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.05)
    s.connect(x); x.connect(g); g.connect(bus); g.connect(verb); s.start(t); s.stop(t + d + 0.1)
  }
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
  const ROOTS = [45, 41, 48, 43]
  const SECTIONS = [[0, "Intro"], [8, "Build"], [16, "Drop"], [32, "Break"], [40, "Drop"], [56, "Outro"]]
  const sectionAt = (bar) => { const b = bar % 64; let n = "Intro"; for (const [s, name] of SECTIONS) if (b >= s) n = name; return n }
  const schedule = (i, t) => {
    const bar = Math.floor(i / 16), s16 = i % 16, b = bar % 64, name = sectionAt(bar), ch = bar % 4
    const drop = name === "Drop", hasKick = drop || name === "Build" || name === "Outro"
    if (hasKick && s16 % 4 === 0) kick(t)
    if (drop && (s16 === 4 || s16 === 12)) clap(t)
    if (s16 % 4 === 2 && (name !== "Intro" || b >= 4)) hat(t, drop)
    if ((drop || name === "Outro") && s16 % 2 === 1) hat(t, false)
    if ((drop || name === "Build") && [2, 3, 6, 10, 11, 14].includes(s16)) bass(t, ROOTS[ch] + (s16 === 11 ? 12 : 0), STEP * 0.9)
    if ((drop || name === "Break") && (drop || s16 % 2 === 0)) arp(t, CHORDS[ch][s16 % 3] + 12 * (1 + (Math.floor(s16 / 3) % 2)))
    if (s16 === 0) pad(t, CHORDS[ch], BAR)
    if (s16 === 0 && (b === 15 || b === 39)) riser(t, BAR)
  }
  let step = 0, nextT = 0, timer = 0
  const pump = () => { while (nextT < ac.currentTime + 0.15) { schedule(step, nextT); step++; nextT += STEP } }
  return {
    start() { if (timer) return; if (nextT < ac.currentTime) nextT = ac.currentTime + 0.06; timer = setInterval(pump, 25); pump() },
    stop() { clearInterval(timer); timer = 0 },
    info() { const i = Math.max(0, step - 10), bar = Math.floor(i / 16); return sectionAt(bar) + " · bar " + ((bar % 64) + 1) + "/64" },
  }
}


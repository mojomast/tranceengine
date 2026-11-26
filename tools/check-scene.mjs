// Usage: bun tools/check-scene.mjs scenes/<slug>.js        (ENTRY=2 to start the scene at phase 3)
// Runs a scene script inside the real Psychoscript engine (the same worker the page uses),
// feeding it 14 seconds of synthetic music: calm intro, build, a drop, then full energy.
// Prints a report and exits 0 when the scene passes, 1 when it fails.
import { join, dirname } from "node:path"
import { existsSync } from "node:fs"
const ROOT = join(dirname(new URL(import.meta.url).pathname), "..")
const BUNDLE = join(ROOT, "dist/engine.bundle.js")
if (!existsSync(BUNDLE)) { console.error("dist/engine.bundle.js is missing: run `bun tools/build.mjs` first"); process.exit(2) }
// VM time budget per frame, for a typical desktop. Shared CI runners are slower, so CI raises it (VM_BUDGET_MS).
const BUDGET_MS = +(process.env.VM_BUDGET_MS || 5)
const file = process.argv[2]
if (!file) { console.log("usage: bun check-scene.mjs <scene.js>"); process.exit(2) }
const code = await Bun.file(file).text()
const nameLine = code.split("\n")[0]
const name = (nameLine.match(/^\/\/\s*name:\s*(.+)$/) || [])[1]

const BPM = 124, PERIOD = 60 / BPM
const synth = (n, fps) => {
  const t = n / fps
  const section = t < 4 ? "calm" : t < 8 ? "build" : "full"
  const beatNo = Math.floor(t / PERIOD), sinceBeat = t - beatNo * PERIOD
  const hasKick = section !== "calm"
  const prevT = (n - 1) / fps
  const beat = hasKick && n > 0 && Math.floor(prevT / PERIOD) !== beatNo
  const halfNo = Math.floor((t + PERIOD / 2) / PERIOD)
  const snapHit = section === "full" && n > 0 && Math.floor((prevT + PERIOD / 2) / PERIOD) !== halfNo
  const drop = n > 0 && t >= 8 && prevT < 8
  const kick = hasKick ? Math.exp(-sinceBeat * 7) : 0
  const sinceHalf = (t + PERIOD / 2) % PERIOD
  const snap = section === "full" ? Math.exp(-sinceHalf * 12) : 0
  const energy = section === "calm" ? 0.2 : section === "build" ? 0.3 + (t - 4) * 0.08 : 0.8
  const dropAmt = t >= 8 ? Math.exp(-(t - 8) * 0.5) : 0
  const bands = Array.from({ length: 32 }, (_, i) => Math.max(0, Math.min(1, energy * (0.5 + 0.5 * Math.sin(t * 3 + i * 0.5)) + kick * 0.5 * (1 - i / 32))))
  return {
    level: Math.min(1, energy * 0.8 + kick * 0.2), bass: Math.min(1, 0.2 + kick * 0.7 * energy + 0.1), mid: 0.3 + 0.3 * Math.sin(t), high: 0.3 + snap * 0.5,
    kick, beat, beats: hasKick ? beatNo - Math.floor(4 / PERIOD) : 0,
    snap, snapHit, snaps: section === "full" ? halfNo : 0,
    phase: sinceBeat / PERIOD, bar: ((beatNo % 4) + 4) % 4, bpm: BPM,
    energy, drop, dropAmt, calm: section === "calm" ? 1 : 0, bands,
    kickHit: beat, kicks: hasKick ? beatNo : 0, snare: snap, snareHit: snapHit, snares: section === "full" ? halfNo : 0,
    hat: section === "calm" ? 0 : Math.exp(-((t * 4 / PERIOD) % 1) * 3), hatHit: section !== "calm" && n > 0 && Math.floor(prevT * 4 / PERIOD) !== Math.floor(t * 4 / PERIOD), hats: Math.floor(t * 4 / PERIOD),
    anticip: Math.max(0, (sinceBeat / PERIOD - 0.75) * 4), barPhase: ((((beatNo % 4) + 4) % 4) + sinceBeat / PERIOD) / 4,
    downbeat: beat && beatNo % 4 === 0, bars: Math.floor(beatNo / 4), phrase: Math.floor(beatNo / 4) % 8, phraseStart: beat && beatNo % 32 === 0, beatConf: hasKick ? 0.9 : 0,
    bright: 0.3 + 0.4 * energy, noise: 0.15 + snap * 0.3, tonal: 0.85 - snap * 0.3,
    chroma: Array.from({ length: 12 }, (_, i) => (i === 9 ? 1 : i === 4 ? 0.7 : 0.1)), note: 9, key: 9, keyHue: 90,
  }
}

const ENTRY = +(process.env.ENTRY || 0)
const runAt = (w, h, frames) => new Promise((resolve) => {
  const worker = new Worker(BUNDLE)
  let n = 0, t = 0
  const vms = [], problems = new Set()
  let maxShapes = 0, maxPoints = 0, phases = 0, cue = -1, cueAt = 0, lagWorst = 0
  const seen = new Set()
  const finish = (r) => { worker.terminate(); resolve(r) }
  const timer = setTimeout(() => finish({ error: "timed out at frame " + n + " (a loop probably runs without await frame(...))" }), 30000)
  const bad = (v) => typeof v !== "number" || !Number.isFinite(v)
  worker.onmessage = (e) => {
    const m = e.data
    if (m.type === "ready") worker.postMessage({ type: "run", slot: "a", token: 1, code })
    else if (m.type === "frame") {
      n++
      if (n > 3) vms.push(m.vm)
      const shapes = m.shapes
      maxShapes = Math.max(maxShapes, shapes.length)
      let points = 0
      for (const o of shapes) {
        if (!o || typeof o !== "object") { problems.add("non-object shape"); continue }
        if (o.k === "c") { if (bad(o.x) || bad(o.y) || bad(o.r)) problems.add("circle with non-finite x/y/r") }
        else if (o.k === "p") {
          if (!Array.isArray(o.pts)) { problems.add("path without pts array"); continue }
          points += o.pts.length
          if (o.pts.some(bad)) problems.add("path with non-finite point")
        } else if (o.k === "l") { if (bad(o.x1) || bad(o.y1) || bad(o.x2) || bad(o.y2)) problems.add("line with non-finite coordinate") }
        else if (o.k === "t") { if (bad(o.x) || bad(o.y)) problems.add("text with non-finite x/y") }
        else if (o.k === "w") {
          if (bad(o.x) || bad(o.y) || (o.size !== undefined && bad(o.size)) || (o.t !== undefined && bad(o.t))) problems.add("kinetic text with non-finite x/y/size/t")
          if (o.fx !== undefined && !["type", "scramble", "wave", "punch", "split", "glitch", "stack", "orbit", "flap", "neon", "rise", "flip"].includes(o.fx)) problems.add("unknown text fx " + JSON.stringify(o.fx))
        }
        else problems.add("unknown shape kind " + JSON.stringify(o.k))
        if (o.h !== undefined && bad(o.h)) problems.add("non-finite hue h")
      }
      maxPoints = Math.max(maxPoints, points)
      if (m.fx && typeof m.fx.phase === "number") {
        phases = Math.max(phases, m.fx.phases || 0); seen.add(m.fx.phase)
        if (cue >= 0 && m.fx.phase === cue) { lagWorst = Math.max(lagWorst, n - cueAt); cue = -1 }
        if (cue >= 0 && n - cueAt > 6) { problems.add("ignored cue " + cue + " (still in phase " + m.fx.phase + ")"); cue = -1 }
        if (typeof m.fx.title !== "string") problems.add("fx.title missing")
        if (phases > 1 && n % 120 === 60) { cue = (m.fx.phase + 1) % phases; cueAt = n }
      }
      if (m.fx) for (const k of ["trail", "zoom", "spin", "hue", "mirror"]) if (m.fx[k] !== undefined && bad(m.fx[k])) problems.add("non-finite fx." + k)
      if (n >= frames) {
        clearTimeout(timer)
        const sorted = [...vms].sort((a, b) => a - b)
        return finish({ phases, phasesSeen: seen.size, cueLagFrames: lagWorst, avgVm: vms.reduce((a, b) => a + b, 0) / vms.length, p95Vm: sorted[Math.floor(sorted.length * 0.95)], maxShapes, maxPoints, problems: [...problems] })
      }
      t += 1 / 60
      worker.postMessage({ type: "tick", slot: "a", token: 1, view: { t, dt: 1 / 60, frame: n, w, h, cx: w / 2, cy: h / 2, mx: w * 0.6, my: h * 0.4, down: false, audio: synth(n, 60), entry: ENTRY, cue } })
    } else if (m.type === "error") { clearTimeout(timer); finish({ error: m.message }) }
    else if (m.type === "ended") { clearTimeout(timer); finish({ error: "script ended (returned) after " + n + " frames; it must loop forever" }) }
  }
})

const desk = await runAt(1280, 720, 840)
const phone = desk.error ? null : await runAt(390, 844, 300)
const fails = []
if (!name) fails.push("first line must be  // name: <Scene name>")
for (const [label, r] of [["desktop", desk], ["phone", phone]]) {
  if (!r) continue
  if (r.error) { fails.push(label + ": " + r.error); continue }
  if (r.problems.length) fails.push(label + ": " + r.problems.join("; "))
  if (r.avgVm > BUDGET_MS) fails.push(label + ": too slow, avg " + r.avgVm.toFixed(2) + " ms per frame in the VM (budget " + BUDGET_MS + " ms)")
  if (r.maxShapes > 1500) fails.push(label + ": " + r.maxShapes + " shapes in one frame (budget 1500)")
  if (r.maxPoints > 20000) fails.push(label + ": " + r.maxPoints + " path coordinates in one frame (budget 20000)")
}
console.log(JSON.stringify({ scene: name || null, desktop: desk, phone, pass: fails.length === 0, fails }, (k, v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v), 2))
process.exit(fails.length ? 1 : 0)

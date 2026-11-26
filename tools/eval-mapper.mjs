#!/usr/bin/env bun
// Scores the song mapper against the synthetic test songs' ground truth (assets/truth/*.truth.json):
// tempo, downbeats, kick/snare/hat onset precision and recall, sections and drop timing.
// The real song has no truth file, so it is only printed.
import { join, dirname } from "node:path"
import { decode, loadMapper } from "./decode.mjs"
const ROOT = join(dirname(new URL(import.meta.url).pathname), "..")
const mapSong = await loadMapper(ROOT)
for (const name of ["slow-burn", "breakneck", "song"]) {
  const x = decode(join(ROOT, "assets/audio", name + ".mp3"))
  const t0 = performance.now()
  const m = mapSong(x, 22050)
  const ms = performance.now() - t0
  let truth = null
  try { truth = await Bun.file(join(ROOT, "assets/truth", name + ".truth.json")).json() } catch {}
  console.log(`\n=== ${name}  (${ms.toFixed(0)} ms)  bpm ${m.bpm.toFixed(1)}${truth ? " (truth " + truth.bpm + ")" : ""}  beats ${m.beats.length}  bars ${m.downbeats.length}`)
  console.log("onsets kick/snare/hat:", m.onsets.kick.length, m.onsets.snare.length, m.onsets.hat.length)
  console.log("sections:", m.sections.map((s) => `${s.start.toFixed(1)}-${s.end.toFixed(1)} ${s.kind}(${s.power})`).join(" | "))
  console.log("drops:", m.drops.map((d) => d.toFixed(2)).join(", "), truth ? " truth: " + truth.drops.join(", ") : "")
  if (truth) {
    const bar = truth.bar
    // Downbeat accuracy: share of true bar starts (in drum sections) with a detected downbeat within 70 ms.
    const trueBars = []; for (let t = truth.sections[0].start; t < truth.sections[truth.sections.length - 1].end - 0.01; t += bar) trueBars.push(t)
    const hit = trueBars.filter((t) => m.downbeats.some((d) => Math.abs(d - t) < 0.07)).length
    const beatHit = trueBars.flatMap((t) => [0, 1, 2, 3].map((k) => t + k * bar / 4)).filter((t) => m.beats.some((b) => Math.abs(b - t) < 0.07)).length
    console.log(`downbeats matched ${hit}/${trueBars.length}, beats matched ${beatHit}/${trueBars.length * 4}`)
    const pr = (det, tru, tol = 0.06) => { const tp = det.filter((d) => tru.some((t) => Math.abs(t - d) < tol)).length; const rc = tru.filter((t) => det.some((d) => Math.abs(t - d) < tol)).length; return `P ${(tp / Math.max(1, det.length) * 100).toFixed(0)}% R ${(rc / Math.max(1, tru.length) * 100).toFixed(0)}% (${det.length} vs ${tru.length})` }
    console.log("kick", pr(m.onsets.kick, truth.events.kick), "| snare", pr(m.onsets.snare, [...truth.events.snare, ...truth.events.roll]), "| hat", pr(m.onsets.hat, truth.events.hat))
    console.log("truth sections:", truth.sections.map((s) => `${s.start.toFixed(1)} ${s.name}`).join(" | "))
  }
}

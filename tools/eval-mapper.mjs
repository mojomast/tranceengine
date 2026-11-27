#!/usr/bin/env bun
// Scores the song mapper against the synthetic test songs' ground truth (assets/truth/*.truth.json):
// tempo, beats, downbeats, kick/snare/hat onsets, sections and drops, with mir_eval-style one-to-one windows.
// The real song has no truth file, so it is only printed.
import { join, dirname } from "node:path"
import { readFileSync, writeFileSync } from "node:fs"
import { decode, loadMapper } from "./decode.mjs"
import { ONSET_WINDOW, BEAT_WINDOW, matchEvents, prf, discoverTruthSongs, findRegressions } from "./eval-lib.mjs"

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..")
const mapSong = await loadMapper(ROOT)

const METRICS = ["tempoOk", "downbeatHit", "beatF", "kickF", "kickP", "kickR", "snareF", "hatF", "sectionHit", "dropHit"]
const argv = process.argv.slice(2)
const arg = (flag) => {
  const i = argv.indexOf(flag)
  return i < 0 ? null : argv[i + 1]
}
const json = argv.includes("--json")
const baselineFile = arg("--baseline")
const writeBaselineFile = arg("--write-baseline")
const tolArg = arg("--tolerance")
const tol = tolArg === null ? 0.02 : Number(tolArg)
const tolerance = Number.isFinite(tol) ? tol : 0.02

const truthDir = join(ROOT, "assets/truth")
const names = [...discoverTruthSongs(truthDir), "song"]
const scores = {}
const lines = []
const log = (...parts) => lines.push(parts.join(" "))

const share = (ref, est, window) => Math.min(1, matchEvents(ref, est, window) / Math.max(1, ref.length))
const onset = (det, tru) => {
  const p = prf(tru, det, ONSET_WINDOW)
  return `P ${(p.precision * 100).toFixed(0)}% R ${(p.recall * 100).toFixed(0)}% F ${(p.f * 100).toFixed(0)}% (${det.length} vs ${tru.length})`
}

for (const name of names) {
  const x = decode(join(ROOT, "assets/audio", name + ".mp3"))
  const t0 = performance.now()
  const m = mapSong(x, 22050)
  const ms = performance.now() - t0
  let truth = null
  try { truth = JSON.parse(readFileSync(join(truthDir, name + ".truth.json"), "utf8")) } catch {}
  const off = truth ? Number(truth.offset_s) || 0 : 0
  const shift = (a) => (a || []).map((t) => t + off)

  log("")
  log(`=== ${name}  (${ms.toFixed(0)} ms)  bpm ${m.bpm.toFixed(1)}${truth ? " (truth " + truth.bpm + ")" : ""}  beats ${m.beats.length}  bars ${m.downbeats.length}`)
  log("onsets kick/snare/hat:", m.onsets.kick.length, m.onsets.snare.length, m.onsets.hat.length)
  log("sections:", m.sections.map((s) => `${s.start.toFixed(1)}-${s.end.toFixed(1)} ${s.kind}(${s.power})`).join(" | "))
  log("drops:", m.drops.map((d) => d.toFixed(2)).join(", "), truth ? " truth: " + shift(truth.drops).join(", ") : "")
  if (!truth) continue

  const beats = truth.beats ? shift(truth.beats) : null
  const downbeats = truth.downbeats ? shift(truth.downbeats) : null
  const ev = truth.events || {}
  const events = { kick: shift(ev.kick), snare: shift(ev.snare), roll: shift(ev.roll), hat: shift(ev.hat) }
  const sections = (truth.sections || []).map((s) => ({ ...s, start: s.start + off, end: s.end + off }))
  const drops = shift(truth.drops)
  const bar = truth.bar

  // Without explicit truth beats/downbeats, use the bar grid from the first to the last section.
  const grid = []
  if (sections.length) {
    for (let t = sections[0].start; t < sections[sections.length - 1].end - 0.01; t += bar) grid.push(t)
  }
  const trueBars = downbeats || grid
  const trueBeats = beats || grid.flatMap((t) => [0, 1, 2, 3].map((k) => t + k * bar / 4))
  const hit = matchEvents(trueBars, m.downbeats, BEAT_WINDOW)
  const beatHit = matchEvents(trueBeats, m.beats, BEAT_WINDOW)
  log(`downbeats matched ${hit}/${trueBars.length}, beats matched ${beatHit}/${trueBeats.length}`)

  const kick = prf(events.kick, m.onsets.kick, ONSET_WINDOW)
  const snare = prf([...events.snare, ...events.roll], m.onsets.snare, ONSET_WINDOW)
  const hat = prf(events.hat, m.onsets.hat, ONSET_WINDOW)
  log("kick", onset(m.onsets.kick, events.kick), "| snare", onset(m.onsets.snare, [...events.snare, ...events.roll]), "| hat", onset(m.onsets.hat, events.hat))
  log("truth sections:", sections.map((s) => `${s.start.toFixed(1)} ${s.name}`).join(" | "))

  const metrics = {
    tempoOk: Math.abs(m.bpm - truth.bpm) / truth.bpm < 0.04 ? 1 : 0,
    downbeatHit: share(trueBars, m.downbeats, BEAT_WINDOW),
    beatF: prf(trueBeats, m.beats, BEAT_WINDOW).f,
    kickF: kick.f,
    kickP: kick.precision,
    kickR: kick.recall,
    snareF: snare.f,
    hatF: hat.f,
    sectionHit: share(sections.filter((s) => s.start > 0).map((s) => s.start), m.sections.map((s) => s.start), bar / 2),
    dropHit: share(drops, m.drops, 0.25)
  }
  log("metrics:", METRICS.map((k) => `${k} ${metrics[k].toFixed(2)}`).join(" "))
  scores[name] = { bpm: m.bpm, ms, ...metrics }
}

if (writeBaselineFile) {
  const baseline = {}
  for (const [name, s] of Object.entries(scores)) {
    baseline[name] = {}
    for (const metric of METRICS) baseline[name][metric] = s[metric]
  }
  writeFileSync(writeBaselineFile, JSON.stringify(baseline, null, 2) + "\n")
}

console.log(json ? JSON.stringify({ songs: scores }) : lines.join("\n"))

if (baselineFile) {
  let baseline = null
  try { baseline = JSON.parse(readFileSync(baselineFile, "utf8")) } catch (err) {
    console.error(`cannot read baseline ${baselineFile}: ${err.message}`)
    process.exitCode = 2
  }
  if (baseline) {
    const report = json ? (...parts) => console.error(...parts) : console.log
    const regressions = findRegressions(scores, baseline, tolerance)
    for (const r of regressions) report(`regression ${r.song}.${r.metric}: ${r.base} -> ${r.now}`)
    if (regressions.length) process.exitCode = 1
  }
}

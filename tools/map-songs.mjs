#!/usr/bin/env bun
// Precomputes song maps for the bundled tracks into assets/maps.json, so the page can plan the edit instantly.
// Run it after adding a track to assets/audio/ (and to TRACKS in src/app/timeline.js) or after changing the mapper.
import { readdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { decode, loadMapper } from "./decode.mjs"
const ROOT = join(dirname(new URL(import.meta.url).pathname), "..")
const mapSong = await loadMapper(ROOT)
const out = {}
for (const f of readdirSync(join(ROOT, "assets/audio")).filter((f) => f.endsWith(".mp3")).sort()) {
  const t0 = performance.now(), m = mapSong(decode(join(ROOT, "assets/audio", f)), 22050)
  out[f] = { duration: +m.duration.toFixed(3), bpm: +m.bpm.toFixed(2), period: +m.period.toFixed(4), beats: m.beats, downbeats: m.downbeats, onsets: m.onsets, sections: m.sections, drops: m.drops.map((d) => +d.toFixed(3)) }
  console.log(`${f.padEnd(16)} ${m.bpm.toFixed(1)} BPM · ${m.sections.map((s) => s.kind).join(" › ")} · drops ${m.drops.map((d) => d.toFixed(2)).join(", ") || "none"} (${(performance.now() - t0).toFixed(0)} ms)`)
}
writeFileSync(join(ROOT, "assets/maps.json"), JSON.stringify(out))
console.log("wrote assets/maps.json")

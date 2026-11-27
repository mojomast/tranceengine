// APPROVED TEST (S9 kick detection). Read-only for bees.
// Scores the real mapper with tools/eval-mapper.mjs against the synthetic songs' ground truth (mir_eval-style, one-to-one,
// +/-50 ms onsets) and the committed baseline. Needs bun and ffmpeg on PATH; fails closed when either is missing.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const SONGS = ["breakneck", "slow-burn", "trance138"]
let memo = null
function evaluate() {
  if (memo) return memo
  const ff = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" })
  if (ff.error || ff.status !== 0) throw new Error("ffmpeg is required on PATH (CI has it; in a sandbox: pip install imageio-ffmpeg and link its binary as ffmpeg)")
  const r = spawnSync("bun", ["tools/eval-mapper.mjs", "--json", "--baseline", "assets/eval-baseline.json"],
    { cwd: ROOT, encoding: "utf8", timeout: 900000 })
  if (r.error) throw new Error("could not run bun tools/eval-mapper.mjs: " + r.error.message)
  let j
  try { j = JSON.parse(r.stdout) } catch { throw new Error("eval-mapper printed no JSON: " + (r.stderr || r.stdout).slice(0, 2000)) }
  memo = { status: r.status, stderr: r.stderr || "", songs: j.songs || {} }
  return memo
}

describe("KickDetection", () => {
  it("kick_f_reaches_0_72_on_every_synthetic_song", () => {
    const { songs } = evaluate()
    for (const s of SONGS) assert.ok(songs[s] && songs[s].kickF >= 0.72, s + " kickF " + (songs[s] && songs[s].kickF))
  })
  it("mean_kick_f_reaches_0_80", () => {
    const { songs } = evaluate()
    const mean = SONGS.reduce((a, s) => a + songs[s].kickF, 0) / SONGS.length
    assert.ok(mean >= 0.8, "mean kickF " + mean.toFixed(3))
  })
  it("kick_precision_and_recall_both_reach_0_65", () => {
    const { songs } = evaluate()
    for (const s of SONGS) {
      assert.ok(songs[s].kickP >= 0.65, s + " kickP " + songs[s].kickP)
      assert.ok(songs[s].kickR >= 0.65, s + " kickR " + songs[s].kickR)
    }
  })
  it("no_metric_regresses_against_the_baseline", () => {
    const { status, stderr } = evaluate()
    assert.equal(status, 0, "eval-mapper --baseline failed:\n" + stderr.slice(0, 2000))
    assert.ok(!/regression/.test(stderr), stderr.slice(0, 2000))
  })
  it("mapping_stays_fast", () => {
    const { songs } = evaluate()
    for (const [name, s] of Object.entries(songs)) assert.ok(s.ms < 4000, name + " mapped in " + Math.round(s.ms) + " ms")
  })
})

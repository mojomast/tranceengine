// APPROVED TEST (S1): contract for tools/eval-lib.mjs, the mir_eval-style scoring used by tools/eval-mapper.mjs.
// Run: node --test tools/test/eval-lib.test.mjs   (plain Node, no Bun, no ffmpeg)
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { matchEvents, prf, discoverTruthSongs, findRegressions, ONSET_WINDOW, BEAT_WINDOW } from "../eval-lib.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

describe("EvalLib", () => {
  test("windows_follow_mir_eval_defaults", () => {
    assert.equal(ONSET_WINDOW, 0.05)
    assert.equal(BEAT_WINDOW, 0.07)
  })
  test("matching_is_one_to_one", () => {
    // Two detections near one true hit count once, not twice.
    assert.equal(matchEvents([1.0], [1.0, 1.01], 0.05), 1)
    assert.equal(matchEvents([1.0, 1.01], [1.0], 0.05), 1)
  })
  test("matching_respects_the_window", () => {
    assert.equal(matchEvents([1, 2, 3], [1.049, 2.051, 2.951], 0.05), 2)
    assert.equal(matchEvents([1], [1.069], 0.07), 1)
    assert.equal(matchEvents([1], [1.071], 0.07), 0)
  })
  test("matching_is_maximum_not_greedy_nearest", () => {
    // Nearest-first would pair 1.03 with 1.05 and lose 1.00; the best matching pairs both.
    assert.equal(matchEvents([1.0, 1.05], [1.03, 1.07], 0.05), 2)
    assert.equal(matchEvents([1.03, 1.07], [1.0, 1.05], 0.05), 2)
  })
  test("matching_accepts_unsorted_input", () => {
    assert.equal(matchEvents([3, 1, 2], [2.01, 0.99, 3.02], 0.05), 3)
  })
  test("prf_scores_precision_recall_and_f", () => {
    const r = prf([1, 2, 3, 4], [1.01, 2.02, 5, 6], 0.05)
    assert.equal(r.tp, 2)
    assert.ok(Math.abs(r.precision - 0.5) < 1e-9)
    assert.ok(Math.abs(r.recall - 0.5) < 1e-9)
    assert.ok(Math.abs(r.f - 0.5) < 1e-9)
    const s = prf([1, 2], [1, 2, 3, 4], 0.05)
    assert.ok(Math.abs(s.f - (2 * 0.5 * 1) / 1.5) < 1e-9)
  })
  test("prf_of_empty_lists_is_zero_not_nan", () => {
    for (const [a, b] of [[[], []], [[1], []], [[], [1]]]) {
      const r = prf(a, b, 0.05)
      assert.deepEqual([r.precision, r.recall, r.f, r.tp], [0, 0, 0, 0])
    }
  })
  test("discovers_truth_songs_from_the_folder", () => {
    const d = mkdtempSync(join(tmpdir(), "truth-"))
    writeFileSync(join(d, "zeta.truth.json"), "{}")
    writeFileSync(join(d, "alpha.truth.json"), "{}")
    writeFileSync(join(d, "notes.txt"), "x")
    assert.deepEqual(discoverTruthSongs(d), ["alpha", "zeta"])
  })
  test("discovers_the_bundled_synthetic_songs", () => {
    const names = discoverTruthSongs(join(ROOT, "assets", "truth"))
    assert.ok(names.includes("slow-burn") && names.includes("breakneck"))
    assert.ok(!names.includes("song"))
  })
  test("regressions_are_drops_beyond_tolerance", () => {
    const base = { "slow-burn": { kickF: 0.6, bpm: 84 }, breakneck: { kickF: 0.7 } }
    const now = { "slow-burn": { kickF: 0.59, bpm: 84 }, breakneck: { kickF: 0.6 } }
    const r = findRegressions(now, base, 0.02)
    assert.deepEqual(r.map((x) => [x.song, x.metric]), [["breakneck", "kickF"]])
    assert.equal(r[0].base, 0.7)
    assert.equal(r[0].now, 0.6)
  })
  test("missing_scores_fail_closed", () => {
    const r = findRegressions({ "slow-burn": {} }, { "slow-burn": { kickF: 0.6 }, breakneck: { snareF: 0.5 } }, 0.02)
    assert.deepEqual(r.map((x) => [x.song, x.metric]).sort(), [["breakneck", "snareF"], ["slow-burn", "kickF"]])
  })
  test("improvements_are_not_regressions", () => {
    assert.deepEqual(findRegressions({ a: { kickF: 0.9 } }, { a: { kickF: 0.5 } }, 0.02), [])
  })
  test("eval_mapper_uses_the_lib_and_no_hardcoded_song_list", () => {
    const src = readFileSync(join(ROOT, "tools", "eval-mapper.mjs"), "utf8")
    assert.match(src, /from\s+["']\.\/eval-lib\.mjs["']/)
    assert.doesNotMatch(src, /\[\s*"slow-burn"\s*,\s*"breakneck"/)
    assert.match(src, /--json/)
    assert.match(src, /--baseline/)
  })
})

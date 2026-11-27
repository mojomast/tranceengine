// APPROVED TEST: contract for the new flourish scenes/arp-constellation.js ("Arp constellation").
// Run: node --test tools/test/scene-arp-constellation.test.mjs   (needs bun on PATH for the engine checker)
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT, FLOURISH_AVG_MS, staticProblems, runChecker } from "./scene-helpers.mjs"

const SLUG = "arp-constellation", NAME = "Arp constellation"

describe("ArpConstellation", () => {
  test("follows_the_scene_rules", () => {
    assert.deepEqual(staticProblems(SLUG, NAME), [])
  })
  test("passes_the_engine_checker_within_the_flourish_budget", () => {
    const { status, report } = runChecker(SLUG)
    assert.equal(report.pass, true, JSON.stringify(report.fails))
    assert.equal(status, 0)
    assert.equal(report.scene, NAME)
    for (const size of ["desktop", "phone"]) {
      assert.ok(report[size].avgVm < FLOURISH_AVG_MS, size + " avgVm " + report[size].avgVm + " >= " + FLOURISH_AVG_MS)
      assert.ok(report[size].maxShapes <= 1200, size + " maxShapes " + report[size].maxShapes)
      assert.deepEqual(report[size].problems, [])
    }
  })
})

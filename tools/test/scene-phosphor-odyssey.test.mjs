// APPROVED TEST (scene factory): scenes/phosphor-odyssey.js, "Phosphor odyssey" (feature). Read-only for bees.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { sceneProblems, checkScene, assertWithinBudget } from "./scene-contract.mjs"

const SLUG = "phosphor-odyssey", NAME = "Phosphor odyssey", TIER = "feature"
const OPTS = { tier: TIER, allowRandom: false, technique: [/mulberry|Math\.imul/] }

describe("PhosphorOdyssey", () => {
  it("follows_the_scene_rules", () => {
    assert.deepEqual(sceneProblems(SLUG, NAME, OPTS), [])
  })
  it("passes_the_engine_checker_within_the_feature_budget", () => {
    const { report } = checkScene(SLUG)
    assertWithinBudget(assert, report, TIER)
  })
  it("reports_four_phases_and_answers_cues", () => {
    const { report } = checkScene(SLUG)
    for (const size of ["desktop", "phone"]) {
      assert.equal(report[size].phases, 4, size + " phases")
      assert.ok(report[size].phasesSeen >= 3, size + " phasesSeen " + report[size].phasesSeen)
    }
  })
  it("starts_cleanly_at_a_later_phase", () => {
    const { report } = checkScene(SLUG, 2)
    assertWithinBudget(assert, report, TIER)
  })
})

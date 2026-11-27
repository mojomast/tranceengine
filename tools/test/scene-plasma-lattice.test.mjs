// APPROVED TEST (scene factory): scenes/plasma-lattice.js, "Plasma lattice" (flourish). Read-only for bees.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { sceneProblems, checkScene, assertWithinBudget } from "./scene-contract.mjs"

const SLUG = "plasma-lattice", NAME = "Plasma lattice", TIER = "flourish"
const OPTS = { tier: TIER, allowRandom: false, technique: [/mulberry|Math\.imul/] }

describe("PlasmaLattice", () => {
  it("follows_the_scene_rules", () => {
    assert.deepEqual(sceneProblems(SLUG, NAME, OPTS), [])
  })
  it("passes_the_engine_checker_within_the_flourish_budget", () => {
    const { report } = checkScene(SLUG)
    assertWithinBudget(assert, report, TIER)
  })
})

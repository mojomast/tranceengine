// APPROVED TEST (scene factory): scenes/lsystem-garden.js, "L-system garden" (flourish). Read-only for bees.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { sceneProblems, checkScene, assertWithinBudget } from "./scene-contract.mjs"

const SLUG = "lsystem-garden", NAME = "L-system garden", TIER = "flourish"
const OPTS = { tier: TIER, allowRandom: false, technique: [/\.replace\(\s*\/|new RegExp\(/] }

describe("LsystemGarden", () => {
  it("follows_the_scene_rules", () => {
    assert.deepEqual(sceneProblems(SLUG, NAME, OPTS), [])
  })
  it("passes_the_engine_checker_within_the_flourish_budget", () => {
    const { report } = checkScene(SLUG)
    assertWithinBudget(assert, report, TIER)
  })
})

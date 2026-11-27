// APPROVED TEST (scene factory): scenes/rule30-loom.js, "Rule 30 loom" (flourish). Read-only for bees.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { sceneProblems, checkScene, assertWithinBudget } from "./scene-contract.mjs"

const SLUG = "rule30-loom", NAME = "Rule 30 loom", TIER = "flourish"
const OPTS = { tier: TIER, allowRandom: false, technique: [/\d+n\b|BigInt\(/] }

describe("Rule30Loom", () => {
  it("follows_the_scene_rules", () => {
    assert.deepEqual(sceneProblems(SLUG, NAME, OPTS), [])
  })
  it("passes_the_engine_checker_within_the_flourish_budget", () => {
    const { report } = checkScene(SLUG)
    assertWithinBudget(assert, report, TIER)
  })
})

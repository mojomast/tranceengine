// APPROVED TEST (scene factory): scenes/dot-tunnel.js, "Dot tunnel" (flourish). Read-only for bees.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { sceneProblems, checkScene, assertWithinBudget } from "./scene-contract.mjs"

const SLUG = "dot-tunnel", NAME = "Dot tunnel", TIER = "flourish"
const OPTS = { tier: TIER, allowRandom: false, technique: [/function\s*\*/] }

describe("DotTunnel", () => {
  it("follows_the_scene_rules", () => {
    assert.deepEqual(sceneProblems(SLUG, NAME, OPTS), [])
  })
  it("passes_the_engine_checker_within_the_flourish_budget", () => {
    const { report } = checkScene(SLUG)
    assertWithinBudget(assert, report, TIER)
  })
})

// APPROVED TEST (S13a): contract for tools/plan-harness.mjs and invariants of the planned edit (buildPlan in
// src/app/timeline.js), checked on the three bundled song maps. Run: node --test tools/test/plan.test.mjs
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { loadPlanner } from "../plan-harness.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const MAPS = JSON.parse(readFileSync(join(ROOT, "assets", "maps.json"), "utf8"))
const KEYS = Object.keys(MAPS)
const EPS = 1e-6
const P = await loadPlanner()
const planOf = (key, seed = 1234) => P.plan(MAPS[key], key, seed)

describe("PlanHarness", () => {
  test("uses_the_real_timeline_code", () => {
    const src = readFileSync(join(ROOT, "tools", "plan-harness.mjs"), "utf8")
    assert.match(src, /src\/app\/timeline\.js/)
    assert.doesNotMatch(src, /const\s+buildPlan\s*=/, "do not copy buildPlan into the harness")
    assert.doesNotMatch(src, /const\s+prepMap\s*=/, "do not copy prepMap into the harness")
  })
  test("loads_scenes_from_the_manifest_by_default", () => {
    const m = JSON.parse(readFileSync(join(ROOT, "scenes", "manifest.json"), "utf8"))
    assert.equal(P.scenes.length, m.scenes.length)
    assert.equal(P.scenes.filter((s) => s.tier === "feature").length, m.scenes.filter((s) => s.tier === "feature").length)
    for (const s of P.scenes) assert.equal(s.phases, s.tier === "feature" ? 4 : 1)
  })
  test("accepts_a_custom_scene_list", async () => {
    const Q = await loadPlanner({ scenes: [{ name: "F1", tier: "feature", phases: 4 }, { name: "F2", tier: "feature", phases: 4 }, { name: "L1", tier: "flourish", phases: 1 }] })
    const pl = Q.plan(MAPS[KEYS[0]], KEYS[0], 1)
    assert.ok(pl.shots.length > 0)
    assert.ok(pl.shots.every((s) => s.scene >= 0 && s.scene < 3))
  })
})

describe("PlanInvariants", () => {
  test("same_seed_same_plan_other_seed_other_plan", () => {
    for (const k of KEYS) {
      assert.deepEqual(planOf(k, 99), planOf(k, 99))
      assert.notDeepEqual(planOf(k, 99).shots.map((s) => s.scene), planOf(k, 100).shots.map((s) => s.scene))
    }
  })
  test("shots_tile_the_song_without_gaps", () => {
    for (const k of KEYS) {
      const { shots } = planOf(k)
      assert.equal(shots[0].t0, 0)
      for (let i = 1; i < shots.length; i++) assert.ok(Math.abs(shots[i].t0 - shots[i - 1].t1) < EPS, k + " gap at shot " + i)
      for (const s of shots) assert.ok(s.t1 > s.t0, k + " empty shot")
    }
  })
  test("every_cut_lands_on_a_downbeat", () => {
    for (const k of KEYS) {
      const downs = MAPS[k].downbeats
      for (const s of planOf(k).shots.slice(1)) assert.ok(downs.some((d) => Math.abs(d - s.t0) < EPS), k + " shot at " + s.t0 + " is off the bar grid")
    }
  })
  test("drops_open_with_a_hard_cut", () => {
    for (const k of KEYS) {
      const { shots } = planOf(k)
      for (const s of shots.filter((x) => x.first && x.kind === "drop")) {
        assert.equal(s.type, 6, k + " drop at " + s.t0 + " is not a cut")
        assert.equal(s.lead, 0)
      }
    }
  })
  test("transition_leads_finish_on_the_bar_line_inside_the_previous_shot", () => {
    for (const k of KEYS) {
      const { shots } = planOf(k)
      for (let i = 1; i < shots.length; i++) {
        const s = shots[i]
        assert.ok(s.lead >= 0)
        assert.ok(s.t0 - s.lead >= shots[i - 1].t0 - EPS, k + " lead of shot " + i + " starts before the previous shot")
      }
    }
  })
  test("inserts_are_one_bar_flourishes", () => {
    for (const k of KEYS) {
      for (const s of planOf(k).shots.filter((x) => x.insert)) {
        assert.equal(s.bars, 1)
        assert.equal(P.scenes[s.scene].tier, "flourish")
      }
    }
  })
  test("a_stutter_precedes_every_drop_that_follows_a_build", () => {
    for (const k of KEYS) {
      const S = P.prepMap(MAPS[k], k), pl = P.buildPlan(S, 7)
      S.secs.forEach((sec, i) => {
        const next = S.secs[i + 1]
        if (sec.kind !== "build" || !next || next.kind !== "drop") return
        assert.ok(pl.events.some((e) => e.type === "stutter" && Math.abs(e.t - (next.start - MAPS[k].period)) < EPS), k + " no stutter before drop at " + next.start)
      })
    }
  })
  test("events_are_sorted", () => {
    for (const k of KEYS) {
      const ev = planOf(k).events
      for (let i = 1; i < ev.length; i++) assert.ok(ev[i].t >= ev[i - 1].t)
    }
  })
})

// tools/plan-harness.mjs -- Node-only harness for the planned edit (buildPlan).
//
// Why it exists: src/app/*.js are not ES modules. tools/build.mjs concatenates
// them into one script scope, so prepMap/buildPlan in src/app/timeline.js lean on
// globals defined in other files (PRESETS, isFeature, rotation, the audio state
// A, music, REDUCE, ...). This harness evaluates the REAL timeline.js text in a
// fresh VM context with tiny stand-ins for those globals and exposes the real
// functions, so their invariants can be exercised with plain `node --test` --
// no Bun, no browser, and no copy of the planner logic.
//
// Usage:
//   const P = await loadPlanner()                    // scenes from the manifest
//   const plan = P.plan(map, "song.mp3", 1234)       // buildPlan(prepMap(map, key), seed)
//   const Q = await loadPlanner({ scenes: [...] })   // custom scene list
//
// Approved tests: node --test tools/test/plan.test.mjs

import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import vm from "node:vm"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const manifestScenes = () => {
  const m = JSON.parse(readFileSync(join(ROOT, "scenes", "manifest.json"), "utf8"))
  return m.scenes.map((s) => ({
    name: s.file.replace(/\.js$/, ""),
    tier: s.tier,
    phases: s.tier === "feature" ? 4 : 1
  }))
}

export async function loadPlanner({ scenes } = {}) {
  const list = scenes || manifestScenes()
  const isFeature = (i) => !!list[i] && list[i].tier === "feature"
  const rotation = () => list.map((_, i) => i)
  const noop = () => {}
  const el = () => ({ style: {}, classList: { toggle: noop }, appendChild: noop, title: "" })
  const sandbox = {
    PRESETS: list,
    isFeature,
    rotation,
    A: {},
    music: "file",
    REDUCE: false,
    audioEl: { currentTime: 0 },
    ac: {},
    codes: list.map((s) => s.name),
    enabled: list.map(() => true),
    auto: true,
    story: { hue: 30, words: [] },
    current: 0,
    active: "a",
    trans: null,
    stutter: null,
    slots: { a: { running: false, frames: 0 }, b: { running: false, frames: 0 } },
    $: () => el(),
    document: { createElement: el },
    window: {},
    URL: { createObjectURL: () => "" },
    Blob: function () {},
    Worker: function () {},
    clamp: (x, a, b) => Math.min(b, Math.max(a, x)),
    fmt: (t) => String(t),
    showTag: noop,
    showCard: noop,
    beginTransition: noop,
    cue: noop,
    cancelTransition: noop,
    endFork: noop,
    toast: noop,
    requestFlash: noop,
    drawTimeline: noop,
    mapSong: () => ({})
  }
  const src = readFileSync(join(ROOT, "src", "app", "timeline.js"), "utf8")
  const { prepMap, buildPlan } = vm.runInNewContext(src + "\n;({ prepMap, buildPlan })", sandbox)
  const plan = (M, key, seed) => buildPlan(prepMap(M, key), seed)
  return { scenes: list, prepMap, buildPlan, plan }
}

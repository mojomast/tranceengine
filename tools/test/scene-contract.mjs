// APPROVED TEST HELPER (scene batch v2): shared contract for new scenes. Read-only for bees.
// sceneProblems(): static rules a scene must follow. checkScene(): builds dist/ once if needed and runs
// tools/check-scene.mjs (needs `bun` on PATH). Budgets scale on slow CI runners via FLOURISH_AVG_MS (3.5 = desktop).
import { readFileSync, existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const SLOW = process.env.FLOURISH_AVG_MS ? +process.env.FLOURISH_AVG_MS / 3.5 : 1
export const BUDGET = { flourish: 3.5 * SLOW, feature: 4.0 * SLOW }
export const MAX_SHAPES = { flourish: 1200, feature: 1400 }

const FORBIDDEN = [
  [/\bset(Timeout|Interval)\s*\(|requestAnimationFrame/, "timers"],
  [/\bfetch\s*\(|XMLHttpRequest|WebSocket/, "network"],
  [/\beval\s*\(|new\s+Function\b/, "eval"],
  [/\bProxy\b|\bReflect\b|\bSymbol\s*\(/, "Proxy/Reflect/Symbol"],
  [/\b(document|window|globalThis|navigator|localStorage)\b/, "DOM/global objects"],
  [/\b(Float32|Float64|Int8|Int16|Int32|Uint8|Uint16|Uint32|Uint8Clamped)Array\b/, "typed arrays (use plain arrays)"],
  [/^\s*(import|export)\s/m, "import/export"],
  [/\bDate\.now\s*\(|new\s+Date\s*\(\s*\)|crypto\./, "clock/crypto reads (non-deterministic)"],
]
const REACTIONS = ["kick", "kickHit", "snare", "snareHit", "hat", "hatHit", "bass", "drop", "dropAmt", "calm",
  "build", "toDrop", "keyHue", "note", "chroma", "barPhase", "downbeat", "beat", "phase", "bands", "energy", "bright",
  "level", "mid", "high", "anticip", "phrase", "phraseStart", "kicks", "snares", "hats", "noise", "section"]

// opts: { tier: "flourish" | "feature", allowRandom: false, technique: RegExp or [RegExp], each must match: its psychoscript trick }
export function sceneProblems(slug, expectedName, opts = {}) {
  const tier = opts.tier || "flourish"
  const p = []
  const path = join(ROOT, "scenes", slug + ".js")
  if (!existsSync(path)) return ["scenes/" + slug + ".js does not exist"]
  const code = readFileSync(path, "utf8")
  const lines = code.split("\n")
  if (lines[0] !== "// name: " + expectedName) p.push("first line must be exactly: // name: " + expectedName)
  const header = []; for (const l of lines.slice(1)) { if (!l.startsWith("//")) break; header.push(l) }
  if (header.length < 3) p.push("needs a header comment of 3+ lines: the style, the psychoscript technique and each musical reaction")
  if (!/await\s+frame\s*\(/.test(code)) p.push("must call await frame(...)")
  if (!/while\s*\(\s*true\s*\)/.test(code)) p.push("must loop forever with while (true)")
  for (const [re, what] of FORBIDDEN) if (re.test(code)) p.push("forbidden in the VM: " + what)
  if (!opts.allowRandom && /Math\.random\s*\(/.test(code)) p.push("use a seeded PRNG (e.g. mulberry32), not Math.random, so rewinds and replays are exact")
  for (const re of [].concat(opts.technique || [])) if (!re.test(code)) p.push("must use its psychoscript technique: " + re)
  // Photosensitivity (WCAG 2.3.1): no near-white fills of its own, no frame-inverting blend.
  if (/\bl\s*:\s*(8[5-9]|9\d|100)\b/.test(code)) p.push("lightness 85+ (near-white) is not allowed; keep l <= 80")
  if (/difference/.test(code)) p.push("blend 'difference' can strobe; not allowed")
  const hasPhases = /\bphases\s*:/.test(code)
  if (tier === "flourish" && hasPhases) p.push("flourishes do not report phases")
  if (tier === "feature") {
    if (!hasPhases) p.push("features report fx.phase, fx.phases and fx.title")
    if (!/s\.cue/.test(code) || !/s\.entry/.test(code)) p.push("features read s.entry once and answer s.cue")
  }
  const used = new Set(REACTIONS.filter((k) => new RegExp("\\bA\\." + k + "\\b").test(code)))
  if (used.size < 4) p.push("reacts to only " + used.size + " audio fields (" + [...used].join(", ") + "); use 4+ distinct ones")
  const maxBytes = tier === "feature" ? 20000 : 12000
  if (code.length > maxBytes) p.push("file is " + code.length + " bytes; keep it under " + maxBytes)
  return p
}

let built = false
const cache = new Map()
export function checkScene(slug, entry) {
  const key = slug + "@" + (entry ?? 0)
  if (!cache.has(key)) cache.set(key, runChecker(slug, entry))
  return cache.get(key)
}
function runChecker(slug, entry) {
  const env = { ...process.env }
  if (entry != null) env.ENTRY = String(entry)
  if (!built && !existsSync(join(ROOT, "dist", "engine.bundle.js"))) {
    const b = spawnSync("bun", [join(ROOT, "tools", "build.mjs")], { cwd: ROOT, env, encoding: "utf8", timeout: 600000 })
    if (b.status !== 0) throw new Error("bun tools/build.mjs failed: " + (b.error ? b.error.message : b.stderr || b.stdout))
  }
  built = true
  const r = spawnSync("bun", [join(ROOT, "tools", "check-scene.mjs"), join(ROOT, "scenes", slug + ".js")],
    { cwd: ROOT, env, encoding: "utf8", timeout: 600000 })
  if (r.error) throw new Error("could not run bun tools/check-scene.mjs: " + r.error.message)
  let report
  try { report = JSON.parse(r.stdout) } catch { throw new Error("checker printed no JSON: " + (r.stderr || r.stdout).slice(0, 2000)) }
  return { status: r.status, report }
}

export function assertWithinBudget(assert, report, tier) {
  assert.equal(report.pass, true, JSON.stringify(report.fails))
  for (const size of ["desktop", "phone"]) {
    const r = report[size]
    assert.ok(r && !r.error, size + ": " + (r && r.error))
    assert.ok(r.avgVm < BUDGET[tier], size + " avgVm " + r.avgVm + " >= " + BUDGET[tier].toFixed(2))
    assert.ok(r.maxShapes <= MAX_SHAPES[tier], size + " maxShapes " + r.maxShapes)
    assert.deepEqual(r.problems, [])
  }
}

// APPROVED TEST HELPER (S3-S5): shared checks for new flourish scenes. Read-only for bees.
// staticProblems(): rules a scene file must follow before it ever runs.
// runChecker(): builds dist/ once if needed and runs tools/check-scene.mjs (needs `bun` on PATH).
import { readFileSync, existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
// Average VM ms per frame a flourish may use (CONTRIBUTING: "comfortably inside the budget, under ~3.5 ms").
// Shared CI runners are ~1.5x slower, so CI may raise this the same way it raises VM_BUDGET_MS.
export const FLOURISH_AVG_MS = +(process.env.FLOURISH_AVG_MS || 3.5)

const FORBIDDEN = [
  [/\bset(Timeout|Interval)\s*\(|requestAnimationFrame/, "timers"],
  [/\bfetch\s*\(|XMLHttpRequest|WebSocket/, "network"],
  [/\beval\s*\(|new\s+Function\b/, "eval"],
  [/\bProxy\b|\bSymbol\s*\(/, "Proxy/Symbol"],
  [/\b(document|window|globalThis|navigator|localStorage)\b/, "DOM/global objects"],
  [/\b(Float32|Float64|Int8|Int16|Int32|Uint8|Uint16|Uint32|Uint8Clamped)Array\b/, "typed arrays"],
  [/^\s*(import|export)\s/m, "import/export"],
]
const REACTIONS = ["kick", "kickHit", "snare", "snareHit", "hat", "hatHit", "bass", "drop", "dropAmt", "calm",
  "build", "toDrop", "keyHue", "note", "barPhase", "downbeat", "beat", "phase", "bands", "energy"]

export const sceneCode = (slug) => readFileSync(join(ROOT, "scenes", slug + ".js"), "utf8")

export function staticProblems(slug, expectedName) {
  const p = []
  const path = join(ROOT, "scenes", slug + ".js")
  if (!existsSync(path)) return ["scenes/" + slug + ".js does not exist"]
  const code = readFileSync(path, "utf8")
  const lines = code.split("\n")
  if (lines[0] !== "// name: " + expectedName) p.push("first line must be exactly: // name: " + expectedName)
  const header = []; for (const l of lines.slice(1)) { if (!l.startsWith("//")) break; header.push(l) }
  if (header.length < 2) p.push("needs a header comment of 2+ lines saying how it hears the music")
  if (!/await\s+frame\s*\(/.test(code)) p.push("must call await frame(...)")
  if (!/while\s*\(\s*true\s*\)/.test(code)) p.push("must loop forever with while (true)")
  for (const [re, what] of FORBIDDEN) if (re.test(code)) p.push("forbidden in the VM: " + what)
  // Photosensitivity: no near-white fills of its own and no blend that inverts the frame on the beat.
  if (/\bl\s*:\s*(8[5-9]|9\d|100)\b/.test(code)) p.push("lightness 85+ (near-white) is not allowed; keep l <= 80")
  if (/difference/.test(code)) p.push("blend 'difference' can strobe; not allowed in flourishes")
  if (/\bphases\s*:/.test(code) || /PHASES\s*=/.test(code)) p.push("flourishes do not report phases")
  const used = new Set(REACTIONS.filter((k) => new RegExp("\\bA\\." + k + "\\b").test(code)))
  if (used.size < 4) p.push("reacts to only " + used.size + " audio fields (" + [...used].join(", ") + "); use 4+ distinct ones")
  if (code.length > 12000) p.push("file is " + code.length + " bytes; keep a flourish under 12000")
  return p
}

let built = false
export function runChecker(slug) {
  const env = { ...process.env }
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

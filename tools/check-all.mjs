#!/usr/bin/env bun
// Runs tools/check-scene.mjs on every scene in scenes/manifest.json (features from each phase) and prints a table.
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
const ROOT = join(dirname(new URL(import.meta.url).pathname), "..")
const { scenes } = JSON.parse(readFileSync(join(ROOT, "scenes/manifest.json"), "utf8"))
let failed = 0
for (const { file, tier } of scenes) {
  const r = Bun.spawnSync(["bun", join(ROOT, "tools/check-scene.mjs"), join(ROOT, "scenes", file)], { stdout: "pipe", stderr: "pipe" })
  let rep = null
  try { rep = JSON.parse(r.stdout.toString()) } catch {}
  const ok = rep && rep.pass
  if (!ok) failed++
  const d = rep && rep.desktop
  console.log(`${ok ? "pass" : "FAIL"}  ${file.padEnd(24)} ${tier.padEnd(9)} ${d ? `avg ${d.avgVm} ms · p95 ${d.p95Vm} ms · ${d.maxShapes} shapes` : ""}${ok ? "" : "  " + (rep ? rep.fails.join("; ") : r.stderr.toString().slice(0, 200))}`)
}
console.log(failed ? `\n${failed} scene(s) failed` : "\nall scenes pass")
process.exit(failed ? 1 : 0)

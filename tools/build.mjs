#!/usr/bin/env bun
// Builds the whole app into dist/: a single self-contained index.html (engine, scenes and app inlined) plus the
// bundled songs. With --offline it also writes dist/trance-engine-offline.html, which embeds the songs as data URLs
// so it runs from disk with no network.
//
//   bun tools/build.mjs            -> dist/index.html, dist/*.mp3, dist/engine.bundle.js
//   bun tools/build.mjs --offline  -> also dist/trance-engine-offline.html
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..")
const p = (...a) => join(ROOT, ...a)
const DIST = p("dist")
mkdirSync(DIST, { recursive: true })
const ascii = (s) => s.replace(/[^\x00-\x7e]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"))

// 1. The engine worker: Psychoscript + the two-slot VM host, bundled to one IIFE.
const res = Bun.spawnSync(["bun", "build", p("src/engine/engine.js"), "--target=browser", "--minify", "--format=iife", "--outfile=" + p("dist/engine.bundle.js")], { stdout: "pipe", stderr: "pipe" })
if (res.exitCode !== 0) { console.error(res.stderr.toString()); process.exit(1) }
const engine = ascii(readFileSync(p("dist/engine.bundle.js"), "utf8"))

// 2. Scenes, in manifest order. The first line of each file is "// name: <Scene name>".
const manifest = JSON.parse(readFileSync(p("scenes/manifest.json"), "utf8"))
const PRESETS = manifest.scenes.map(({ file, tier, by }) => {
  const src = readFileSync(p("scenes", file), "utf8"), lines = src.split("\n")
  const m = lines[0].match(/^\/\/\s*name:\s*(.+)$/)
  if (!m) throw new Error(`scenes/${file}: the first line must be "// name: <Scene name>"`)
  const scene = { name: m[1].trim(), by, code: lines.slice(1).join("\n").trim(), tier }
  if (tier === "feature") scene.phases = 4
  return scene
})
const listed = new Set(manifest.scenes.map((s) => s.file))
for (const f of readdirSync(p("scenes"))) if (f.endsWith(".js") && !listed.has(f)) console.warn(`note: scenes/${f} is not in scenes/manifest.json, so it is not built in`)
const presets = "const PRESETS = " + ascii(JSON.stringify(PRESETS, null, 1)) + "\n"

// 3. The app modules, in dependency order, with the demo synth and the precomputed song maps spliced in.
const MODULES = ["mapper", "core", "text", "audio", "director", "timeline", "ui"]
const app = MODULES.map((n) => readFileSync(p("src/app", n + ".js"), "utf8")).join("\n")
  .split("/*DEMO*/").join(readFileSync(p("src/app/demo.js"), "utf8"))
  .split("/*MAPS*/ {}").join(readFileSync(p("assets/maps.json"), "utf8"))
for (const [label, s] of [["engine", engine], ["scenes", presets], ["app", app]]) if (/<\/script/i.test(s)) throw new Error(`a "</script" inside the ${label} would break the page`)

const html = readFileSync(p("src/template.html"), "utf8")
  .split("/*ENGINE*/").join(engine).split("/*PRESETS*/").join(presets).split("/*APP*/").join(ascii(app))
writeFileSync(p("dist/index.html"), html)
for (const f of readdirSync(p("assets/audio"))) copyFileSync(p("assets/audio", f), p("dist", f))
console.log(`dist/index.html  ${(html.length / 1024).toFixed(0)} KB · ${PRESETS.length} scenes (${PRESETS.filter((s) => s.tier === "feature").length} features)`)

if (process.argv.includes("--offline")) {
  const audio = {}
  for (const f of readdirSync(p("assets/audio"))) if (f.endsWith(".mp3")) audio[f] = "data:audio/mpeg;base64," + readFileSync(p("assets/audio", f)).toString("base64")
  const tag = "<script>const OFFLINE_AUDIO = " + JSON.stringify(audio) + "</script>\n"
  const i = html.indexOf('<script type="text/plain" id="engine">')
  const out = html.slice(0, i) + tag + html.slice(i)
  writeFileSync(p("dist/trance-engine-offline.html"), out)
  console.log(`dist/trance-engine-offline.html  ${(out.length / 1048576).toFixed(1)} MB (songs embedded)`)
}

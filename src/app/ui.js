// ---------- Moments: capture the active VM, jump back later ----------
let captureId = 0
const captures = new Map(), moments = []
const capture = () => {
  if (!slots[active].running) return toast("Nothing is running to capture.", true)
  const id = ++captureId, P = pipes[active]
  const snap = document.createElement("canvas")
  snap.width = Math.round(P.buf.width / 2); snap.height = Math.round(P.buf.height / 2)
  snap.getContext("2d").drawImage(P.buf, 0, 0, snap.width, snap.height)
  captures.set(id, { t: slots[active].t, snap, scene: current })
  slots[active].waitingSince = performance.now()
  worker.postMessage({ type: "capture", slot: active, id })
}
const addMoment = (m) => {
  const c = captures.get(m.id); if (!c) return
  captures.delete(m.id)
  const thumb = document.createElement("canvas"); thumb.width = 144; thumb.height = 88
  const tc = thumb.getContext("2d"), k = Math.max(144 / c.snap.width, 88 / c.snap.height)
  tc.drawImage(c.snap, (144 - c.snap.width * k) / 2, (88 - c.snap.height * k) / 2, c.snap.width * k, c.snap.height * k)
  moments.unshift({ ...c, bytes: m.bytes, thumb: thumb.toDataURL("image/jpeg", 0.8) })
  if (moments.length > 8) moments.pop()
  drawMoments()
  toast("Captured " + PRESETS[c.scene].name + ": the whole VM, " + Math.round(m.bytes.length / 1024) + " KB of state.")
}
const drawMoments = () => {
  const box = $("#moments")
  box.classList.toggle("has", moments.length > 0)
  box.querySelectorAll(".moment").forEach((n) => n.remove())
  moments.forEach((mo, i) => {
    const b = document.createElement("button"); b.className = "moment"
    b.setAttribute("aria-label", "Jump back to " + PRESETS[mo.scene].name + " at " + mo.t.toFixed(1) + " seconds")
    const img = document.createElement("img"); img.src = mo.thumb; img.alt = ""
    const s = document.createElement("small"); const bt = document.createElement("b")
    bt.textContent = PRESETS[mo.scene].name; s.append(bt, mo.t.toFixed(1) + " s · " + Math.round(mo.bytes.length / 1024) + " KB")
    b.append(img, s); b.onclick = () => jump(i); box.append(b)
  })
}
const jump = (i) => {
  const mo = moments[i]; if (!mo) return
  cancelTransition(); endFork(); stutter = null
  const st = slots[active]
  st.token = ++tokenSeq; st.next = null; st.ready = false; st.running = true; st.scene = mo.scene; st.t = mo.t; st.waitingSince = performance.now()
  setCurrent(mo.scene); lastCutAt = performance.now(); segBeats = 0; st.phase = -1; st.phases = PRESETS[mo.scene].phases || 1; st.cue = -1
  const P = pipes[active]
  P.ctx.save(); P.ctx.setTransform(1, 0, 0, 1, 0, 0); P.ctx.drawImage(mo.snap, 0, 0, P.buf.width, P.buf.height); P.ctx.restore()
  worker.postMessage({ type: "resume", slot: active, bytes: mo.bytes.slice().buffer, token: st.token })
  $("#err").classList.remove("show"); requestFlash(0.25)
  toast("Back to " + PRESETS[mo.scene].name + " at " + mo.t.toFixed(1) + " s. The VM resumed from its saved bytes.")
}

// ---------- Scenes, editor, controls ----------
// Edits and the on/off list are remembered by scene name, so adding scenes never shuffles them.
const saved = store.get("trance.v4") || {}
let current = 0
const savedCodes = saved.codes && typeof saved.codes === "object" ? saved.codes : {}
const codes = PRESETS.map((p) => (typeof savedCodes[p.name] === "string" ? savedCodes[p.name] : p.code))
const off = new Set(Array.isArray(saved.off) ? saved.off : [])
const enabled = PRESETS.map((p) => !off.has(p.name))
if (saved.auto === false) auto = false
const code = $("#code")
const persist = () => {
  const edited = {}; PRESETS.forEach((p, i) => { if (codes[i] !== p.code) edited[p.name] = codes[i] })
  store.set("trance.v4", { auto, codes: edited, off: PRESETS.filter((_, i) => !enabled[i]).map((p) => p.name) })
}
const byOf = (i) => PRESETS[i].by || "Claude"
const rotation = () => {
  const r = PRESETS.map((_, i) => i).filter((i) => enabled[i])
  return r.length ? r : PRESETS.map((_, i) => i)
}
const step = (dir) => {
  const r = rotation()
  let target
  if (r.includes(current)) target = r[(r.indexOf(current) + dir + r.length) % r.length]
  else if (dir > 0) target = r.find((i) => i > current) ?? r[0]
  else target = [...r].reverse().find((i) => i < current) ?? r[r.length - 1]
  cut(target)
}
const grid = $("#m-grid")
const updateCount = () => {
  const n = enabled.filter(Boolean).length
  $("#m-count").textContent = n + " of " + PRESETS.length + " in rotation" + (n ? "" : " · with none on, all of them cycle")
  $("#rot-count").textContent = n + "/" + PRESETS.length
}
const drawManager = () => {
  grid.textContent = ""
  PRESETS.forEach((p, i) => {
    const card = document.createElement("div")
    card.className = "scard" + (i === current ? " cur" : "") + (enabled[i] ? "" : " off")
    const play = document.createElement("button"); play.className = "play"
    const b = document.createElement("b"); b.textContent = String(i + 1).padStart(2, "0") + " · " + p.name
    const sm = document.createElement("small")
    const marks = bookmarks.get(i) ? Object.keys(bookmarks.get(i)).length : 0
    sm.textContent = (p.tier === "feature" ? "Feature · " + (p.phases || 1) + " phases · " : "Flourish · ") + "by " + byOf(i) + (codes[i] !== p.code ? " · edited" : "") + (marks ? " · " + marks + " bookmarked" : "") + (memory.has(i) ? " · paused mid-scene" : "")
    if (p.tier === "feature") card.classList.add("feat")
    play.append(b, sm); play.onclick = () => cut(i)
    const sw = document.createElement("input"); sw.type = "checkbox"; sw.className = "switch"; sw.checked = enabled[i]
    sw.setAttribute("aria-label", "Include " + p.name + " in rotation")
    sw.onchange = () => { enabled[i] = sw.checked; card.classList.toggle("off", !sw.checked); persist(); updateCount(); replan() }
    card.append(play, sw); grid.append(card)
  })
  updateCount()
}
const setAll = (on) => { enabled.fill(on); persist(); drawManager() }
$("#m-all").onclick = () => setAll(true)
$("#m-none").onclick = () => setAll(false)
const setManager = (open) => {
  $("#manager").hidden = !open; $("#scenes-btn").setAttribute("aria-pressed", String(open))
  if (open) { drawManager(); const cur = grid.children[current]; if (cur) cur.scrollIntoView({ block: "nearest" }) }
}
$("#scenes-btn").onclick = () => setManager($("#manager").hidden)
$("#now").onclick = () => setManager($("#manager").hidden)
$("#m-close").onclick = () => setManager(false)
$("#prev").onclick = () => step(-1)
const setCurrent = (i) => {
  current = i; code.value = codes[i]
  $("#now-num").textContent = String(i + 1).padStart(2, "0"); $("#now-name").textContent = PRESETS[i].name; $("#now-by").textContent = "by " + byOf(i)
  Array.from(grid.children).forEach((c, j) => c.classList.toggle("cur", j === i))
  $("#drawer-title").textContent = PRESETS[i].name + " · " + byOf(i) + (codes[i] !== PRESETS[i].code ? " · edited" : "")
}
const setAuto = (on) => { auto = on; $("#auto").setAttribute("aria-pressed", String(on)); lastCutAt = performance.now(); segBeats = 0; planned = null; persist() }
setAuto(auto)
let saveTimer = 0
code.addEventListener("input", () => {
  codes[current] = code.value
  memory.delete(current)
  $("#drawer-title").textContent = PRESETS[current].name + " · " + byOf(current) + (code.value !== PRESETS[current].code ? " · edited" : "")
  clearTimeout(saveTimer); saveTimer = setTimeout(persist, 400)
})
code.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); runCode(code.value) }
  else if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); code.setRangeText("  ", code.selectionStart, code.selectionEnd, "end"); code.dispatchEvent(new Event("input")) }
  e.stopPropagation()
})
$("#run").onclick = () => runCode(code.value)
$("#reset").onclick = () => { codes[current] = PRESETS[current].code; memory.delete(current); persist(); setCurrent(current); runCode(codes[current]) }
const setDrawer = (open) => {
  $("#drawer").classList.toggle("open", open); $("#edit").setAttribute("aria-pressed", String(open))
  if (open) { code.focus({ preventScroll: true }); if (auto) toast("Auto-cycle waits while the editor is open.") }
  else { lastCutAt = performance.now(); segBeats = 0 }
}
$("#edit").onclick = () => setDrawer(!$("#drawer").classList.contains("open"))
$("#close").onclick = () => setDrawer(false)
const setPaused = (p) => {
  paused = p
  if (!p) { const now = performance.now(); for (const s of Object.values(slots)) { s.waitingSince = now; s.lastFrameAt = 0 } }
  setPlayLabel()
}
const startFrom = (how) => {
  $("#start").hidden = true
  if (how === "song") playSong()
  else if (how === "slow") playTrack(1)
  else if (how === "break") playTrack(2)
  else if (how === "demo") playDemo()
  else if (how === "file") { ensureAC(); setPaused(false); $("#file").click() }
  else { music = "none"; setPaused(false); $("#track-name").textContent = "No music"; introCard("Trance Engine"); startStory() }
}
$("#s-song").onclick = () => startFrom("song")
$("#s-slow").onclick = () => startFrom("slow")
$("#s-break").onclick = () => startFrom("break")
$("#s-demo").onclick = () => startFrom("demo")
$("#s-file").onclick = () => startFrom("file")
$("#s-silent").onclick = () => startFrom("silent")
$("#play").onclick = () => (music === "none" && !$("#start").hidden ? startFrom("song") : togglePlay())
$("#tracks").onchange = (e) => playTrack(+e.target.value)
$("#demo").onclick = playDemo
$("#pick").onclick = () => { ensureAC(); $("#file").click() }
$("#file").onchange = (e) => { playFile(e.target.files[0]); e.target.value = "" }
$("#auto").onclick = () => setAuto(!auto)
$("#next").onclick = () => step(1)
$("#capture").onclick = capture
const fullscreen = () => {
  const el = document.documentElement
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  else if (el.requestFullscreen) el.requestFullscreen().catch(() => toast("Fullscreen isn't allowed in this view.", true))
  else toast("Fullscreen isn't available here.", true)
}
$("#full").onclick = fullscreen

addEventListener("keydown", (e) => {
  wake()
  if (!$("#start").hidden || (e.target.closest && e.target.closest("textarea,input"))) return
  if (e.key === " " && !(e.target.closest && e.target.closest("button"))) { e.preventDefault(); togglePlay() }
  else if (e.key === "c" || e.key === "C") capture()
  else if (e.key === "e" || e.key === "E") setDrawer(!$("#drawer").classList.contains("open"))
  else if (e.key === "n" || e.key === "N" || e.key === "ArrowRight") step(1)
  else if (e.key === "p" || e.key === "P" || e.key === "ArrowLeft") step(-1)
  else if (e.key === "s" || e.key === "S") setManager($("#manager").hidden)
  else if (e.key === "a" || e.key === "A") { setAuto(!auto); toast(auto ? "Auto-cycle on: transitions land on phrase boundaries." : "Auto-cycle off.") }
  else if (e.key === "f" || e.key === "F") fullscreen()
  else if (e.key === "Escape") { setDrawer(false); setManager(false) }
  else if (/^[1-9]$/.test(e.key) && PRESETS[+e.key - 1]) cut(+e.key - 1)
})
const point = (e) => { mx = e.clientX; my = e.clientY }
view.addEventListener("pointermove", point)
view.addEventListener("pointerdown", (e) => { point(e); down = true; view.setPointerCapture(e.pointerId) })
addEventListener("pointerup", () => (down = false))
addEventListener("pointercancel", () => (down = false))

// Hide the controls while the video plays and nobody is touching anything.
let idleTimer = 0
const wake = () => {
  document.body.classList.remove("idle"); clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    if (!paused && $("#start").hidden && !$("#drawer").classList.contains("open") && $("#manager").hidden && !$("#dock").matches(":hover") && !(document.activeElement && $("#dock").contains(document.activeElement) && document.activeElement.matches(":focus-visible"))) document.body.classList.add("idle")
  }, 2800)
}
addEventListener("pointermove", wake); addEventListener("pointerdown", wake); addEventListener("focusin", wake)

// Drag a song anywhere to play it.
let dragDepth = 0
addEventListener("dragenter", (e) => { e.preventDefault(); dragDepth++; $("#drop").classList.add("show") })
addEventListener("dragover", (e) => e.preventDefault())
addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; $("#drop").classList.remove("show") } })
addEventListener("drop", (e) => {
  e.preventDefault(); dragDepth = 0; $("#drop").classList.remove("show")
  const f = e.dataTransfer && e.dataTransfer.files[0]
  if (f) { $("#start").hidden = true; playFile(f) }
})

if (REDUCE) $("#s-note").textContent += " Reduced motion is on, so flashes, shake, glitches, stutters and beat punches are switched off."
updateCount()
setCurrent(0); startScene(active, 0, { fresh: true, entry: 0 }); history.push(0)
setPaused(false)
window.__trance = { A, cut: (i) => cut(i), get current() { return current }, get music() { return music }, get active() { return active },
  get trans() { return trans && { type: TNAMES[trans.type], beats: trans.beats, reason: trans.reason } }, get memory() { return [...memory.keys()] },
  get fork() { return !!forkState }, get phase() { return slots[active].phase + "/" + slots[active].phases + " " + slots[active].title },
  get story() { return { ...story, segBeats } },
  get slots() { return Object.values(slots).map((x) => ({ id: x.id, scene: x.scene, running: x.running, ready: x.ready, frames: x.frames, phase: x.phase, token: x.token, cue: x.cue })) }, get err() { return $("#err").textContent }, get bookmarks() { return [...bookmarks.entries()].map(([i, b]) => PRESETS[i].name + ":" + Object.keys(b).join(",")) }, get stutter() { return !!stutter }, stutterNow: () => startStutter([0, 0.5, 0.75], 1), forkNow: () => startFork(), transNow: (type, beats) => beginTransition(chooseNext(), type, beats, "test"), cueNow: (p) => cue(p), setAuto: (on) => setAuto(on),
  get mapped() { return isMapped() }, get scenes() { return PRESETS.map((p) => p.name) }, freeze: (on) => { directorFrozen = !!on }, get shot() { return shotIdx }, get mapT() { return mc.t }, get rewind() { return rewind },
  get plan() { return songMap && songMap.plan && songMap.plan.shots.map((s) => ({ t0: +s.t0.toFixed(2), scene: PRESETS[s.scene].name, entry: s.entry, kind: s.kind, type: TNAMES[s.type], bars: s.bars, cues: s.cues.length })) },
  get events() { return songMap && songMap.plan && songMap.plan.events },
  get keyframes() { return [...kfs.entries()].map(([k, l]) => k + ":" + l.map((x) => x.songT.toFixed(1)).join(",")) }, get kfBytes() { return kfBytes } }

// Desktop app: where the Claude desktop app can install this page as an app of its own, offer it.
;(async () => {
  for (let k = 0; k < 30 && !(window.claude && window.claude.use); k++) await new Promise((r) => setTimeout(r, 100))
  try {
    if (!window.claude || !window.claude.use) return
    const desktop = await window.claude.use("desktop")
    if (!desktop || !desktop.install) return
    if ((await desktop.install.state()) !== "available") return
    for (const b of document.querySelectorAll(".install")) {
      b.hidden = false
      b.onclick = () => desktop.install.request().then(() => toast("Installing Trance Engine as an app…"), () => toast("The app couldn't be installed from here.", true))
    }
  } catch (e) { /* not installable in this view */ }
})()

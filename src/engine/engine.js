// Runs inside a Web Worker. Two Psychoscript VMs ("slots") can run scenes at the same time,
// which is what makes overlapping transitions and forks possible. Each scene's only way out of
// its VM is the host function frame(shapes, fx).
//
// Psychoscript-specific operations used by the page:
//   park      suspend a scene to bytes so it can later resume exactly where it left off (scene memory)
//   beatsnap  snapshot the running scene on every beat into a small ring
//   stutter   rewind the running scene to a ring snapshot (beat-repeat edits)
//   fork      clone a running scene into the other slot mid-flight
//   bookmark  snapshot a scene as it enters a phase, so it can later start from that phase
//   capture   save a moment the viewer can jump back to
//   catchup   after a seek, a restored scene runs ahead at full speed (frames answered without drawing)
//             so its state matches the song position exactly
import "./polyfill.js"
import { Host, Runtime, toBytes, fromBytes } from "psychoscript"

const RING = 6

const makeSlot = (id) => {
  const slot = { id, program: null, controller: null, pending: null, gen: 0, token: 0, lastResolve: 0,
    suspending: false, ring: [], hold: false, queue: Promise.resolve() }
  slot.runtime = Runtime.make({
    globals: () => ({
      frame: Host.fn(
        ([shapes, fx], call) =>
          new Promise((resolve) => {
            // Catch-up after a seek: answer frames at once (no drawing) until the scene reaches the song position.
            const c = slot.catchup
            if (c && c.n > 0) {
              c.n--; c.view.t += c.view.dt; c.view.frame++
              if (c.n === 0) { slot.catchup = null; postMessage({ type: "caughtUp", slot: id, token: slot.token }) }
              resolve({ ...c.view }); return
            }
            const vm = slot.lastResolve ? performance.now() - slot.lastResolve : 0
            postMessage({ type: "frame", slot: id, token: slot.token, shapes: Array.isArray(shapes) ? shapes : [],
              fx: fx && typeof fx === "object" ? fx : null, vm })
            const entry = { resolve }
            slot.pending = entry
            call.signal.addEventListener("abort", () => { if (slot.pending === entry) slot.pending = null })
          }),
        { type: "async", idempotent: true },
      ),
    }),
  })
  return slot
}
const slots = { a: makeSlot("a"), b: makeSlot("b") }

const describe = (error) => {
  if (!error) return "Unknown error"
  return (error.kind ? error.kind + ": " : "") + (error.message || String(error))
}

const start = (slot, program, token) => {
  if (token !== slot.token) slot.hold = false
  const mine = ++slot.gen
  slot.token = token
  slot.controller = new AbortController()
  slot.program = program
  slot.lastResolve = 0
  program.run({ signal: slot.controller.signal }).then(
    (result) => {
      if (mine !== slot.gen || slot.suspending) return
      slot.program = null
      if (result && result.ok === false) postMessage({ type: "error", slot: slot.id, token, message: describe(result.error) })
      else postMessage({ type: "ended", slot: slot.id, token })
    },
    (error) => {
      if (mine !== slot.gen || slot.suspending || (error && error.name === "AbortError")) return
      postMessage({ type: "error", slot: slot.id, token, message: describe(error) })
    },
  )
}

const stop = (slot) => {
  slot.gen++
  slot.pending = null
  if (slot.controller) slot.controller.abort("replaced")
  slot.controller = null
  slot.program = null
}

// Suspend the running program and return its bytes. With keepRunning it resumes immediately,
// so the scene never notices it was frozen.
const freeze = async (slot, keepRunning) => {
  const program = slot.program
  if (!program) return null
  slot.suspending = true
  try {
    const outcome = await program.suspend()
    if (!outcome || !outcome.state) return null
    const bytes = toBytes(outcome.state)
    if (keepRunning) start(slot, slot.runtime.resume(fromBytes(bytes)), slot.token)
    else stop(slot)
    return bytes
  } finally {
    slot.suspending = false
  }
}

// Operations that suspend or replace a program run one at a time per slot.
const queue = (slot, op) => {
  slot.queue = slot.queue.then(op).catch((error) => postMessage({ type: "error", slot: slot.id, token: slot.token, message: describe(error) }))
}

self.onmessage = (event) => {
  const m = event.data
  const slot = slots[m.slot]
  if (!slot) return
  if (m.type === "tick") {
    if (slot.token === m.token && slot.pending) {
      const p = slot.pending
      slot.pending = null
      slot.lastResolve = performance.now()
      p.resolve(m.view)
    }
    return
  }
  if (m.type === "hold") { slot.hold = !!m.on; return }
  if (m.type === "stop") { stop(slot); slot.ring = []; return }
  queue(slot, async () => {
    if (m.type === "run") {
      stop(slot); slot.ring = []
      slot.catchup = m.catchup && m.catchup.n > 0 ? { n: Math.min(600, m.catchup.n | 0), view: { ...m.catchup.view } } : null
      try { start(slot, slot.runtime.program(String(m.code)), m.token) }
      catch (error) { postMessage({ type: "error", slot: slot.id, token: m.token, message: describe(error) }) }
    } else if (m.type === "resume") {
      stop(slot); slot.ring = []
      slot.catchup = m.catchup && m.catchup.n > 0 ? { n: Math.min(600, m.catchup.n | 0), view: { ...m.catchup.view } } : null
      start(slot, slot.runtime.resume(fromBytes(new Uint8Array(m.bytes))), m.token)
    } else if (m.type === "park") {
      const bytes = await freeze(slot, false)
      slot.ring = []
      if (bytes) { const copy = bytes.slice(); postMessage({ type: "parked", key: m.key, bytes: copy }, [copy.buffer]) }
    } else if (m.type === "beatsnap") {
      if (slot.hold || !slot.program || slot.token !== m.token) return
      const bytes = await freeze(slot, true)
      if (bytes) { slot.ring.push(bytes); if (slot.ring.length > RING) slot.ring.shift() }
    } else if (m.type === "stutter") {
      if (slot.token !== m.token) return
      const bytes = slot.ring[slot.ring.length - 1 - (m.back | 0)]
      if (!bytes) return
      stop(slot)
      start(slot, slot.runtime.resume(fromBytes(bytes)), m.token)
      postMessage({ type: "stuttered", slot: slot.id, token: m.token })
    } else if (m.type === "fork") {
      const target = slots[m.to]
      if (!target || slot.token !== m.token) return
      const bytes = await freeze(slot, true)
      if (!bytes) return
      stop(target); target.ring = []
      start(target, target.runtime.resume(fromBytes(bytes)), m.forkToken)
      postMessage({ type: "forked", slot: target.id, token: m.forkToken })
    } else if (m.type === "bookmark") {
      // Phase bookmark: snapshot the scene as it enters a phase so the director can start it there later.
      if (slot.token !== m.token || !slot.program) return
      const bytes = await freeze(slot, true)
      if (bytes) { const copy = bytes.slice(); postMessage({ type: "bookmarked", key: m.key, bytes: copy }, [copy.buffer]) }
    } else if (m.type === "capture") {
      const bytes = await freeze(slot, true)
      if (!bytes) return postMessage({ type: "captureFailed", id: m.id, message: "Nothing is running to capture." })
      const copy = bytes.slice()
      postMessage({ type: "captured", id: m.id, bytes: copy }, [copy.buffer])
    }
  })
}

postMessage({ type: "ready" })

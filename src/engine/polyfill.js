// Browsers lack setImmediate, which the engine uses to yield between steps.
if (typeof globalThis.setImmediate !== "function") {
  const queue = new Map()
  let nextId = 1
  const channel = new MessageChannel()
  channel.port1.onmessage = (event) => {
    const task = queue.get(event.data)
    if (!task) return
    queue.delete(event.data)
    task.fn(...task.args)
  }
  globalThis.setImmediate = (fn, ...args) => {
    const id = nextId++
    queue.set(id, { fn, args })
    channel.port2.postMessage(id)
    return id
  }
  globalThis.clearImmediate = (id) => {
    queue.delete(id)
  }
}

// crypto.randomUUID only exists in secure contexts; the engine uses it for run ids.
if (globalThis.crypto && typeof globalThis.crypto.randomUUID !== "function") {
  globalThis.crypto.randomUUID = () => {
    const b = globalThis.crypto.getRandomValues(new Uint8Array(16))
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20)
  }
}

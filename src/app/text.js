// ---------- Kinetic text: per-letter effects driven by the music ----------
// Scenes draw it with { k: "w", text, x, y, size, fx, t, font, align, h, s, l, a, hs, seed, speed };
// the director uses the same effects for title, chapter and end cards.
const FONTS = { display: "Shrikhand, Georgia, serif", mono: "'JetBrains Mono', ui-monospace, monospace", sans: "Inter, system-ui, sans-serif" }
const TEXT_FX = ["type", "scramble", "wave", "punch", "split", "glitch", "stack", "orbit", "flap", "neon", "rise", "flip"]
const SCRAMBLE = "◇○△▽✦+×#%&@*/<>=ΣΨΔΩ01".split("")
const widthCache = new Map()
const glyphW = (ctx, ch, font, size) => {
  const key = font + "|" + size + "|" + ch
  let w = widthCache.get(key)
  if (w === undefined) { ctx.font = size + "px " + font; w = ctx.measureText(ch).width; if (widthCache.size > 6000) widthCache.clear(); widthCache.set(key, w) }
  return w
}
const rnd = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x) }
const drawKinetic = (ctx, o, A) => {
  const chars = Array.from(String(o.text == null ? "" : o.text).slice(0, 140))
  if (!chars.length) return
  const font = FONTS[o.font] || FONTS.display
  const size = Math.round(clamp(num(o.size, 48), 6, 400))
  const t = Math.max(0, num(o.t, 0)), seed = num(o.seed, 1), fx = TEXT_FX.includes(o.fx) ? o.fx : "rise"
  const H = num(o.h, 40), Sat = clamp(num(o.s, 85), 0, 100), L = clamp(num(o.l, 65), 0, 100), Al = clamp(num(o.a, 1), 0, 1), hs = num(o.hs, 0)
  const ws = chars.map((ch) => glyphW(ctx, ch, font, size))
  const total = ws.reduce((a, b) => a + b, 0)
  const x = num(o.x, 0), y = num(o.y, 0)
  let cx = o.align === "left" ? x : o.align === "right" ? x - total : x - total / 2
  const n = chars.length, mid = (n - 1) / 2
  ctx.save()
  ctx.font = size + "px " + font; ctx.textBaseline = "middle"; ctx.textAlign = "center"
  const col = (dh, dl, a) => "hsla(" + (H + dh) + "," + Sat + "%," + clamp(L + dl, 0, 100) + "%," + clamp(a, 0, 1) + ")"
  const put = (ch, px, py, sx, sy, rot, alpha, dh, dl, stroke) => {
    if (alpha <= 0.01 || !ch.trim()) return
    ctx.save(); ctx.translate(px, py); if (rot) ctx.rotate(rot); if (sx !== 1 || sy !== 1) ctx.scale(sx || 0.001, sy || 0.001)
    if (stroke) { ctx.lineWidth = Math.max(1, size * 0.045); ctx.strokeStyle = col(dh, dl, alpha); ctx.strokeText(ch, 0, 0) }
    else { ctx.fillStyle = col(dh, dl, alpha); ctx.fillText(ch, 0, 0) }
    ctx.restore()
  }
  if (fx === "orbit") {
    const R = Math.max(size, total / Math.PI / 2 * 1.15)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t * 0.7 + (A.beats || 0) * 0.08
      put(chars[i], x + Math.cos(a) * R, y + Math.sin(a) * R, 1 + A.kick * 0.2, 1 + A.kick * 0.2, a + Math.PI / 2, Al, i * hs, A.hat * 15, false)
    }
    ctx.restore(); return
  }
  for (let i = 0; i < n; i++) {
    let ch = chars[i], w = ws[i], px = cx + w / 2, py = y, sx = 1, sy = 1, rot = 0, alpha = Al, dh = i * hs, dl = 0, stroke = false
    if (fx === "type") {
      const shown = Math.floor(t * num(o.speed, 16))
      if (i >= shown) { if (i === shown && Math.floor(t * 3) % 2 === 0) put("▌", px, py, 1, 1, 0, Al, 0, 10, false); cx += w; continue }
      if (i === shown - 1) dl = 20
    } else if (fx === "scramble") {
      const settle = 0.2 + i * 0.045
      if (t < settle || (A.snare > 0.45 && rnd(i, A.snares + seed) < A.snare * 0.5)) { ch = SCRAMBLE[Math.floor(rnd(i + seed, Math.floor(t * 18)) * SCRAMBLE.length)]; dh += 160; dl = 10 }
    } else if (fx === "wave") {
      py += Math.sin(i * 0.55 - t * 5 + A.phase * Math.PI * 2) * size * 0.16 * (0.4 + A.bass)
      sx = sy = 1 + A.kick * 0.12
    } else if (fx === "punch") {
      sx = sy = 1 + A.kick * 0.32
      px += (i - mid) * A.kick * size * 0.14
    } else if (fx === "split") {
      const p = smooth01((t - i * 0.025) / 0.55)
      const burst = A.dropAmt || 0
      const ox = (rnd(i, seed) * 2 - 1) * size * 5, oy = (rnd(seed, i) * 2 - 1) * size * 3
      px += ox * (1 - p) + ox * burst * 0.6; py += oy * (1 - p) + oy * burst * 0.6
      rot = (1 - p) * (rnd(i, 7) - 0.5) * 4; alpha *= p
    } else if (fx === "glitch") {
      const off = (A.snare * 0.12 + 0.02) * size
      const jy = A.hat > 0.4 && rnd(i, A.hats) > 0.6 ? (rnd(A.hats, i) - 0.5) * size * 0.3 : 0
      put(ch, px - off, py + jy, 1, 1, 0, Al * 0.55, 120, 0, false)
      put(ch, px + off, py + jy, 1, 1, 0, Al * 0.55, 240, 0, false)
      py += jy
    } else if (fx === "stack") {
      const copies = 1 + (A.bar || 0)
      for (let k = copies; k >= 1; k--) put(ch, px, py - k * size * 0.82, 1, 1, 0, Al * 0.45 / k, k * 25, -10, true)
    } else if (fx === "flap") {
      const land = 0.12 + i * 0.06
      if (t < land) { ch = String.fromCharCode(65 + Math.floor(rnd(i, Math.floor(t * 24)) * 26)); sy = Math.abs(Math.cos(t * 26 + i)); dl = -10 }
    } else if (fx === "neon") {
      stroke = true
      const flick = rnd(i + seed, Math.floor(t * 12))
      alpha *= flick < 0.06 + A.hat * 0.1 ? 0.25 : 0.9 + A.kick * 0.1
      dl = A.kick * 15
    } else if (fx === "rise") {
      const p = smooth01((t - i * 0.05) / 0.45)
      py += (1 - p) * size * 0.9 - (i === (A.beats || 0) % n ? A.kick * size * 0.18 : 0)
      alpha *= p
    } else if (fx === "flip") {
      const group = ((i + (A.beats || 0)) % 3) === 0
      sx = group ? Math.cos(Math.min(1, A.phase * 2.2) * Math.PI) : 1
      if (sx < 0) { sx = -sx; dh += 180 }
    }
    put(ch, px, py, sx, sy, rot, alpha, dh, dl, stroke)
    cx += w
  }
  ctx.restore()
}

// ---------- Overlay cards: titles, chapters and the end card, drawn crisp above the scene ----------
const ovl = $("#ovl"), octx = ovl.getContext("2d")
const cards = []
const sizeOverlay = () => { ovl.width = Math.round(W * S); ovl.height = Math.round(H * S) }
sizeOverlay(); addEventListener("resize", sizeOverlay)
// card: { text, fx, font, size (fraction of min side), x, y (fractions), h, l, dur, hold, sub, subFx }
const showCard = (c) => {
  const now = performance.now()
  for (const k of cards) if (k.slot === c.slot) k.end = Math.min(k.end, now + 250)
  cards.push({ ...c, start: now, end: now + (c.dur || 3200) })
}
const drawCards = (now) => {
  octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, ovl.width, ovl.height)
  if (!cards.length) return
  octx.setTransform(S, 0, 0, S, 0, 0)
  const m = Math.min(W, H)
  for (let i = cards.length - 1; i >= 0; i--) {
    const c = cards[i]
    if (now > c.end) { cards.splice(i, 1); continue }
    const t = (now - c.start) / 1000, out = clamp((c.end - now) / 400, 0, 1)
    octx.shadowColor = "rgba(0,0,0,.75)"; octx.shadowBlur = 18
    drawKinetic(octx, { text: c.text, x: W * (c.x ?? 0.5), y: barPx + (H - 2 * barPx) * (c.y ?? 0.5), size: m * (c.size || 0.09), fx: c.fx, font: c.font, t, h: c.h ?? 30, s: c.s ?? 70, l: c.l ?? 80, a: out, hs: c.hs || 0, align: c.align }, A)
    if (c.sub) drawKinetic(octx, { text: c.sub, x: W * (c.x ?? 0.5), y: barPx + (H - 2 * barPx) * (c.y ?? 0.5) + m * (c.size || 0.09) * 0.95, size: m * (c.size || 0.09) * 0.3, fx: c.subFx || "type", font: "mono", t: Math.max(0, t - 0.4), h: c.h ?? 30, s: 30, l: 85, a: out * 0.9, align: c.align, speed: 30 }, A)
    octx.shadowBlur = 0
  }
}

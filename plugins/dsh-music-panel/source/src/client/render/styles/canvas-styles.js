/**
 * 画布类样式 — 莫奈（monet）：泼墨般的晕染。
 *
 * Runs in plain canvas 2D: no pixi in the bundle, the same renderer protocol as
 * `CanvasLyricStage`. 时计（pendolo）is no longer a sketch here; it is the verbatim
 * Folia renderer in `src/folia/` (see `src/render/styles/folia-pendolo.js`).
 */

function mpCanvasLineText(line) {
  return line && typeof line.text === 'string' ? line.text : ''
}

mpRegisterStyle({
  id: 'monet',
  labelKey: 'sheet.styleMonet',
  glyph: 'disc',
  kind: 'canvas',
  create: function () {
    var blobs = []
    return {
      draw: function (ctx, state) {
        var w = state.width
        var h = state.height
        ctx.clearRect(0, 0, w, h)
        var active = state.active
        var line = active >= 0 ? mpCanvasLineText(state.lines[active]) : ''
        // Wash: soft pigment blooms that drift with time.
        blobs.length = 0
        var count = 7
        for (var index = 0; index < count; index += 1) {
          var phase = state.time * 0.12 + index * 1.7
          blobs.push({
            x: (0.5 + Math.sin(phase) * 0.36) * w,
            y: (0.5 + Math.cos(phase * 0.8) * 0.28) * h,
            r: (0.12 + (index % 3) * 0.06) * Math.min(w, h),
          })
        }
        ctx.globalCompositeOperation = 'lighter'
        for (var b = 0; b < blobs.length; b += 1) {
          var blob = blobs[b]
          var gradient = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r)
          gradient.addColorStop(0, hexToRgba(state.accent || '#f2607a', 0.16))
          gradient.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalCompositeOperation = 'source-over'
        // Lyrics: the active line, characters spaced like brush strokes.
        drawCanvasText(ctx, state, line)
      },
    }
  },
})

/** A plain, readable line for canvas styles that keep text (monet). */
function drawCanvasText(ctx, state, line) {
  var chars = Array.from(line || '')
  if (chars.length === 0) return
  var w = state.width
  var h = state.height
  var fontSize = Math.max(16, Math.min(44, (w / Math.max(1, chars.length)) * 0.85))
  ctx.font = '600 ' + String(fontSize) + 'px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,255,255,.92)'
  ctx.fillText(line, w / 2, h / 2)
}

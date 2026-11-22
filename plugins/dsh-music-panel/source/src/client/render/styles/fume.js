/**
 * 浮名 (fume) — a canvas "wall of text" with a camera, the way Folia's `fume`
 * style works:
 *
 *   - the whole lyric is laid out as an article: one oversized line after another
 *   - the active line is larger than the viewport on purpose, so its edges run off
 *     screen; the lines above and below stay visible, faded, as context
 *   - a camera pans vertically to the active line, stepped or smoothed, and the
 *     active line is scaled to overflow the width
 *   - printer's crop marks frame the page (Folia's 印刷裁切符号)
 *
 * It is a `kind: 'canvas'` renderer: the page hands it a 2D context and a clock.
 */

mpRegisterStyle({
  id: 'fume',
  labelKey: 'sheet.styleFume',
  glyph: 'lyrics',
  kind: 'canvas',
  create: function () {
    var cache = { key: '', rows: [], font: '' }
    var camera = 0
    var started = false

    function layout(ctx, state) {
      var width = state.width
      var height = state.height
      var lines = Array.isArray(state.lines) ? state.lines : []
      var active = Number(state.active)
      var font = '700 ' + String(Math.round(Math.min(width * 0.19, height * 0.26))) + 'px system-ui, -apple-system, "Segoe UI", sans-serif'
      ctx.font = font
      var rows = []
      var y = height * 0.5
      for (var index = 0; index < lines.length; index += 1) {
        var text = typeof lines[index].text === 'string' ? lines[index].text : ''
        var isActive = index === active
        var size = isActive ? 1 : 0.42
        var gap = (isActive ? 0.62 : 0.34) * height * 0.18
        if (index > 0) y += gap
        var translation = lines[index].translation || ''
        rows.push({ text: text, translation: translation, y: y, size: size, index: index })
        y += Math.round(Number(font.split(' ')[1].replace('px', '')) * size)
      }
      cache = { key: String(active) + ':' + width + 'x' + height + ':' + lines.length, rows: rows, font: font }
    }

    return {
      draw: function (ctx, state) {
        var width = state.width
        var height = state.height
        var lines = Array.isArray(state.lines) ? state.lines : []
        var active = Number(state.active)
        var key = String(active) + ':' + width + 'x' + height + ':' + lines.length
        ctx.clearRect(0, 0, width, height)
        if (cache.key !== key) layout(ctx, state)
        ctx.font = cache.font
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        // The camera looks at the active line; the first frame snaps, later it eases.
        var activeRow = null
        for (var row = 0; row < cache.rows.length; row += 1) {
          if (cache.rows[row].index === active) activeRow = cache.rows[row]
        }
        var target = activeRow === null ? height * 0.5 : height * 0.5 - activeRow.y
        camera = started ? camera + (target - camera) * 0.12 : target
        started = true

        for (var index = 0; index < cache.rows.length; index += 1) {
          var item = cache.rows[index]
          var y = item.y + camera
          if (y < -height * 0.4 || y > height * 1.4) continue
          var distance = Math.abs(y - height * 0.5) / height
          var alpha = item.index === active ? 1 : Math.max(0.06, 0.34 - distance * 0.3)
          var size = Math.round(Math.min(width * 0.19, height * 0.26) * item.size)
          ctx.font = '700 ' + String(size) + 'px system-ui, -apple-system, "Segoe UI", sans-serif'
          ctx.fillStyle = 'rgba(255,255,255,' + String(alpha) + ')'
          ctx.fillText(item.text, width / 2, y)
          if (item.index === active && item.translation !== '') {
            var small = Math.round(size * 0.3)
            ctx.font = '500 ' + String(small) + 'px system-ui, -apple-system, "Segoe UI", sans-serif'
            ctx.fillStyle = 'rgba(255,255,255,.62)'
            ctx.fillText(item.translation, width / 2, y + size * 0.62)
          }
        }

        // Printer's crop marks, Folia's 印刷裁切符号.
        var mark = Math.max(12, Math.round(Math.min(width, height) * 0.035))
        ctx.strokeStyle = 'rgba(255,255,255,.28)'
        ctx.lineWidth = 1
        var inset = Math.round(mark * 0.8)
        ;[
          [inset, inset, 1, 1],
          [width - inset, inset, -1, 1],
          [inset, height - inset, 1, -1],
          [width - inset, height - inset, -1, -1],
        ].forEach(function (corner) {
          ctx.beginPath()
          ctx.moveTo(corner[0], corner[1] + mark * corner[3])
          ctx.lineTo(corner[0], corner[1])
          ctx.lineTo(corner[0] + mark * corner[2], corner[1])
          ctx.stroke()
        })
      },
      destroy: function () {
        cache = { key: '', rows: [], font: '' }
        started = false
        camera = 0
      },
    }
  },
})

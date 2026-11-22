/**
 * 动效画布 — one canvas renderer behind the registry's animated modes, the way
 * Folia keeps a renderer per entry rather than an `if` chain in the panel.
 *
 * Modes: aurora (drifting colour blobs), stars (drifting points), rain (streaks),
 * wave (sine ribbons). Colours come from the active accent, so themes repaint it.
 */

function FxCanvas(props) {
  var canvasRef = useRef(null)
  var mode = typeof props.mode === 'string' ? props.mode : 'aurora'
  var accent = typeof props.accent === 'string' ? props.accent : '#f2607a'
  var dim = props.dim === true

  useEffect(
    function () {
      var canvas = canvasRef.current
      if (!canvas || typeof window === 'undefined') return undefined
      var ctx = canvas.getContext('2d')
      if (!ctx) return undefined
      var raf = 0
      var stopped = false
      var width = 0
      var height = 0
      var dpr = Math.min(2, window.devicePixelRatio || 1)
      var seed = 0.5
      var points = []

      function resize() {
        var box = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : { width: 0, height: 0 }
        width = Math.max(1, Math.round(box.width))
        height = Math.max(1, Math.round(box.height))
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
        canvas.style.width = width + 'px'
        canvas.style.height = height + 'px'
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        seed = width > 0 ? (height * 0.37) % 1 : 0.5
        points = []
        var count = mode === 'stars' ? Math.round((width * height) / 5200) : mode === 'rain' ? 90 : 0
        for (var index = 0; index < count; index += 1) {
          points.push({
            x: (seed + index * 0.6180339887) % 1,
            y: (seed * 3.7 + index * 0.4142135623) % 1,
            r: ((seed * 13 + index * 0.317) % 1) * 1.6 + 0.4,
            v: ((seed * 7 + index * 0.173) % 1) * 0.6 + 0.2,
          })
        }
      }

      function draw(time) {
        if (stopped) return
        var t = time / 1000
        if (mode === 'aurora') {
          ctx.globalCompositeOperation = 'source-over'
          ctx.fillStyle = dim ? '#0d0d10' : '#101014'
          ctx.fillRect(0, 0, width, height)
          var blobs = [
            { x: 0.28 + Math.sin(t * 0.13) * 0.12, y: 0.3 + Math.cos(t * 0.11) * 0.1, r: 0.55 },
            { x: 0.72 + Math.cos(t * 0.09) * 0.12, y: 0.42 + Math.sin(t * 0.15) * 0.12, r: 0.48 },
            { x: 0.5 + Math.sin(t * 0.07 + 2) * 0.18, y: 0.7 + Math.cos(t * 0.08) * 0.1, r: 0.6 },
          ]
          ctx.globalCompositeOperation = 'lighter'
          for (var index = 0; index < blobs.length; index += 1) {
            var blob = blobs[index]
            var radius = blob.r * Math.min(width, height)
            var gradient = ctx.createRadialGradient(
              blob.x * width,
              blob.y * height,
              0,
              blob.x * width,
              blob.y * height,
              radius,
            )
            gradient.addColorStop(0, hexToRgba(accent, 0.28 - index * 0.05))
            gradient.addColorStop(1, 'rgba(0,0,0,0)')
            ctx.fillStyle = gradient
            ctx.beginPath()
            ctx.arc(blob.x * width, blob.y * height, radius, 0, Math.PI * 2)
            ctx.fill()
          }
        } else if (mode === 'stars') {
          ctx.fillStyle = dim ? '#0b0b0e' : '#101014'
          ctx.fillRect(0, 0, width, height)
          ctx.fillStyle = hexToRgba(accent, 0.75)
          for (var s = 0; s < points.length; s += 1) {
            var point = points[s]
            var x = ((point.x + t * point.v * 0.02) % 1) * width
            var y = point.y * height
            var twinkle = 0.55 + 0.45 * Math.sin(t * 2 + s)
            ctx.globalAlpha = twinkle
            ctx.beginPath()
            ctx.arc(x, y, point.r, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.globalAlpha = 1
        } else if (mode === 'rain') {
          ctx.clearRect(0, 0, width, height)
          ctx.strokeStyle = hexToRgba(accent, 0.35)
          ctx.lineWidth = 1
          for (var r = 0; r < points.length; r += 1) {
            var drop = points[r]
            var dx = ((drop.x + t * drop.v * 0.035) % 1) * width
            var dy = ((drop.y + t * drop.v * 0.42) % 1) * height
            ctx.beginPath()
            ctx.moveTo(dx, dy)
            ctx.lineTo(dx - 2, dy + 14 + drop.v * 10)
            ctx.stroke()
          }
        } else if (mode === 'wave') {
          ctx.clearRect(0, 0, width, height)
          for (var w = 0; w < 3; w += 1) {
            ctx.beginPath()
            ctx.strokeStyle = hexToRgba(accent, 0.22 - w * 0.05)
            ctx.lineWidth = 2
            for (var x = 0; x <= width; x += 6) {
              var y = height * (0.55 + w * 0.08) + Math.sin(x / 140 + t * (0.8 + w * 0.2)) * (18 + w * 8)
              if (x === 0) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            }
            ctx.stroke()
          }
        }
        raf = window.requestAnimationFrame(draw)
      }

      resize()
      raf = window.requestAnimationFrame(draw)
      var observer = null
      if (typeof ResizeObserver === 'function' && canvas.parentElement) {
        observer = new ResizeObserver(function () {
          resize()
        })
        observer.observe(canvas.parentElement)
      }
      return function () {
        stopped = true
        if (raf) window.cancelAnimationFrame(raf)
        if (observer !== null) observer.disconnect()
      }
    },
    [mode, accent, dim],
  )

  return h('canvas', {
    ref: canvasRef,
    'aria-hidden': 'true',
    style: { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' },
  })
}

/** `#rrggbb` or an hsl() string to rgba(); anything unknown falls back to white. */
function hexToRgba(color, alpha) {
  var text = String(color || '').trim()
  var match = text.match(/^#([0-9a-f]{6})$/i)
  if (match !== null) {
    var value = parseInt(match[1], 16)
    return (
      'rgba(' + ((value >> 16) & 255) + ',' + ((value >> 8) & 255) + ',' + (value & 255) + ',' + String(alpha) + ')'
    )
  }
  var hsl = text.match(/^hsl\(\s*([\d.]+)\s*,?\s*([\d.]+)%\s*,?\s*([\d.]+)%\s*\)$/i)
  if (hsl !== null) {
    return 'hsla(' + hsl[1] + ',' + hsl[2] + '%,' + hsl[3] + '%,' + String(alpha) + ')'
  }
  return 'rgba(255,255,255,' + String(alpha) + ')'
}

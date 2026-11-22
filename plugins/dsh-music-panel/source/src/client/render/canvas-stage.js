/**
 * 画布歌词舞台 — renderers that need to draw themselves get a canvas and a clock.
 *
 * Protocol (the same shape Folia's renderers have, minus pixi):
 *   { id, kind: 'canvas', create(): { draw(ctx, state), destroy?() } }
 * `state` carries { width, height, dpr, active, lines, now, accent, time }.
 * A canvas style that throws falls back to `classic`, so a broken effect never
 * leaves the player without lyrics.
 *
 * Lifecycle: the renderer is created once per style. The frame loop reads the latest
 * props from a ref, so a new lyric line, a new accent or a seek never tears the scene
 * down — that was the bug that made every effect restart on every line.
 */

function CanvasLyricStage(props) {
  var canvasRef = useRef(null)
  var liveRef = useRef(props)
  liveRef.current = props

  useEffect(
    function () {
      var canvas = canvasRef.current
      var entry = mpStyleOf(props.styleId)
      if (!canvas || typeof window === 'undefined' || entry === null || typeof entry.create !== 'function') {
        return undefined
      }
      var ctx = canvas.getContext('2d')
      if (!ctx) return undefined
      var renderer = null
      try {
        renderer = entry.create()
      } catch (error) {
        return undefined
      }
      var stopped = false
      var raf = 0
      var width = 0
      var height = 0
      var dpr = Math.min(2, window.devicePixelRatio || 1)
      var resize = function () {
        var box = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : { width: 0, height: 0 }
        width = Math.max(1, Math.round(box.width))
        height = Math.max(1, Math.round(box.height))
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
        canvas.style.width = width + 'px'
        canvas.style.height = height + 'px'
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      resize()
      var observer = null
      if (typeof ResizeObserver === 'function' && canvas.parentElement) {
        observer = new ResizeObserver(resize)
        observer.observe(canvas.parentElement)
      }
      var startedAt = Date.now()
      var frame = function () {
        if (stopped) return
        var current = liveRef.current
        try {
          renderer.draw(ctx, {
            width: width,
            height: height,
            dpr: dpr,
            lines: Array.isArray(current.lines) ? current.lines : [],
            active: Number(current.active),
            now: Number(current.now) || 0,
            accent: typeof current.accent === 'string' ? current.accent : '',
            time: (Date.now() - startedAt) / 1000,
          })
        } catch (error) {
          stopped = true
          return
        }
        raf = window.requestAnimationFrame(frame)
      }
      raf = window.requestAnimationFrame(frame)
      return function () {
        stopped = true
        if (raf) window.cancelAnimationFrame(raf)
        if (observer !== null) observer.disconnect()
        if (renderer && typeof renderer.destroy === 'function') renderer.destroy()
      }
    },
    [props.styleId],
  )

  // The canvas fills the lyric stage's own box, not the whole page: the wrapper is
  // the positioning context.
  return h(
    'div',
    { className: 'mp-np-canvas-wrap', style: { position: 'relative', flex: '1 1 auto', minHeight: '0', width: '100%' } },
    h('canvas', {
      ref: canvasRef,
      className: 'mp-np-canvas-lyrics',
      'aria-hidden': 'true',
      style: { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' },
    }),
  )
}

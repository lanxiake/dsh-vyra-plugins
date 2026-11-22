/**
 * 像素舞台 — pixi renderers get a real pixi Application on their own canvas.
 *
 * Protocol for `kind: 'pixi'` entries:
 *   { create(app, options): { draw(state), destroy?() } }
 * The stage owns the Application (init/destroy, resize, ticker); the style only
 * builds its scene graph and updates it per frame. Without pixi the entry is never
 * reached: `LyricStage` falls back to `classic` first.
 *
 * Lifecycle: one Application per style, for as long as the style is on screen. Props
 * are read from a ref every ticker frame, so a line change does not rebuild the app
 * (Pixi init costs tens of milliseconds and resets every particle).
 */

function PixiLyricStage(props) {
  var hostRef = useRef(null)
  var liveRef = useRef(props)
  liveRef.current = props

  useEffect(
    function () {
      var host = hostRef.current
      var entry = mpStyleOf(props.styleId)
      if (!host || MP_PIXI === null || entry === null || typeof entry.create !== 'function') return undefined
      var app = null
      var scene = null
      var destroyed = false
      var width = 1
      var height = 1

      function measure() {
        var box = host.getBoundingClientRect()
        width = Math.max(1, Math.round(box.width))
        height = Math.max(1, Math.round(box.height))
      }
      measure()

      var canvas = document.createElement('canvas')
      canvas.className = 'mp-np-pixi-canvas'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.style.display = 'block'
      host.appendChild(canvas)

      app = new MP_PIXI.Application()
      app
        .init({
          canvas: canvas,
          width: width,
          height: height,
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(2, window.devicePixelRatio || 1),
          autoDensity: true,
        })
        .then(function () {
          if (destroyed) {
            try {
              app.destroy(true, { children: true })
            } catch (error) {}
            return
          }
          try {
            scene = entry.create(app, { width: width, height: height })
          } catch (error) {
            scene = null
          }
          if (scene && typeof scene.draw === 'function') {
            app.ticker.add(function () {
              if (!scene) return
              var current = liveRef.current
              try {
                scene.draw({
                  width: width,
                  height: height,
                  lines: Array.isArray(current.lines) ? current.lines : [],
                  active: Number(current.active),
                  now: Number(current.now) || 0,
                  accent: typeof current.accent === 'string' ? current.accent : '',
                  time: app.ticker.lastTime / 1000,
                })
              } catch (error) {}
            })
          }
        })
        .catch(function () {
          // A canvas pixi cannot take: the stage stays empty, the page keeps its colour.
        })

      var observer = null
      if (typeof ResizeObserver === 'function') {
        observer = new ResizeObserver(function () {
          measure()
          if (app !== null && app.renderer !== undefined) {
            try {
              app.renderer.resize(width, height)
            } catch (error) {}
          }
        })
        observer.observe(host)
      }
      return function () {
        destroyed = true
        if (observer !== null) observer.disconnect()
        if (scene && typeof scene.destroy === 'function') {
          try {
            scene.destroy()
          } catch (error) {}
        }
        if (app !== null) {
          try {
            app.destroy(true, { children: true })
          } catch (error) {}
        }
        if (canvas.parentNode === host) host.removeChild(canvas)
      }
    },
    [props.styleId],
  )

  return h('div', {
    ref: hostRef,
    className: 'mp-np-pixi-wrap',
    style: { position: 'relative', flex: '1 1 auto', minHeight: '0', width: '100%' },
  })
}

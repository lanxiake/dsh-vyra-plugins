/**
 * 三维舞台 — three.js styles own a WebGL canvas.
 *
 * Protocol for `kind: 'three'` entries:
 *   { create(THREE, ctx): { draw(state), destroy?() } }
 * The stage owns the renderer, the camera and the frame loop; the style builds its
 * scene. Without three the entry is never reached (`LyricStage` falls back).
 *
 * Lifecycle: one renderer per style. The loop reads the latest props from a ref, so a
 * lyric line change never recreates the WebGL context (rain, camera drift and any
 * particle state stay continuous).
 */

function ThreeLyricStage(props) {
  var hostRef = useRef(null)
  var liveRef = useRef(props)
  liveRef.current = props

  useEffect(
    function () {
      var host = hostRef.current
      var entry = mpStyleOf(props.styleId)
      if (!host || MP_THREE === null || entry === null || typeof entry.create !== 'function') return undefined
      var THREE = MP_THREE
      var width = Math.max(1, host.clientWidth)
      var height = Math.max(1, host.clientHeight)
      var canvas = document.createElement('canvas')
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.style.display = 'block'
      host.appendChild(canvas)

      var renderer = null
      var scene3 = null
      try {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true })
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
        renderer.setSize(width, height, false)
        scene3 = entry.create(THREE, { width: width, height: height, canvas: canvas, renderer: renderer })
      } catch (error) {
        if (renderer !== null) {
          try {
            renderer.dispose()
          } catch (disposeError) {}
        }
        return undefined
      }

      var raf = 0
      var stopped = false
      var camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 200)
      camera.position.set(9.5, 7.2, 13.5)
      camera.lookAt(0, 2.1, 0)

      var startedAt = Date.now()
      var frame = function () {
        if (stopped) return
        var current = liveRef.current
        try {
          if (scene3 && typeof scene3.draw === 'function') {
            scene3.draw({
              width: width,
              height: height,
              lines: Array.isArray(current.lines) ? current.lines : [],
              active: Number(current.active),
              now: Number(current.now) || 0,
              accent: typeof current.accent === 'string' ? current.accent : '',
              title: current.title || '',
              time: (Date.now() - startedAt) / 1000,
              camera: camera,
            })
          }
          renderer.render(scene3.scene, camera)
        } catch (error) {
          stopped = true
          return
        }
        raf = window.requestAnimationFrame(frame)
      }
      raf = window.requestAnimationFrame(frame)

      var observer = null
      if (typeof ResizeObserver === 'function') {
        observer = new ResizeObserver(function () {
          width = Math.max(1, host.clientWidth)
          height = Math.max(1, host.clientHeight)
          renderer.setSize(width, height, false)
          camera.aspect = width / height
          camera.updateProjectionMatrix()
        })
        observer.observe(host)
      }
      return function () {
        stopped = true
        if (raf) window.cancelAnimationFrame(raf)
        if (observer !== null) observer.disconnect()
        if (scene3 && typeof scene3.destroy === 'function') {
          try {
            scene3.destroy()
          } catch (error) {}
        }
        try {
          renderer.dispose()
        } catch (error) {}
        if (canvas.parentNode === host) host.removeChild(canvas)
      }
    },
    [props.styleId],
  )

  return h('div', {
    ref: hostRef,
    className: 'mp-np-three-wrap',
    style: { position: 'relative', flex: '1 1 auto', minHeight: '0', width: '100%' },
  })
}

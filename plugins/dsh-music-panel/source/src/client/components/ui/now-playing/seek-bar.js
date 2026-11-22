function WaveSeekBar(props) {
  var accent = useCoverAccent(props.cover || '', props.imageRef)
  var time = usePlayerTime()
  var seekPair = useState(null)
  var seeking = seekPair[0]
  var setSeeking = seekPair[1]
  var seekingRef = useRef(null)
  var hoverRef = useRef(null)
  var duration = effectivePlayerDuration(time.duration, props.fallbackDuration)
  var position = seeking !== null ? seeking : Math.min(time.currentTime, duration || 0)
  var progress = duration > 0 ? clamp(position / duration, 0, 1) : 0
  var buffered = duration > 0 ? Math.min(duration, Math.max(0, Number(time.buffered) || 0)) : 0
  var progressRef = useRef(progress)
  var durationRef = useRef(duration)
  var bufferedRef = useRef(buffered)
  var morphRef = useRef(props.wave === false ? 0 : 1)
  var targetMorphRef = useRef(props.wave === false ? 0 : 1)
  var canvasRef = useRef(null)
  var drawRef = useRef(null)
  var startRef = useRef(null)
  var playing = props.playing === true
  var active = props.active !== false
  var playingRef = useRef(playing)
  playingRef.current = playing
  progressRef.current = progress
  durationRef.current = duration
  bufferedRef.current = buffered

  function choose(value) {
    seekingRef.current = value
    setSeeking(value)
  }
  function commit() {
    var value = seekingRef.current
    if (value === null) return
    if (duration > 0) player.seek(value)
    seekingRef.current = null
    setSeeking(null)
  }

  function toneOf(source) {
    var h = Number(source && source.h)
    if (!isFinite(h)) h = 0
    var sat = Number(source && source.s)
    if (!isFinite(sat) || sat < 0) sat = 0
    if (sat > 0 && sat <= 1) sat *= 100
    var light = Number(source && source.l)
    if (!isFinite(light) || light < 0) light = 60
    if (light > 0 && light <= 1) light *= 100
    // Neutral covers must not gain a hue; muted colours keep their own tone.
    if (sat < 20) sat = 0
    return {
      h: ((h % 360) + 360) % 360,
      s: Math.min(80, Math.max(0, sat)),
      l: Math.min(78, Math.max(52, light)),
    }
  }

  useEffect(
    function () {
      targetMorphRef.current = props.wave === false ? 0 : 1
      if (drawRef.current !== null) drawRef.current(performance.now())
      if (startRef.current !== null) startRef.current()
    },
    [props.wave],
  )

  useEffect(
    function () {
      if (props.playing === true && startRef.current !== null) {
        drawRef.current(performance.now())
        startRef.current()
      }
    },
    [props.playing],
  )

  useEffect(
    function () {
      var canvas = canvasRef.current
      if (canvas === null) return undefined
      var ctx = canvas.getContext('2d')
      if (ctx === null) return undefined
      if (active !== true) {
        var clearTimer = setTimeout(function () {
          var node = canvasRef.current
          if (node === null) return
          var clearCtx = node.getContext('2d')
          if (clearCtx !== null) clearCtx.clearRect(0, 0, node.width, node.height)
        }, 420)
        return function () {
          clearTimeout(clearTimer)
        }
      }
      var dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)
      var levels = []
      var bands = 32
      var spectrumBands = 16
      var raf = 0
      var last = 0
      var tone = toneOf(accent)

      function resize() {
        var width = Math.max(1, Math.round(canvas.clientWidth * dpr))
        var height = Math.max(1, Math.round(canvas.clientHeight * dpr))
        if (width === canvas.width && height === canvas.height) return
        canvas.width = width
        canvas.height = height
        // Assigning width/height clears the bitmap; repaint when idle.
        if (drawRef.current !== null) drawRef.current(performance.now())
      }
      resize()
      var observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
      if (observer !== null) observer.observe(canvas)
      window.addEventListener('resize', resize)

      function shouldAnimate() {
        if (Math.abs(morphRef.current - targetMorphRef.current) > 0.005) return true
        if (targetMorphRef.current === 0) return false
        return playingRef.current === true
      }

      function draw(now) {
        var w = canvas.width / dpr
        var h = canvas.height / dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w, h)
        ctx.globalAlpha = 1
        var morph = morphRef.current
        var target = targetMorphRef.current
        morph += (target - morph) * 0.18
        if (Math.abs(morph - target) < 0.003) morph = target
        morphRef.current = morph

        if (morph < 0.02 && target === 0) {
          var trackH = 4
          var trackY = h / 2
          function rail(x, width, color) {
            if (width <= 0) return
            ctx.fillStyle = color
            if (typeof ctx.roundRect === 'function') {
              ctx.beginPath()
              ctx.roundRect(x, trackY - trackH / 2, width, trackH, trackH / 2)
              ctx.fill()
            } else {
              ctx.fillRect(x, trackY - trackH / 2, width, trackH)
            }
          }
          rail(0, w, '#26262c')
          if (durationRef.current > 0 && bufferedRef.current > 0) {
            rail(0, Math.min(1, bufferedRef.current / durationRef.current) * w, '#3a3a43')
          }
          var playedWidth = progressRef.current * w
          rail(0, playedWidth, 'hsla(' + tone.h + ',' + tone.s + '%,' + tone.l + '%,1)')
          ctx.fillStyle = '#f7f7f8'
          ctx.beginPath()
          ctx.arc(Math.max(5, Math.min(w - 5, playedWidth)), trackY, 5, 0, Math.PI * 2)
          ctx.fill()
          if (hoverRef.current !== null) {
            ctx.fillStyle = 'rgba(255,255,255,.3)'
            ctx.fillRect(Math.max(0, Math.min(w - 1, hoverRef.current * w)), 0, 1, h)
          }
          return
        }

        var data = playingRef.current ? player.getWave() : null
        var raw = []
        if (data !== null && data.length > 0) {
          for (var band = 0; band < spectrumBands; band += 1) {
            var from = Math.floor(Math.pow(band / spectrumBands, 1.6) * data.length)
            var to = Math.max(from + 1, Math.floor(Math.pow((band + 1) / spectrumBands, 1.6) * data.length))
            to = Math.min(to, data.length)
            var sum = 0
            for (var i = from; i < to; i += 1) sum += data[i]
            raw.push(sum / Math.max(1, to - from) / 255)
          }
        } else {
          for (var z = 0; z < spectrumBands; z += 1) raw.push(0)
        }
        var peak = 0.4
        for (var p = 0; p < raw.length; p += 1) peak = Math.max(peak, raw[p])
        var gap = w / bands
        var mid = (bands - 1) / 2
        var bufferedRatio =
          durationRef.current > 0 ? Math.min(1, bufferedRef.current / durationRef.current) : 0
        for (var k = 0; k < bands; k += 1) {
          var dist = Math.abs(k - mid) / mid
          var bandIndex = Math.min(spectrumBands - 1, Math.round(dist * (spectrumBands - 1)))
          var level = Math.pow(Math.max(0, raw[bandIndex]) / peak, 1.5)
          level = 0.02 + Math.min(1, level) * 0.98
          var previous = levels[k] || 0
          levels[k] = level > previous ? level : previous * 0.45 + level * 0.55
          var targetHalf = Math.max(2, (levels[k] * h) / 2)
          var half = 2 + (targetHalf - 2) * morph
          var barW = gap * (1 - 0.42 * morph)
          var x = k * gap + (gap - barW) / 2
          var center = (k + 0.5) / bands
          var played = center <= progressRef.current
          var bufferedBar = center <= bufferedRatio
          ctx.fillStyle = played
            ? 'hsla(' + tone.h + ',' + tone.s + '%,' + tone.l + '%,0.96)'
            : bufferedBar
              ? 'rgba(255,255,255,.32)'
              : 'rgba(255,255,255,' + (0.18 + 0.14 * morph).toFixed(3) + ')'
          var radius = Math.min(barW / 2, 4, half) * Math.min(1, morph * 2)
          if (morph < 0.05 && (k === 0 || k === bands - 1)) radius = Math.min(2, half)
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath()
            ctx.roundRect(x, h / 2 - half, barW, half * 2, [radius, radius, radius, radius])
            ctx.fill()
          } else {
            ctx.fillRect(x, h / 2 - half, barW, half * 2)
          }
        }
        if (durationRef.current > 0) {
          var head = progressRef.current * w
          if (morph > 0.08) {
            ctx.fillStyle = 'rgba(255,255,255,' + (0.22 + 0.68 * morph).toFixed(3) + ')'
            ctx.fillRect(Math.max(0, Math.min(w - 1.5, head - 0.75)), 2, 1.5, h - 4)
          }
          ctx.fillStyle = '#f7f7f8'
          ctx.beginPath()
          ctx.arc(Math.max(5, Math.min(w - 5, head)), h / 2, 5 - 2 * morph, 0, Math.PI * 2)
          ctx.fill()
        }
        if (hoverRef.current !== null) {
          ctx.fillStyle = 'rgba(255,255,255,.3)'
          ctx.fillRect(Math.max(0, Math.min(w - 1, hoverRef.current * w)), 0, 1, h)
        }
      }

      function frame(now) {
        raf = 0
        if (now - last < 33) {
          raf = requestAnimationFrame(frame)
          return
        }
        last = now
        draw(now)
        if (shouldAnimate()) raf = requestAnimationFrame(frame)
      }
      function start() {
        if (raf === 0 && shouldAnimate()) raf = requestAnimationFrame(frame)
      }
      drawRef.current = draw
      startRef.current = start
      draw(performance.now())
      start()
      return function () {
        if (raf !== 0) cancelAnimationFrame(raf)
        if (observer !== null) observer.disconnect()
        window.removeEventListener('resize', resize)
        drawRef.current = null
        startRef.current = null
      }
    },
    [accent, active],
  )

  useEffect(
    function () {
      if (drawRef.current !== null) drawRef.current(performance.now())
      if (startRef.current !== null) startRef.current()
    },
    [progress, duration, seeking],
  )

  return h(
    'div',
    { className: 'mp-wave-seek' },
    h('canvas', {
      ref: canvasRef,
      className: cx('mp-np-reflect-wave', active !== true && 'is-fading', props.wave === false && 'is-rail'),
      'aria-hidden': 'true',
    }),
    h('input', {
      type: 'range',
      className: 'mp-wave-seek-input',
      min: 0,
      max: duration > 0 ? duration : 1,
      step: 0.5,
      value: position,
      disabled: duration <= 0,
      'aria-label': t('page.duration'),
      onChange: function (event) {
        choose(Number(event.target.value))
      },
      onPointerUp: commit,
      onKeyUp: commit,
      onBlur: commit,
      onPointerMove: function (event) {
        var rect = event.currentTarget.getBoundingClientRect()
        hoverRef.current = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1)
        if (drawRef.current !== null) drawRef.current(performance.now())
      },
      onPointerLeave: function () {
        hoverRef.current = null
        if (drawRef.current !== null) drawRef.current(performance.now())
      },
    }),
  )
}


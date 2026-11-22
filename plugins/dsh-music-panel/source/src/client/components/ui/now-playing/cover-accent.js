function fallbackCoverAccent() {
  var h = 40
  var sat = 12
  var light = 70
  return {
    h: h,
    s: sat,
    l: light,
    palette: [
      { h: 28, s: 10, l: 62 },
      { h: h, s: sat, l: light },
      { h: 52, s: 14, l: 78 },
    ],
  }
}

function rgbToHslColor(red, green, blue) {
  var r = red / 255
  var g = green / 255
  var b = blue / 255
  var max = Math.max(r, g, b)
  var min = Math.min(r, g, b)
  var d = max - min
  var l = (max + min) / 2
  var s = 0
  var h = 0
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h: h, s: s, l: l }
}

function coverAccentFromUrl(url, image) {
  return new Promise(function (resolve) {
    if (!url) {
      resolve(fallbackCoverAccent())
      return
    }
    var img = image || new Image()
    img.onload = function () {
      try {
        var canvas = document.createElement('canvas')
        canvas.width = 24
        canvas.height = 24
        var ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, 24, 24)
        var data = ctx.getImageData(0, 0, 24, 24).data
        var buckets = new Map()
        for (var i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue
          var red = data[i]
          var green = data[i + 1]
          var blue = data[i + 2]
          var key = (red >> 4) + ',' + (green >> 4) + ',' + (blue >> 4)
          var entry = buckets.get(key)
          if (entry === undefined) {
            entry = { count: 0, r: 0, g: 0, b: 0 }
            buckets.set(key, entry)
          }
          entry.count += 1
          entry.r += red
          entry.g += green
          entry.b += blue
        }
        var colors = []
        buckets.forEach(function (entry) {
          var color = rgbToHslColor(entry.r / entry.count, entry.g / entry.count, entry.b / entry.count)
          colors.push({ h: color.h, s: color.s, l: color.l, count: entry.count })
        })
        colors.sort(function (a, b) {
          return b.count - a.count
        })
        var picked = []
        for (var c = 0; c < colors.length && picked.length < 3; c += 1) {
          var candidate = colors[c]
          var distinct = true
          for (var p = 0; p < picked.length; p += 1) {
            var other = picked[p]
            var hueGap = Math.min(
              Math.abs(candidate.h - other.h),
              360 - Math.abs(candidate.h - other.h),
            ) / 360
            var distance = Math.hypot(hueGap, candidate.s - other.s, candidate.l - other.l)
            if (distance < 0.16) {
              distinct = false
              break
            }
          }
          if (distinct) picked.push(candidate)
        }
        if (picked.length === 0) {
          resolve(fallbackCoverAccent())
          return
        }
        while (picked.length < 3) {
          var base = picked[0]
          picked.push({
            h: (base.h + (picked.length === 1 ? 32 : 328)) % 360,
            s: base.s,
            l: Math.min(0.8, Math.max(0.38, base.l + (picked.length === 1 ? 0.08 : -0.06))),
            count: 0,
          })
        }
        if (colors.length === 0) {
          resolve(fallbackCoverAccent())
          return
        }
        // Signature colour: among reasonably saturated clusters, prefer area
        // times saturation. This ignores both a large cream background and a
        // tiny saturated JPEG fringe (which used to win and turn the wave blue).
        var maxCount = colors.reduce(function (max, color) {
          return Math.max(max, color.count || 1)
        }, 1)
        var minCount = Math.max(3, Math.floor(maxCount * 0.02))
        var saturated = colors.filter(function (color) {
          return (
            color.s > 0.3 &&
            color.l > 0.06 &&
            color.l < 0.92 &&
            Math.max(1, color.count || 1) >= minCount
          )
        })
        var pool = saturated.length > 0 ? saturated : colors
        var base = pool.reduce(function (best, color) {
          var score = Math.max(1, color.count || 1) * (0.35 + color.s)
          var bestScore = Math.max(1, best.count || 1) * (0.35 + best.s)
          return score > bestScore ? color : best
        }, pool[0])
        var feature = []
        function addFeature(source) {
          var candidate = {
            h: Math.round(source.h),
            s: Math.round(Math.min(1, Math.max(0.16, source.s)) * 100),
            l: Math.round(Math.min(0.82, Math.max(0.38, source.l)) * 100),
          }
          for (var f = 0; f < feature.length; f += 1) {
            var other = feature[f]
            var hueGap = Math.min(
              Math.abs(candidate.h - other.h),
              360 - Math.abs(candidate.h - other.h),
            ) / 360
            if (Math.hypot(hueGap, (candidate.s - other.s) / 100, (candidate.l - other.l) / 100) < 0.16) {
              return
            }
          }
          feature.push(candidate)
        }
        addFeature(base)
        for (var f = 0; f < picked.length; f += 1) addFeature(picked[f])
        // Hard bound the fallback loop. addFeature() may reject a generated
        // neighbour as too similar, so looping on it can spin forever on
        // low-colour artwork and freeze the panel while extracting the cover.
        var featureGuard = 0
        while (feature.length < 3 && featureGuard < 12) {
          var anchor = feature[0] || { h: 40, s: 16, l: 70 }
          var angle = (featureGuard + 1) * 30
          feature.push({
            h: (anchor.h + angle) % 360,
            s: Math.max(16, anchor.s),
            l: Math.min(82, Math.max(38, anchor.l + (featureGuard % 2 === 0 ? 8 : -6))),
          })
          featureGuard += 1
        }
        feature = feature.slice(0, 4).sort(function (a, b) {
          return a.h - b.h
        })
        resolve({
          h: Math.round(base.h),
          s: Math.round(Math.min(1, Math.max(0.16, base.s)) * 100),
          l: Math.round(Math.min(0.82, Math.max(0.38, base.l)) * 100),
          palette: feature,
        })
      } catch (error) {
        resolve(fallbackCoverAccent())
      }
    }
    img.onerror = function () {
      resolve(fallbackCoverAccent())
    }
    if (image) {
      if (img.complete) {
        if (img.naturalWidth > 0) img.onload()
        else img.onerror()
      }
    } else {
      img.src = url
    }
  })
}

function useCoverAccent(url, imageRef) {
  var pair = useState(fallbackCoverAccent())
  var accent = pair[0]
  var setAccent = pair[1]
  useEffect(
    function () {
      var cancelled = false
      var timer = null
      var tries = 0
      function attempt() {
        if (cancelled) return
        if (url === '') {
          setAccent(fallbackCoverAccent())
          return
        }
        var image = imageRef && imageRef.current ? imageRef.current : null
        // The <img> element is reused across tracks. Wait until it actually
        // shows the requested cover and has decoded, otherwise we would sample
        // the previous artwork and keep the old accent after switching songs.
        var shown = image === null ? '' : image.getAttribute('src') || ''
        var ready = image !== null && shown === url && image.complete && image.naturalWidth > 0
        if (!ready) {
          if (tries < 40) {
            tries += 1
            timer = setTimeout(attempt, 50)
            return
          }
          setAccent(fallbackCoverAccent())
          return
        }
        // Sample only the <img> already rendered by the player. Online covers
        // are served from the Host's local cache; this never makes a second
        // request.
        coverAccentFromUrl(url, image).then(function (next) {
          if (!cancelled) setAccent(next)
        })
      }
      attempt()
      return function () {
        cancelled = true
        if (timer !== null) clearTimeout(timer)
      }
    },
    [url, imageRef],
  )
  return accent
}

function createBlurredBackdrop(url) {
  return new Promise(function (resolve) {
    if (!url) {
      resolve('')
      return
    }
    var img = new Image()
    img.onload = function () {
      try {
        var size = 64
        var canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        var ctx = canvas.getContext('2d')
        if (ctx === null) {
          resolve('')
          return
        }
        // Blur once at 64x64 instead of applying a 110px blur to a full-screen
        // image on every raster. Upscaling this texture is visually close and
        // orders of magnitude cheaper.
        if (typeof ctx.filter === 'string') {
          ctx.filter = 'blur(4px) saturate(1.6) brightness(.68)'
        }
        ctx.drawImage(img, 0, 0, size, size)
        if (typeof ctx.filter === 'string') ctx.filter = 'none'
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      } catch (error) {
        resolve('')
      }
    }
    img.onerror = function () {
      resolve('')
    }
    img.src = url
  })
}


/**
 * Ambient backdrop motion: CSS handles the slow drift, and this cheap loop
 * only raises a CSS variable with the beat so the blurred cover can pulse.
 */
function useAmbientBeat(ref, enabled, playing, sensitivity, amount, ready) {
  var stateRef = useRef({
    enabled: enabled === true,
    playing: playing === true,
    sensitivity: Number(sensitivity) || 0.6,
    amount: Number(amount) || 0.6,
  })
  useEffect(
    function () {
      stateRef.current = {
        enabled: enabled === true,
        playing: playing === true,
        sensitivity: Number(sensitivity) || 0.6,
        amount: Number(amount) || 0.6,
      }
    },
    [enabled, playing, sensitivity, amount],
  )
  useEffect(function () {
    if (ready !== true) return undefined
    var node = ref.current
    if (node === null) return undefined
    var tracker = createBeatTracker()
    var raf = 0
    var last = 0
    function frame(now) {
      raf = requestAnimationFrame(frame)
      var state = stateRef.current
      if (state.enabled !== true || state.playing !== true || document.visibilityState === 'hidden') {
        node.style.setProperty('--mp-beat-scale', '1')
        return
      }
      if (now - last < 50) return
      last = now
      var wave =
        typeof player !== 'undefined' && player !== null && typeof player.getWave === 'function'
          ? player.getWave()
          : null
      var beat = tracker.update(wave, true, state.sensitivity) * state.amount
      node.style.setProperty('--mp-beat-scale', (1 + beat * 0.24).toFixed(4))
    }
    raf = requestAnimationFrame(frame)
    return function () {
      cancelAnimationFrame(raf)
      if (node.style) node.style.removeProperty('--mp-beat-scale')
    }
  }, [ready])
}

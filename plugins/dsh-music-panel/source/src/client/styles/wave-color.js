/**
 * Waveform palette derived from the cover's signature colour.
 *
 * The progress waveform used to pick colours straight from the raw colour
 * clusters of the artwork, so a small saturated area (green foliage, a logo)
 * could own the bars even when the cover reads as pink or red. Stay on the
 * signature hue and only vary saturation/lightness plus a small hue offset,
 * which keeps the bars visually tied to the cover on every track.
 *
 * @param {{ h?: number, s?: number, l?: number } | null | undefined} accent
 * @returns {Array<{ h: number, s: number, l: number }>}
 */
function createBeatTracker() {
  var previous = null
  var average = 0
  var level = 0
  return {
    update: function (wave, playing, sensitivity) {
      var feel = Number(sensitivity)
      if (!isFinite(feel)) feel = 0.6
      feel = Math.max(0, Math.min(2, feel))
      if (playing !== true || wave === null || wave === undefined || wave.length === 0) {
        level *= 0.82
        previous = null
        return level
      }
      var bands = Math.max(3, Math.min(10, Math.floor(wave.length * 0.08)))
      var flux = 0
      if (previous !== null && previous.length === bands) {
        for (var i = 0; i < bands; i += 1) {
          var delta = wave[i] - previous[i]
          if (delta > 0) flux += delta
        }
        flux = flux / (bands * 255)
      }
      if (previous === null || previous.length !== bands) previous = new Array(bands)
      for (var j = 0; j < bands; j += 1) previous[j] = wave[j]
      average = average * 0.9 + flux * 0.1
      var threshold = Math.max(0.003, average * 1.25 * (1.9 - 1.5 * feel))
      var hit = flux > threshold ? Math.min(1, (flux - threshold) * (5 + 5 * feel) + 0.3) : 0
      hit *= feel
      level = Math.max(hit, level * 0.82)
      return level
    },
  }
}

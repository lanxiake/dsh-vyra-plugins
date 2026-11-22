/**
 * Lyric preview of the match window — a port of Folia's `LyricPreviewPanel`.
 *
 * The behaviour is the same: the selected lyric is played back on a small demo
 * clock, the current line is drawn large with a word-by-word gradient (one word
 * at a time, like a karaoke read head), the next line sits under it in a muted
 * colour, and the line scrolls horizontally so the word being sung stays centred.
 *
 * The network half is not ported: this plugin already has the selected lyric in
 * the window (`lines` with word timing, or plain LRC), so the panel renders what
 * it is given.
 */

var MP_PREVIEW_LOOP_MS = 120

function mpPreviewGradient(activeColor, baseColor, progress) {
  return 'linear-gradient(to right, ' + activeColor + ' ' + String(progress) + '%, ' + baseColor + ' ' + String(progress) + '%)'
}

function mpClampProgress(value) {
  return Math.max(0, Math.min(100, value))
}

/** Normalise whatever the preview API returned into timed lines. */
function mpPreviewLines(preview) {
  if (preview === null || preview === undefined) return []
  if (Array.isArray(preview.lines) && preview.lines.length > 0) {
    return preview.lines.map(function (line) {
      return {
        start: Number(line.t) || 0,
        end: Number(line.end) || Number(line.t) || 0,
        text: String(line.text || ''),
        words: Array.isArray(line.words)
          ? line.words.map(function (word) {
              return {
                start: Number(word.t) || 0,
                end: Number(word.end) || Number(word.t) || 0,
                text: String(word.text || ''),
              }
            })
          : [],
      }
    })
  }
  var parsed = parseLrcText(preview.lrc || '')
  return parsed.map(function (line, index) {
    var next = parsed[index + 1]
    return {
      start: line.time,
      end: next ? next.time : line.time + 4,
      text: line.text,
      words: [],
    }
  })
}

function LyricMatchPreview(props) {
  var lines = props.lines || []
  var height = props.height || 112

  var clockPair = useState(0)
  var now = clockPair[0]
  var setNow = clockPair[1]
  var scrollerRef = useRef(null)
  var wordRefs = useRef([])

  // The demo clock: it walks the lyric and loops, so the panel always shows the
  // read head moving instead of a static first line.
  useEffect(
    function () {
      if (lines.length === 0) return undefined
      var startedAt = Date.now()
      var total = Math.max(4, Number(lines[lines.length - 1].end) - Number(lines[0].start) || 12)
      var timer = setInterval(function () {
        var elapsed = ((Date.now() - startedAt) / 1000) % total
        setNow(Number(lines[0].start) + elapsed)
      }, MP_PREVIEW_LOOP_MS)
      return function () {
        clearInterval(timer)
      }
    },
    [lines.length === 0 ? 0 : lines[0].start, lines.length === 0 ? 0 : lines[lines.length - 1].end],
  )

  if (lines.length === 0) {
    return h(
      'div',
      {
        style: {
          height: String(height) + 'px',
          display: 'grid',
          placeItems: 'center',
          fontSize: '12px',
          opacity: '.45',
        },
      },
      props.emptyLabel || '',
    )
  }

  // Current line: the last one that started; next line is the one after it.
  var activeIndex = -1
  for (var index = 0; index < lines.length; index += 1) {
    if (lines[index].start <= now) activeIndex = index
    else break
  }
  var current = activeIndex >= 0 ? lines[activeIndex] : lines[0]
  var next = lines[Math.min(lines.length - 1, Math.max(0, activeIndex + 1))]

  function wordProgress(word, line) {
    if (now <= word.start) return 0
    if (word.end > word.start) return mpClampProgress(((now - word.start) / (word.end - word.start)) * 100)
    return now >= word.start ? 100 : 0
  }

  function lineProgress(line) {
    if (line.end > line.start) return mpClampProgress(((now - line.start) / (line.end - line.start)) * 100)
    return now >= line.start ? 100 : 0
  }

  return h(
    'div',
    { style: { height: String(height) + 'px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px', overflow: 'hidden' } },
    // The sung line, word by word.
    h(
      'div',
      {
        ref: scrollerRef,
        style: {
          position: 'relative',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          fontSize: '20px',
          fontWeight: '600',
          lineHeight: '30px',
          textAlign: 'center',
        },
      },
      current.words && current.words.length > 0
        ? current.words.map(function (word, wordIndex) {
            return h(
              'span',
              {
                key: 'w' + String(wordIndex),
                ref: function (node) {
                  wordRefs.current[wordIndex] = node
                },
                style: {
                  display: 'inline-block',
                  backgroundImage: mpPreviewGradient(
                    props.activeColor || '#60a5fa',
                    props.mutedColor || 'rgba(255,255,255,.3)',
                    wordProgress(word, current),
                  ),
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  transition: 'background-image 120ms linear',
                },
              },
              word.text,
            )
          })
        : h(
            'span',
            {
              style: {
                backgroundImage: mpPreviewGradient(
                  props.activeColor || '#60a5fa',
                  props.mutedColor || 'rgba(255,255,255,.3)',
                  lineProgress(current),
                ),
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                transition: 'background-image 120ms linear',
              },
            },
            current.text,
          ),
    ),
    // The line after it, muted.
    h(
      'div',
      {
        style: {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textAlign: 'center',
          fontSize: '13px',
          lineHeight: '20px',
          opacity: '.4',
        },
      },
      next && next !== current ? next.text : '',
    ),
  )
}

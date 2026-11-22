/**
 * plugin: seat registration and lifecycle.
 */

var SIDE_BANDS = [0, 2, 4, 8, 14, 24, 40, 64, 96]

function MusicSideIcon() {
  var snap = usePlayerSnapshot()
  var ref = useRef(null)
  var widePair = useState(false)
  var wide = widePair[0]
  var setWide = widePair[1]
  var levelPair = useState([0, 0, 0, 0, 0, 0, 0, 0])
  var levels = levelPair[0]
  var setLevels = levelPair[1]
  var waveVisiblePair = useState(false)
  var waveVisible = waveVisiblePair[0]
  var setWaveVisible = waveVisiblePair[1]
  var waveFadingPair = useState(false)
  var waveFading = waveFadingPair[0]
  var setWaveFading = waveFadingPair[1]

  useEffect(
    function () {
      var node = ref.current
      if (node === null) return undefined
      // The controls are absolutely positioned so they can sit at the right
      // edge of the host row. Some DSH sidebar rows are not positioned, which
      // made them escape to the nearest positioned ancestor (often the whole
      // sidebar). Mark the host row here instead of relying on its CSS.
      var row = node.closest('button') || node.closest('[role="button"]') || node.closest('a')
      if (row !== null) row.classList.add('mp-side-row')
      // Composer-side controls open the panel queue by clicking this row: the host owns
      // panel visibility, so asking its own entry is the only supported way to show it.
      if (row !== null) row.setAttribute('data-music-panel-row', '1')
      // Host rows are React-managed. When playback starts the host re-renders
      // and can overwrite className, dropping our positioning hook and making
      // the controls anchor to the sidebar instead. Put it back if that happens.
      var rowObserver =
        typeof MutationObserver === 'function' && row !== null
          ? new MutationObserver(function () {
              if (!row.classList.contains('mp-side-row')) row.classList.add('mp-side-row')
            })
          : null
      if (rowObserver !== null) {
        rowObserver.observe(row, { attributes: true, attributeFilter: ['class'] })
      }
      function measure() {
        setWide(row !== null && row.getBoundingClientRect().width >= 230)
      }
      measure()
      var observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
      if (observer !== null && row !== null) observer.observe(row)
      window.addEventListener('resize', measure)
      return function () {
        window.removeEventListener('resize', measure)
        if (observer !== null) observer.disconnect()
        if (rowObserver !== null) rowObserver.disconnect()
        if (row !== null) {
          row.classList.remove('mp-side-row')
          row.removeAttribute('data-music-panel-row')
        }
      }
    },
    [],
  )

  useEffect(
    function () {
      if (snap.playing !== true || snap.queue.length === 0) {
        if (levels.some(function (level) { return level > 0.01 })) {
          setWaveVisible(true)
          setWaveFading(true)
          var fadeTimer = setTimeout(function () {
            setWaveVisible(false)
            setWaveFading(false)
            setLevels([0, 0, 0, 0, 0, 0, 0, 0])
          }, 380)
          return function () {
            clearTimeout(fadeTimer)
          }
        }
        setWaveVisible(false)
        setWaveFading(false)
        setLevels([0, 0, 0, 0, 0, 0, 0, 0])
        return undefined
      }
      setWaveVisible(true)
      setWaveFading(false)
      var frame = 0
      var last = 0
      function tick(now) {
        if (now - last >= 60) {
          last = now
          var data = player.getWave()
          if (data !== null) {
            var next = []
            for (var band = 0; band < SIDE_BANDS.length - 1; band += 1) {
              var start = SIDE_BANDS[band]
              var end = Math.min(SIDE_BANDS[band + 1], data.length)
              var sum = 0
              for (var i = start; i < end; i += 1) sum += data[i]
              var avg = end > start ? sum / (end - start) : 0
              var normalized = Math.max(0, Math.min(1, (avg - 4) / 240))
              next.push(0.03 + Math.pow(normalized, 1.35) * 0.93)
            }
            setLevels(next)
          }
        }
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
      return function () {
        cancelAnimationFrame(frame)
      }
    },
    [snap.playing, snap.queue.length],
  )

  function control(key, name, title, run) {
    return h(
      'span',
      {
        key: key,
        className: 'mp-side-btn',
        role: 'button',
        tabIndex: 0,
        title: title,
        'aria-label': title,
        onClick: function (event) {
          event.preventDefault()
          event.stopPropagation()
          run()
        },
        onKeyDown: function (event) {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          event.stopPropagation()
          run()
        },
      },
      icon(name, 13),
    )
  }

  return h(
    'span',
    { className: 'mp-side-icon', ref: ref },
    icon('note', 16),
    wide && snap.queue.length > 0
      ? h(
          'span',
          { className: 'mp-side-extras' },
          waveVisible
            ? h(
                'span',
                { className: cx('mp-side-wave', waveFading && 'is-fading'), 'aria-hidden': 'true' },
                levels.map(function (level, index) {
                  return h('i', {
                    key: index,
                    style: { height: Math.round(4 + level * 18) + 'px' },
                  })
                }),
              )
            : null,
          control('prev', 'prev', t('page.prev'), function () {
            player.prev()
          }),
          control(
            'toggle',
            snap.playing ? 'pause' : 'play',
            snap.playing ? t('page.pause') : t('page.play'),
            function () {
              player.toggle()
            },
          ),
          control('next', 'next', t('page.next'), function () {
            player.next()
          }),
        )
      : null,
  )
}

function NewPlaylistDialog(props) {
  var pair = useState('')
  var name = pair[0]
  var setName = pair[1]
  var busyPair = useState(false)
  var busy = busyPair[0]
  var setBusy = busyPair[1]

  function create() {
    var value = name.trim()
    if (value === '' || busy) return
    setBusy(true)
    createPlaylist(value).then(function (created) {
      setBusy(false)
      if (created) {
        popLayer()
        p3Navigate('playlist', created.id)
      }
    })
  }

  return h(
    'div',
    { className: 'mp-overlay is-on' },
    h('div', { className: 'mp-scrim', onClick: function () { popLayer() } }),
    h(
      'div',
      { className: 'mp-dialog is-sm', role: 'dialog', 'aria-label': t('v2.newPlaylist') },
      h(
        'div',
        { className: 'mp-d-head' },
        h('div', { className: 'mp-d-title' }, t('v2.newPlaylist')),
        h('div', { className: 'mp-spacer' }),
        h(IconButton, { icon: 'x', title: t('v2.close'), onClick: function () { popLayer() } }),
      ),
      h(
        'div',
        { className: 'mp-d-body' },
        h('input', {
          type: 'text',
          value: name,
          placeholder: t('v2.playlistName'),
          autoFocus: true,
          style: {
            height: '32px',
            padding: '0 10px',
            borderRadius: '8px',
            border: '1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07))',
            background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04))',
            color: 'inherit',
            font: 'inherit',
            outline: 'none',
          },
          onChange: function (event) {
            setName(event.target.value)
          },
          onKeyDown: function (event) {
            if (event.key === 'Enter') create()
          },
        }),
      ),
      h(
        'div',
        { className: 'mp-d-foot' },
        h(Button, { variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
        h(Button, { variant: 'primary', disabled: busy, onClick: create }, t('page.create')),
      ),
    ),
  )
}

function apply(ctx) {
  try {
    if (typeof console !== 'undefined' && console.info) {
      console.info('[dsh-music-panel] host UI kit:', hostUi ? 'native' : 'fallback')
    }
  } catch (error) {
    // Logging is best-effort.
  }
  try {
    var htmlLang = document.documentElement.getAttribute('lang') || ''
    if (htmlLang !== '') LANG = String(htmlLang).toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
  } catch (error) {
    // Keep the initial guess.
  }

  var locale = ctx.locale
  if (
    locale !== null &&
    locale !== undefined &&
    typeof locale.register === 'function' &&
    typeof locale.bind === 'function'
  ) {
    ctx.effect(function () {
      var dispose = locale.register('dsh-music-panel', DICTS)
      return function () {
        if (typeof dispose === 'function') dispose()
      }
    })
    try {
      var bound = locale.bind('dsh-music-panel')
      if (typeof bound === 'function') localeTranslate = bound
    } catch (error) {
      localeTranslate = null
    }
  }

  ctx.effect(function () {
    var style = document.createElement('style')
    style.dataset.plugin = 'dsh-music-panel'
    style.textContent =
      THEME_TEXT +
      '\n' +
      (typeof FOLIA_CSS === 'string' ? FOLIA_CSS : '') +
      '\n' +
      (typeof FOLIA_TAILWIND === 'string' ? FOLIA_TAILWIND : '') +
      '\n' +
      (typeof FOLIA_LOGIN_CSS === 'string' ? FOLIA_LOGIN_CSS : '') +
      '\n' +
      (typeof P3_CSS === 'string' ? P3_CSS : '')
    document.head.appendChild(style)
    return function () {
      style.remove()
    }
  })

  ctx.effect(function () {
    var stopAudioFocus = startAudioFocus()
    return function () {
      if (typeof stopAudioFocus === 'function') stopAudioFocus()
    }
  })

  // Folia keeps its sleep timer at the app root; so does the plugin. Folding the panel
  // must not stop a countdown that was already armed.
  ctx.effect(function () {
    return startSleepTimer()
  })

  ctx.effect(function () {
    return function () {
      player.suspend()
    }
  })
  // `music_control` is drained here, not by the panel: folding the panel (or never opening it)
  // must not stop the model from controlling playback.
  ctx.effect(function () {
    return startControlDrainer()
  })

  ctx.effect(function () {
    function onVisibility() {
      if (document.visibilityState === 'hidden') player.flushOnHide()
    }
    function onUnload() {
      player.flushOnHide()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onUnload)
    return function () {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onUnload)
    }
  })

  ctx.effect(function () {
    try {
      if (
        typeof navigator === 'undefined' ||
        navigator.locks === undefined ||
        typeof navigator.locks.request !== 'function'
      ) {
        return
      }
      if (window.__dshMusicLeaderBound === true) return
      window.__dshMusicLeaderBound = true
      var LOCK = 'dsh-music-panel.player'
      function hold() {
        return new Promise(function () {})
      }
      function becomeLeader() {
        player.setLeader(true)
        return hold()
      }
      navigator.locks
        .request(LOCK, { mode: 'exclusive', ifAvailable: true }, function (lock) {
          if (lock !== null && lock !== undefined) return becomeLeader()
          player.setLeader(false)
          return navigator.locks.request(LOCK, becomeLeader)
        })
        .catch(function () {
          player.setLeader(true)
        })
    } catch (error) {
      player.setLeader(true)
    }
  })

  function mount(name, registration, component) {
    // Folia's motion tree expects a MotionConfig provider (framer 13). The host mounts
    // each slot as its own root, so wrap every slot entry; without it useMotionValue
    // destructures a null context and the whole stage errors.
    if (typeof MotionConfig === 'function') {
      var Inner = component
      component = function MotionConfigRoot(props) {
        return h(MotionConfig, null, h(Inner, props))
      }
    }
    ctx.effect(function () {
      var dispose = ctx.slots.inject(name, function () {
        return ctx.slots.register(registration, component)
      })
      return function () {
        if (typeof dispose === 'function') dispose()
      }
    })
  }

  mount('shell.overlay', { name: 'shell.overlay', id: 'music-player', order: 15 }, AudioHost)
  mount(
    'sidebar.panellist',
    {
      name: 'sidebar.panellist',
      id: PANEL_ID,
      order: 20,
      label: function () {
        return t('nav.label')
      },
    },
    MusicSideIcon,
  )
  mount('main', { name: 'main', key: PANEL_ID }, function () {
    return h(MusicBoundary, null, h(P3Shell))
  })
  mount('conversation.input.dock', { name: 'conversation.input.dock', id: 'music-lyrics-above' }, function () {
    return h(SilentBoundary, null, h(ComposerLyrics))
  })
  mount(
    'conversation.input.right',
    { name: 'conversation.input.right', id: 'music-composer-cluster', order: 10 },
    function () {
      return h(SilentBoundary, null, h(ComposerCluster))
    },
  )
}

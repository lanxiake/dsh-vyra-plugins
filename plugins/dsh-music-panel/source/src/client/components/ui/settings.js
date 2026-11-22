/**
 * settings: one full-height sheet with seven tabs.
 *
 * The layout switch lives here (Appearance → Layout) because the user asked for
 * a single, discoverable place to change it.
 */

var SETTINGS_TABS = [
  { key: 'appearance', label: 'settings.tabAppearance', glyph: 'settings' },
  { key: 'lyrics', label: 'v2.lyrics', glyph: 'note' },
  { key: 'playback', label: 'settings.tabPlayback', glyph: 'equalizer' },
  { key: 'online', label: 'settings.tabOnline', glyph: 'refresh' },
  { key: 'library', label: 'settings.tabLibrary', glyph: 'folder' },
  { key: 'cache', label: 'settings.tabStorage', glyph: 'trash' },
  { key: 'about', label: 'settings.tabAbout', glyph: 'info' },
]

// The lyric page's groups, Folia's order plus the plugin's own group last.
var LYRIC_GROUP_DEFS = [
  { key: 'source', labelKey: 'settings.lyricGroupSource' },
  { key: 'timing', labelKey: 'settings.lyricGroupTiming' },
  { key: 'format', labelKey: 'settings.lyricGroupFormat' },
  { key: 'plugin', labelKey: 'settings.lyricGroupPlugin' },
]

var LYRIC_FORMAT_FALLBACK = ['lrc', 'vtt', 'ttml', 'qrc', 'yrc', 'krc']
var LYRIC_GLOBAL_OFFSET_LIMIT_MS = 2000

function clampLyricGlobalOffset(value) {
  var number = Number(value)
  if (!isFinite(number)) number = 0
  return Math.max(-LYRIC_GLOBAL_OFFSET_LIMIT_MS, Math.min(LYRIC_GLOBAL_OFFSET_LIMIT_MS, Math.round(number)))
}

function SettingsSheet(props) {
  var prefs = usePrefs()
  var sleepRemaining = useCountdown(prefs.sleepDeadline)
  var library = useStore(libraryStore)
  var online = useStore(onlineStore)
  var audioFocus = useStore(audioFocusStore)
  var tabPair = useState(props.initialTab || 'appearance')
  var tab = tabPair[0]
  var setTab = tabPair[1]
  // Opening the sheet from a specific entry (e.g. the Navidrome connect chip) lands on
  // that tab even when the sheet was already mounted.
  useEffect(
    function () {
      if (props.initialTab) setTab(props.initialTab)
    },
    [props.initialTab],
  )
  // Component test page: a full view inside the same sheet, so it shares the sheet's
  // modal layer instead of opening a second one.
  var galleryPair = useState(false)
  var galleryOpen = galleryPair[0]
  var setGalleryOpen = galleryPair[1]
  var cachePair = useState(null)
  var builtinLoudness =
    typeof window !== 'undefined' &&
    (typeof window.OfflineAudioContext !== 'undefined' ||
      typeof window.webkitOfflineAudioContext !== 'undefined')
  var cache = cachePair[0]
  var setCache = cachePair[1]
  var dataPair = useState(null)
  var data = dataPair[0]
  var setData = dataPair[1]
  var resetPair = useState(0)
  var resetStage = resetPair[0]
  var setResetStage = resetPair[1]
  var resetBusyPair = useState(false)
  var resetBusy = resetBusyPair[0]
  var setResetBusy = resetBusyPair[1]
  // 存储与备份: the backup window, and a counter that re-renders after localStorage rows
  // are cleared (their sizes are read from storage during render).
  var backupOpenPair = useState(false)
  var backupOpen = backupOpenPair[0]
  var setBackupOpen = backupOpenPair[1]
  var backupBusyPair = useState(false)
  var backupBusy = backupBusyPair[0]
  var setBackupBusy = backupBusyPair[1]
  var backupFileRef = useRef(null)
  var storageTickPair = useState(0)
  var storageTick = storageTickPair[0]
  var setStorageTick = storageTickPair[1]
  var pathPair = useState('')
  var rootDraft = pathPair[0]
  var setRootDraft = pathPair[1]
  var busyPair = useState(false)
  var busy = busyPair[0]
  var setBusy = busyPair[1]
  // Navidrome credential form. Every hook in this component must run on each
  // render, so it lives here rather than inside the tab/card render helpers.
  var navForm = useNavidromeForm()
  // The server form is taller than every other account card. Keep it collapsed
  // until asked for, so the default grid stays one uniform card size.
  var navOpenPair = useState(false)
  var navOpen = navOpenPair[0]
  var setNavOpen = navOpenPair[1]
  // Lyric page: the folded format order, and the two windows its rows open (Folia's
  // global offset and the lyric filter).
  var lyricFormatOpenPair = useState(false)
  var lyricFormatOpen = lyricFormatOpenPair[0]
  var setLyricFormatOpen = lyricFormatOpenPair[1]
  var lyricOffsetOpenPair = useState(false)
  var lyricOffsetOpen = lyricOffsetOpenPair[0]
  var setLyricOffsetOpen = lyricOffsetOpenPair[1]
  var lyricOffsetDraftPair = useState(0)
  var lyricOffsetDraft = lyricOffsetDraftPair[0]
  var setLyricOffsetDraft = lyricOffsetDraftPair[1]
  var lyricFilterOpenPair = useState(false)
  var lyricFilterOpen = lyricFilterOpenPair[0]
  var setLyricFilterOpen = lyricFilterOpenPair[1]
  var outputPair = useState([])
  var outputDevices = outputPair[0]
  var setOutputDevices = outputPair[1]
  var sinkSupported =
    typeof window !== 'undefined' &&
    typeof window.AudioContext !== 'undefined' &&
    typeof window.AudioContext.prototype.setSinkId === 'function'

  function refreshOutputDevices() {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.enumerateDevices !== 'function'
    ) {
      setOutputDevices([])
      return
    }
    navigator.mediaDevices
      .enumerateDevices()
      .then(function (devices) {
        setOutputDevices(
          devices
            .filter(function (device) {
              return device.kind === 'audiooutput'
            })
            .map(function (device, index) {
              return {
                id: device.deviceId,
                label: device.label || t('settings.outputDeviceN', { n: index + 1 }),
              }
            }),
        )
      })
      .catch(function () {
        setOutputDevices([])
      })
  }

  useEffect(
    function () {
      if (tab !== 'playback' || props.open !== true || !sinkSupported) return undefined
      refreshOutputDevices()
      return undefined
    },
    [tab, props.open, sinkSupported],
  )

  useEffect(
    function () {
      if (tab !== 'online' || props.open !== true) return undefined
      void loadProviders()
      return undefined
    },
    [tab, props.open],
  )

  useEffect(
    function () {
      if (tab !== 'cache' || props.open !== true) return undefined
      var cancelled = false
      // The cache directory and 自动扫描 live in the Host config; read it with the sizes.
      void loadConfig()
      getJson(API + 'online/cache')
        .then(function (body) {
          if (!cancelled) setCache(body)
        })
        .catch(function () {
          if (!cancelled) setCache(null)
        })
      getJson(API + 'data')
        .then(function (body) {
          if (!cancelled) setData(body)
        })
        .catch(function () {
          if (!cancelled) setData(null)
        })
      return function () {
        cancelled = true
      }
    },
    // A cache directory change moves the store: re-read the sizes for the new root.
    [tab, props.open, library.cacheDir],
  )

  if (props.open !== true) return null

  function clearPluginLocalStorage() {
    try {
      var prefixes = ['music.', 'dsh-music', 'mu.', 'lyric_', 'visualizer_', 'url_background_', 'folia.dev.']
      var suffixes = ['_tuning']
      var keys = []
      for (var index = 0; index < window.localStorage.length; index += 1) {
        var key = window.localStorage.key(index)
        if (key === null) continue
        var owned = prefixes.some(function (prefix) {
          return key.indexOf(prefix) === 0
        })
        if (!owned) {
          owned = suffixes.some(function (suffix) {
            return key.length >= suffix.length && key.slice(-suffix.length) === suffix
          })
        }
        if (owned) keys.push(key)
      }
      keys.forEach(function (key) {
        window.localStorage.removeItem(key)
      })
    } catch (error) {
      /* Private mode / quota errors must not block the host reset. */
    }
  }

  function clearAllData() {
    if (resetBusy) return
    setResetBusy(true)
    postJson(API + 'data/clear', { confirm: 'clear-all' })
      .then(function () {
        clearPluginLocalStorage()
        setResetBusy(false)
        setResetStage(0)
        showToast(t('data.resetDone'))
        if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
          window.setTimeout(function () {
            window.location.reload()
          }, 260)
        }
      })
      .catch(function (error) {
        setResetBusy(false)
        setResetStage(0)
        showToast(errorText(error))
      })
  }

  function resetDialog() {
    if (resetStage === 0) return null
    var final = resetStage === 2
    return h(
      KitModal,
      {
        key: 'data-reset',
        title: final ? t('data.resetTitleFinal') : t('data.resetTitle'),
        small: true,
        onClose: function () {
          if (!resetBusy) setResetStage(0)
        },
        footer: [
          h(
            Button,
            {
              key: 'cancel',
              variant: 'ghost',
              disabled: resetBusy,
              onClick: function () {
                if (!resetBusy) setResetStage(0)
              },
            },
            t('page.cancel'),
          ),
          h(
            Button,
            {
              key: final ? 'confirm' : 'continue',
              variant: 'primary',
              className: final ? 'mp-data-danger-btn' : undefined,
              disabled: resetBusy,
              onClick: function () {
                if (resetBusy) return
                if (final) clearAllData()
                else setResetStage(2)
              },
            },
            resetBusy ? t('data.resetting') : final ? t('data.resetConfirm') : t('data.resetContinue'),
          ),
        ],
      },
      h('p', { className: 'mp-kit-text' }, final ? t('data.resetHintFinal') : t('data.resetHint')),
    )
  }

  function patchPrefs(patch) {
    setPrefs(patch)
  }

  // Lyric line filters (Folia's lyricLineRules): the two ready-made presets plus
  // free words; the player turns them into rules for the parse-time document.
  function lyricFilterPresets() {
    return Array.isArray(prefs.lyricFilterPresets) ? prefs.lyricFilterPresets.slice() : []
  }

  function toggleLyricFilterPreset(id, on) {
    var next = lyricFilterPresets().filter(function (item) {
      return item !== id
    })
    if (on) next.push(id)
    patchPrefs({ lyricFilterPresets: next })
  }

  function layoutChoices() {
    return h(KitSegmented, {
      id: 'mp-layout-choice',
      value: prefs.layout === 'rail' ? 'rail' : 'top',
      label: t('v2.layout'),
      options: [
        { value: 'top', label: t('v2.layoutTop') },
        { value: 'rail', label: t('v2.layoutRail') },
      ],
      onChange: function (value) {
        patchPrefs({ layout: value })
      },
    })
  }

  function appearanceTab() {
    var styleId = typeof mpStyleIdOf === 'function' ? mpStyleIdOf(prefs.lyricStyle) : prefs.lyricStyle
    var bgId = typeof mpLookId === 'function' ? mpLookId(MP_BG_MODES, prefs.bgMode) : prefs.bgMode
    return [
      h('h2', { key: 'h' }, t('v2.appearance')),
      h('div', { key: 'panel-head', className: 'mp-set-label' }, t('settings.appearancePanel')),
      h(
        SetRow,
        { key: 'layout', label: t('v2.layout'), desc: t('v2.layoutHint') },
        layoutChoices(),
      ),
      h(
        SetRow,
        {
          key: 'composer-list-button',
          label: t('settings.composerListButton'),
          desc: t('settings.composerListButtonDesc'),
        },
        h(Switch, {
          value: prefs.composerListButton !== false,
          onChange: function (value) {
            patchPrefs({ composerListButton: value })
          },
        }),
      ),
      h('div', { key: 'player-head', className: 'mp-set-label' }, t('settings.appearancePlayer')),
      h('div', { key: 'player-hint', className: 'mp-set-desc' }, t('settings.appearancePlayerHint')),
      h(
        'div',
        { key: 'lyric-style', style: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '6px 0' } },
        h('div', { className: 'mp-set-label' }, t('sheet.lyricStyle')),
        h(LookChoiceGrid, {
          kind: 'lyricStyle',
          value: styleId,
          onPick: function (next) { patchPrefs({ lyricStyle: next }) },
        }),
      ),
      h(
        'div',
        { key: 'bg-mode', style: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '6px 0' } },
        h('div', { className: 'mp-set-label' }, t('sheet.background')),
        h(LookChoiceGrid, {
          kind: 'bgMode',
          value: bgId,
          onPick: function (next) { patchPrefs({ bgMode: next }) },
        }),
      ),
      h(
        SetRow,
        { key: 'lyric-intensity', label: t('settings.lyricIntensity'), desc: t('settings.lyricIntensityDesc') },
        h(KitSelect, {
          value: ['calm', 'normal', 'chaotic'].indexOf(prefs.lyricIntensity) >= 0 ? prefs.lyricIntensity : 'normal',
          label: t('settings.lyricIntensity'),
          options: [
            { value: 'calm', label: t('settings.lyricIntensityCalm') },
            { value: 'normal', label: t('settings.lyricIntensityNormal') },
            { value: 'chaotic', label: t('settings.lyricIntensityChaotic') },
          ],
          onChange: function (value) { patchPrefs({ lyricIntensity: String(value) }) },
        }),
      ),
      h(
        SetRow,
        { key: 'theme-source', label: t('sheet.themeSource'), desc: t('settings.themeSourceDesc') },
        h(KitSelect, {
          value: MP_THEME_SOURCES.indexOf(prefs.themeSource) >= 0 ? prefs.themeSource : 'default',
          label: t('sheet.themeSource'),
          options: [
            { value: 'default', label: t('sheet.sourceDefault') },
            { value: 'cover', label: t('sheet.sourceAI') },
            { value: 'custom', label: t('sheet.sourceCustom') },
          ],
          onChange: function (value) { patchPrefs({ themeSource: String(value) }) },
        }),
      ),
      prefs.themeSource === 'custom'
        ? h(
            SetRow,
            { key: 'theme-accent', label: t('settings.themeAccent'), desc: t('settings.themeAccentDesc') },
            h(KitInput, {
              value: typeof prefs.themeAccent === 'string' ? prefs.themeAccent : '',
              placeholder: '#f2607a',
              label: t('settings.themeAccent'),
              onChange: function (value) { patchPrefs({ themeAccent: String(value).trim() }) },
            }),
          )
        : null,
    ]
  }

  /** The listener order of sidecar formats, normalized against the default list. */
  function lyricFormatOrder() {
    var order = Array.isArray(prefs.lyricFormatOrder) && prefs.lyricFormatOrder.length > 0
      ? prefs.lyricFormatOrder.slice()
      : LYRIC_FORMAT_FALLBACK.slice()
    for (var index = 0; index < LYRIC_FORMAT_FALLBACK.length; index += 1) {
      if (order.indexOf(LYRIC_FORMAT_FALLBACK[index]) < 0) order.push(LYRIC_FORMAT_FALLBACK[index])
    }
    return order
  }

  function lyricFormatSummary() {
    return t('settings.lyricFormatSummary', { format: '.' + lyricFormatOrder()[0] })
  }

  /** The sidecar lyric formats, reorderable: the first one wins when a track has several. */
  function lyricFormatOrderRows() {
    var order = lyricFormatOrder()
    function move(from, delta) {
      var target = from + delta
      if (from < 0 || target < 0 || from >= order.length || target >= order.length) return
      var next = order.slice()
      var item = next.splice(from, 1)[0]
      next.splice(target, 0, item)
      patchPrefs({ lyricFormatOrder: next })
    }
    return h(
      'div',
      { className: 'mp-lyric-format-list' },
      order.map(function (format, index) {
        return h(
          'div',
          { key: format, className: 'mp-lyric-format-row' },
          h('span', { className: 'mp-lyric-format-name' }, format.toUpperCase()),
          index > 0 ? mpSmallButton('\u2191', function () { move(index, -1) }) : null,
          index < order.length - 1 ? mpSmallButton('\u2193', function () { move(index, 1) }) : null,
        )
      }),
    )
  }

  /** One settings group: Folia's heading over one card of rows. */
  function settingsGroup(key, labelKey, rows, foot, action) {
    return h(
      'section',
      { key: 'group-' + key, className: 'mp-set-group' },
      h(
        'div',
        { className: 'mp-set-group-head' },
        h('span', { className: 'mp-set-label' }, t(labelKey)),
        action || null,
      ),
      h('div', { className: 'mp-set-card' }, h('div', { className: 'mp-set-card-body' }, rows)),
      foot ? h('div', { key: 'foot', className: 'mp-set-foot' }, foot) : null,
    )
  }

  /** The lyric page's groups read their label from LYRIC_GROUP_DEFS. */
  function lyricGroup(key, rows) {
    var def = null
    for (var index = 0; index < LYRIC_GROUP_DEFS.length; index += 1) {
      if (LYRIC_GROUP_DEFS[index].key === key) def = LYRIC_GROUP_DEFS[index]
    }
    return def === null ? null : settingsGroup('lyric-' + key, def.labelKey, rows)
  }

  /** Bytes held by these localStorage keys: browsers keep strings as UTF-16. */
  function storageBytes(keys) {
    var total = 0
    if (typeof window === 'undefined' || !window.localStorage) return total
    for (var index = 0; index < keys.length; index += 1) {
      try {
        var raw = window.localStorage.getItem(keys[index])
        if (raw !== null) total += raw.length * 2
      } catch (error) {
        /* private mode */
      }
    }
    return total
  }

  function clearStorageKeys(keys) {
    if (typeof window === 'undefined' || !window.localStorage) return
    for (var index = 0; index < keys.length; index += 1) {
      try {
        window.localStorage.removeItem(keys[index])
      } catch (error) {
        /* private mode */
      }
    }
  }

  function currentLyricGlobalOffset() {
    return clampLyricGlobalOffset(prefs.lyricGlobalOffsetMs)
  }

  function formatLyricOffset(value) {
    var number = clampLyricGlobalOffset(value)
    return (number > 0 ? '+' : '') + number + ' ms'
  }

  function adjustLyricOffsetDraft(delta) {
    setLyricOffsetDraft(clampLyricGlobalOffset(lyricOffsetDraft + delta))
  }

  function lyricsTab() {
    // Folia's lyric page: 歌词来源 / 时间与过滤 / 分词 / 本地歌词文件格式优先级, plus the
    // plugin's own display controls in 插件.
    var lyricStyleId = typeof mpStyleIdOf === 'function' ? mpStyleIdOf(prefs.lyricStyle) : String(prefs.lyricStyle || '')
    // 莫奈 and 静止 paint their own translation row instead of Folia's shared subtitle
    // overlay, so the subtitle-background switch cannot do anything there.
    var subtitleBackgroundApplies = lyricStyleId !== 'monet' && lyricStyleId !== 'still'
    var fontScale = Math.round((Number(prefs.lyricsFontScale) || 1) * 100)
    var translationScale = Math.min(150, Math.max(50, Math.round(Number(prefs.translationScale) || 90)))
    var localPriority = prefs.lyricLocalPriority === 'online' ? 'online' : 'local'
    var preferredSource = String(prefs.lyricPreferredSource || 'qq')
    var globalOffset = currentLyricGlobalOffset()

    var sourceRows = [
      h(
        SetRow,
        {
          key: 'auto-best',
          label: t('settings.lyricAutoBest'),
          desc: t(prefs.autoUseBestLyric === false ? 'settings.lyricAutoBestOff' : 'settings.lyricAutoBestDesc'),
        },
        h(Switch, {
          value: prefs.autoUseBestLyric !== false,
          onChange: function (value) {
            patchPrefs({ autoUseBestLyric: value })
          },
        }),
      ),
      h(
        SetRow,
        { key: 'match-priority', label: t('settings.lyricMatchPriority'), desc: t('settings.lyricMatchPriorityDesc') },
        h(KitSelect, {
          value: preferredSource,
          label: t('settings.lyricMatchPriority'),
          options: [
            { value: 'qq', label: t('lyricSource.qq') },
            { value: 'netease', label: t('lyricSource.netease') },
            { value: 'amll', label: t('lyricSource.amll') },
            { value: 'kugouLite', label: t('lyricSource.kugouLite') },
            { value: 'qishui', label: t('lyricSource.qishui') },
          ],
          onChange: function (value) {
            patchPrefs({ lyricPreferredSource: String(value) })
          },
        }),
      ),
      h(
        SetRow,
        {
          key: 'keep-provider-word-timing',
          label: t('settings.lyricKeepProviderWordTiming'),
          desc: t('settings.lyricKeepProviderWordTimingDesc'),
        },
        h(Switch, {
          value: prefs.lyricKeepProviderWordTiming !== false,
          onChange: function (value) {
            patchPrefs({ lyricKeepProviderWordTiming: value })
          },
        }),
      ),
      h(
        SetRow,
        {
          key: 'local-priority',
          label: t('settings.lyricLocalPriority'),
          desc: t(localPriority === 'online'
            ? 'settings.lyricLocalPriorityOnlineDesc'
            : 'settings.lyricLocalPriorityLocalDesc'),
        },
        h(KitSegmented, {
          id: 'mp-lyric-local-priority',
          value: localPriority,
          label: t('settings.lyricLocalPriority'),
          options: [
            { value: 'local', label: t('settings.lyricLocalPriorityLocal') },
            { value: 'online', label: t('settings.lyricLocalPriorityOnline') },
          ],
          onChange: function (value) {
            patchPrefs({ lyricLocalPriority: String(value) })
          },
        }),
      ),
    ]

    var timingRows = [
      h(
        SetRow,
        { key: 'global-offset', label: t('settings.lyricGlobalOffset'), desc: t('settings.lyricGlobalOffsetDesc') },
        h('span', { className: 'mp-set-val' }, formatLyricOffset(globalOffset)),
        h(Button, {
          variant: 'ghost',
          onClick: function () {
            setLyricOffsetDraft(globalOffset)
            setLyricOffsetOpen(true)
          },
        }, t('settings.lyricGlobalOffsetAdjust')),
      ),
      h(
        SetRow,
        { key: 'filter', label: t('settings.lyricFilter'), desc: t('settings.lyricFilterDesc') },
        h(Button, {
          variant: 'ghost',
          onClick: function () {
            setLyricFilterOpen(true)
          },
        }, t('settings.lyricFilterEdit')),
      ),
    ]

    var formatRows = [
      h(
        SetRow,
        { key: 'format-order', label: t('settings.lyricFormatOrder'), desc: t('settings.lyricFormatOrderDesc') },
        h('span', { className: 'mp-set-val' }, lyricFormatSummary()),
        h(Button, {
          variant: 'ghost',
          onClick: function () {
            setLyricFormatOpen(!lyricFormatOpen)
          },
        }, t(lyricFormatOpen ? 'settings.lyricFormatCollapse' : 'settings.lyricFormatExpand')),
      ),
      lyricFormatOpen
        ? h(
            'div',
            { key: 'format-rows', className: 'mp-lyric-format-fold' },
            lyricFormatOrderRows(),
            h(Button, {
              variant: 'ghost',
              className: 'mp-lyric-format-reset',
              onClick: function () {
                patchPrefs({ lyricFormatOrder: LYRIC_FORMAT_FALLBACK.slice() })
              },
            }, t('settings.lyricFormatReset')),
          )
        : null,
    ]

    var pluginRows = [
      h(
        SetRow,
        { key: 'tr', label: t('page.translation') },
        h(Switch, {
          value: prefs.showTranslation === true,
          onChange: function (value) {
            patchPrefs({ showTranslation: value })
          },
        }),
      ),
      h(
        SetRow,
        {
          key: 'subtitle-bg',
          label: t('settings.subtitleOverlayBackground'),
          desc: t(subtitleBackgroundApplies ? 'settings.subtitleOverlayBackgroundDesc' : 'settings.subtitleOverlayBackgroundUnsupported'),
        },
        h(Switch, {
          value: prefs.subtitleOverlayBackground !== false,
          disabled: !subtitleBackgroundApplies,
          onChange: function (value) {
            patchPrefs({ subtitleOverlayBackground: value })
          },
        }),
      ),
      h(
        SetRow,
        { key: 'font-scale', label: t('settings.lyricFontScale'), desc: t('settings.lyricFontScaleDesc') },
        h('input', {
          type: 'range',
          className: 'mp-range',
          min: 70,
          max: 150,
          step: 5,
          value: fontScale,
          onChange: function (event) {
            patchPrefs({ lyricsFontScale: Number(event.target.value) / 100 })
          },
        }),
        h('span', { className: 'mp-set-val' }, fontScale + '%'),
      ),
      h(
        SetRow,
        { key: 'scale', label: t('page.translationScale'), desc: t('settings.translationScaleDesc') },
        h('input', {
          type: 'range',
          className: 'mp-range',
          min: 50,
          max: 150,
          step: 5,
          value: translationScale,
          onChange: function (event) {
            patchPrefs({ translationScale: Number(event.target.value) })
          },
        }),
        h('span', { className: 'mp-set-val' }, translationScale + '%'),
      ),
      h(
        SetRow,
        { key: 'composer-lyrics', label: t('settings.composerLyrics') },
        h(Switch, {
          value: prefs.composerLyrics === true,
          onChange: function (value) {
            patchPrefs({ composerLyrics: value })
          },
        }),
      ),
      h(
        SetRow,
        {
          key: 'composer-translation',
          label: t('settings.composerTranslation'),
          desc: t('settings.composerTranslationDesc'),
        },
        h(Switch, {
          value: prefs.composerTranslation !== false,
          onChange: function (value) {
            patchPrefs({ composerTranslation: value })
          },
        }),
      ),
    ]

    return [
      h('h2', { key: 'h' }, t('v2.lyrics')),
      lyricGroup('source', sourceRows),
      lyricGroup('timing', timingRows),
      lyricGroup('format', formatRows),
      lyricGroup('plugin', pluginRows),
      lyricOffsetDialog(),
      lyricFilterDialog(),
    ]
  }

  /** Folia's global lyric offset window: a draft, ±50 / ±10 steps, then Apply. */
  function lyricOffsetDialog() {
    if (!lyricOffsetOpen) return null
    var applied = currentLyricGlobalOffset()
    var draft = clampLyricGlobalOffset(lyricOffsetDraft)
    return h(
      KitModal,
      {
        key: 'lyric-offset',
        title: t('settings.lyricOffsetTitle'),
        small: true,
        onClose: function () {
          setLyricOffsetOpen(false)
        },
        footer: [
          h(Button, {
            key: 'cancel',
            variant: 'ghost',
            onClick: function () {
              setLyricOffsetOpen(false)
            },
          }, t('page.cancel')),
          h(Button, {
            key: 'apply',
            variant: 'primary',
            disabled: draft === applied,
            onClick: function () {
              patchPrefs({ lyricGlobalOffsetMs: draft })
              setLyricOffsetOpen(false)
            },
          }, t('settings.lyricOffsetApply')),
        ],
      },
      h(
        'div',
        { className: 'mp-kit-body' },
        h('p', { className: 'mp-set-desc' }, t('settings.lyricOffsetSubtitle')),
        h('div', { className: 'mp-lyric-offset-value' }, formatLyricOffset(draft)),
        h('p', { className: 'mp-set-desc mp-lyric-offset-hint' }, t(
          draft === 0
            ? 'settings.lyricOffsetNeutral'
            : draft > 0
              ? 'settings.lyricOffsetLater'
              : 'settings.lyricOffsetEarlier',
        )),
        h(
          'div',
          { className: 'mp-lyric-offset-actions' },
          [-50, -10, 10, 50].map(function (step) {
            return h(Button, {
              key: 'step-' + String(step),
              variant: 'ghost',
              onClick: function () {
                adjustLyricOffsetDraft(step)
              },
            }, (step > 0 ? '+' : '') + String(step))
          }),
          h(Button, {
            key: 'reset',
            variant: 'ghost',
            disabled: draft === 0,
            onClick: function () {
              setLyricOffsetDraft(0)
            },
          }, t('settings.lyricOffsetReset')),
        ),
      ),
    )
  }

  /** The lyric filter window: the two ready-made line presets plus free words. */
  function lyricFilterDialog() {
    if (!lyricFilterOpen) return null
    return h(
      KitModal,
      {
        key: 'lyric-filter',
        title: t('settings.lyricFilter'),
        small: true,
        onClose: function () {
          setLyricFilterOpen(false)
        },
        footer: [
          h(Button, {
            key: 'done',
            variant: 'primary',
            onClick: function () {
              setLyricFilterOpen(false)
            },
          }, t('page.done')),
        ],
      },
      h(
        'div',
        { className: 'mp-kit-body' },
        h('p', { className: 'mp-set-desc' }, t('settings.lyricFilterDialogHint')),
        h(
          SetRow,
          { key: 'filter-copyright', label: t('settings.lyricFilterCopyright'), desc: t('settings.lyricFilterCopyrightDesc') },
          h(Switch, {
            value: lyricFilterPresets().indexOf('copyright') >= 0,
            onChange: function (value) {
              toggleLyricFilterPreset('copyright', value)
            },
          }),
        ),
        h(
          SetRow,
          { key: 'filter-source', label: t('settings.lyricFilterSource') },
          h(Switch, {
            value: lyricFilterPresets().indexOf('lyricSource') >= 0,
            onChange: function (value) {
              toggleLyricFilterPreset('lyricSource', value)
            },
          }),
        ),
        h(
          SetRow,
          { key: 'filter-words', label: t('settings.lyricFilterWords'), desc: t('settings.lyricFilterWordsDesc') },
          h(KitInput, {
            value: String(prefs.lyricFilterWords || ''),
            placeholder: t('settings.lyricFilterWordsPlaceholder'),
            label: t('settings.lyricFilterWords'),
            onChange: function (value) {
              patchPrefs({ lyricFilterWords: value })
            },
          }),
        ),
      ),
    )
  }

  function playbackTab() {
    // Folia's 播放控制 page: 智能过渡 / 声音与设备 / 播放行为, then the plugin's own
    // extras (startup, online quality, reports, audio focus, sleep) in 插件.
    var reportSupported = availableSources().some(function (provider) { return supports(provider, 'playbackReports') })
    var crossfadeOn = crossfadeFadeSeconds(prefs) > 0
    // The mode is the only switch; `normalizeVolume` is the legacy mirror of it.
    var replayGainValue =
      prefs.replayGainMode === 'off' || prefs.replayGainMode === 'track' || prefs.replayGainMode === 'album'
        ? prefs.replayGainMode
        : 'auto'
    var queueAddBehavior = prefs.queueAddBehavior === 'next' ? 'next' : 'append'
    var wakeLockAvailable = typeof navigator !== 'undefined'
      && navigator.wakeLock !== null
      && typeof navigator.wakeLock === 'object'
      && typeof navigator.wakeLock.request === 'function'

    var transitionRows = [
      h(
        SetRow,
        {
          key: 'crossfade',
          label: t('settings.transition'),
          desc: t('settings.crossfadeHint'),
        },
        h(Switch, {
          value: crossfadeOn,
          onChange: function (value) {
            // Separate switch: turning it back on keeps the chosen maximum (Folia's
            // automixEnabled beside crossfadeMaxSec).
            patchPrefs({ crossfadeEnabled: value })
          },
        }),
      ),
      crossfadeOn
        ? h(
            SetRow,
            { key: 'crossfade-seconds', label: t('settings.crossfadeSeconds'), desc: t('settings.crossfadeSecondsHint') },
            h('input', {
              type: 'range',
              className: 'mp-range',
              min: CROSSFADE_MIN_SECONDS,
              max: CROSSFADE_MAX_SECONDS,
              step: 1,
              value: crossfadeFadeSeconds(prefs),
              onChange: function (event) { patchPrefs({ crossfadeSeconds: Number(event.target.value) }) },
            }),
            h('span', { className: 'mp-set-val' }, crossfadeFadeSeconds(prefs) + ' s'),
          )
        : null,
    ]

    var soundRows = [
      h(
        SetRow,
        {
          key: 'output-device',
          label: t('settings.outputDevice'),
          desc: !sinkSupported
            ? t('settings.outputDeviceUnsupported')
            : outputDevices.length === 0
              ? t('settings.outputDeviceLoadFailed')
              : t('settings.outputDeviceHint'),
        },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h(IconButton, {
            icon: 'refresh',
            size: 15,
            title: t('settings.outputDeviceRefresh'),
            disabled: !sinkSupported,
            onClick: function () { refreshOutputDevices() },
          }),
          h(KitSelect, {
            value: prefs.audioOutputDeviceId || '',
            label: t('settings.outputDevice'),
            disabled: !sinkSupported || outputDevices.length === 0,
            options: [{ value: '', label: t('settings.outputDefault') }].concat(
              outputDevices.map(function (device) {
                return { value: device.id, label: device.label }
              }),
            ),
            onChange: function (value) {
              var next = String(value || '')
              patchPrefs({ audioOutputDeviceId: next })
              player.setOutputDevice(next)
            },
          }),
        ),
      ),
      h(
        SetRow,
        {
          key: 'replayGain',
          label: t('settings.replayGain'),
          desc: t('settings.replayGainModeDesc'),
        },
        h(KitSegmented, {
          id: 'mp-replay-gain-mode',
          value: replayGainValue,
          label: t('settings.replayGain'),
          options: [
            { value: 'off', label: t('settings.replayGainOff') },
            { value: 'auto', label: t('settings.replayGainAuto') },
            { value: 'track', label: t('settings.replayGainTrack') },
            { value: 'album', label: t('settings.replayGainAlbum') },
          ],
          onChange: function (value) {
            // Folia: only 智能平衡 measures loudness; the tag modes read the source's own
            // figures, and off applies neither. The engine decides at once and mirrors the
            // legacy on/off key for older builds.
            if (player && typeof player.setGainMode === 'function') player.setGainMode(String(value))
            else patchPrefs({ replayGainMode: String(value) })
          },
        }),
      ),
      h('div', { key: 'replay-status-hint', className: 'mp-set-hint' }, t('settings.replayGainStatus')),
      h(
        'div',
        {
          key: 'normalize-status',
          className: cx(
            'mp-set-status',
            replayGainValue === 'track' || replayGainValue === 'album'
              ? 'is-on'
              : replayGainValue === 'off'
                ? 'is-off'
                : builtinLoudness
                  ? 'is-on'
                  : 'is-bad',
          ),
        },
        h('i'),
        h(
          'span',
          null,
          replayGainValue === 'track' || replayGainValue === 'album'
            ? t('settings.replayGainTagMode')
            : replayGainValue === 'off'
              ? t('settings.volumeNormalizeOff')
              : builtinLoudness
                ? t('settings.volumeNormalizeReady')
                : t('settings.volumeNormalizeMissing'),
        ),
        replayGainValue === 'auto' && !builtinLoudness
          ? h('span', { className: 'mp-set-status-hint' }, t('settings.volumeNormalizeMissingHint'))
          : null,
      ),
      h(
        SetRow,
        {
          key: 'playback-fade',
          label: t('settings.playbackFade'),
          desc: t('settings.playbackFadeHint'),
        },
        h(Switch, {
          value: prefs.playbackFade !== false,
          onChange: function (value) {
            patchPrefs({ playbackFade: value })
            player.setPlaybackFade(value)
          },
        }),
      ),
    ]

    var behaviorRows = [
      h(
        SetRow,
        {
          key: 'queue-add',
          label: t('settings.queueAddBehavior'),
          desc: t('settings.queueAddBehaviorDesc'),
        },
        h(KitSegmented, {
          id: 'mp-queue-add-behavior',
          value: queueAddBehavior,
          label: t('settings.queueAddBehavior'),
          options: [
            { value: 'append', label: t('settings.queueAppend') },
            { value: 'next', label: t('settings.queueNext') },
          ],
          onChange: function (value) {
            patchPrefs({ queueAddBehavior: String(value) === 'next' ? 'next' : 'append' })
          },
        }),
      ),
      h(
        SetRow,
        {
          key: 'auto-skip',
          label: t('settings.autoSkipUnplayable'),
          desc: t('settings.autoSkipUnplayableDesc'),
        },
        h(Switch, {
          value: prefs.autoSkipUnplayable === true,
          onChange: function (value) { patchPrefs({ autoSkipUnplayable: value }) },
        }),
      ),
      h(
        SetRow,
        {
          key: 'shuffle-round',
          label: t('settings.shuffleRoundNoRepeat'),
          desc: t('settings.shuffleRoundNoRepeatDesc'),
        },
        h(Switch, {
          value: prefs.shuffleRoundNoRepeat === true,
          onChange: function (value) { patchPrefs({ shuffleRoundNoRepeat: value }) },
        }),
      ),
      h(
        SetRow,
        {
          key: 'prevent-sleep',
          label: t('settings.preventSleep'),
          desc: t('settings.preventSleepDesc') + (wakeLockAvailable ? '' : ' ' + t('settings.preventSleepUnsupported')),
        },
        h(Switch, {
          value: prefs.preventSleepDuringPlayback === true,
          disabled: !wakeLockAvailable,
          onChange: function (value) {
            patchPrefs({ preventSleepDuringPlayback: value })
            if (player.refreshWakeLock) player.refreshWakeLock()
          },
        }),
      ),
      h(
        SetRow,
        {
          key: 'voice-input-pause',
          label: t('settings.voiceInputPause'),
          desc: t('settings.voiceInputPauseDesc') + (audioFocus.supported ? '' : ' ' + t('settings.audioFocusUnsupported')),
        },
        h(Switch, {
          value: prefs.voiceInputPause === true,
          label: t('settings.voiceInputPause'),
          disabled: !audioFocus.supported,
          onChange: function (value) { patchPrefs({ voiceInputPause: value }) },
        }),
      ),
    ]

    var pluginRows = [
      h(
        SetRow,
        { key: 'resume', label: t('settings.resumeOnStart') },
        h(Switch, {
          value: prefs.resumeOnStart === true,
          onChange: function (value) { patchPrefs({ resumeOnStart: value }) },
        }),
      ),
      h(
        SetRow,
        {
          key: 'auto',
          label: t('settings.autoResume'),
          // Folia restores and starts in one call; here the two are separate switches, so
          // the second one must say when it cannot do anything.
          desc: t('settings.autoResumeHint'),
        },
        h(Switch, {
          value: prefs.autoResume === true,
          disabled: prefs.resumeOnStart !== true,
          onChange: function (value) { patchPrefs({ autoResume: value }) },
        }),
      ),
      h(
        SetRow,
        { key: 'per', label: t('settings.rememberPerTrack') },
        h(Switch, {
          value: prefs.rememberPerTrack === true,
          onChange: function (value) { patchPrefs({ rememberPerTrack: value }) },
        }),
      ),
      h(
        SetRow,
        {
          key: 'online-quality',
          label: t('settings.onlineQuality'),
          desc: t('settings.onlineQualityDesc'),
        },
        h(KitSelect, {
          value: ['standard', 'high', 'lossless', 'hires'].indexOf(prefs.onlineQuality) >= 0 ? prefs.onlineQuality : 'high',
          label: t('settings.onlineQuality'),
          options: [
            { value: 'standard', label: t('sheet.qStandard') },
            { value: 'high', label: t('sheet.qHigh') },
            { value: 'lossless', label: t('sheet.qLossless') },
            { value: 'hires', label: t('sheet.qHires') },
          ],
          onChange: function (value) { patchPrefs({ onlineQuality: String(value) }) },
        }),
      ),
      h(
        SetRow,
        {
          key: 'playback-reports',
          label: t('settings.playbackReports'),
          desc: t('settings.playbackReportsHint') + (reportSupported ? '' : ' ' + t('settings.playbackReportsUnavailable')),
        },
        h(Switch, {
          value: prefs.playbackReports === true,
          onChange: function (value) { patchPrefs({ playbackReports: value }) },
        }),
      ),
      h(
        SetRow,
        {
          key: 'audio-focus-ducking',
          label: t('settings.audioFocusDucking'),
          desc: t('settings.audioFocusDuckingDesc'),
        },
        h(Switch, {
          value: prefs.audioFocusDucking !== false,
          label: t('settings.audioFocusDucking'),
          onChange: function (value) { patchPrefs({ audioFocusDucking: value }) },
        }),
      ),
      prefs.audioFocusDucking !== false
        ? h(
            SetRow,
            { key: 'audio-focus-level', label: t('settings.audioFocusDuckLevel'), desc: t('settings.audioFocusDuckLevelDesc') },
            h('input', {
              type: 'range',
              className: 'mp-range',
              min: 0,
              max: 100,
              step: 5,
              value: Math.round((isFinite(Number(prefs.audioFocusDuckLevel)) ? Number(prefs.audioFocusDuckLevel) : 0.3) * 100),
              onChange: function (event) {
                patchPrefs({ audioFocusDuckLevel: Number(event.target.value) / 100 })
              },
            }),
            h('span', { className: 'mp-set-val' }, Math.round((isFinite(Number(prefs.audioFocusDuckLevel)) ? Number(prefs.audioFocusDuckLevel) : 0.3) * 100) + '%'),
          )
        : null,
      prefs.audioFocusDucking !== false
        ? h(
            SetRow,
            { key: 'audio-focus-fade', label: t('settings.audioFocusFade'), desc: t('settings.audioFocusFadeDesc') },
            h('input', {
              type: 'range',
              className: 'mp-range',
              min: 0,
              max: 1000,
              step: 50,
              value: Number(prefs.audioFocusFadeMs) || 0,
              onChange: function (event) { patchPrefs({ audioFocusFadeMs: Number(event.target.value) }) },
            }),
            h('span', { className: 'mp-set-val' }, (Number(prefs.audioFocusFadeMs) || 0) + ' ms'),
          )
        : null,
      h(
        SetRow,
        { key: 'sleep', label: t('settings.sleepTimer') },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h(KitSelect, {
            value: String(prefs.sleepTimerMinutes || 0),
            label: t('settings.sleepTimer'),
            options: [0, 15, 30, 60, 90].map(function (minutes) {
              return {
                value: String(minutes),
                label: minutes === 0 ? t('settings.sleepOff') : t('v2.minutes', { n: minutes }),
              }
            }),
            onChange: function (value) {
              var minutes = Number(value) || 0
              patchPrefs({
                sleepTimerMinutes: minutes,
                sleepDeadline: minutes > 0 ? Date.now() + minutes * 60000 : 0,
              })
            },
          }),
          sleepRemaining > 0
            ? h('span', { className: 'mp-set-val' }, t('v2.sleepRemaining', { time: fmtClock(sleepRemaining / 1000) }))
            : null,
          sleepRemaining > 0
            ? h(
                Button,
                {
                  variant: 'ghost',
                  onClick: function () {
                    patchPrefs({ sleepTimerMinutes: 0, sleepDeadline: 0 })
                  },
                },
                t('v2.sleepCancel'),
              )
            : null,
        ),
      ),
    ]

    return [
      h('h2', { key: 'h' }, t('v2.playback')),
      settingsGroup('transition', 'settings.groupTransition', transitionRows, t('settings.transitionNote')),
      settingsGroup('sound', 'settings.groupSound', soundRows),
      settingsGroup('behavior', 'settings.groupBehavior', behaviorRows),
      settingsGroup('plugin', 'settings.groupPlugin', pluginRows),
    ]
  }

  function accountAvatar(info) {
    if (info.avatarUrl) {
      return h('img', {
        className: 'mp-account-avatar',
        src: API + 'online/cover?url=' + encodeURIComponent(info.avatarUrl),
        alt: '',
      })
    }
    return h('span', { className: 'mp-account-avatar is-fallback' }, (info.nickname || '?').slice(0, 1))
  }

  function onlineTab() {
    var providers = online.providers || {}
    // Only platforms that declare a sign-in flow get a card here; the list comes
    // from whatever the host registered, so a new platform needs no client edit.
    var ids = availableSources().filter(function (provider) {
      return provider !== 'local' && (supports(provider, 'loginQr') || supports(provider, 'loginPassword'))
    })
    var logged = ids.filter(function (provider) {
      return providers[provider] && providers[provider].loggedIn === true
    }).length
    function providerLabel(provider) {
      return sourceLabelOf(provider)
    }
    /**
     * Navidrome / Subsonic: a URL + credential form instead of a QR flow.
     * The password only travels once, to be traded for a salted token.
     */
    function navidromeCard(info, form, open, setOpen) {
      var busy = form.phase === 'loading'
      return h(
        'div',
        { key: 'navidrome', className: cx('mp-online-card', 'is-navidrome', info.loggedIn === true && 'is-logged', open === true && info.loggedIn !== true && 'is-expanded') },
        h(
          'div',
          { className: 'mp-online-card-head' },
          // Official logo, verbatim and unmodified (navidrome.org/brand allows
          // it for a server-connection screen). Sized to match the other
          // provider logos rather than above them, as the guidelines require.
          h('span', { className: 'mp-online-logo', title: 'Navidrome' }, providerLogo('navidrome', 38)),
          h(
            'div',
            { className: 'mp-online-title' },
            h('div', { className: 'mp-online-name' }, t('online.providerNavidrome')),
            h(
              'div',
              { className: 'mp-online-state' },
              info.loggedIn === true ? t('online.loggedIn') : t('online.loggedOut'),
            ),
          ),
        ),
        info.loggedIn === true
          ? h(
              'div',
              { className: 'mp-online-body' },
              h(
                'div',
                { className: 'mp-online-meta' },
                h('strong', { className: 'mp-online-nick' }, info.nickname || info.username || t('online.loggedIn')),
                info.server ? h('span', { className: 'mp-online-hint-text' }, info.server) : null,
                h(
                  'span',
                  { className: 'mp-online-hint-text' },
                  t(info.nativeSongs === true ? 'online.navidromeNativeOn' : 'online.navidromeNativeOff'),
                ),
              ),
              h(IconButton, {
                icon: 'logout',
                size: 15,
                title: t('online.logout'),
                onClick: function () {
                  form.reset()
                  void logoutProvider('navidrome')
                },
              }),
            )
          : open !== true
            ? h(
                'div',
                { className: 'mp-online-body is-out mp-navidrome-body is-compact' },
                h('span', { className: 'mp-online-hint-text' }, t('online.navidromeCompactHint')),
                h(Button, {
                  variant: 'primary',
                  icon: 'server',
                  className: 'mp-online-connect-btn',
                  onClick: function () {
                    setOpen(true)
                  },
                  children: t('online.navidromeConnect'),
                }),
              )
            : h(
              'div',
              { className: 'mp-online-body is-out mp-navidrome-body' },
              h('span', { className: 'mp-online-hint-text' }, t('online.navidromeHint')),
              h(KitInput, {
                type: 'url',
                placeholder: t('online.navidromeServerPlaceholder'),
                label: t('online.navidromeServerPlaceholder'),
                value: form.server,
                disabled: busy,
                onChange: function (value) {
                  form.setServer(value)
                },
              }),
              h(KitInput, {
                type: 'text',
                placeholder: t('online.navidromeUser'),
                label: t('online.navidromeUser'),
                value: form.username,
                disabled: busy,
                onChange: function (value) {
                  form.setUsername(value)
                },
              }),
              h(KitInput, {
                type: 'password',
                placeholder: t('online.navidromePassword'),
                label: t('online.navidromePassword'),
                value: form.password,
                disabled: busy,
                onChange: function (value) {
                  form.setPassword(value)
                },
              }),
              h(
                'div',
                {
                  className: 'mp-online-hint-text',
                  style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
                },
                h('span', null, t('online.navidromeKeep')),
                h(Switch, {
                  value: form.keepPassword === true,
                  label: t('online.navidromeKeep'),
                  disabled: busy,
                  onChange: function (next) {
                    form.setKeepPassword(next === true)
                  },
                }),
              ),
              form.keepPassword === true
                ? h('span', { className: 'mp-online-hint-text' }, t('online.navidromeKeepWarn'))
                : null,
              form.error !== ''
                ? h('span', { className: 'mp-online-error' }, form.error)
                : form.notice !== ''
                  ? h('span', { className: 'mp-online-ok' }, form.notice)
                  : null,
              h(
                'div',
                { className: 'mp-navidrome-footer' },
                h(Button, {
                  variant: 'ghost',
                  onClick: function () {
                    setOpen(false)
                  },
                  children: t('online.navidromeCollapse'),
                }),
                h(Button, {
                  variant: 'primary',
                  icon: 'checkCircle',
                  disabled: busy,
                  onClick: function () {
                    void form.connect()
                  },
                  children: busy ? t('online.navidromeConnecting') : t('online.navidromeConnect'),
                }),
              ),
            ),
      )
    }

    function card(provider) {
      var info = providers[provider] || {}
      // Navidrome signs in with credentials, not a QR code, so it gets its own
      // body instead of the shared "scan to sign in" branch below.
      if (provider === 'navidrome') return navidromeCard(info, navForm, navOpen, setNavOpen)
      return h(
        'div',
        { key: provider, className: cx('mp-online-card', 'is-' + provider, info.loggedIn === true && 'is-logged') },
        h(
          'div',
          { className: 'mp-online-card-head' },
          h('span', { className: 'mp-online-logo' }, providerLogo(provider, 38)),
          h(
            'div',
            { className: 'mp-online-title' },
            h('div', { className: 'mp-online-name' }, providerLabel(provider)),
            h(
              'div',
              { className: 'mp-online-state' },
              info.loggedIn === true ? t('online.loggedIn') : t('online.loggedOut'),
            ),
          ),
        ),
        info.loggedIn
          ? h(
              'div',
              { className: 'mp-online-body' },
              accountAvatar(info),
              h(
                'div',
                { className: 'mp-online-meta' },
                h('strong', {
                  className: 'mp-online-nick',
                  title: info.nickname || (provider === 'qq' ? t('online.qqAccount') : t('online.loggedIn')),
                }, info.nickname || (provider === 'qq' ? t('online.qqAccount') : t('online.loggedIn'))),
                info.accountId
                  ? h('span', { className: 'mp-online-id', title: 'ID ' + info.accountId }, 'ID ' + info.accountId)
                  : null,
                info.vip === true ? h('span', { className: 'mp-online-vip' }, 'VIP') : null,
              ),
              h(IconButton, {
                icon: 'logout',
                size: 15,
                title: t('online.logout'),
                onClick: function () {
                  void logoutProvider(provider)
                },
              }),
            )
          : h(
              'div',
              { className: 'mp-online-body is-out' },
              h('span', { className: 'mp-online-hint-text' }, t('online.accountHint')),
              h(Button, {
                variant: 'primary',
                icon: 'qr',
                onClick: function () {
                  pushLayer('login', { provider: provider })
                },
                children: t('online.login'),
              }),
            ),
      )
    }
    return [
      h(
        'div',
        { key: 'head', className: 'mp-online-head' },
        h('h2', null, t('v2.online')),
        h('span', { className: 'mp-online-count' }, t('online.loggedCount', { n: logged, total: ids.length })),
      ),
      h('div', { key: 'grid', className: 'mp-online-grid' }, ids.map(card)),
      h(
        'div',
        { key: 'hint', className: 'mp-online-foot' },
        icon('info', 13),
        h('span', null, t('online.settingsHint')),
      ),
    ]
  }

  function libraryTab() {
    var config = library.config || { roots: [], hiddenRoots: [], depth: 4 }
    var roots = Array.isArray(config.roots) ? config.roots : []
    var hiddenRoots = Array.isArray(config.hiddenRoots) ? config.hiddenRoots : []
    var scanning = library.phase === 'loading'
    function setRootVisible(root, visible) {
      var next = hiddenRoots.slice()
      var at = next.indexOf(root)
      if (visible && at >= 0) next.splice(at, 1)
      if (!visible && at < 0) next.push(root)
      void saveConfig({ hiddenRoots: next })
    }
    function removeRoot(root) {
      pushLayer('confirm', {
        title: t('page.delete'),
        text: t('settings.removeConfirm'),
        onConfirm: function () {
          var next = roots.filter(function (item) {
            return item !== root
          })
          void saveConfig({ roots: next })
        },
      })
    }
    function rescan() {
      if (scanning) return
      void loadLibrary(true)
      showToast(t('page.scanning'))
    }
    var folderRows =
      roots.length === 0
        ? [h('div', { key: 'empty', className: 'mp-set-empty-card' }, t('v2.noTracksHint'))]
        : roots.map(function (root) {
            var hidden = hiddenRoots.indexOf(root) >= 0
            return h(
              'div',
              { key: root, className: cx('mp-root-row', hidden && 'is-hidden') },
              h('span', { className: 'mp-root-icon' }, icon('folder', 16)),
              h(
                'div',
                { className: 'mp-root-main' },
                h('div', { className: 'mp-root-path', title: root }, root),
                h('div', { className: 'mp-root-state' }, hidden ? t('v2.folderHidden') : t('v2.folderVisible')),
              ),
              h(
                'div',
                { className: 'mp-root-actions' },
                h(Switch, {
                  value: !hidden,
                  label: hidden ? t('v2.folderHidden') : t('v2.folderVisible'),
                  onChange: function (visible) {
                    setRootVisible(root, visible)
                  },
                }),
                h(IconButton, {
                  icon: 'trash',
                  size: 15,
                  title: t('page.delete'),
                  onClick: function () {
                    removeRoot(root)
                  },
                }),
              ),
            )
          })
    return [
      h(
        'div',
        { key: 'head', className: 'mp-set-page-head' },
        h('h2', null, t('v2.library')),
        h(
          'span',
          { className: 'mp-set-page-meta' },
          t('settings.scannedTracks', { n: (library.tracks || []).length }),
          (library.warnings || []).length > 0
            ? ' · ' + t('settings.scanWarnings', { n: library.warnings.length })
            : '',
          library.truncated === true ? ' · ' + t('page.truncated') : '',
        ),
      ),
      h(
        'section',
        { key: 'folders', className: 'mp-set-card' },
        h(
          'div',
          { className: 'mp-set-card-head' },
          h('div', { className: 'mp-set-card-title' }, icon('folder', 13), t('settings.foldersTitle')),
          h(Button, {
            variant: 'ghost',
            icon: 'refresh',
            disabled: scanning,
            onClick: rescan,
            children: scanning ? t('page.scanning') : t('page.refresh'),
          }),
        ),
        h('div', { className: 'mp-set-card-body' }, folderRows),
        h(
          'div',
          { className: 'mp-root-add' },
          h(KitInput, {
            value: rootDraft,
            placeholder: 'D:\\Music',
            label: t('settings.addFolder'),
            onChange: function (value) {
              setRootDraft(value)
            },
            onKeyDown: function (event) {
              if (event.key === 'Enter') addRoot()
            },
          }),
          h(
            Button,
            { variant: 'ghost', icon: 'folder', onClick: function () { pushLayer('folderPicker') } },
            t('v2.folderBrowse'),
          ),
          h(Button, {
            variant: 'primary',
            icon: 'plus',
            disabled: busy || rootDraft.trim() === '',
            onClick: addRoot,
            children: t('settings.addFolderAction'),
          }),
        ),
      ),
      h(
        'section',
        { key: 'scan', className: 'mp-set-card' },
        h(
          'div',
          { className: 'mp-set-card-head' },
          h('div', { className: 'mp-set-card-title' }, icon('settings', 13), t('settings.scanSettings')),
        ),
        h(
          'div',
          { className: 'mp-set-card-body' },
          h(
            SetRow,
            { key: 'depth', label: t('settings.depth'), desc: t('settings.depthHint') },
            h(KitSelect, {
              value: String(config.depth === undefined ? 4 : config.depth),
              label: t('settings.depth'),
              options: [0, 1, 2, 3, 4, 5, 6].map(function (n) {
                return { value: String(n), label: String(n) }
              }),
              onChange: function (value) {
                void saveConfig({ depth: Number(value) })
              },
            }),
          ),
          h('div', { className: 'mp-set-hint-line' }, t('settings.formatsHint')),
        ),
      ),
      h(
        'section',
        { key: 'trash', className: 'mp-set-card' },
        h(
          'div',
          { className: 'mp-set-card-head' },
          h('div', { className: 'mp-set-card-title' }, icon('trash', 13), t('v2.trash')),
          h(Button, { variant: 'ghost', icon: 'trash', onClick: function () { pushLayer('trash', {}) } }, t('settings.openTrash')),
        ),
        h('div', { className: 'mp-set-card-body' }, h('p', { className: 'mp-set-desc' }, t('v2.trashHint'))),
      ),
    ]
  }

  function addRoot() {
    var value = rootDraft.trim()
    if (value === '' || busy) return
    var config = library.config || { roots: [] }
    var roots = Array.isArray(config.roots) ? config.roots.slice() : []
    if (roots.indexOf(value) >= 0) return
    roots.push(value)
    setBusy(true)
    saveConfig({ roots: roots }).then(function (ok) {
      setBusy(false)
      if (ok) {
        setRootDraft('')
        showToast(t('settings.foldersAdded', { n: roots.length }))
      }
    })
  }

  function cacheTab() {
    // Sizes below are read fresh each render; clearing localStorage rows bumps storageTick.
    void storageTick
    var config = library.config || {}
    var stats = cache || { songs: 0, files: 0, bytes: 0, categories: { audio: { files: 0, bytes: 0 }, cover: { files: 0, bytes: 0 } } }
    var dataStats = data || { files: 0, bytes: 0, categories: [] }
    var categories = Array.isArray(dataStats.categories) ? dataStats.categories : []
    function categoryBytes(id) {
      for (var index = 0; index < categories.length; index += 1) {
        if (categories[index].id === id) return Number(categories[index].bytes) || 0
      }
      return 0
    }
    var audioBytes = Number(stats.categories && stats.categories.audio && stats.categories.audio.bytes) || 0
    var coverBytes = Number(stats.categories && stats.categories.cover && stats.categories.cover.bytes) || 0
    var playlistsBytes = categoryBytes('favorites') + categoryBytes('playlists')
    var lyricClientKeys = ['lyric_timeline_offsets', 'lyric_segmentations']
    var lyricsBytes = categoryBytes('lyrics') + storageBytes(lyricClientKeys)
    var profileBytes = storageBytes(['music.profile.v1'])
    var balanceBytes = storageBytes(['music.balance.v1'])
    var limitGb = prefs.onlineCacheLimitGb === undefined ? 5 : Number(prefs.onlineCacheLimitGb)
    var limitOptions = [
      { value: '1', label: '1 GB' },
      { value: '2', label: '2 GB' },
      { value: '5', label: '5 GB' },
      { value: '10', label: '10 GB' },
      { value: '20', label: '20 GB' },
      { value: '50', label: '50 GB' },
      { value: '0', label: t('data.cacheNoLimit') },
    ]
    var cacheDir = library.cacheDir || library.defaultCacheDir || ''
    var customCache = typeof config.cacheDir === 'string' && config.cacheDir !== ''

    function refreshStorage() {
      getJson(API + 'online/cache').then(function (body) { setCache(body) }).catch(function () { setCache(null) })
      getJson(API + 'data').then(function (body) { setData(body) }).catch(function () { setData(null) })
      void loadConfig()
      setStorageTick(function (value) { return value + 1 })
    }

    function clearHostCategory(category) {
      return postJson(API + 'data/clear', { category: category })
    }

    function clearCacheCategory(category) {
      return postJson(API + 'online/cache', { category: category })
    }

    function runClear(run) {
      Promise.resolve().then(run).then(function () {
        showToast(t('data.cacheCleared'))
        refreshStorage()
      }).catch(function (error) {
        showToast(errorText(error))
      })
    }

    function confirmClear(titleKey, textKey, run) {
      pushLayer('confirm', {
        title: t(titleKey),
        text: t(textKey),
        onConfirm: function () {
          runClear(run)
        },
      })
    }

    function clearPlaylistsData() {
      runClear(function () {
        return Promise.all([clearHostCategory('favorites'), clearHostCategory('playlists')]).then(function () {
          void loadLibrary(false)
          void loadFavorites()
          void loadPlaylists()
        })
      })
    }

    function clearLyricClient() {
      if (typeof clearLyricClientCaches === 'function') {
        clearLyricClientCaches()
        return
      }
      clearStorageKeys(lyricClientKeys)
    }

    function clearLyricsData() {
      runClear(function () {
        return clearHostCategory('lyrics').then(function () {
          clearLyricClient()
        })
      })
    }

    function clearCoverData() {
      runClear(function () {
        return clearCacheCategory('cover')
      })
    }

    function clearAudioData() {
      runClear(function () {
        return clearCacheCategory('audio')
      })
    }

    function clearProfileData() {
      runClear(function () {
        if (typeof clearProfileStore === 'function') clearProfileStore()
        else clearStorageKeys(['music.profile.v1'])
      })
    }

    function clearBalanceData() {
      runClear(function () {
        if (typeof clearBalanceStore === 'function') clearBalanceStore()
        else clearStorageKeys(['music.balance.v1'])
      })
    }

    function clearAllDetails() {
      runClear(function () {
        return Promise.all([
          clearHostCategory('favorites'),
          clearHostCategory('playlists'),
          clearHostCategory('lyrics'),
          clearCacheCategory('cover'),
          clearCacheCategory('audio'),
        ]).then(function () {
          clearLyricClient()
          if (typeof clearProfileStore === 'function') clearProfileStore()
          else clearStorageKeys(['music.profile.v1'])
          if (typeof clearBalanceStore === 'function') clearBalanceStore()
          else clearStorageKeys(['music.balance.v1'])
          void loadLibrary(false)
          void loadFavorites()
          void loadPlaylists()
        })
      })
    }

    function exportLyrics() {
      if (busy) return
      setBusy(true)
      postJson(API + 'data/export-lyrics', {})
        .then(function (body) {
          setBusy(false)
          if (!body || !body.count) {
            showToast(t('data.exportEmpty'))
            return
          }
          showToast(t('data.exportDone', { n: body.count }))
          void revealHostDir('exports')
        })
        .catch(function (error) {
          setBusy(false)
          showToast(errorText(error))
        })
    }

    function clearButton(onClick) {
      return h(Button, { variant: 'ghost', icon: 'trash', onClick: onClick }, t('data.cacheClear'))
    }

    function detailRow(key, label, bytes, actions) {
      return h(
        SetRow,
        { key: 'detail-' + key, label: label },
        h('span', { className: 'mp-data-size' }, fmtBytes(bytes)),
        actions,
      )
    }

    var mediaRows = [
      h(
        SetRow,
        { key: 'cache-enable', label: t('data.cacheEnable'), desc: t('data.cacheEnableDesc') },
        h(Switch, {
          value: prefs.onlineCacheEnabled === true,
          onChange: function (value) {
            patchPrefs({ onlineCacheEnabled: value })
          },
        }),
      ),
      h(
        SetRow,
        {
          key: 'cache-dir',
          label: t('data.cacheDir'),
          desc: t(customCache ? 'data.cacheDirCustom' : 'data.cacheDirDefault'),
        },
        h('span', { className: 'mp-data-path', title: cacheDir }, cacheDir || t('data.cacheDirUnset')),
        h(IconButton, {
          icon: 'folder',
          size: 15,
          title: t('data.cacheDirOpen'),
          onClick: function () {
            void revealHostDir('cache')
          },
        }),
        h(
          Button,
          {
            variant: 'ghost',
            onClick: function () {
              pushLayer('folderPicker', { mode: 'cacheDir' })
            },
          },
          t('data.cacheDirPick'),
        ),
      ),
      h(
        SetRow,
        { key: 'cache-limit', label: t('data.cacheLimit'), desc: t('data.cacheLimitDesc') },
        h(KitSelect, {
          value: String(limitGb),
          label: t('data.cacheLimit'),
          options: limitOptions,
          onChange: function (value) {
            patchPrefs({ onlineCacheLimitGb: Number(value) })
          },
        }),
      ),
      h(
        SetRow,
        { key: 'cache-songs', label: t('data.cacheSongs'), desc: t('data.cacheSongsDesc') },
        h('span', { className: 'mp-data-size' }, t('data.cacheSongsValue', {
          songs: stats.songs || 0,
          size: fmtBytes(stats.bytes || 0),
        })),
      ),
    ]

    var detailRows = [
      detailRow('playlists', t('data.rowPlaylists'), playlistsBytes, clearButton(function () {
        confirmClear('data.clearPlaylistsTitle', 'data.clearPlaylistsText', clearPlaylistsData)
      })),
      detailRow('lyrics', t('data.rowLyrics'), lyricsBytes, [
        h(Button, { key: 'export', variant: 'ghost', icon: 'download', disabled: busy, onClick: exportLyrics }, t('data.rowLyricsExport')),
        clearButton(function () {
          confirmClear('data.clearLyricsTitle', 'data.clearLyricsText', clearLyricsData)
        }),
      ]),
      detailRow('cover', t('data.rowCover'), coverBytes, clearButton(function () {
        confirmClear('data.clearCoverTitle', 'data.clearCoverText', clearCoverData)
      })),
      detailRow('audio', t('data.rowAudio'), audioBytes, clearButton(function () {
        confirmClear('data.clearAudioTitle', 'data.clearAudioText', clearAudioData)
      })),
      detailRow('profile', t('data.rowProfile'), profileBytes, clearButton(function () {
        confirmClear('data.clearProfileTitle', 'data.clearProfileText', clearProfileData)
      })),
      detailRow('balance', t('data.rowBalance'), balanceBytes, clearButton(function () {
        confirmClear('data.clearBalanceTitle', 'data.clearBalanceText', clearBalanceData)
      })),
    ]

    var watchRows = [
      h(
        SetRow,
        { key: 'watch-folders', label: t('data.watchEnable'), desc: t('data.watchEnableDesc') },
        h(Switch, {
          value: config.watchFolders === true,
          onChange: function (value) {
            void saveHostConfig({ watchFolders: value })
          },
        }),
      ),
    ]

    var backupRows = [
      h(
        SetRow,
        { key: 'backup-row', label: t('data.backupRow'), desc: t('data.backupDesc') },
        h(
          Button,
          {
            variant: 'ghost',
            onClick: function () {
              setBackupOpen(true)
            },
          },
          t('data.backupOpen'),
        ),
      ),
    ]

    return [
      h('h2', { key: 'h' }, t('v2.dataTab')),
      settingsGroup('mediaCache', 'data.groupMedia', mediaRows),
      settingsGroup(
        'cacheDetails',
        'data.groupDetails',
        detailRows,
        null,
        h(
          Button,
          {
            variant: 'ghost',
            onClick: function () {
              confirmClear('data.clearAllTitle', 'data.clearAllText', clearAllDetails)
            },
          },
          t('data.clearAll'),
        ),
      ),
      settingsGroup('watch', 'data.groupWatch', watchRows),
      settingsGroup('backup', 'data.groupBackup', backupRows),
      h('div', { key: 'reset-head', className: 'mp-set-label' }, t('data.groupDanger')),
      h(
        'div',
        { key: 'danger', className: 'mp-data-danger' },
        h('div', { className: 'mp-data-danger-title' }, t('data.resetTitle')),
        h('p', { className: 'mp-data-danger-desc' }, t('data.resetHint')),
        h(
          Button,
          {
            variant: 'primary',
            className: 'mp-data-danger-btn',
            onClick: function () {
              setResetStage(1)
            },
          },
          t('data.resetAction'),
        ),
      ),
      backupDialog(),
    ]
  }

  /** Folia's 备份与导入: settings only (no cache, no credentials), as one JSON file. */
  function exportBackup() {
    if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof document === 'undefined') {
      showToast(t('data.backupUnavailable'))
      return
    }
    // The Host config in memory is the copy the cache page last read; fetch it fresh so an
    // export made from another tab still carries roots/hiddenRoots/watchFolders.
    loadConfig().then(function (hostConfig) {
      try {
        var payload = {
          format: 'dsh-music-panel.backup',
          version: 1,
          at: new Date().toISOString(),
          prefs: readPrefs(),
          host: hostConfig || library.config || {},
        }
        var url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
        var anchor = document.createElement('a')
        anchor.href = url
        anchor.download = 'dsh-music-panel-backup-' + new Date().toISOString().slice(0, 10) + '.json'
        anchor.style.display = 'none'
        document.body.appendChild(anchor)
        anchor.click()
        if (typeof anchor.remove === 'function') anchor.remove()
        window.setTimeout(function () {
          URL.revokeObjectURL(url)
        }, 1000)
        showToast(t('data.backupExported'))
      } catch (error) {
        showToast(errorText(error))
      }
    })
  }

  function pickBackupFile() {
    if (backupBusy) return
    if (backupFileRef.current && typeof backupFileRef.current.click === 'function') backupFileRef.current.click()
  }

  function readBackupFile(event) {
    var input = event && event.target
    var file = input && input.files && input.files[0]
    if (!file) return
    var reader = new FileReader()
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || ''))
        if (!parsed || parsed.format !== 'dsh-music-panel.backup' || parsed.version !== 1) {
          throw new Error(t('data.backupBadFile'))
        }
        var host = parsed.host && typeof parsed.host === 'object' ? parsed.host : {}
        var patch = {}
        if (Array.isArray(host.roots)) patch.roots = host.roots
        if (Array.isArray(host.hiddenRoots)) patch.hiddenRoots = host.hiddenRoots
        if (host.depth !== undefined) patch.depth = host.depth
        if (Array.isArray(host.extensions)) patch.extensions = host.extensions
        if (typeof host.cacheDir === 'string') patch.cacheDir = host.cacheDir
        if (typeof host.watchFolders === 'boolean') patch.watchFolders = host.watchFolders
        // A backup from another computer names folders and a cache directory that may not
        // exist here: drop the missing folders and retry without the cache path rather than
        // failing the whole restore.
        patch.allowMissingRoots = true
        setBackupBusy(true)
        function restoreHost() {
          return saveHostConfig(patch).then(function (body) {
            if (body || patch.cacheDir === undefined) return body
            delete patch.cacheDir
            return saveHostConfig(patch)
          })
        }
        restoreHost().then(function (body) {
          setBackupBusy(false)
          if (!body) return
          var source = parsed.prefs && typeof parsed.prefs === 'object' ? parsed.prefs : {}
          var allowed = typeof prefKeys === 'function' ? prefKeys() : []
          var prefsPatch = {}
          allowed.forEach(function (key) {
            if (source[key] !== undefined) prefsPatch[key] = source[key]
          })
          if (Object.keys(prefsPatch).length > 0) setPrefs(prefsPatch)
          setBackupOpen(false)
          var skipped = Array.isArray(body.skippedRoots) ? body.skippedRoots.length : 0
          showToast(skipped > 0 ? t('data.backupImportedSkipped', { n: skipped }) : t('data.backupImported'))
          void loadLibrary(true)
        })
      } catch (error) {
        setBackupBusy(false)
        showToast(errorText(error))
      }
    }
    reader.onerror = function () {
      setBackupBusy(false)
      showToast(t('data.backupBadFile'))
    }
    reader.readAsText(file)
    if (input) input.value = ''
  }

  function backupDialog() {
    if (!backupOpen) return null
    return h(
      KitModal,
      {
        key: 'backup',
        title: t('data.backupTitle'),
        small: true,
        onClose: function () {
          if (!backupBusy) setBackupOpen(false)
        },
        footer: [
          h(
            Button,
            {
              key: 'close',
              variant: 'ghost',
              disabled: backupBusy,
              onClick: function () {
                setBackupOpen(false)
              },
            },
            t('v2.close'),
          ),
        ],
      },
      h(
        'div',
        { className: 'mp-kit-body' },
        h('p', { className: 'mp-set-desc' }, t('data.backupHint')),
        h(
          'div',
          { className: 'mp-data-actions' },
          h(Button, { icon: 'download', disabled: backupBusy, onClick: exportBackup }, t('data.backupExport')),
          h(Button, { disabled: backupBusy, onClick: pickBackupFile }, t('data.backupImport')),
        ),
        h('input', {
          ref: backupFileRef,
          type: 'file',
          accept: '.json,application/json',
          style: { display: 'none' },
          onChange: readBackupFile,
        }),
      ),
    )
  }

  function aboutTab() {
    var kit = typeof hostKitState === 'function' ? hostKitState() : { state: hostUi ? 'native' : 'fallback', missing: [] }
    return [
      h('h2', { key: 'h' }, t('v2.about')),
      h(
        'div',
        { key: 'card', className: 'mp-about-card' },
        h('img', { className: 'mp-about-logo', src: BRAND_LOGO, alt: '' }),
        h(
          'div',
          { className: 'mp-about-main' },
          h('div', { className: 'mp-about-name' }, 'dsh-music-panel'),
          h('div', { className: 'mp-about-version' }, t('about.version') + ' ' + APP_VERSION),
          h('div', { className: 'mp-about-tagline' }, t('about.tagline')),
        ),
      ),
      h(
        'div',
        { key: 'meta', className: 'mp-about-rows' },
        h('div', { className: 'mp-about-row' }, h('span', null, t('about.project')), h('strong', null, 'DeepSeek Harness Music Panel')),
        h('div', { className: 'mp-about-row' }, h('span', null, t('about.license')), h('strong', null, 'AGPL-3.0-only')),
        h('div', { className: 'mp-about-row' }, h('span', null, t('about.author')), h('strong', null, 'Aliboder')),
        h(
          'div',
          { className: 'mp-about-row' },
          h('span', null, t('about.feedback')),
          h(
            'a',
            { href: 'https://github.com/Aliboder/dsh-music-panel/issues', target: '_blank', rel: 'noreferrer' },
            'GitHub Issues',
          ),
        ),
      ),
      h(
        'div',
        { key: 'links', className: 'mp-about-links' },
        h(
          'a',
          { href: 'https://github.com/Aliboder/dsh-music-panel', target: '_blank', rel: 'noreferrer' },
          t('about.source'),
        ),
        h(
          'a',
          { href: 'https://www.npmjs.com/package/dsh-music-panel', target: '_blank', rel: 'noreferrer' },
          t('about.npm'),
        ),
      ),
      h('div', { key: 'diag-head', className: 'mp-set-label' }, t('about.diagnostics')),
      h(
        SetRow,
        { key: 'hostkit', label: t('v2.hostKit'), desc: t('v2.hostKitDesc') },
        h(
          KitTag,
          { tone: kit.state === 'native' ? 'info' : kit.state === 'partial' ? 'warning' : 'neutral' },
          kit.state === 'native'
            ? t('v2.hostKitNative')
            : kit.state === 'partial'
              ? t('v2.hostKitPartial', { n: kit.missing.length })
              : t('v2.hostKitFallback'),
        ),
      ),
      h(
        SetRow,
        { key: 'gallery', label: t('about.componentTest'), desc: t('about.componentTestDesc') },
        h(Button, { icon: 'list', onClick: function () { setGalleryOpen(true) } }, t('about.componentTestOpen')),
      ),
      h('p', { key: 'desc', className: 'mp-set-desc' }, t('about.description')),
    ]
  }

  var body =
    tab === 'appearance'
      ? appearanceTab()
      : tab === 'lyrics'
        ? lyricsTab()
        : tab === 'playback'
          ? playbackTab()
          : tab === 'online'
            ? onlineTab()
            : tab === 'library'
              ? libraryTab()
              : tab === 'cache'
                ? cacheTab()
                : aboutTab()

  return h(
    KitModal,
    { headless: true, onClose: props.onClose, className: 'mp-kit-sheet' },
    h(
      'div',
      { className: 'mp-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('page.settings') },
      galleryOpen
        ? h(ComponentGallery, {
            key: 'gallery',
            onClose: function () {
              setGalleryOpen(false)
            },
          })
        : [
            h(
              'div',
              { key: 'nav', className: 'mp-sheet-nav' },
              h('div', { className: 'mp-sheet-title' }, t('page.settings')),
              SETTINGS_TABS.map(function (item) {
                return h(
                  'button',
                  {
                    key: item.key,
                    type: 'button',
                    className: cx('mp-sheet-tab', tab === item.key && 'is-on'),
                    onClick: function () {
                      setTab(item.key)
                    },
                  },
                  icon(item.glyph, 15),
                  h('span', { className: 'mp-sheet-tab-label' }, t(item.label)),
                )
              }),
            ),
            h(
              'button',
              {
                key: 'close',
                type: 'button',
                className: 'mp-sheet-close',
                title: t('v2.close'),
                'aria-label': t('v2.close'),
                onClick: props.onClose,
              },
              icon('x', 16),
            ),
            h('div', { key: 'body', className: 'mp-sheet-body' }, body, resetDialog()),
          ],
    ),
  )
}



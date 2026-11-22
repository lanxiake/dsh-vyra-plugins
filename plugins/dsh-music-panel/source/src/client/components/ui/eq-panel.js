/**
 * eq-panel: the equalizer surface inside the audio-effects popover.
 *
 * Three tabs, mirroring how desktop players organise this: factory presets,
 * the user's saved curves, and the editor (response curve + faders + effects).
 * All state lives in prefs through `player.setEq`, so the panel stays a pure
 * view of a single source of truth.
 */

var EQ_TABS = [
  { id: 'presets', labelKey: 'eq.tabPresets' },
  { id: 'device', labelKey: 'eq.tabDevices' },
  { id: 'mine', labelKey: 'eq.tabMine' },
  { id: 'edit', labelKey: 'eq.tabEdit' },
]

/** One page of the AutoEQ library; "load more" appends the next batch. */
var EQ_DEVICE_PAGE = 40

/** Folia's six sound presets; the bundle owns the gains and effects. */
var FOLIA_AUDIO_API = typeof __mpAudioBundle === 'function' ? __mpAudioBundle() : null
var FOLIA_SOUND_PRESETS =
  FOLIA_AUDIO_API !== null && FOLIA_AUDIO_API.AUDIO_SOUND_PRESETS
    ? FOLIA_AUDIO_API.AUDIO_SOUND_PRESETS
    : {}
var FOLIA_SOUND_PRESET_IDS =
  FOLIA_AUDIO_API !== null && Array.isArray(FOLIA_AUDIO_API.AUDIO_SOUND_PRESET_IDS)
    ? FOLIA_AUDIO_API.AUDIO_SOUND_PRESET_IDS
    : []
var FOLIA_SOUND_PRESET_LABELS = {
  flat: 'eq.presetFlat',
  lofi: 'eq.presetLofi',
  radio: 'eq.presetRadio',
  hall: 'eq.presetHall',
  vocal: 'eq.presetVocal',
  bass: 'eq.presetBass',
}

/** AutoEQ stores the measurement rig family; show it in the user's language. */
function eqFormLabel(form) {
  var value = String(form || '')
  if (value.indexOf('in-ear') !== -1) return t('eq.formInEar')
  if (value.indexOf('over-ear') !== -1) return t('eq.formOverEar')
  if (value.indexOf('earbud') !== -1) return t('eq.formEarbud')
  return value
}

function eqFormatDb(value) {
  var db = Number(value) || 0
  if (Math.abs(db) < 0.05) return '0'
  var rounded = Math.round(db)
  // AutoEQ gains land on tenths; show them instead of pretending to be whole.
  var text = Math.abs(db - rounded) < 0.05 ? String(Math.abs(rounded)) : Math.abs(db).toFixed(1)
  return (db > 0 ? '+' : '-') + text
}

function eqFrequencyLabel(freq) {
  return freq >= 1000 ? String(freq / 1000) + 'k' : String(freq)
}

/** Tiny ten-bar thumbnail of a curve, used in the preset and saved lists. */
function EqMiniBars(props) {
  var bands = props.bands || []
  return h(
    'span',
    { className: 'mp-eq-bars', 'aria-hidden': 'true' },
    EQ_FREQS.map(function (_, index) {
      var db = clamp(Number(bands[index]) || 0, -EQ_MAX_DB, EQ_MAX_DB)
      return h('i', { key: index, style: { height: Math.round(50 + (db / EQ_MAX_DB) * 50) + '%' } })
    }),
  )
}

/** Real magnitude response of the current chain, drawn as a line. */
function EqCurve(props) {
  var bands = props.bands || []
  var samples = eqCurveSamples(bands, 0, 72, 44100)
  var width = 300
  var height = 64
  var span = EQ_MAX_DB + 6
  var lowLog = Math.log(EQ_MIN_HZ)
  var highLog = Math.log(EQ_MAX_HZ)
  var points = samples.map(function (sample) {
    var x = ((Math.log(sample.freq) - lowLog) / (highLog - lowLog)) * width
    var y = height / 2 - (sample.db / span) * (height / 2)
    return x.toFixed(1) + ',' + clamp(y, 0, height).toFixed(1)
  })
  return h(
    'svg',
    {
      className: 'mp-eq-curve',
      viewBox: '0 0 ' + width + ' ' + height,
      preserveAspectRatio: 'none',
      'aria-hidden': 'true',
    },
    h('line', {
      x1: 0,
      y1: height / 2,
      x2: width,
      y2: height / 2,
      className: 'mp-eq-curve-zero',
      vectorEffect: 'non-scaling-stroke',
    }),
    h('polyline', {
      points: points.join(' '),
      className: 'mp-eq-curve-line',
      vectorEffect: 'non-scaling-stroke',
    }),
  )
}

function EqFader(props) {
  return h(
    'div',
    { className: cx('mp-eq-fader', (Number(props.value) || 0) !== 0 && 'is-active') },
    h('span', { className: 'mp-eq-fader-value' }, eqFormatDb(props.value)),
    h('input', {
      type: 'range',
      min: -EQ_MAX_DB,
      max: EQ_MAX_DB,
      step: 0.5,
      value: Number(props.value) || 0,
      'aria-label': props.label + ' Hz',
      title: props.label + ' Hz',
      onChange: function (event) {
        props.onChange(Number(event.target.value))
      },
      onDoubleClick: function () {
        props.onChange(0)
      },
    }),
    h('span', { className: 'mp-eq-fader-label' }, props.label),
  )
}

var EQ_EFFECT_LABEL_KEYS = {
  highpass: 'eq.fxHighpass',
  lowpass: 'eq.fxLowpass',
  drive: 'eq.fxDrive',
  crush: 'eq.fxCrush',
  wow: 'eq.fxWow',
  noise: 'eq.fxNoise',
  width: 'eq.fxWidth',
  space: 'eq.fxSpace',
  punch: 'eq.fxPunch',
}

function eqEffectReadout(control, value) {
  if (control.unit === 'hz') {
    return value >= 1000 ? (value / 1000).toFixed(1) + ' kHz' : Math.round(value) + ' Hz'
  }
  return Math.round(value * 100) + '%'
}

/** One Folia post-EQ effect slider. */
function EqEffectRow(props) {
  var control = props.control
  var value = Number(props.value)
  return h(
    'div',
    { className: 'mp-eq-fx-row' },
    h('span', { className: 'mp-eq-fx-label' }, t(EQ_EFFECT_LABEL_KEYS[control.id])),
    h('input', {
      type: 'range',
      min: control.min,
      max: control.max,
      step: control.step,
      value: isFinite(value) ? value : control.neutral,
      className: 'mp-range',
      'aria-label': t(EQ_EFFECT_LABEL_KEYS[control.id]),
      onChange: function (event) {
        var next = normalizeEqEffects(props.effects)
        next[control.id] = Number(event.target.value)
        player.setEq({ effects: next, enabled: true })
      },
    }),
    h('span', { className: 'mp-eq-fx-value' }, eqEffectReadout(control, isFinite(value) ? value : control.neutral)),
  )
}


function EqPresetTile(props) {
  return h(
    'button',
    {
      type: 'button',
      className: cx('mp-eq-preset', props.active === true && 'is-on'),
      onClick: props.onClick,
      title: props.title || props.name,
    },
    h('span', { className: 'mp-eq-preset-name' }, props.name),
    props.caption ? h('span', { className: 'mp-eq-preset-caption' }, props.caption) : null,
    h(EqMiniBars, { bands: props.bands }),
  )
}

/**
 * audio-effects: one popover with two views.
 *
 * The volume controls and the equalizer are content of the same panel, not two
 * popovers that swap under the button, so the panel keeps its position and
 * chrome while the view changes.
 */

var AUDIO_FX_VIEWS = [
  { id: 'audio', labelKey: 'page.volume' },
  { id: 'eq', labelKey: 'eq.title' },
]

function AudioEffectsPanel(props) {
  var snap = props.snap || {}
  var prefs = props.prefs || {}
  var track = props.track || null
  var view = props.view === 'eq' ? 'eq' : 'audio'
  var volume = clamp(Number(snap.volume), 0, 1)
  if (!isFinite(volume)) volume = 1
  var muted = snap.muted === true
  var crossfadeOn = crossfadeFadeSeconds(prefs) > 0

  function show(next) {
    if (typeof props.onView === 'function') props.onView(next)
  }

  function toggleCrossfade(value) {
    // The switch and the maximum are separate values; the engine decides the real overlap.
    setPrefs({ crossfadeEnabled: value })
  }

  var body =
    view === 'audio'
      ? h(
          'div',
          { className: 'mp-fx-body' },
          h(
            'div',
            { className: 'mp-fx-row' },
            h('span', { className: 'mp-fx-label' }, t('page.volume')),
            h('span', { className: 'mp-fx-value' }, Math.round((muted ? 0 : volume) * 100) + '%'),
          ),
          h('input', {
            type: 'range',
            className: 'mp-range mp-fx-range',
            min: 0,
            max: 1,
            step: 0.01,
            value: volume,
            'aria-label': t('page.volume'),
            onChange: function (event) {
              player.setVolume(Number(event.target.value))
            },
          }),
          h(
            'div',
            { className: 'mp-np-extra-row' },
            h('span', null, t('settings.volumeNormalize')),
            h(Switch, {
              // The switch is 智能平衡 / 关闭 — the same mode the 音频增益 row shows
              // (Folia has no separate normalization flag).
              value: prefs.replayGainMode === 'auto',
              onChange: function (value) {
                if (player && typeof player.setGainMode === 'function') player.setGainMode(value ? 'auto' : 'off')
                else setPrefs({ replayGainMode: value ? 'auto' : 'off', normalizeVolume: value })
              },
            }),
          ),
          h(
            'div',
            { className: 'mp-np-extra-row', title: t('settings.crossfadeHint') },
            h('span', null, t('settings.crossfade')),
            h(Switch, {
              value: crossfadeOn,
              label: t('settings.crossfade'),
              onChange: toggleCrossfade,
            }),
          ),
          // Pinned to the bottom of the fixed-height card so the panel reads as
          // a filled card instead of controls floating in empty space.
          h(
            'div',
            { className: 'mp-fx-hint' },
            track && track.qualityHint ? track.qualityHint : t('online.qualityStandard'),
          ),
        )
      : h(EqPanel, { prefs: prefs })

  return h(
    'div',
    { className: 'mp-np-extra-pop is-effects' },
    h(
      'div',
      { className: 'mp-fx-head' },
      h('span', { className: 'mp-fx-title' }, t('page.audioEffects')),
      h(
        'div',
        { className: 'mp-fx-seg', role: 'tablist' },
        AUDIO_FX_VIEWS.map(function (item) {
          return h(
            'button',
            {
              key: item.id,
              type: 'button',
              role: 'tab',
              'aria-selected': view === item.id,
              className: cx('mp-fx-seg-btn', view === item.id && 'is-on'),
              onClick: function () {
                show(item.id)
              },
            },
            t(item.labelKey),
          )
        }),
      ),
    ),
    body,
  )
}

function EqPanel(props) {
  var subscribedPrefs = usePrefs()
  // The now-playing bar already keeps a live prefs snapshot (the volume view
  // reads it). Prefer that snapshot when the parent provides one: this pane is
  // the only one with its own subscription, and a dropped subscription made it
  // show stale EQ state while the sound and every other view were current.
  var prefs =
    props && props.prefs && props.prefs.eqBands !== undefined ? props.prefs : subscribedPrefs
  var eq = normalizeEqPrefs(prefs)
  var initialTab = props.initialTab
  var tabPair = useState(
    initialTab === 'device' || initialTab === 'mine' || initialTab === 'edit' ? initialTab : 'presets',
  )
  var tab = tabPair[0]
  var setTab = tabPair[1]
  var slots = normalizeEqSlots(eq.slots)
  var available = player.getEq().available
  function soundPresetForBands(bands) {
    for (var index = 0; index < FOLIA_SOUND_PRESET_IDS.length; index += 1) {
      var id = FOLIA_SOUND_PRESET_IDS[index]
      var preset = FOLIA_SOUND_PRESETS[id]
      if (preset && eqBandsEqual(preset.gains, bands)) return id
    }
    return ''
  }
  var activePreset =
    eq.preset === 'device'
      ? 'device'
      : FOLIA_SOUND_PRESET_IDS.indexOf(eq.preset) >= 0
        ? eq.preset
        : soundPresetForBands(eq.bands) || eqPresetForBands(eq.bands)

  // ── AutoEQ device search (debounced, cancelled by sequence) ──────────
  var searchPair = useState('')
  var search = searchPair[0]
  var setSearch = searchPair[1]
  var foundPair = useState([])
  var found = foundPair[0]
  var setFound = foundPair[1]
  var loadingPair = useState(false)
  var loading = loadingPair[0]
  var setLoading = loadingPair[1]
  var errorPair = useState('')
  var searchError = errorPair[0]
  var setSearchError = errorPair[1]
  var totalPair = useState(0)
  var total = totalPair[0]
  var setTotal = totalPair[1]
  var morePair = useState(false)
  var loadingMore = morePair[0]
  var setLoadingMore = morePair[1]
  var searchSeq = useRef(0)

  /**
   * One page of the device library. `offset` doubles as the append position:
   * the panel only ever grows the list downward.
   */
  function fetchDevices(text, offset, append) {
    var seq = searchSeq.current + 1
    searchSeq.current = seq
    if (append) setLoadingMore(true)
    else setLoading(true)
    getJson(
      API +
        'eq/presets?q=' +
        encodeURIComponent(text) +
        '&limit=' +
        EQ_DEVICE_PAGE +
        '&offset=' +
        offset,
    )
      .then(function (body) {
        if (searchSeq.current !== seq) return
        var rows = Array.isArray(body.results) ? body.results : []
        setFound(function (previous) {
          return append ? previous.concat(rows) : rows
        })
        setTotal(Number(body.total) || 0)
        setSearchError('')
      })
      .catch(function (error) {
        if (searchSeq.current !== seq) return
        if (!append) setFound([])
        setSearchError(error && error.message ? error.message : t('eq.searchFailed'))
      })
      .then(function () {
        if (searchSeq.current !== seq) return
        setLoading(false)
        setLoadingMore(false)
      })
  }

  useEffect(
    function () {
      if (tab !== 'device') return undefined
      var text = String(search || '').trim()
      // Typing waits for a pause; opening the tab loads the head of the library
      // immediately so the tab always shows profiles, like the preset grid.
      var timer = setTimeout(
        function () {
          fetchDevices(text, 0, false)
        },
        text === '' ? 0 : 220,
      )
      return function () {
        clearTimeout(timer)
      }
    },
    [tab, search],
  )

  function applyDevice(entry) {
    if (!entry || !Array.isArray(entry.bands)) return
    player.setEq({
      bands: entry.bands,
      preset: 'device',
      device: entry.id,
      enabled: true,
    })
  }

  function loadMoreDevices() {
    if (loading || loadingMore) return
    fetchDevices(String(search || '').trim(), found.length, true)
  }

  function usePreset(presetId) {
    var preset = FOLIA_SOUND_PRESETS[presetId]
    if (!preset) return
    player.setEq({
      preset: presetId,
      bands: preset.gains,
      effects: preset.effects,
      enabled: true,
    })
  }

  function changeBand(index, value) {
    var bands = eq.bands.slice()
    bands[index] = clamp(Number(value) || 0, -EQ_MAX_DB, EQ_MAX_DB)
    player.setEq({ bands: bands, preset: eqPresetForBands(bands), enabled: true })
  }

  function useSlot(index) {
    var slot = normalizeEqSlots(eq.slots)[index]
    player.setEq({
      preset: 'custom' + (index + 1),
      bands: slot.bands,
      effects: slot.effects,
      enabled: true,
    })
  }

  function saveSlot(index) {
    var next = normalizeEqSlots(eq.slots)
    next[index] = {
      bands: eq.bands.slice(),
      effects: normalizeEqEffects(eq.effects),
    }
    player.setEq({
      slots: next,
      preset: 'custom' + (index + 1),
      bands: next[index].bands,
      effects: next[index].effects,
      enabled: true,
    })
    showToast(t('eq.saved'))
  }

  var body = null
  if (tab === 'presets') {
    var soundIds = FOLIA_SOUND_PRESET_IDS.length > 0
      ? FOLIA_SOUND_PRESET_IDS
      : EQ_PRESETS.map(function (preset) { return preset.id })
    body = h(
      'div',
      { className: 'mp-eq-grid' },
      soundIds.map(function (presetId) {
        var sound = FOLIA_SOUND_PRESETS[presetId]
        var labelKey = FOLIA_SOUND_PRESET_LABELS[presetId]
        return h(EqPresetTile, {
          key: presetId,
          name: labelKey ? t(labelKey) : eqPresetName(eqPresetById(presetId)),
          bands: sound ? sound.gains : eqBandsForPreset(presetId),
          active: activePreset === presetId && eq.enabled,
          onClick: function () {
            usePreset(presetId)
          },
        })
      }),
    )
  } else if (tab === 'device') {
    // Same tile grid as the factory presets, so the two libraries read alike.
    var deviceTiles = found.map(function (entry) {
      return h(EqPresetTile, {
        key: entry.id,
        name: entry.name,
        caption: entry.source + (entry.form ? ' · ' + eqFormLabel(entry.form) : ''),
        bands: entry.bands,
        active: eq.preset === 'device' && eq.device === entry.id,
        onClick: function () {
          applyDevice(entry)
        },
      })
    })
    var selectedName = ''
    if (eq.preset === 'device' && eq.device !== '') {
      var parts = String(eq.device).split('::')
      selectedName = parts.length > 2 ? parts.slice(2).join('::') : eq.device
    }
    body = h(
      'div',
      { className: 'mp-eq-device' },
      h('input', {
        type: 'text',
        className: 'mp-eq-search',
        value: search,
        placeholder: t('eq.searchDevice'),
        'aria-label': t('eq.searchDevice'),
        onChange: function (event) {
          setSearch(event.target.value)
        },
      }),
      selectedName !== ''
        ? h('div', { className: 'mp-eq-device-current' }, t('eq.deviceCurrent', { name: selectedName }))
        : null,
      h(
        'div',
        { className: 'mp-eq-device-scroll' },
        deviceTiles.length > 0
          ? h('div', { className: 'mp-eq-grid' }, deviceTiles)
          : h(
              'div',
              { className: 'mp-eq-empty' },
              h(
                'span',
                { className: 'mp-eq-empty-title' },
                loading ? t('eq.searching') : searchError !== '' ? searchError : t('eq.searchEmpty'),
              ),
            ),
      ),
      // Outside the scroll area so it stays reachable however long the list is.
      found.length > 0 && found.length < total
        ? h(
            'button',
            { type: 'button', className: 'mp-eq-more', onClick: loadMoreDevices },
            loadingMore ? t('eq.searching') : t('eq.loadMore'),
          )
        : null,
      total > 0
        ? h('div', { className: 'mp-eq-device-count' }, t('eq.deviceCount', { shown: found.length, total: total }))
        : null,
    )
  } else if (tab === 'mine') {
    body = h(
      'div',
      { className: 'mp-eq-mine' },
      h(
        'div',
        { className: 'mp-eq-slots' },
        EQ_CUSTOM_SLOT_IDS.map(function (id, index) {
          var slot = slots[index]
          return h(
            'div',
            { key: id, className: cx('mp-eq-slot', eq.enabled && eq.preset === id && 'is-on') },
            h(
              'button',
              {
                type: 'button',
                className: 'mp-eq-slot-main',
                'aria-pressed': eq.enabled && eq.preset === id,
                onClick: function () {
                  useSlot(index)
                },
              },
              h('span', { className: 'mp-eq-slot-name' }, t('eq.slotN', { n: index + 1 })),
              h(EqMiniBars, { bands: slot.bands }),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'mp-eq-slot-save',
                onClick: function () {
                  saveSlot(index)
                },
              },
              t('eq.saveHere'),
            ),
          )
        }),
      ),
      h('div', { className: 'mp-eq-hint' }, t('eq.slotHint')),
    )
  } else {
    body = h(
      'div',
      { className: 'mp-eq-edit' },
      h(EqCurve, { bands: eq.bands }),
      h(
        'div',
        { className: 'mp-eq-faders' },
        EQ_FREQS.map(function (freq, index) {
          return h(EqFader, {
            key: freq,
            label: eqFrequencyLabel(freq),
            value: eq.bands[index],
            offset: eq.bands[index],
            onChange: function (value) {
              changeBand(index, value)
            },
          })
        }),
      ),
      h(
        'div',
        { className: 'mp-eq-effects' },
        h('div', { className: 'mp-eq-effects-title' }, t('eq.effects')),
        EQ_EFFECT_CONTROLS.map(function (control) {
          return h(EqEffectRow, {
            key: control.id,
            control: control,
            value: normalizeEqEffects(eq.effects)[control.id],
            effects: eq.effects,
          })
        }),
      ),
      h('div', { className: 'mp-eq-hint' }, t('eq.fxHint')),
      h(
        'div',
        { className: 'mp-eq-actions' },
        h(
          'button',
          {
            type: 'button',
            className: 'mp-eq-action',
            onClick: function () {
              player.setEq({
                preset: 'flat',
                bands: zeroEqBands(),
                effects: normalizeEqEffects({}),
              })
            },
          },
          t('eq.reset'),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mp-eq-action',
            onClick: function () {
              setTab('mine')
            },
          },
          t('eq.saveCurrent'),
        ),
      ),
    )
  }

  return h(
    'div',
    { className: 'mp-eqp' },
    h(
      'div',
      { className: 'mp-eq-tabs-row' },
      h(
        'div',
        { className: 'mp-eq-tabs', role: 'tablist' },
        EQ_TABS.map(function (item) {
          return h(
            'button',
            {
              key: item.id,
              type: 'button',
              role: 'tab',
              'aria-selected': tab === item.id,
              className: cx('mp-eq-tab', tab === item.id && 'is-on'),
              onClick: function () {
                setTab(item.id)
              },
            },
            t(item.labelKey),
          )
        }),
      ),
      h(Switch, {
        value: eq.enabled,
        label: t('eq.enable'),
        title: t('eq.enable'),
        onChange: function (value) {
          player.setEq({ enabled: value })
        },
      }),
    ),
    eq.enabled && !available ? h('div', { className: 'mp-eq-warn' }, t('eq.unavailable')) : null,
    h('div', { className: 'mp-eq-body' }, body),
  )
}

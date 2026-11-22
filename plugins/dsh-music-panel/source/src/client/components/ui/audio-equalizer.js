/**
 * audio-equalizer: Folia's audio effect window (AudioEqualizerDialog), ported.
 *
 * Folia's src/components/panelTab/AudioEqualizerDialog.tsx opens this from the control tab's
 * 「音频效果器」tile: the processing switch in the header, the preset chips (six built-ins plus the
 * two custom slots, with a reset for the chosen slot), the ten band faders with their scale and
 * curve, then the post-EQ effect chain. Its decisions are kept word for word below:
 *
 *   setEnabled          the switch stops processing and keeps every value
 *   writeCustomDraft    a band or effect edit goes into the active custom slot, or the first one
 *                       while a built-in plays, and switches processing on
 *   applyPreset         a chip writes its gains and effects, and switches processing on
 *   resetActiveCustomSlot  reset only ever clears a custom slot; built-ins are not editable
 *
 * What differs is the plumbing: the plugin has no settings store of its own, so the same decisions
 * go through player.setEq, which persists to prefs (Folia keeps a draft and writes it on release).
 */

/** Folia's effect controls carry Folly's own noise tags; the local mirror is the fallback. */
var AUDIO_EQ_EFFECT_CONTROLS =
  FOLIA_AUDIO_API !== null &&
  Array.isArray(FOLIA_AUDIO_API.AUDIO_EFFECT_CONTROLS) &&
  FOLIA_AUDIO_API.AUDIO_EFFECT_CONTROLS.length > 0
    ? FOLIA_AUDIO_API.AUDIO_EFFECT_CONTROLS
    : EQ_EFFECT_CONTROLS

/** Folia's PRESET_IDS: the six built-ins, then the two custom slots. */
var AUDIO_EQ_PRESET_IDS =
  (FOLIA_SOUND_PRESET_IDS.length > 0 ? FOLIA_SOUND_PRESET_IDS : EQ_SOUND_PRESET_IDS)
    .concat(EQ_CUSTOM_SLOT_IDS)

function audioEqPresetLabel(id) {
  if (isEqCustomSlotId(id)) {
    var index = EQ_CUSTOM_SLOT_IDS.indexOf(String(id))
    return t('eq.slotN', { n: index + 1 })
  }
  var labelKey = FOLIA_SOUND_PRESET_LABELS[String(id)]
  return labelKey ? t(labelKey) : String(id)
}

/** The gains and effects a chip stands for (Folia's applyPreset source). */
function audioEqPresetSource(id, slots) {
  if (isEqCustomSlotId(id)) {
    var slot = slots[EQ_CUSTOM_SLOT_IDS.indexOf(String(id))]
    return {
      bands: normalizeEqBands(slot ? slot.bands : zeroEqBands()),
      effects: normalizeEqEffects(slot ? slot.effects : {}),
    }
  }
  var preset = FOLIA_SOUND_PRESETS[String(id)]
  if (preset) {
    return { bands: normalizeEqBands(preset.gains), effects: normalizeEqEffects(preset.effects) }
  }
  return { bands: eqBandsForPreset(id), effects: normalizeEqEffects({}) }
}

var AUDIO_EQ_FLAT = (function () {
  var flat = FOLIA_SOUND_PRESETS.flat
  return {
    bands: normalizeEqBands(flat ? flat.gains : zeroEqBands()),
    effects: normalizeEqEffects(flat ? flat.effects : {}),
  }
})()

/** Folia's writeCustomDraft: the edit lands in a custom slot and switches processing on. */
function audioEqWriteCustom(eq, bands, effects) {
  var slotId = isEqCustomSlotId(eq.preset) ? eq.preset : EQ_CUSTOM_SLOT_IDS[0]
  var index = EQ_CUSTOM_SLOT_IDS.indexOf(String(slotId))
  var next = normalizeEqBands(bands)
  var fx = normalizeEqEffects(effects)
  var slots = normalizeEqSlots(eq.slots)
  slots[index] = { bands: next, effects: fx }
  player.setEq({ enabled: true, preset: slotId, bands: next, effects: fx, slots: slots })
}

/** One band column: Folia's EqualizerBandGrid fader, value above and frequency under it. */
function AudioEqualizerBand(props) {
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
      'aria-valuetext': eqFormatDb(props.value) + ' dB',
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

/** One effect row: Folia's AudioEffectGrid entry (name, noise tag, value, slider). */
function AudioEqualizerEffect(props) {
  var control = props.control
  var value = Number(props.value)
  if (!isFinite(value)) value = control.neutral
  var name = t(EQ_EFFECT_LABEL_KEYS[control.id])
  var valueText = eqEffectReadout(control, value)
  return h(
    'div',
    { className: 'mp-eqwin-effect' },
    h(
      'div',
      { className: 'mp-eqwin-effect-head' },
      h('span', { className: 'mp-eqwin-effect-name' }, name),
      control.addsNoise === true
        ? h(
            'span',
            { className: cx('mp-eqwin-effect-tag', value !== control.neutral && 'is-on'), title: t('eq.noiseTagHint') },
            t('eq.noiseTag'),
          )
        : null,
      h('span', { className: 'mp-eqwin-effect-value' }, valueText),
    ),
    h('input', {
      type: 'range',
      className: 'mp-range',
      min: control.min,
      max: control.max,
      step: control.step,
      value: value,
      'aria-label': name,
      'aria-valuetext': valueText,
      onChange: function (event) {
        props.onChange(Number(event.target.value))
      },
    }),
  )
}

/** The window itself — Folia's AudioEqualizerDialog body, in the plugin's dialog chrome. */
function AudioEqualizerWindow(props) {
  var prefs = usePrefs()
  var eq = normalizeEqPrefs(prefs)
  var slots = normalizeEqSlots(eq.slots)
  var available = player.getEq().available
  var canReset = isEqCustomSlotId(eq.preset)

  function setEnabled(value) {
    // The switch stops processing and keeps every value.
    player.setEq({ enabled: value })
  }

  function changeBand(index, value) {
    var bands = eq.bands.slice()
    bands[index] = clamp(Number(value) || 0, -EQ_MAX_DB, EQ_MAX_DB)
    audioEqWriteCustom(eq, bands, eq.effects)
  }

  function changeEffect(id, value) {
    var effects = normalizeEqEffects(eq.effects)
    effects[id] = value
    audioEqWriteCustom(eq, eq.bands, effects)
  }

  function applyPreset(id) {
    var source = audioEqPresetSource(id, slots)
    player.setEq({ enabled: true, preset: id, bands: source.bands, effects: source.effects })
  }

  function resetActiveCustomSlot() {
    if (!isEqCustomSlotId(eq.preset)) return
    var index = EQ_CUSTOM_SLOT_IDS.indexOf(String(eq.preset))
    var next = normalizeEqSlots(eq.slots)
    next[index] = { bands: AUDIO_EQ_FLAT.bands.slice(), effects: normalizeEqEffects(AUDIO_EQ_FLAT.effects) }
    // Still the chosen slot (Folia keeps it); without the preset the flat curve would be read
    // as the built-in 「flat」 preset and the chip would jump.
    player.setEq({
      preset: eq.preset,
      bands: next[index].bands,
      effects: next[index].effects,
      slots: next,
    })
  }

  return h(
    'div',
    { className: 'mp-eqwin', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('sheet.effects') },
    h(
      'div',
      { className: 'mp-eqwin-head' },
      h(
        'div',
        { className: 'mp-eqwin-titles' },
        h('div', { className: 'mp-eqwin-title' }, t('sheet.effects')),
        h('div', { className: 'mp-eqwin-sub' }, t('eq.winSub')),
      ),
      h(
        'div',
        { className: 'mp-eqwin-switch' },
        h('span', null, t(eq.enabled ? 'eq.procOn' : 'eq.procOff')),
        h(Switch, {
          value: eq.enabled,
          label: t('eq.enable'),
          onChange: setEnabled,
        }),
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'mp-eqwin-close',
          title: t('v2.close'),
          'aria-label': t('v2.close'),
          onClick: props.onClose,
        },
        icon('x', 16),
      ),
    ),
    h(
      'div',
      { className: 'mp-eqwin-body' },
      eq.enabled && !available ? h('div', { className: 'mp-eqwin-warn' }, t('eq.unavailable')) : null,
      // Presets: six built-ins and the two custom slots, with the reset Folia keeps for a slot.
      h(
        'div',
        { className: 'mp-eqwin-chips' },
        h(
          'div',
          { className: 'mp-eqwin-chip-list' },
          AUDIO_EQ_PRESET_IDS.map(function (id) {
            var chosen = eq.enabled && eq.preset === id
            return h(
              'button',
              {
                key: id,
                type: 'button',
                className: cx('mp-eqwin-chip', chosen && 'is-on'),
                'aria-pressed': chosen ? 'true' : 'false',
                onClick: function () {
                  applyPreset(id)
                },
              },
              audioEqPresetLabel(id),
            )
          }),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'mp-eqwin-reset',
            title: t('eq.resetSlotChip'),
            'aria-label': t('eq.resetSlotChip'),
            disabled: !canReset,
            onClick: resetActiveCustomSlot,
          },
          icon('refresh', 15),
        ),
      ),
      h(
        'section',
        { className: cx('mp-eqwin-section', !eq.enabled && 'is-off') },
        h(
          'div',
          { className: 'mp-eqwin-section-head' },
          h('span', { className: 'mp-set-label' }, t('eq.gainTitle')),
        ),
        h(EqCurve, { bands: eq.bands }),
        h(
          'div',
          { className: 'mp-eqwin-bands' },
          h(
            'div',
            { className: 'mp-eqwin-scale', 'aria-hidden': 'true' },
            h('span', null, '+' + EQ_MAX_DB + ' dB'),
            h('span', null, '0'),
            h('span', null, '−' + EQ_MAX_DB + ' dB'),
          ),
          h(
            'div',
            { className: 'mp-eqwin-faders' },
            EQ_FREQS.map(function (freq, index) {
              return h(AudioEqualizerBand, {
                key: freq,
                label: eqFrequencyLabel(freq),
                value: eq.bands[index],
                onChange: function (value) {
                  changeBand(index, value)
                },
              })
            }),
          ),
          h('span', { className: 'mp-eqwin-hz', 'aria-hidden': 'true' }, 'Hz'),
        ),
      ),
      h(
        'section',
        { className: cx('mp-eqwin-section', !eq.enabled && 'is-off') },
        h(
          'div',
          { className: 'mp-eqwin-section-head' },
          h('span', { className: 'mp-set-label' }, t('eq.chainTitle')),
          h('span', { className: 'mp-set-desc' }, t('eq.chainHint')),
        ),
        h(
          'div',
          { className: 'mp-eqwin-effects' },
          AUDIO_EQ_EFFECT_CONTROLS.map(function (control) {
            return h(AudioEqualizerEffect, {
              key: control.id,
              control: control,
              value: normalizeEqEffects(eq.effects)[control.id],
              onChange: function (value) {
                changeEffect(control.id, value)
              },
            })
          }),
        ),
      ),
    ),
  )
}

/** Opens as a layer: the plugin's modal chrome, Folia's window inside it. */
function AudioEqualizerDialog(props) {
  return h(
    KitModal,
    { headless: true, onClose: props.onClose, className: 'mp-eqwin-modal' },
    h(
      'div',
      { className: 'mp-eqwin-layer' },
      h(AudioEqualizerWindow, { onClose: props.onClose }),
    ),
  )
}

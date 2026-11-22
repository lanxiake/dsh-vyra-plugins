function NpSecondaryActions(props) {
  var extraPanel = props.extraPanel
  var setExtraPanel = props.setExtraPanel
  var sleepRef = props.sleepRef
  var audioRef = props.audioRef
  var prefs = props.prefs
  var sleepCustom = props.sleepCustom
  var setSleepCustom = props.setSleepCustom
  var sleepRemaining = props.sleepRemaining
  var applySleepCustom = props.applySleepCustom
  var setSleep = props.setSleep
  var snap = props.snap
  var track = props.track
  var onToggleQueue = props.onToggleQueue
  var setSettingsOpen = props.setSettingsOpen
  var setEditorOpen = props.setEditorOpen

  return h(
          'div',
          { className: 'mp-np-secondary' },
          h(
            'div',
            { className: 'mp-np-extra-item', ref: sleepRef },
            h(IconButton, {
              icon: 'clock',
              size: 22,
              active: extraPanel === 'sleep',
              title: t('settings.sleepTimer'),
              onClick: function () {
                setExtraPanel(extraPanel === 'sleep' ? '' : 'sleep')
              },
            }),
              extraPanel === 'sleep'
                ? h(NpSleepMenu, {
                    prefs: prefs,
                    sleepCustom: sleepCustom,
                    setSleepCustom: setSleepCustom,
                    sleepRemaining: sleepRemaining,
                    applySleepCustom: applySleepCustom,
                    setSleep: setSleep,
                    onClose: function () {
                      setExtraPanel('')
                    },
                  })
                : null,
          ),
          h(IconButton, {
            icon: playModeIcon(playModeOf(snap)),
            size: 22,
            title: t('page.loopAll'),
            onClick: function () {
              cyclePlayMode(snap)
            },
          }),
          h(
            'div',
            { className: 'mp-np-extra-item', ref: audioRef },
            h(IconButton, {
              icon: 'equalizer',
              size: 22,
              active: extraPanel === 'audio' || extraPanel === 'eq',
              title: t('page.audioEffects'),
              onClick: function () {
                var effectsOpen =
                  extraPanel === 'audio' || extraPanel === 'eq'
                setExtraPanel(effectsOpen ? '' : 'audio')
              },
            }),
            extraPanel === 'audio' || extraPanel === 'eq'
              ? h(AudioEffectsPanel, {
                  view: extraPanel,
                  onView: setExtraPanel,
                  snap: snap,
                  prefs: prefs,
                  track: track,
                })
              : null,
          ),
          h(
            'div',
            { className: 'mp-pb-queue-wrap' },
            // One queue surface: the owner closes this page and shows the panel queue.
            h(IconButton, {
              icon: 'playlist',
              size: 22,
              title: t('page.queue'),
              onClick: props.onToggleQueue,
            }),
          ),
          h(IconButton, {
            icon: 'more',
            size: 22,
            title: t('editor.title'),
            onClick: function () {
              setSettingsOpen(false)
              setEditorOpen(true)
            },
          }),
  )
}

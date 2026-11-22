function NpSleepMenu(props) {
  var prefs = props.prefs
  var sleepCustom = props.sleepCustom
  var setSleepCustom = props.setSleepCustom
  var sleepRemaining = props.sleepRemaining
  var applySleepCustom = props.applySleepCustom
  var setSleep = props.setSleep
  var onClose = props.onClose

  return h(
                  'div',
                  { className: 'mp-np-extra-pop is-sleep' },
                  h(
                    'div',
                    { className: 'mp-np-sleep-head' },
                    h('span', { className: 'mp-np-sleep-head-icon' }, icon('clock', 14)),
                    h(
                      'div',
                      { className: 'mp-np-sleep-title-wrap' },
                      h('div', { className: 'mp-np-sleep-title' }, t('settings.sleepTimer')),
                      h(
                        'div',
                        { className: 'mp-np-sleep-hint' },
                        sleepRemaining > 0
                          ? t('sleep.remaining', { time: fmtClock(sleepRemaining / 1000) })
                          : t('sleep.hint'),
                      ),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'mp-np-sleep-close',
                        title: t('editor.close'),
                        onClick: function () {
                          onClose()
                        },
                      },
                      icon('x', 14),
                    ),
                  ),
                  h('div', { className: 'mp-np-sleep-label' }, t('sleep.presets')),
                  h(
                    'div',
                    { className: 'mp-np-sleep-grid' },
                    [15, 30, 45, 60, 90].map(function (minutes) {
                      var on = sleepRemaining > 0 && prefs.sleepTimerMinutes === minutes
                      return h(
                        'button',
                        {
                          key: minutes,
                          type: 'button',
                          className: cx('mp-np-sleep-chip', on && 'is-on'),
                          onClick: function () {
                            setSleep(minutes)
                          },
                        },
                        minutes,
                        h('span', null, t('sleep.minutes')),
                      )
                    }),
                  ),
                  h('div', { className: 'mp-np-sleep-label' }, t('sleep.custom')),
                  h(
                    'div',
                    { className: 'mp-np-sleep-custom' },
                    h('input', {
                      type: 'text',
                      inputMode: 'numeric',
                      maxLength: 3,
                      className: 'mp-np-sleep-input',
                      placeholder: t('sleep.placeholder'),
                      'aria-label': t('sleep.placeholder'),
                      value: sleepCustom,
                      onChange: function (event) {
                        setSleepCustom(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))
                      },
                      onKeyDown: function (event) {
                        if (event.key === 'Enter') applySleepCustom()
                      },
                    }),
                    h('span', { className: 'mp-np-sleep-unit' }, t('sleep.minutes')),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'mp-np-sleep-set',
                        disabled: !(Number(sleepCustom) >= 1 && Number(sleepCustom) <= 720),
                        onClick: applySleepCustom,
                      },
                      t('sleep.set'),
                    ),
                  ),
                  sleepCustom !== '' && !(Number(sleepCustom) >= 1 && Number(sleepCustom) <= 720)
                    ? h('div', { className: 'mp-np-sleep-error' }, t('sleep.invalid'))
                    : null,
                  sleepRemaining > 0
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'mp-np-sleep-off',
                          onClick: function () {
                            setSleep(0)
                          },
                        },
                        t('settings.sleepOff'),
                      )
                    : null,
                )
}

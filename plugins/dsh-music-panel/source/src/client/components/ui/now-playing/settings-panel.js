function NpSettingsPanel(props) {
  var prefs = props.prefs
  var setPrefs = props.setPrefs
  var track = props.track
  var offsetMs = props.offsetMs
  var settingsRef = props.settingsRef
  var settingsPos = props.settingsPos
  var applyOffset = props.applyOffset
  var writeLyricsBack = props.writeLyricsBack
  var openOnlineLyric = props.openOnlineLyric
  // Typography that every Folia style reads lives in 设置 · 歌词 and the appearance panel;
  // this popover keeps the two controls tied to the playing song: the translation row's
  // size and whether it is shown at all. The removed classic list's px controls are gone.
  var translationScale = Math.min(150, Math.max(50, Math.round(Number(prefs.translationScale) || 90)))

  return h(
          'div',
          {
            className: 'mp-np-settings',
            ref: settingsRef,
            style: settingsPos
              ? { left: settingsPos.left + 'px', bottom: settingsPos.bottom + 'px', width: settingsPos.width + 'px', right: 'auto', top: 'auto' }
              : undefined,
          },
          h(
            'div',
            { className: 'mp-np-setting' },
            h(
              'div',
              { className: 'mp-np-setting-head' },
              h('span', null, t('page.translationScale')),
              h('span', { className: 'mp-set-val' }, translationScale + '%'),
            ),
            h('input', {
              type: 'range',
              className: 'mp-range',
              min: 50,
              max: 150,
              step: 5,
              value: translationScale,
              onChange: function (event) {
                setPrefs({ translationScale: Number(event.target.value) })
              },
            }),
          ),
          h(
            SetRow,
            { label: t('page.translation') },
            h(Switch, {
              value: prefs.showTranslation === true,
              onChange: function (value) {
                setPrefs({ showTranslation: value })
              },
            }),
          ),
          track && !track.onlineProvider
            ? h(
                'div',
                { className: 'mp-np-setting' },
                h(
                  'div',
                  { className: 'mp-np-setting-head' },
                  h('span', null, t('page.lyricOffset')),
                  h('span', { className: 'mp-set-val' }, (offsetMs / 1000).toFixed(1) + ' s'),
                ),
                h(
                  'div',
                  { className: 'mp-np-offset-actions' },
                  h(
                    Button,
                    {
                      variant: 'ghost',
                      onClick: function () {
                        applyOffset(-500)
                      },
                    },
                    '−0.5s',
                  ),
                  h(
                    Button,
                    {
                      variant: 'ghost',
                      onClick: function () {
                        applyOffset(500)
                      },
                    },
                    '+0.5s',
                  ),
                  h(Button, { onClick: writeLyricsBack }, t('page.writeLyrics')),
                ),
                h('div', { className: 'mp-np-setting-hint' }, t('page.lyricOffsetHint')),
              )
            : null,
          track && !track.onlineProvider
            ? h(Button, { icon: 'search', onClick: openOnlineLyric }, t('page.onlineLyrics'))
            : null,
        )
}

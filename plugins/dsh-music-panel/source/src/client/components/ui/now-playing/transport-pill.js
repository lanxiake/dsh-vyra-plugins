function NpTransportPill(props) {
  var cover = props.cover
  var snap = props.snap
  var prefs = props.prefs
  var track = props.track
  var duration = props.duration
  var time = props.time
  var staged = props.staged
  var coverImgRef = props.coverImgRef

        // Folia's floating pill: transport, the bar, the times — one rounded panel.
  return h(
          'div',
          { className: 'mp-np-pill' },
          h(
            'div',
            { className: 'mp-np-pill-title' },
            h('span', { className: 'mp-np-pill-name' }, trackTitleOf(track)),
            h('span', { className: 'mp-np-pill-artist' }, trackArtistOf(track)),
          ),
        h(
          'div',
          { className: 'mp-np-progress' },
          h(WaveSeekBar, {
            cover: cover,
            playing: snap.playing,
            imageRef: coverImgRef,
            active: staged,
            wave: prefs.waveEnabled !== false,
            fallbackDuration: track ? track.durationSec || 0 : 0,
          }),
        ),
        h(
          'div',
          { className: 'mp-np-times' },
          h('span', null, fmtClock(time.currentTime)),
          h('span', null, fmtClock(effectivePlayerDuration(duration, track ? track.durationSec : 0))),
        ),
        h(
          'div',
          { className: 'mp-np-transport' },
          h(IconButton, {
            icon: 'prev',
            size: 28,
            title: t('page.prev'),
            tooltip: false,
            onClick: function () {
              player.prev()
            },
          }),
          h(
            'button',
            {
              type: 'button',
              className: 'mp-pb-play',
              title: snap.playing ? t('page.pause') : t('page.play'),
              onClick: function () {
                player.toggle()
              },
            },
            icon(snap.playing ? 'pause' : 'play', 38),
          ),
          h(IconButton, {
            icon: 'next',
            size: 28,
            title: t('page.next'),
            tooltip: false,
            onClick: function () {
              player.next()
            },
          }),
        ),
  )
}

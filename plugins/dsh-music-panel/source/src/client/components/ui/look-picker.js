/**
 * 外观选择器 — Folia draws its pickers as a grid of small pictures that use the
 * current theme, not as a line of labels. This is the same idea with what the panel
 * has: each cell renders the real style on a sample line, the real backdrop on a
 * swatch, and the real scene overlay on a tile.
 *
 * `kind` decides what a cell draws; picking one calls `onPick(id)`.
 */

var MP_LOOK_SAMPLE = '夜に駆ける'

// Settings screenshots for every real lyric style, shipped with the plugin at
// /music/assets/lyric-style-thumbs/<id>.webp. The random pseudo-style has none.
var MP_LYRIC_STYLE_THUMBS = {
  still: 'still',
  partita: 'partita',
  fume: 'fume',
  monet: 'monet',
  tilt: 'tilt',
  claddagh: 'claddagh',
  cadenza: 'cadenza',
  lumiere: 'lumiere',
  sonnet: 'sonnet',
  tempera: 'tempera',
  hanabi: 'hanabi',
  nebbia: 'nebbia',
  diorama: 'diorama',
  pendolo: 'pendolo',
}

function mpLyricStyleThumb(id) {
  var file = MP_LYRIC_STYLE_THUMBS[String(id || '')]
  if (!file) return ''
  return (typeof API === 'string' ? API : 'music/') + 'assets/lyric-style-thumbs/' + file + '.webp'
}

function mpLookCellStyle(selected) {
  return {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '6px',
    borderRadius: '10px',
    border: '1px solid ' + (selected ? 'var(--mp-look-accent,#4f8cff)' : 'rgba(255,255,255,.08)'),
    background: selected ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.03)',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
  }
}

function mpGridStyle(columns) {
  return { display: 'grid', gridTemplateColumns: 'repeat(' + String(columns) + ', minmax(0,1fr))', gap: '6px' }
}

function LookChoiceGrid(props) {
  var kind = props.kind
  var value = props.value
  var cover = typeof props.cover === 'string' ? props.cover : ''

  if (kind === 'lyricStyle') {
    return h(
      'div',
      { style: mpGridStyle(3) },
      mpStylePickerCatalog().map(function (entry) {
        var selected = entry.id === value
        return h(
          'button',
          {
            key: entry.id,
            type: 'button',
            onClick: function () {
              if (typeof props.onPick === 'function') props.onPick(entry.id)
            },
            style: mpLookCellStyle(selected),
          },
          (function () {
            var thumb = mpLyricStyleThumb(entry.id)
            if (thumb !== '') {
              return h('img', {
                src: thumb,
                alt: '',
                loading: 'lazy',
                decoding: 'async',
                style: {
                  width: '100%',
                  aspectRatio: '3 / 2',
                  objectFit: 'cover',
                  borderRadius: 'var(--dsw-radius-sm, 8px)',
                  display: 'block',
                  opacity: selected ? '1' : '.78',
                },
              })
            }
            return h(
              'div',
              {
                className: 'mp-look-preview',
                style: {
                  height: '44px',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,.35)',
                  color: selected ? 'var(--mp-look-accent,#4f8cff)' : 'inherit',
                  opacity: selected ? '1' : '.75',
                },
              },
              icon(entry.glyph || 'note', 20),
            )
          })(),
          h('span', { style: { fontSize: '11px', opacity: '.7' } }, t(entry.labelKey)),
        )
      }),
    )
  }

  if (kind === 'bgMode') {
    return h(
      'div',
      { style: mpGridStyle(3) },
      MP_BG_MODES.map(function (entry) {
        var selected = entry.id === value
        var swatch = 'linear-gradient(120deg,rgba(255,255,255,.28),rgba(255,255,255,.06) 45%,rgba(0,0,0,.45))'
        if (entry.id === 'common') {
          swatch = 'linear-gradient(135deg,#2b2f3a,#11131a),repeating-linear-gradient(45deg,rgba(255,255,255,.10) 0 2px,transparent 2px 10px)'
        } else if (entry.id === 'monet' && cover !== '') {
          swatch = 'url(' + cover + ') center / cover'
        } else if (entry.id === 'nomand') {
          swatch = 'conic-gradient(#d9d4c7 25%,#3a3d45 0 50%,#d9d4c7 0 75%,#3a3d45 0) 0 0/8px 8px'
        } else if (entry.id === 'latent') {
          swatch = 'radial-gradient(circle at 30% 40%,#f0a35e33 0 20%,transparent 21%),radial-gradient(circle at 70% 60%,#7c5cff33 0 24%,transparent 25%),linear-gradient(160deg,#20242e,#0c0e14)'
        } else if (entry.id === 'sora') {
          swatch = 'radial-gradient(1px 1px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 60% 70%,#fff,transparent),radial-gradient(1px 1px at 80% 20%,#fff,transparent),linear-gradient(160deg,#05070d,#101a2e)'
        } else if (entry.id === 'url') {
          swatch = 'linear-gradient(180deg,#3a3f4b 0 14px,#161a22 14px)'
        } else if (entry.id === 'none') {
          swatch = 'linear-gradient(#101014,#101014)'
        }
        return h(
          'button',
          {
            key: entry.id,
            type: 'button',
            onClick: function () {
              if (typeof props.onPick === 'function') props.onPick(entry.id)
            },
            style: mpLookCellStyle(selected),
          },
          h('div', {
            style: {
              height: '44px',
              borderRadius: '6px',
              overflow: 'hidden',
              background: swatch,
            },
          }),
          h('span', { style: { fontSize: '11px', opacity: '.7' } }, t(entry.labelKey)),
        )
      }),
    )
  }

  return h(
    'div',
    { style: mpGridStyle(3) },
    MP_SCENES.map(function (entry) {
      var selected = entry.id === value
      return h(
        'button',
        {
          key: entry.id,
          type: 'button',
          onClick: function () {
            if (typeof props.onPick === 'function') props.onPick(entry.id)
          },
          style: mpLookCellStyle(selected),
        },
        h('div', {
          className: 'mp-scene-swatch mp-scene-' + entry.id,
          style: { height: '44px', borderRadius: '6px', background: 'rgba(0,0,0,.5)', overflow: 'hidden' },
        }),
        h('span', { style: { fontSize: '11px', opacity: '.7' } }, t(entry.labelKey)),
      )
    }),
  )
}


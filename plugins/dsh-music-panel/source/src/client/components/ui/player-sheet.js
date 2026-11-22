/**
 * Floating player card — the layout of Folia's `panelTab/shell` with its motion.
 *
 * Motion is now driven by the same library Folia uses (framer-motion, bundled into
 * `src/vendor/framer.bundle.js`), so the dynamics match rather than approximate:
 *
 *   surface   motion.div, initial { opacity:0, scale:.92 } → { 1, 1 } over .3s
 *             `ease: [0.22, 1, 0.36, 1]` (KIT_EASE.out), exit over .22s, inside
 *             AnimatePresence (kitTransition('unfold' | 'move'))
 *   tab mark  motion.span with the same `layoutId` inside whichever tab is open:
 *             framer animates position AND width as one shared element (.22s)
 *   tab body  keyed page remounts with `.st-page-in` (opacity 0 + translateY 6px,
 *             .22s out) — Folia's kit.css
 *   surface h body = 12 + 1px hairline + 8 + measured content, animated .3s out
 *
 * When the host's React cannot host framer (a thin runtime, the test harness) the
 * vendor bundle fails to load and this falls back to the CSS-only card.
 */

var MP_EASE_OUT = [0.22, 1, 0.36, 1]
var MP_DUR_FAST = 0.12
var MP_DUR_MOVE = 0.22
var MP_DUR_UNFOLD = 0.3

var MP_PADDING = 12
var MP_DOCK_HEIGHT = 36
var MP_DOCK_GAP = 12
var MP_BODY_GAP = 12
var MP_BODY_LINE = 1
var MP_BODY_UNDER = 8
var MP_FOLDED = 48
var MP_COVER_GAP = 14
var MP_MIN_COVER = 96
var MP_TOP_MARGIN = 56
var MP_BOTTOM_GAP = 24
function clampCardBodyHeight(measured) {
  var viewport = typeof window === 'undefined' ? 800 : window.innerHeight || 800
  // Bottom-anchored (like Folia): the surface grows upward, so the room is what is left between the bottom gap and the top margin.
  var room = viewport - MP_TOP_MARGIN - MP_BOTTOM_GAP - MP_PADDING * 2 - MP_FOLDED - MP_DOCK_HEIGHT - MP_DOCK_GAP
  return Math.max(0, Math.min(measured, room))
}

function PlayerSheet(props) {
  var framer = motion !== null && AnimatePresence !== null
  if (!framer) return props.open === true ? h(PlayerSheetInner, props) : null
  return h(
    AnimatePresence,
    null,
    props.open === true
      ? h(
          PlayerSheetInner,
          Object.assign({}, props, {
            key: 'mp-card-sheet',
            framer: {
              surface: motion.div,
              mark: motion.span,
              enter: { opacity: 0, scale: 0.92 },
              shown: { opacity: 1, scale: 1 },
              leave: { opacity: 0, scale: 0.92 },
              transition: { duration: MP_DUR_UNFOLD, ease: MP_EASE_OUT },
              leaveTransition: { duration: MP_DUR_MOVE, ease: MP_EASE_OUT },
              markTransition: { duration: MP_DUR_MOVE, ease: MP_EASE_OUT },
            },
          }),
        )
      : null,
  )
}

function PlayerSheetInner(props) {
  var onClose = props.onClose
  var track = props.track || null
  var favoriteSet = props.favoriteSet || {}
  var prefs = usePrefs()
  var ui = useStore(uiStore)
  var library = useStore(libraryStore)
  var online = useStore(onlineStore)
  var snap = usePlayerSnapshot()
  var framer = props.framer || null
  // The locally generated theme for this song (null until the page has made one).
  var localThemeState = useMpLocalTheme(typeof props.lyricsPath === 'string' ? props.lyricsPath : '')

  var indexPair = useState(0)
  var index = indexPair[0]
  var setIndex = indexPair[1]
  // Controls tab state: the theme source and light/dark.
  // Which appearance picker is open under its row (Folia opens one at a time).
  var lookPickerPair = useState('')
  var lookPicker = lookPickerPair[0]
  var setLookPicker = lookPickerPair[1]
  var themeSourcePair = useState('default')
  var themeSource = themeSourcePair[0]
  var setThemeSource = themeSourcePair[1]
  var modePair = useState('dark')
  var colorMode = modePair[0]
  var setColorMode = modePair[1]

  var bodyHPair = useState(0)
  var bodyH = bodyHPair[0]
  var setBodyH = bodyHPair[1]

  // Only used by the CSS fallback: framer's layoutId does the same job itself.
  var markPair = useState({ left: 0, width: 0, ready: false })
  var mark = markPair[0]
  var setMark = markPair[1]

  var contentRef = useRef(null)
  var tabRefs = useRef([])

  // Folia's source tab follows the song: local files say "本地", platform songs say
  // "歌词", and a Navidrome song names its server. The tab index stays the same.
  var isOnlineTrack = track !== null && Boolean(track.onlineProvider)
  var isNavidromeTrack = isOnlineTrack && track.onlineProvider === 'navidrome'
  var sourceTabKey = isNavidromeTrack ? 'sheet.navidrome' : isOnlineTrack ? 'sheet.lyrics' : 'sheet.local'
  var TABS = ['sheet.cover', sourceTabKey, 'sheet.controls', 'sheet.quality']
  var isCover = index === 0
  var useFramerMark = framer !== null

  useEffect(
    function () {
      if (props.open !== true) return undefined
      function onKey(event) {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }
      window.addEventListener('keydown', onKey)
      return function () {
        window.removeEventListener('keydown', onKey)
      }
    },
    [props.open, onClose],
  )

  useLayoutEffect(
    function () {
      if (props.open !== true) return
      var el = contentRef.current
      if (el === null) return
      setBodyH(clampCardBodyHeight(el.scrollHeight))
    },
    [props.open, index],
  )

  useEffect(
    function () {
      if (props.open !== true) return undefined
      var el = contentRef.current
      if (el === null || typeof ResizeObserver !== 'function') return undefined
      var observer = new ResizeObserver(function () {
        setBodyH(clampCardBodyHeight(el.scrollHeight))
      })
      observer.observe(el)
      return function () {
        observer.disconnect()
      }
    },
    [props.open, index],
  )

  // CSS fallback only: follow the open tab with a measured mark.
  useLayoutEffect(
    function () {
      if (props.open !== true || useFramerMark) return undefined
      function place() {
        var el = tabRefs.current[index]
        if (el === undefined || el === null || !el.offsetWidth) return
        setMark({ left: el.offsetLeft, width: el.offsetWidth, ready: true })
      }
      place()
      if (typeof ResizeObserver !== 'function') return undefined
      var observer = new ResizeObserver(place)
      tabRefs.current.forEach(function (el) {
        if (el !== null && el !== undefined) observer.observe(el)
      })
      return function () {
        observer.disconnect()
      }
    },
    [props.open, index, useFramerMark],
  )

  // The page computes the cover (local file cover or the provider's URL); the card
  // must not read `track.cover`, which the player object never carries.
  var cover = typeof props.cover === 'string' && props.cover !== '' ? props.cover : ''
  var likeInfo = props.like || null
  var favorite = likeInfo !== null ? likeInfo.isLiked === true : track !== null && favoriteSet[track.path] === true
  var title = track ? track.title || '' : ''
  var artist = track ? track.artist || '' : ''
  var album = track && track.album ? track.album : ''

  function iconButton(key, label, glyph, active) {
    return h(
      'button',
      {
        key: key,
        type: 'button',
        className: cx('mp-card-icon-btn', active === true && 'is-on'),
        title: label,
        'aria-label': label,
        onClick: function (event) {
          event.stopPropagation()
          if (typeof props.onAction === 'function') props.onAction(key)
        },
        style: {
          width: '32px',
          height: '32px',
          flex: '0 0 auto',
          display: 'grid',
          placeItems: 'center',
          borderRadius: '8px',
          border: '0',
          // PanelIconButton: `filled` draws the square; home/settings stay bare.
          background:
            key === 'favorite' || key === 'addToPlaylist'
              ? 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.07))'
              : 'transparent',
          color: 'var(--dsw-alias-label-secondary,rgba(255,255,255,.72))',
          cursor: 'pointer',
          transition:
            'background-color ' + MP_DUR_FAST + 's cubic-bezier(.4,0,.2,1), color ' +
            MP_DUR_FAST + 's cubic-bezier(.4,0,.2,1)',
        },
      },
      glyph,
    )
  }

  function coverArt(size, radius) {
    return h(
      'div',
      {
        className: 'mp-card-art',
        onClick: isCover
          ? undefined
          : function () {
              setIndex(0)
            },
        style: {
          width: size === 'fill' ? '100%' : String(size) + 'px',
          height: size === 'fill' ? '100%' : String(size) + 'px',
          flex: '0 0 auto',
          overflow: 'hidden',
          borderRadius: String(radius) + 'px',
          background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06))',
          cursor: isCover ? 'default' : 'pointer',
          transition: 'width ' + MP_DUR_MOVE + 's cubic-bezier(.22,1,.36,1), height ' + MP_DUR_MOVE + 's cubic-bezier(.22,1,.36,1)',
        },
      },
      cover !== ''
        ? h('img', {
            src: cover,
            alt: '',
            draggable: false,
            style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
          })
        : h(
            'div',
            { style: { width: '100%', height: '100%', display: 'grid', placeItems: 'center', opacity: '.5' } },
            icon('music', size === 'fill' ? 44 : 18),
          ),
    )
  }

  // SongCredits (the block under the cover): 18/26 semibold title, 13/20 artists
  // separated by a dim slash, 12/18 album.
  function metaBlock(compact) {
    return h(
      'div',
      {
        className: 'mp-card-meta',
        style: {
          minWidth: '0',
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: compact ? '0' : '2px',
        },
      },
      h(
        'div',
        {
          style: {
            fontSize: compact ? '14px' : '18px',
            fontWeight: '600',
            lineHeight: compact ? '20px' : '26px',
            display: '-webkit-box',
            WebkitLineClamp: compact ? '1' : '2',
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
          },
        },
        title,
      ),
      h(
        'div',
        {
          style: {
            marginTop: compact ? '0' : '2px',
            fontSize: compact ? '12px' : '13px',
            lineHeight: compact ? '18px' : '20px',
            opacity: '.72',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
        },
        artist,
      ),
      !compact && album !== ''
        ? h(
            'div',
            {
              style: {
                fontSize: '12px',
                lineHeight: '18px',
                opacity: '.5',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
            },
            album,
          )
        : null,
    )
  }

  function actionsRow() {
    return h(
      'div',
      {
        className: 'mp-card-actions',
        style: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px', flex: '0 0 auto' },
      },
      // LikeButton: pressed state paints the heart in the player's like colour.
      iconButton(
        'favorite',
        likeInfo !== null && likeInfo.disabled === true ? String(likeInfo.reason || '') || t('page.favorite') : t('page.favorite'),
        h(
          'span',
          {
            style: {
              display: 'flex',
              color: favorite ? '#f2607a' : 'inherit',
              opacity: likeInfo !== null && likeInfo.disabled === true ? '.4' : '1',
            },
          },
          icon(favorite ? 'heartFill' : 'heart', 17),
        ),
        favorite,
      ),
      iconButton('addToPlaylist', t('page.addToPlaylist'), icon('star', 17), false),
      // The collection the queue came from, like Folia's "playing from" pill.
      props.canLocate === false
        ? null
        : h(
            'button',
            {
              key: 'locate',
              type: 'button',
              className: 'mp-card-actions-mid',
              title: t('page.locateCurrent'),
              onClick: function (event) {
                event.stopPropagation()
                if (typeof props.onAction === 'function') props.onAction('locate')
              },
              style: {
                height: '32px',
                minWidth: '0',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 12px 0 10px',
                borderRadius: '8px',
                border: '0',
                background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.07))',
                color: 'inherit',
                fontSize: '12px',
                cursor: 'pointer',
              },
            },
            icon('target', 15),
            h(
              'span',
              { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
              t('page.locateCurrent'),
            ),
          ),
      h('div', { style: { flex: '1 1 auto' } }),
      iconButton('home', t('page.home'), icon('house', 17), false),
      iconButton('settings', t('page.settings'), icon('settings', 17), false),
    )
  }

  // SongHeader sizing and the two transition vocabularies it uses (Folia's
  // `st-t-unfold` for the cover/height morph, `st-t-move`/`st-t-fast` for the fades).
  var coverBig = 'min(336px, 52vh)'
  var headerH = isCover ? 'calc(' + coverBig + ' + ' + String(MP_COVER_GAP) + 'px + 108px)' : String(MP_FOLDED) + 'px'
  var tMorph =
    'width ' + MP_DUR_UNFOLD + 's cubic-bezier(.22,1,.36,1), height ' + MP_DUR_UNFOLD +
    's cubic-bezier(.22,1,.36,1), border-radius ' + MP_DUR_UNFOLD + 's cubic-bezier(.22,1,.36,1)'
  var tFadeMove =
    'opacity ' + MP_DUR_MOVE + 's cubic-bezier(.22,1,.36,1), transform ' + MP_DUR_MOVE +
    's cubic-bezier(.22,1,.36,1), visibility ' + MP_DUR_MOVE + 's'
  var tFadeFast =
    'opacity ' + MP_DUR_FAST + 's cubic-bezier(.4,0,.2,1), transform ' + MP_DUR_FAST +
    's cubic-bezier(.4,0,.2,1), visibility ' + MP_DUR_FAST + 's'

  var header = h(
    'header',
    {
      className: 'mp-card-header',
      style: {
        position: 'relative',
        flex: '0 0 auto',
        height: headerH,
        overflow: 'hidden',
        transition: 'height ' + MP_DUR_UNFOLD + 's cubic-bezier(.22,1,.36,1)',
      },
    },
    // Cover: the same element at two sizes.
    h(
      'div',
      {
        className: 'mp-card-art',
        onClick: isCover
          ? undefined
          : function () {
              setIndex(0)
            },
        style: {
          position: 'absolute',
          left: '0',
          top: '0',
          width: isCover ? '100%' : String(MP_FOLDED) + 'px',
          height: isCover ? coverBig : String(MP_FOLDED) + 'px',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
          borderRadius: isCover ? '10px' : '8px',
          background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06))',
          cursor: isCover ? 'default' : 'pointer',
          transition: tMorph,
        },
      },
      cover !== ''
        ? h('img', {
            src: cover,
            alt: '',
            draggable: false,
            style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
          })
        : h(
            'div',
            { style: { width: '100%', height: '100%', display: 'grid', placeItems: 'center', opacity: '.5' } },
            icon('music', isCover ? 40 : 20),
          ),
    ),
    // Folded line: title + artist beside the 48px cover.
    h(
      'button',
      {
        type: 'button',
        className: 'mp-card-folded-line',
        onClick: function () {
          setIndex(0)
        },
        style: {
          position: 'absolute',
          left: '60px',
          right: '44px',
          top: '5px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          border: '0',
          background: 'transparent',
          color: 'inherit',
          font: 'inherit',
          textAlign: 'left',
          padding: '0',
          cursor: 'pointer',
          opacity: isCover ? '0' : '1',
          transform: isCover ? 'translateY(-4px)' : 'translateY(0)',
          visibility: isCover ? 'hidden' : 'visible',
          transition: tFadeMove,
          pointerEvents: isCover ? 'none' : 'auto',
        },
      },
      h(
        'span',
        {
          style: {
            fontSize: '14px',
            fontWeight: '600',
            lineHeight: '20px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          },
        },
        title,
      ),
      h(
        'span',
        {
          style: {
            fontSize: '12px',
            lineHeight: '18px',
            opacity: '.72',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          },
        },
        artist,
      ),
    ),
    // Like: folded form only, at the right end.
    h(
      'button',
      {
        type: 'button',
        className: 'mp-card-like',
        title: t('page.favorite'),
        onClick: function (event) {
          event.stopPropagation()
          if (typeof props.onAction === 'function') props.onAction('favorite')
        },
        style: {
          position: 'absolute',
          right: '0',
          top: '8px',
          width: '28px',
          height: '28px',
          display: 'grid',
          placeItems: 'center',
          border: '0',
          borderRadius: '999px',
          background: 'transparent',
          color: 'inherit',
          opacity: isCover ? '0' : favorite === true ? '1' : '.6',
          transform: isCover ? 'translateY(-4px)' : 'translateY(0)',
          visibility: isCover ? 'hidden' : 'visible',
          cursor: 'pointer',
          transition: tFadeMove,
          pointerEvents: isCover ? 'none' : 'auto',
        },
      },
      icon(favorite ? 'heartFill' : 'heart', 16),
    ),
    // Big form's own block: meta under the cover, then the action row.
    h(
      'div',
      {
        className: 'mp-card-under',
        style: {
          position: 'absolute',
          left: '4px',
          right: '4px',
          bottom: '0',
          display: 'flex',
          flexDirection: 'column',
          opacity: isCover ? '1' : '0',
          transform: isCover ? 'translateY(0)' : 'translateY(8px)',
          visibility: isCover ? 'visible' : 'hidden',
          transition: isCover ? tFadeMove : tFadeFast,
          pointerEvents: isCover ? 'auto' : 'none',
        },
      },
      metaBlock(false),
      actionsRow(),
    ),
  )
  // ── panes ────────────────────────────────────────────────────────────────
  // Content mirrors Folia's panelTab/*: the playing song's files (local), the
  // sound/appearance/theme groups (controls), the queue, and the streaming account.

  function mpFormatBytes(bytes) {
    var value = Number(bytes) || 0
    if (value <= 0) return ''
    var units = ['B', 'KB', 'MB', 'GB']
    var at = 0
    while (value >= 1024 && at < units.length - 1) {
      value = value / 1024
      at += 1
    }
    return (at === 0 ? String(Math.round(value)) : value.toFixed(1)) + ' ' + units[at]
  }

  // PanelRow (the panel's own 44px row) and FactList (a name/value grid) from Folia.
  /** Folia's `‹ glyph name / value ›` row: the whole line opens the picker. */
  function mpNavRow(label, value, glyph, onOpen) {
    return h(
      'button',
      {
        key: 'nav-' + String(label),
        type: 'button',
        onClick: onOpen,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          minHeight: '44px',
          padding: '6px 4px',
          border: '0',
          background: 'transparent',
          color: 'inherit',
          font: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
        },
      },
      h('span', { style: { display: 'flex', opacity: '.55', flex: '0 0 auto' } }, '\u2039'),
      h(
        'span',
        {
          style: {
            width: '30px',
            height: '30px',
            flex: '0 0 auto',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '8px',
            background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.08))',
            opacity: '.85',
          },
        },
        icon(glyph, 16),
      ),
      h(
        'span',
        { style: { flex: '1 1 auto', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '1px' } },
        h('span', { style: { fontSize: '11px', opacity: '.55' } }, label),
        h('span', { style: { fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, value),
      ),
      h('span', { style: { display: 'flex', opacity: '.45', flex: '0 0 auto' } }, '\u203a'),
    )
  }

  function mpPanelRow(label, control, hint) {
    return h(
      'div',
      {
        key: 'prow-' + String(label),
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: '12px',
          rowGap: '4px',
          minHeight: '44px',
          padding: '6px 4px',
        },
      },
      h(
        'div',
        { style: { minWidth: '0', flex: '1 1 72px' } },
        h('div', { style: { fontSize: '14px', lineHeight: '20px' } }, label),
        hint ? h('div', { style: { fontSize: '12px', lineHeight: '16px', opacity: '.45' } }, hint) : null,
      ),
      control
        ? h(
            'div',
            {
              style: {
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                minWidth: '0',
                maxWidth: '100%',
              },
            },
            control,
          )
        : null,
    )
  }

  function mpFacts(facts) {
    return h(
      'dl',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0,1fr)',
          columnGap: '16px',
          rowGap: '4px',
          padding: '0 4px 6px',
          margin: '0',
          fontSize: '12px',
          lineHeight: '18px',
        },
      },
      facts.map(function (fact) {
        return h(
          'div',
          { key: 'fact-' + fact.label, style: { display: 'contents' } },
          h('dt', { style: { margin: '0', opacity: '.45' } }, fact.label),
          h(
            'dd',
            {
              style: {
                margin: '0',
                minWidth: '0',
                textAlign: 'right',
                opacity: '.75',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
              title: String(fact.value),
            },
            String(fact.value === undefined || fact.value === null || fact.value === '' ? '—' : fact.value),
          ),
        )
      }),
    )
  }

  function mpSmallButton(label, onClick) {
    return h(
      'button',
      {
        key: 'btn-' + String(label),
        type: 'button',
        onClick: onClick,
        style: {
          height: '28px',
          padding: '0 10px',
          borderRadius: '8px',
          border: '0',
          background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.07))',
          color: 'inherit',
          fontSize: '12px',
          font: 'inherit',
          cursor: 'pointer',
        },
      },
      label,
    )
  }

  function mpSection(title, children) {
    return h(
      'div',
      { key: 'section-' + String(title), style: { marginBottom: '2px' } },
      h(
        'div',
        {
          style: {
            fontSize: '11px',
            letterSpacing: '.04em',
            textTransform: 'uppercase',
            opacity: '.45',
            padding: '10px 4px 4px',
          },
        },
        title,
      ),
      children,
    )
  }

  function mpQuickTile(glyph, label, on, onClick) {
    return h(
      'button',
      {
        type: 'button',
        onClick: onClick,
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          height: '58px',
          borderRadius: '10px',
          border: '0',
          background:
            on === true ? 'var(--st-raise,rgba(255,255,255,.18))' : 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06))',
          color: 'inherit',
          font: 'inherit',
          fontSize: '11.5px',
          cursor: 'pointer',
          padding: '0 6px',
          transition: 'background-color ' + MP_DUR_MOVE + 's cubic-bezier(.22,1,.36,1)',
        },
      },
      glyph,
      h(
        'span',
        { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' } },
        label,
      ),
    )
  }

  // ControlsTab: 声音 (VolumeRow + SoundTiles) / 外观 (AppearanceSection rows) / 主题
  // (ThemeSourceRow + ThemeNameRow). Entries for settings this plugin does not own yet
  // stay visible and say where they lead.
  function cardControlsPane() {
    var volume = Number(snap.volume)
    if (!isFinite(volume)) volume = 1
    var muted = snap.muted === true
    var loop = snap.loop || 'none'
    var loopLabel = loop === 'one' ? t('sheet.loopOne') : loop === 'all' ? t('sheet.loopAll') : t('sheet.loopOff')
    var heard = muted ? 0 : volume

    return h(
      'div',
      { key: 'controls-pane' },
      mpSection(
        t('sheet.sound'),
        h(
          'div',
          { style: { padding: '0 4px' } },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '10px', height: '32px' } },
            h(
              'button',
              {
                type: 'button',
                title: muted ? t('sheet.unmute') : t('sheet.mute'),
                onClick: function () {
                  player.setMuted(!muted)
                },
                style: {
                  width: '28px',
                  height: '28px',
                  display: 'grid',
                  placeItems: 'center',
                  border: '0',
                  borderRadius: '8px',
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                },
              },
              icon(muted || heard === 0 ? 'mute' : heard < 0.5 ? 'volumeLow' : 'volume', 17),
            ),
            h('input', {
              type: 'range',
              min: '0',
              max: '1',
              step: '0.01',
              value: String(heard),
              'aria-label': t('sheet.volume'),
              onChange: function (event) {
                player.setVolume(Number(event.target.value))
              },
              style: { flex: '1 1 auto', minWidth: '0', accentColor: (typeof props.accentCss === 'string' && props.accentCss) || 'var(--dsw-alias-state-business-primary,#4f8cff)' },
            }),
            h(
              'span',
              { style: { minWidth: '36px', textAlign: 'right', fontSize: '12px', opacity: '.7' } },
              String(Math.round(heard * 100)) + '%',
            ),
          ),
          h(
            'div',
            { style: { marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' } },
            mpQuickTile(
              icon(loop === 'one' ? 'repeatOne' : loop === 'all' ? 'repeat' : 'list', 18),
              loopLabel,
              loop !== 'none',
              function () {
                player.setLoop(loop === 'none' ? 'all' : loop === 'all' ? 'one' : 'none')
              },
            ),
            // Folia's QuickTile: a switch, lit while blending is on — the gear at the top of
            // the sheet is still the way into 设置 · 播放控制 for the length and the details.
            mpQuickTile(icon('shuffle', 18), t('sheet.smartFade'), crossfadeFadeSeconds(prefs) > 0, function () {
              setPrefs({ crossfadeEnabled: crossfadeFadeSeconds(prefs) <= 0 })
            }),
            // Folia's SoundTiles: an opening tile, lit while processing is on. The window it
            // raises is the audio effect panel (audio-equalizer.js).
            mpQuickTile(
              icon('equalizer', 18),
              t('sheet.effects'),
              normalizeEqPrefs(prefs).enabled,
              function () {
                pushLayer('equalizer', {})
              },
            ),
          ),
        ),
      ),
      mpSection(
        t('sheet.appearance'),
        h(
          'div',
          null,
          // Folia's rows: a glyph, the name, the current value and a chevron that opens
          // the same place the old 「打开」 button did.
          mpNavRow(
            t('sheet.lyricStyle'),
            mpStyleLabelOf(prefs.lyricStyle),
            'note',
            function () {
              setLookPicker(lookPicker === 'lyricStyle' ? '' : 'lyricStyle')
            },
          ),
          lookPicker === 'lyricStyle'
            ? h(
                'div',
                { style: { padding: '2px 4px 10px 44px' } },
                h(LookChoiceGrid, {
                  kind: 'lyricStyle',
                  value: mpStyleIdOf(prefs.lyricStyle),
                  onPick: function (next) {
                    setPrefs({ lyricStyle: next })
                  },
                }),
              )
            : null,
          h(
            'div',
            {
              key: 'lyric-quick',
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '4px',
                minHeight: '36px',
                padding: '2px 4px',
              },
            },
            mpSmallButton(t('sheet.standard'), function () { setPrefs({ lyricIntensity: prefs.lyricIntensity === 'normal' ? 'calm' : prefs.lyricIntensity === 'calm' ? 'chaotic' : 'normal' }) }, t('settings.lyricIntensity')),
            mpSmallButton('\u2261', function () { setPrefs({ showTranslation: prefs.showTranslation === false }) }, t('page.translation')),
            mpSmallButton('\u2194', function () { setPrefs({ translationScale: prefs.translationScale === 100 ? 110 : prefs.translationScale === 110 ? 90 : 100 }) }, t('page.translationScale')),
            mpSmallButton('\u224b', function () { setPrefs({ lyricsFontScale: prefs.lyricsFontScale === 1 ? 1.15 : prefs.lyricsFontScale === 1.15 ? 0.9 : 1 }) }, t('settings.lyricFontScale')),
          ),
          mpNavRow(
            t('sheet.background'),
            mpLookLabel(MP_BG_MODES, prefs.bgMode),
            'disc',
            function () {
              setLookPicker(lookPicker === 'bgMode' ? '' : 'bgMode')
            },
          ),
          lookPicker === 'bgMode'
            ? h(
                'div',
                { style: { padding: '2px 4px 10px 44px' } },
                h(LookChoiceGrid, {
                  kind: 'bgMode',
                  value: mpLookId(MP_BG_MODES, prefs.bgMode),
                  cover: cover,
                  onPick: function (next) {
                    setPrefs({ bgMode: next })
                  },
                }),
                mpLookId(MP_BG_MODES, prefs.bgMode) === 'url'
                  ? h('input', {
                      type: 'url',
                      value: typeof prefs.bgUrl === 'string' ? prefs.bgUrl : '',
                      placeholder: 'https://…',
                      'aria-label': t('sheet.foliaBgUrl'),
                      style: {
                        width: '100%',
                        marginTop: '8px',
                        height: '30px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1))',
                        background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04))',
                        color: 'inherit',
                        font: 'inherit',
                        outline: 'none',
                      },
                      onChange: function (event) {
                        setPrefs({ bgUrl: event.target.value })
                      },
                    })
                  : null,
              )
            : null,
          h(
            'div',
            {
              key: 'bg-quick',
              style: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', padding: '2px 4px' },
            },
            mpSegment(
              [
                { value: 'dithering', label: t('sheet.latentDithering') },
                { value: 'mesh', label: t('sheet.latentMesh') },
                { value: 'both', label: t('sheet.latentBoth') },
              ],
              prefs.latentDisplayMode === 'dithering' || prefs.latentDisplayMode === 'mesh' ? prefs.latentDisplayMode : 'both',
              function (next) {
                setPrefs({ latentDisplayMode: next, bgMode: 'latent' })
              },
            ),
            mpSmallButton(t('sheet.bgCoverOnly'), function () {
              setPrefs({ bgCoverOnly: prefs.bgCoverOnly !== true, latentColorSource: prefs.bgCoverOnly === true ? 'cover-theme' : 'cover-only' })
            }),
          ),
        ),
      ),
      mpSection(
        t('sheet.theme'),
        h(
          'div',
          null,
          mpPanelRow(
            t('sheet.themeSource'),
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
              mpSegment(
                [
                  { value: 'default', label: t('sheet.sourceDefault') },
                  { value: 'cover', label: t('sheet.sourceAI') },
                  { value: 'custom', label: t('sheet.sourceCustom') },
                ],
                MP_THEME_SOURCES.indexOf(prefs.themeSource) >= 0 ? prefs.themeSource : 'default',
                function (next) {
                  setPrefs({ themeSource: next })
                },
              ),
              mpSmallButton('\u25a4', function () {
                if (typeof props.onAction === 'function') props.onAction('settings')
              }),
            ),
          ),
          mpPanelRow(
            t('sheet.themeName'),
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
              h(
                'span',
                { style: { fontSize: '12px', opacity: '.75', marginRight: '2px' } },
                (prefs.themeSource === 'custom'
                  ? t('sheet.sourceCustom')
                  : prefs.themeSource === 'cover'
                    ? t('sheet.sourceAI')
                    : t('sheet.sourceDefault')) +
                  ' · ' +
                  (prefs.themeSource === 'cover' && localThemeState.theme
                    ? localThemeState.theme.name
                    : t('sheet.themeBuiltin')),
              ),
              mpSegment(
                [
                  { value: 'light', label: t('sheet.light') },
                  { value: 'dark', label: t('sheet.dark') },
                ],
                colorMode,
                setColorMode,
              ),
              mpSmallButton('\u21c4', function () {
                setColorMode(colorMode === 'dark' ? 'light' : 'dark')
              }),
            ),
          ),
          // Local theme: cover palette + lyric mood, generated on this machine. No model,
          // no network; the button is a fresh variation, the page auto-fills on song change.
          mpPanelRow(
            t('sheet.genAI'),
            mpSmallButton(t('sheet.genFromCover'), function () {
              setPrefs({ themeSource: 'cover' })
              if (typeof mpGenerateLocalThemeForSong !== 'function') return
              mpGenerateLocalThemeForSong({
                key: typeof props.lyricsPath === 'string' ? props.lyricsPath : '',
                cover: typeof props.cover === 'string' ? props.cover : '',
                lyricsText: typeof props.lyricsText === 'string' ? props.lyricsText : '',
                songTitle: typeof props.songTitle === 'string' ? props.songTitle : '',
                variation: Date.now(),
              }).then(
                function (theme) {
                  if (theme !== null && typeof showToast === 'function') showToast(t('sheet.themeGenerated'))
                },
                function () {
                  if (typeof showToast === 'function') showToast(t('sheet.themeFailed'))
                },
              )
            }),
          ),
        ),
      ),
    )
  }

  /**
   * Where the lyric comes from — Folia's source row for a local file: the file's own
   * lyrics, the matched online lyric, and the instrumental mark. The choice is stored on
   * the song, so the reset control appears only when this song has an explicit one.
   */
  function lyricSourceControl() {
    var info = props.lyricSources || null
    var onlineLabel = track && track.onlineProvider ? sourceLabelOf(track.onlineProvider) : t('sheet.srcOnline')
    var hasEmbedded = info !== null && info.embedded === true
    var hasLocal = info !== null && info.local === true
    var hasOnline = info !== null && info.online === true
    var hasImported = info !== null && info.imported === true
    var options = []
    var active = ''
    var explicit = false
    var resetVisible = false

    if (isOnlineTrack) {
      // Folia's online source row offers the platform's own lyric and an imported
      // one; pure music is a result of the lyric match, never a selectable source.
      if (hasOnline) options.push({ value: 'online', label: onlineLabel })
      if (hasImported) options.push({ value: 'imported', label: t('sheet.srcImported') })
      active = hasImported && info.active === 'imported' ? 'imported' : hasOnline ? 'online' : ''
      explicit = info !== null && (
        info.markedPureMusic === true ||
        (info.source !== null && info.source !== undefined) ||
        hasImported
      )
      resetVisible = explicit
    } else if (isNavidromeTrack) {
      if (hasOnline) options.push({ value: 'online', label: onlineLabel })
      if (hasLocal) options.push({ value: 'local', label: t('sheet.srcLocal') })
      active = hasOnline ? 'online' : hasLocal ? 'local' : ''
    } else {
      // Folia's local row: local file, embedded tag, matched online lyric. A
      // matched lyric is one choice; an instrumental mark is only a label.
      if (hasLocal) options.push({ value: 'local', label: t('sheet.srcLocal') })
      if (hasEmbedded) options.push({ value: 'embedded', label: t('sheet.srcEmbedded') })
      if (hasOnline) options.push({ value: 'online', label: onlineLabel })
      active = info !== null && info.active === 'online' && hasOnline
        ? 'online'
        : info !== null && info.active === 'embedded' && hasEmbedded
          ? 'embedded'
          : hasLocal
            ? 'local'
            : hasEmbedded
              ? 'embedded'
              : hasOnline
                ? 'online'
                : ''
    }

    if (options.length === 0) {
      var label = info !== null && info.markedPureMusic === true
        ? t('sheet.srcPureMusic')
        : (props.lyricSourceLabel || t('sheet.srcNone'))
      return h(
        'span',
        { style: { fontSize: '13px', opacity: '.75', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
        label,
      )
    }

    var choice = options.length > 1
      ? mpSegment(options, active, function (next) {
          if (typeof props.onSwitchLyricSource === 'function') props.onSwitchLyricSource(next)
        })
      : h(
          'span',
          { style: { fontSize: '13px', opacity: '.75', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
          options[0].label,
        )

    return h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
      resetVisible
        ? mpSmallButton('\u21ba', function () {
            if (typeof props.onResetLyricSource === 'function') props.onResetLyricSource()
          })
        : null,
      choice,
    )
  }

  /**
   * One line under 音频增益 — Folia's ReplayGainControl: nothing for 关闭, 未检测到 ReplayGain
   * for a tag mode the source gave nothing to, otherwise the mode's name and the gain the
   * engine actually applied (after the peak cap), with 估计 while the balance stands on a
   * stand-in reading.
   */
  function gainHint() {
    var mode = typeof props.gainMode === 'string' ? props.gainMode : 'auto'
    if (mode === 'off') return ''
    if (mode !== 'auto' && props.gainAvailable === false) return t('sheet.gainUnavailable')
    var db = props.gainAppliedDb
    if (typeof db !== 'number' || !isFinite(db)) {
      // 智能平衡 always has a decision, even 0 dB; a missing figure means the engine is older
      // than this panel, and "no tags" would be a false statement about the song.
      return mode === 'auto' ? t('sheet.gainAutoHint') : t('sheet.gainUnavailable')
    }
    var label = mode === 'album' ? t('sheet.gainAlbum') : mode === 'track' ? t('sheet.gainTrack') : t('sheet.gainAuto')
    return (
      label + ' ' + (db > 0 ? '+' : '') + db.toFixed(1) + ' dB' +
      (mode === 'auto' && props.gainAutoEstimated === true ? ' · ' + t('sheet.gainEstimated') : '')
    )
  }

  // 本地 tab — Folia's SourceTab: lyric source, timeline offset, match + lyric file,
  // audio gain, then what is known about the file.
  function cardLocalPane() {
    var row = track !== null && track.path ? trackByPath(track.path) : null
    var name = row && row.name ? row.name : track && track.path ? String(track.path).split(/[\\/]/).pop() : ''
    var offset = Number(props.offsetMs) || 0

    function step(delta) {
      if (typeof props.onOffsetChange === 'function') props.onOffsetChange(offset + delta)
    }
    function reset() {
      if (typeof props.onOffsetChange === 'function') props.onOffsetChange(0)
    }
    function pickLyricFile() {
      if (typeof document === 'undefined') return
      var input = document.createElement('input')
      input.type = 'file'
      input.accept = '.lrc,.txt,text/plain'
      input.onchange = function () {
        var file = input.files && input.files[0]
        if (!file) return
        var reader = new FileReader()
        reader.onload = function () {
          var text = String(reader.result || '')
          if (text.trim() === '' || typeof props.lyricsPath !== 'string' || props.lyricsPath === '') return
          postJson(API + 'lyrics/save', { path: props.lyricsPath, lrc: text })
            .then(function () {
              if (typeof showToast === 'function') showToast(t('sheet.lyricsImported'))
              if (typeof props.onLyricsSaved === 'function') props.onLyricsSaved()
            })
            .catch(function (error) {
              if (typeof showToast === 'function') showToast(errorText(error))
            })
        }
        reader.readAsText(file)
      }
      input.click()
    }
    function exportLyricFile() {
      if (typeof document === 'undefined') return
      var text = typeof props.lyricsText === 'string' ? props.lyricsText : ''
      if (text.trim() === '') {
        if (typeof showToast === 'function') showToast(t('sheet.noLyricsToExport'))
        return
      }
      var blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
      var url = URL.createObjectURL(blob)
      var link = document.createElement('a')
      link.href = url
      link.download = (name.replace(/\.[^.]+$/, '') || 'lyrics') + '.lrc'
      link.click()
      URL.revokeObjectURL(url)
    }

    var offsetStepper = h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          padding: '2px',
          borderRadius: '10px',
          background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06))',
        },
      },
      h(
        'button',
        {
          type: 'button',
          className: 'mp-card-step',
          title: '-',
          onClick: function () {
            step(-250)
          },
          style: mpStepperStyle(),
        },
        '-',
      ),
      h('input', {
        type: 'text',
        inputMode: 'numeric',
        'aria-label': t('sheet.lyricOffset'),
        value: (offset > 0 ? '+' : '') + String(offset),
        onChange: function (event) {
          var next = Number(String(event.target.value || '').replace(/[^0-9+-]/g, ''))
          if (typeof props.onOffsetChange === 'function') props.onOffsetChange(Number.isFinite(next) ? next : 0)
        },
        style: {
          width: '54px',
          minWidth: '0',
          border: '0',
          outline: '0',
          background: 'transparent',
          color: 'inherit',
          textAlign: 'center',
          font: 'inherit',
          fontSize: '12px',
          fontVariantNumeric: 'tabular-nums',
        },
      }),
      h('span', { style: { fontSize: '10px', opacity: '.55', marginLeft: '-2px' } }, 'ms'),
      h(
        'button',
        {
          type: 'button',
          className: 'mp-card-step',
          title: '+',
          onClick: function () {
            step(250)
          },
          style: mpStepperStyle(),
        },
        '+',
      ),
    )

    return h(
      'div',
      { key: 'local-pane' },
      mpPanelRow(
        t('sheet.lyrics'),
        lyricSourceControl(),
      ),

      mpPanelRow(
        t('sheet.lyricOffset'),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          offset !== 0
            ? mpSmallButton('\u21ba', reset)
            : null,
          offsetStepper,
        ),
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '8px', padding: '8px 2px 4px' } },
        h(
          'button',
          {
            type: 'button',
            onClick: function () {
              if (typeof props.onAction === 'function') props.onAction('matchOnline')
            },
            style: mpWideButtonStyle(),
          },
          icon('search', 15),
          t('sheet.matchOnline'),
        ),
        h(
          'button',
          {
            type: 'button',
            onClick: function () {
              if (typeof props.onOpenLyricFile === 'function') props.onOpenLyricFile()
            },
            style: mpWideButtonStyle(),
          },
          icon('note', 15),
          t('sheet.lyricFile'),
        ),
      ),

      h('div', { style: { height: '1px', background: 'var(--dsw-alias-border-l1,rgba(255,255,255,.08))', margin: '8px 0' } }),
      mpPanelRow(
        t('sheet.audioGain'),
        mpSegment(
          [
            { value: 'off', label: t('sheet.gainOff') },
            { value: 'auto', label: t('sheet.gainAuto') },
            { value: 'track', label: t('sheet.gainTrack') },
            { value: 'album', label: t('sheet.gainAlbum') },
          ],
          typeof props.gainMode === 'string' ? props.gainMode : 'auto',
          function (next) {
            if (typeof props.onGainModeChange === 'function') props.onGainModeChange(next)
          },
        ),
      ),
      h('div', { style: { padding: '0 4px 6px', fontSize: '11px', opacity: '.45' } }, gainHint()),
      !isOnlineTrack
        ? h(
            'div',
            null,
            h('div', { style: { height: '1px', background: 'var(--dsw-alias-border-l1,rgba(255,255,255,.08))', margin: '8px 0' } }),
            mpFacts([
              { label: t('sheet.file'), value: name },
              {
                label: t('sheet.size'),
                value:
                  mpFormatBytes(row && row.size) +
                  (row && row.bitrate ? ' / ' + String(Math.round(Number(row.bitrate) / 1000)) + ' kbps' : ''),
              },
            ]),
          )
        : isNavidromeTrack
          ? h(
              'div',
              null,
              h('div', { style: { height: '1px', background: 'var(--dsw-alias-border-l1,rgba(255,255,255,.08))', margin: '8px 0' } }),
              mpFacts([{ label: 'Song ID', value: String(track.onlineId || '') }]),
            )
          : null,
    )
  }

  function mpStepperStyle() {
    return {
      width: '26px',
      height: '24px',
      display: 'grid',
      placeItems: 'center',
      borderRadius: '8px',
      border: '0',
      background: 'transparent',
      color: 'inherit',
      fontSize: '14px',
      lineHeight: '1',
      cursor: 'pointer',
    }
  }

  function mpWideButtonStyle() {
    return {
      flex: '1 1 0',
      minWidth: '0',
      height: '34px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      padding: '0 8px',
      borderRadius: '10px',
      border: '0',
      background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.07))',
      color: 'inherit',
      font: 'inherit',
      fontSize: '12px',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    }
  }

  function mpSegment(options, value, onChange) {
    return h(
      'div',
      {
        style: {
          display: 'flex',
          gap: '2px',
          padding: '2px',
          borderRadius: '10px',
          background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06))',
        },
      },
      options.map(function (option) {
        var selected = option.value === value
        return h(
          'button',
          {
            key: option.value,
            type: 'button',
            'aria-pressed': selected ? 'true' : 'false',
            onClick: function () {
              onChange(option.value)
            },
            style: {
              height: '28px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '0',
              background: selected ? 'var(--st-raise,rgba(255,255,255,.18))' : 'transparent',
              boxShadow: selected ? '0 1px 2px rgba(0,0,0,.2)' : 'none',
              color: 'inherit',
              font: 'inherit',
              fontSize: '12px',
              opacity: selected ? '1' : '.65',
              cursor: 'pointer',
              transition:
                'background-color ' + MP_DUR_MOVE + 's cubic-bezier(.22,1,.36,1), opacity ' + MP_DUR_MOVE + 's',
            },
          },
          option.label,
        )
      }),
    )
  }

  function cardQualityPane() {
    var providerId = track && track.onlineProvider ? String(track.onlineProvider) : ''
    var info = providerId !== '' && online.providers ? online.providers[providerId] : null
    var label = info && info.displayName ? info.displayName : providerId
    var options = [
      { value: 'standard', label: t('sheet.qStandard') },
      { value: 'high', label: t('sheet.qHigh') },
      { value: 'lossless', label: t('sheet.qLossless') },
      { value: 'hires', label: t('sheet.qHires') },
    ]
    return h(
      'div',
      { key: 'quality-pane' },
      // AccountTab puts audio quality on a PanelRow with a Segments control.
      mpPanelRow(
        t('sheet.quality'),
        mpSegment(options, prefs.onlineQuality || 'high', function (value) {
          setPrefs({ onlineQuality: value })
        }),
      ),
      track !== null && providerId !== ''
        ? mpFacts([
            { label: t('sheet.provider'), value: label },
            { label: t('sheet.account'), value: info && info.loggedIn === true ? t('sheet.loggedIn') : t('sheet.loggedOut') },
            { label: 'ID', value: track.onlineId || '' },
          ])
        : mpFacts([{ label: t('sheet.provider'), value: '—' }]),
      // Online tracks split their lyrics here too: the saved split is per song, not per
      // file, so a platform lyric and a local lyric each keep their own.
      track !== null && providerId !== ''
        ? mpPanelRow(
            t('sheet.lyricSegmentation'),
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
              h(
                'span',
                { style: { fontSize: '12px', opacity: '.65' } },
                Number(props.lyricSegCount) > 0
                  ? t('sheet.lyricSegCount', { count: String(props.lyricSegCount) })
                  : t('sheet.lyricSegDefault'),
              ),
              mpSmallButton(t('sheet.lyricSegOpen'), function () {
                if (typeof props.onOpenLyricSegmentation === 'function') props.onOpenLyricSegmentation()
              }),
            ),
          )
        : null,
    )
  }
  var bodies = [null, cardLocalPane(), cardControlsPane(), cardQualityPane()]

  var bodyHeight = isCover ? 0 : MP_BODY_GAP + MP_BODY_LINE + MP_BODY_UNDER + (bodyH > 0 ? bodyH : 0)

  var body = h(
    'div',
    {
      className: 'mp-card-body-wrap',
      style: {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '0',
        overflow: 'hidden',
        height: String(bodyHeight) + 'px',
        marginInline: String(-MP_PADDING) + 'px',
        transition: 'height ' + MP_DUR_UNFOLD + 's cubic-bezier(.22,1,.36,1)',
      },
    },
    h('div', {
      style: {
        height: '1px',
        flex: '0 0 auto',
        marginTop: String(MP_BODY_GAP) + 'px',
        marginInline: String(MP_PADDING) + 'px',
        background: 'var(--dsw-alias-border-l1,rgba(255,255,255,.08))',
      },
    }),
    h(
      'div',
      {
        className: 'mp-card-scroll',
        style: {
          minHeight: '0',
          flex: '1 1 auto',
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          paddingTop: String(MP_BODY_UNDER) + 'px',
          paddingInline: String(MP_PADDING) + 'px',
        },
      },
      h(
        'div',
        {
          key: 'page-' + String(index),
          ref: contentRef,
          className: 'mp-card-page',
          style: { animation: 'mp-page-in ' + MP_DUR_MOVE + 's cubic-bezier(.22,1,.36,1) backwards' },
        },
        bodies[index],
      ),
    ),
  )

  var markEl = null
  if (!useFramerMark && mark.ready) {
    markEl = h('div', {
      key: 'mark',
      'aria-hidden': 'true',
      style: {
        position: 'absolute',
        top: '2px',
        bottom: '2px',
        left: '0',
        width: String(mark.width) + 'px',
        borderRadius: '8px',
        background: 'rgba(255,255,255,.14)',
        transform: 'translate3d(' + String(mark.left - 2) + 'px,0,0)',
        transition:
          'transform ' + MP_DUR_MOVE + 's cubic-bezier(.22,1,.36,1), width ' + MP_DUR_MOVE + 's cubic-bezier(.22,1,.36,1)',
        pointerEvents: 'none',
      },
    })
  }

  var dock = h(
    'div',
    {
      className: 'mp-card-tabs',
      role: 'tablist',
      style: {
        position: 'relative',
        display: 'flex',
        flex: '0 0 auto',
        gap: '2px',
        height: String(MP_DOCK_HEIGHT) + 'px',
        marginTop: String(MP_DOCK_GAP) + 'px',
        padding: '2px',
        borderRadius: '10px',
        background: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06))',
      },
    },
    markEl,
    TABS.map(function (key, tabIndex) {
      var active = tabIndex === index
      return h(
        'button',
        {
          key: key,
          type: 'button',
          role: 'tab',
          ref: function (el) {
            tabRefs.current[tabIndex] = el
          },
          'aria-selected': active ? 'true' : 'false',
          className: cx('mp-card-tab', active && 'is-active'),
          onClick: function (event) {
            event.stopPropagation()
            setIndex(tabIndex)
          },
          style: {
            position: 'relative',
            zIndex: '1',
            flex: '1 1 0',
            minWidth: '0',
            border: '0',
            borderRadius: '8px',
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
            fontSize: '12px',
            padding: '0 6px',
            color: active ? 'var(--dsw-alias-label-primary,inherit)' : 'var(--dsw-alias-label-secondary,rgba(255,255,255,.6))',
            cursor: 'pointer',
            transition: 'opacity ' + MP_DUR_MOVE + 's cubic-bezier(.22,1,.36,1)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
        },
        // Segments: one shared element (layoutId) inside the open tab; framer
        // animates its position and width between tabs.
        useFramerMark && active
          ? h(framer.mark, {
              key: 'mark-shared',
              layoutId: 'mp-card-tab-mark',
              transition: framer.markTransition,
              'aria-hidden': 'true',
              style: {
                position: 'absolute',
                inset: '0',
                borderRadius: '8px',
                background: 'var(--st-raise,rgba(255,255,255,.18))',
                boxShadow: '0 1px 2px rgba(0,0,0,.2)',
                zIndex: '0',
                pointerEvents: 'none',
              },
            })
          : null,
        h('span', { style: { position: 'relative', zIndex: '1' }, key: 'label' }, t(key)),
      )
    }),
  )

  var surfaceStyle = {
    position: 'absolute',
    right: (props.anchor && props.anchor.right >= 0 ? String(props.anchor.right) + 'px' : '22px'),
    bottom: (props.anchor && props.anchor.bottom >= 0 ? String(props.anchor.bottom) + 'px' : '24px'),
    width: '360px',
    maxWidth: 'calc(100vw - 2rem)',
    maxHeight:
      'calc(100dvh - ' +
      String(MP_TOP_MARGIN) +
      'px - ' +
      (props.anchor && props.anchor.bottom >= 0 ? String(props.anchor.bottom) + 'px' : '24px') +
      ')',
    display: 'flex',
    flexDirection: 'column',
    padding: String(MP_PADDING) + 'px',
    borderRadius: '20px',
    pointerEvents: 'auto',
    background: 'rgba(23, 23, 26, 0.95)',
    backdropFilter: 'blur(40px) saturate(1.3)',
    border: '1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.09))',
    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.09)',
    transformOrigin: 'calc(100% - 24px) calc(100% + 24px)',
    overflow: 'hidden',
  }

  var surfaceProps = framer
    ? {
        className: 'mp-card',
        initial: framer.enter,
        animate: Object.assign({}, framer.shown, { transition: framer.transition }),
        exit: Object.assign({}, framer.leave, { transition: framer.leaveTransition }),
        style: surfaceStyle,
        onClick: function (event) {
          event.stopPropagation()
        },
      }
    : {
        className: 'mp-card',
        style: Object.assign({}, surfaceStyle, {
          animation: 'mp-card-in ' + MP_DUR_UNFOLD + 's cubic-bezier(.22,1,.36,1) backwards',
        }),
        onClick: function (event) {
          event.stopPropagation()
        },
      }

  var Surface = framer ? framer.surface : 'div'

  return h(
    'div',
    {
      className: 'mp-card-root',
      'data-card-motion': framer ? 'framer' : 'css',
      role: 'dialog',
      'aria-modal': 'false',
      style: { position: 'fixed', inset: '0', zIndex: String(MP_Z.page), pointerEvents: 'none' },
    },
    h('div', {
      className: 'mp-card-catcher',
      onClick: onClose,
      style: { position: 'absolute', inset: '0', pointerEvents: 'auto', background: 'transparent' },
    }),
    h(
      Surface,
      surfaceProps,
      h(
        'style',
        null,
        '@keyframes mp-card-in{from{opacity:0;scale:.92}to{opacity:1;scale:1}}' +
          '@keyframes mp-page-in{from{opacity:0;transform:translateY(6px)}}',
      ),
      header,
      body,
      dock,
    ),
  )
}







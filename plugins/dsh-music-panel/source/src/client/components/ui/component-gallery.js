/**
 * Component test page (设置 → 关于 → 测试页面).
 *
 * One screen with every shared control, so a change to the gap between the plugin's
 * controls and the DSH host is visible at a glance. Each case renders the real primitive
 * (host component when the host exposes it, otherwise its fallback), not a mock: what you
 * see is what the rest of the plugin draws. Rules: A_other/docs/主题与组件开发规范.md.
 */

var GALLERY_SECTIONS = [
  { key: 'buttons', labelKey: 'gallery.secButtons' },
  { key: 'form', labelKey: 'gallery.secForm' },
  { key: 'navigation', labelKey: 'gallery.secNav' },
  { key: 'overlays', labelKey: 'gallery.secOverlays' },
  { key: 'states', labelKey: 'gallery.secStates' },
]

/** One labelled case in the grid: a title above whatever the case renders. */
function GalleryCase(props) {
  return h(
    'div',
    { className: cx('mp-gallery-case', props.wide === true && 'is-wide') },
    h('div', { className: 'mp-gallery-case-title' }, props.title),
    h('div', { className: 'mp-gallery-row' }, props.children),
  )
}

function ComponentGallery(props) {
  var sectionPair = useState('buttons')
  var section = sectionPair[0]
  var setSection = sectionPair[1]
  var modalPair = useState(false)
  var modalOpen = modalPair[0]
  var setModalOpen = modalPair[1]

  var inputPair = useState('')
  var inputValue = inputPair[0]
  var setInputValue = inputPair[1]

  var selectPair = useState('a')
  var selectValue = selectPair[0]
  var setSelectValue = selectPair[1]

  var switchPair = useState(true)
  var switchOn = switchPair[0]
  var setSwitchOn = switchPair[1]

  var checkPair = useState(true)
  var checked = checkPair[0]
  var setChecked = checkPair[1]

  var rangePair = useState(48)
  var rangeValue = rangePair[0]
  var setRangeValue = rangePair[1]

  var pillPair = useState('lyrics')
  var pillValue = pillPair[0]
  var setPillValue = pillPair[1]

  var segmentPair = useState('all')
  var segmentValue = segmentPair[0]
  var setSegmentValue = segmentPair[1]

  var tabsPair = useState('songs')
  var tabsValue = tabsPair[0]
  var setTabsValue = tabsPair[1]

  var hostKit = hostComponent('Button') !== null ? 'native' : 'fallback'

  function buttonsSection() {
    return [
      h(
        'div',
        { key: 'variants' },
        h(
          'div',
          { className: 'mp-gallery-grid' },
          h(GalleryCase, { title: t('gallery.caseButtonVariants') },
            h(Button, { variant: 'primary' }, t('gallery.primary')),
            h(Button, null, t('gallery.outline')),
            h(Button, { variant: 'ghost' }, t('gallery.ghost')),
            h(Button, { variant: 'toolbar' }, t('gallery.toolbar')),
          ),
          h(GalleryCase, { title: t('gallery.caseButtonSizes') },
            h(Button, { size: 'md' }, t('gallery.medium')),
            h(Button, { size: 'sm' }, t('gallery.small')),
          ),
          h(GalleryCase, { title: t('gallery.caseButtonIcon') },
            h(Button, { icon: 'plus' }, t('gallery.withIcon')),
            h(Button, { variant: 'primary', icon: 'play' }, t('gallery.play')),
          ),
          h(GalleryCase, { title: t('gallery.caseButtonDisabled') },
            h(Button, { disabled: true }, t('gallery.disabled')),
            h(Button, { variant: 'primary', disabled: true }, t('gallery.disabled')),
          ),
          h(GalleryCase, { title: t('gallery.caseDanger') },
            h(Button, { className: 'mp-data-danger-btn', icon: 'trash' }, t('gallery.danger')),
          ),
          h(GalleryCase, { title: t('gallery.caseIconButton') },
            h(IconButton, { icon: 'note', title: t('gallery.iconButton') }),
            h(IconButton, { icon: 'list', title: t('gallery.iconButton'), active: true }),
            h(IconButton, { icon: 'refresh', title: t('gallery.iconButton'), disabled: true }),
          ),
        ),
      ),
    ]
  }

  function formSection() {
    return [
      h(
        'div',
        { key: 'grid', className: 'mp-gallery-grid' },
        h(GalleryCase, { title: t('gallery.caseInput') },
          h(KitInput, {
            value: inputValue,
            placeholder: t('gallery.inputPlaceholder'),
            icon: 'search',
            label: t('gallery.caseInput'),
            onChange: setInputValue,
          }),
        ),
        h(GalleryCase, { title: t('gallery.caseSelect') },
          h(KitSelect, {
            value: selectValue,
            label: t('gallery.caseSelect'),
            options: [
              { value: 'a', label: t('gallery.optLatest') },
              { value: 'b', label: t('gallery.optTitle') },
              { value: 'c', label: t('gallery.optArtist') },
            ],
            onChange: setSelectValue,
          }),
        ),
        h(GalleryCase, { title: t('gallery.caseSwitch') },
          h(Switch, { value: switchOn, label: t('gallery.caseSwitch'), onChange: setSwitchOn }),
          h(Switch, { value: !switchOn, label: t('gallery.caseSwitch'), onChange: setSwitchOn }),
          h(Switch, { value: false, label: t('gallery.caseSwitch'), disabled: true }),
        ),
        h(GalleryCase, { title: t('gallery.caseCheckbox') },
          h(KitCheckbox, { checked: checked, label: t('gallery.caseCheckbox'), onChange: setChecked }),
          h(KitCheckbox, { checked: false, label: t('gallery.disabled'), disabled: true, onChange: function () {} }),
        ),
        h(GalleryCase, { title: t('gallery.caseRange') },
          h('input', {
            type: 'range',
            className: 'mp-range',
            min: 0,
            max: 100,
            value: rangeValue,
            'aria-label': t('gallery.caseRange'),
            onChange: function (event) {
              setRangeValue(Number(event.target.value))
            },
          }),
          h('span', { className: 'mp-set-val' }, rangeValue + '%'),
        ),
        h(GalleryCase, { title: t('gallery.casePill') },
          [
            ['lyrics', t('gallery.pillLyrics')],
            ['cover', t('gallery.pillCover')],
            ['info', t('gallery.pillInfo')],
          ].map(function (entry) {
            return h(
              KitPill,
              {
                key: entry[0],
                active: pillValue === entry[0],
                onClick: function () {
                  setPillValue(entry[0])
                },
              },
              entry[1],
            )
          }),
        ),
      ),
    ]
  }

  function navigationSection() {
    var tabItems = [
      { value: 'songs', label: t('gallery.tabSongs'), id: 'mp-gallery-tab-songs', panelId: 'mp-gallery-panel-songs' },
      { value: 'albums', label: t('gallery.tabAlbums'), id: 'mp-gallery-tab-albums', panelId: 'mp-gallery-panel-albums' },
      { value: 'artists', label: t('gallery.tabArtists'), id: 'mp-gallery-tab-artists', panelId: 'mp-gallery-panel-artists' },
    ]
    return [
      h(
        'div',
        { key: 'grid', className: 'mp-gallery-grid' },
        h(GalleryCase, { title: t('gallery.caseSegmented') },
          h(KitSegmented, {
            id: 'mp-gallery-segment',
            value: segmentValue,
            label: t('gallery.caseSegmented'),
            options: [
              { value: 'all', label: t('gallery.segAll') },
              { value: 'local', label: t('gallery.segLocal') },
              { value: 'online', label: t('gallery.segOnline') },
            ],
            onChange: setSegmentValue,
          }),
        ),
        h(GalleryCase, { title: t('gallery.caseSegmentedTabs') },
          h(KitSegmentedTabs, {
            items: tabItems,
            value: tabsValue,
            label: t('gallery.caseSegmentedTabs'),
            onChange: setTabsValue,
          }),
        ),
        h(GalleryCase, { title: t('gallery.caseTabsSm') },
          h(KitSegmentedTabs, {
            items: tabItems,
            value: tabsValue,
            size: 'sm',
            label: t('gallery.caseTabsSm'),
            onChange: setTabsValue,
          }),
        ),
        h(GalleryCase, { title: t('gallery.casePillsTab') },
          h(KitPill, { active: true, onClick: function () {} }, t('gallery.pillTabOne')),
          h(KitPill, { active: false, onClick: function () {} }, t('gallery.pillTabTwo')),
          h(KitPill, { active: false, onClick: function () {} }, t('gallery.pillTabThree')),
        ),
        h(GalleryCase, { title: t('gallery.caseTag') },
          h(KitTag, { tone: 'outline' }, t('gallery.tagOutline')),
          h(KitTag, { tone: 'neutral' }, t('gallery.tagNeutral')),
          h(KitTag, { tone: 'success' }, t('gallery.tagSuccess')),
          h(KitTag, { tone: 'warning' }, t('gallery.tagWarning')),
          h(KitTag, { tone: 'danger' }, t('gallery.tagDanger')),
          h(KitTag, { tone: 'info' }, t('gallery.tagInfo')),
        ),
      ),
      h(
        'div',
        { key: 'panel', className: 'mp-gallery-note', id: 'mp-gallery-panel-' + tabsValue, role: 'tabpanel', 'aria-labelledby': 'mp-gallery-tab-' + tabsValue },
        t('gallery.tabPanel') + ': ' + tabsValue,
      ),
    ]
  }

  function overlaysSection() {
    var menuItems = [
      { key: 'sort-latest', label: t('gallery.optLatest'), active: true, run: function () {} },
      { key: 'sort-title', label: t('gallery.optTitle'), run: function () {} },
      { key: 'sort-artist', label: t('gallery.optArtist'), run: function () {} },
      { key: 'separator', separator: true },
      { key: 'clear', label: t('gallery.menuClear'), danger: true, run: function () {} },
    ]
    return [
      h(
        'div',
        { key: 'grid', className: 'mp-gallery-grid' },
        h(GalleryCase, { title: t('gallery.caseMenu') }, h(HeadMenu, { icon: 'more', title: t('gallery.caseMenu'), items: menuItems })),
        h(GalleryCase, { title: t('gallery.caseTooltip') },
          h(IconButton, { icon: 'info', title: t('gallery.caseTooltip') }),
        ),
        h(GalleryCase, { title: t('gallery.caseModal') },
          h(Button, { onClick: function () { setModalOpen(true) } }, t('gallery.openModal')),
        ),
        h(GalleryCase, { title: t('gallery.caseToast') },
          h(Button, { onClick: function () { showToast(t('gallery.toastText')) } }, t('gallery.showToast')),
        ),
      ),
      modalOpen
        ? h(
            KitModal,
            {
              title: t('gallery.modalTitle'),
              onClose: function () { setModalOpen(false) },
              footer: [
                h(Button, { key: 'cancel', onClick: function () { setModalOpen(false) } }, t('gallery.cancel')),
                h(Button, { key: 'ok', variant: 'primary', onClick: function () { setModalOpen(false) } }, t('gallery.ok')),
              ],
            },
            h('p', { className: 'mp-set-desc' }, t('gallery.modalBody')),
          )
        : null,
    ]
  }

  function statesSection() {
    return [
      h(
        'div',
        { key: 'grid', className: 'mp-gallery-grid' },
        h(GalleryCase, { title: t('gallery.caseState') },
          h(KitStateDot, { state: 'done' }),
          h(KitStateDot, { state: 'warning' }),
          h(KitStateDot, { state: 'error' }),
          h(KitStateDot, { state: 'idle' }),
          h(KitStateDot, { state: 'ongoing' }),
        ),
        h(GalleryCase, { title: t('gallery.caseSpinner') }, h(Spinner), h('span', { className: 'mp-gallery-note' }, t('gallery.loading'))),
        h(GalleryCase, { title: t('gallery.caseSetRow'), wide: true },
          h(SetRow, { label: t('gallery.caseSetRow'), desc: t('gallery.caseSetRowDesc') }, h(Button, null, t('gallery.action'))),
        ),
      ),
      h('div', { key: 'empty', className: 'mp-gallery-section' }, h(Empty, { title: t('gallery.emptyTitle'), hint: t('gallery.emptyHint') })),
    ]
  }

  function sectionBody() {
    if (section === 'form') return formSection()
    if (section === 'navigation') return navigationSection()
    if (section === 'overlays') return overlaysSection()
    if (section === 'states') return statesSection()
    return buttonsSection()
  }

  return h(
    'div',
    { className: 'mp-gallery' },
    h(
      'div',
      { className: 'mp-gallery-head' },
      h(IconButton, { icon: 'chevronLeft', title: t('gallery.back'), onClick: props.onClose }),
      h('div', { className: 'mp-gallery-title' }, t('gallery.title')),
      h('span', { className: 'mp-gallery-hint' }, t('gallery.hostKit') + ': ' + (hostKit === 'native' ? t('gallery.native') : t('gallery.fallback'))),
    ),
    h(
      'div',
      { className: 'mp-gallery-body' },
      h(
        'div',
        { className: 'mp-gallery-nav', role: 'tablist', 'aria-label': t('gallery.title') },
        GALLERY_SECTIONS.map(function (entry) {
          return h(
            'button',
            {
              key: entry.key,
              type: 'button',
              role: 'tab',
              'aria-selected': section === entry.key ? 'true' : 'false',
              className: cx('mp-gallery-navbtn', section === entry.key && 'is-on'),
              onClick: function () {
                setSection(entry.key)
              },
            },
            t(entry.labelKey),
          )
        }),
      ),
      h('div', { className: 'mp-gallery-main', role: 'tabpanel' }, sectionBody()),
    ),
  )
}

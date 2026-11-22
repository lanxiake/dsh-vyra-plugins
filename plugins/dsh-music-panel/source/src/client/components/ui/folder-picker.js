/**
 * folder picker: read-only directory browser backed by GET /browse.
 *
 * Used from Settings → 音乐库 and from the folder view quick-add button.
 */

function FolderPickerDialog(props) {
  var statePair = useState({ phase: 'loading', path: '', parent: null, dirs: [], error: '' })
  var state = statePair[0]
  var setState = statePair[1]

  function load(target) {
    setState(function (previous) {
      return Object.assign({}, previous, { phase: 'loading', error: '' })
    })
    getJson(API + 'browse?path=' + encodeURIComponent(target))
      .then(function (body) {
        setState({
          phase: 'ready',
          path: body.path || '',
          parent: body.parent === undefined ? null : body.parent,
          dirs: Array.isArray(body.dirs) ? body.dirs : [],
          error: '',
        })
      })
      .catch(function (error) {
        setState(function (previous) {
          return Object.assign({}, previous, { phase: 'error', error: errorText(error) })
        })
      })
  }

  useEffect(function () {
    load('')
  }, [])

  function useHere() {
    if (state.path === '') return
    // 存储与备份 → 缓存目录 reuses this browser, but writes the cache directory instead
    // of adding a music root (Folia's 选择文件夹).
    var mode = props.layer && props.layer.props ? props.layer.props.mode : ''
    if (mode === 'cacheDir') {
      saveHostConfig({ cacheDir: state.path }).then(function (body) {
        if (!body) return
        showToast(t('data.cacheDirChanged'))
        popLayer()
      })
      return
    }
    var config = libraryStore.get().config || {}
    var roots = Array.isArray(config.roots) ? config.roots.slice() : []
    if (roots.indexOf(state.path) < 0) roots.push(state.path)
    var after = function (ok) {
      if (!ok) return
      showToast(t('v2.folderAdded'))
      popLayer()
    }
    saveConfig({ roots: roots }).then(after)
  }

  var list = null
  if (state.phase === 'loading') {
    list = h('div', { className: 'mp-folder-state' }, h(Spinner), h('span', null, t('v2.loading')))
  } else if (state.phase === 'error') {
    list = h('div', { className: 'mp-folder-state' }, state.error || t('page.loadFailed'))
  } else if (state.dirs.length === 0) {
    list = h('div', { className: 'mp-folder-state' }, t('v2.folderEmpty'))
  } else {
    list = h(
      'div',
      { className: 'mp-folder-list' },
      state.parent !== null && state.parent !== undefined
        ? h(
            'button',
            { type: 'button', className: 'mp-folder-row', onClick: function () { load(state.parent) } },
            icon('chevronLeft', 14),
            h('span', null, t('v2.folderUp')),
          )
        : null,
      state.dirs.map(function (dir) {
        return h(
          'button',
          {
            key: dir.path,
            type: 'button',
            className: 'mp-folder-row',
            onClick: function () {
              load(dir.path)
            },
          },
          icon('folder', 16),
          h('span', { className: 'mp-folder-row-name', title: dir.name }, dir.name),
        )
      }),
    )
  }

  return h(
    KitModal,
    {
      title: props.layer && props.layer.props && props.layer.props.mode === 'cacheDir'
        ? t('data.cacheDirPick')
        : t('v2.folderPick'),
      onClose: popLayer,
      footer: [
        h(Button, { key: 'cancel', variant: 'ghost', onClick: function () { popLayer() } }, t('page.cancel')),
        h(
          Button,
          {
            key: 'here',
            variant: 'primary',
            icon: 'check',
            disabled: state.path === '' || state.phase !== 'ready',
            onClick: useHere,
          },
          t('v2.folderHere'),
        ),
      ],
    },
    h(
      'div',
      { className: 'mp-folder-path', title: state.path },
      state.path === '' ? t('v2.folderPick') : state.path,
    ),
    list,
  )
}

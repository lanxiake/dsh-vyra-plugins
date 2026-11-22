/**
 * shared head menu: host Menu when available, local popover fallback.
 */

function HeadMenu(props) {
  var openPair = useState(false)
  var open = openPair[0]
  var setOpen = openPair[1]
  var ref = useRef(null)

  useEffect(
    function () {
      if (!open) return undefined
      if (props.hostMenu !== false && hostComponent('Menu') !== null) return undefined
      function onDown(event) {
        if (ref.current && ref.current.contains(event.target)) return
        setOpen(false)
      }
      function onKey(event) {
        if (event.key === 'Escape') setOpen(false)
      }
      document.addEventListener('pointerdown', onDown, true)
      window.addEventListener('keydown', onKey)
      return function () {
        document.removeEventListener('pointerdown', onDown, true)
        window.removeEventListener('keydown', onKey)
      }
    },
    [open],
  )

  var trigger = h(IconButton, {
    icon: props.icon,
    size: 17,
    title: props.title,
    active: open,
    onClick: function () {
      setOpen(!open)
    },
  })
  var HostMenu = props.hostMenu === false ? null : hostComponent('Menu')
  if (HostMenu !== null) {
    var hostItems = props.items.map(function (item) {
      if (item.separator) return { type: 'separator', id: item.key }
      return {
        id: item.key,
        label: item.label,
        icon: item.icon ? icon(item.icon, 13) : undefined,
        disabled: item.disabled === true,
        danger: item.danger === true,
      }
    })
    var selectedId
    props.items.forEach(function (item) {
      if (item.active === true && selectedId === undefined) selectedId = item.key
    })
    return h(HostMenu, {
      open: open,
      anchor: trigger,
      items: hostItems,
      selectedId: selectedId,
      onSelect: function (id) {
        setOpen(false)
        var chosen = null
        props.items.forEach(function (item) {
          if (chosen === null && item.key === id) chosen = item
        })
        if (chosen !== null && typeof chosen.run === 'function') chosen.run()
      },
      onClose: function () {
        setOpen(false)
      },
      side: 'bottom',
      align: 'end',
      portal: true,
      compact: true,
      className: 'mp-headmenu-host',
    })
  }

  return h(
    'div',
    { className: 'mp-headmenu', ref: ref },
    trigger,
    open
      ? h(
          'div',
          { className: 'mp-headmenu-pop', role: 'menu' },
          props.items.map(function (item) {
            if (item.separator) return h('hr', { key: item.key, className: 'mp-headmenu-sep' })
            return h(
              'button',
              {
                key: item.key,
                type: 'button',
                role: 'menuitem',
                className: cx('mp-headmenu-item', item.active === true && 'is-on'),
                onClick: function () {
                  setOpen(false)
                  if (typeof item.run === 'function') item.run()
                },
              },
              item.icon ? icon(item.icon, 13) : null,
              h('span', { className: 'mp-headmenu-label' }, item.label),
              item.hint ? h('span', { className: 'mp-headmenu-hint' }, item.hint) : null,
            )
          }),
        )
      : null,
  )
}

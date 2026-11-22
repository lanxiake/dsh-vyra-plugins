/**
 * primitives: the few shared UI atoms plus the player hooks.
 */

function usePlayerSnapshot() {
  var pair = useState(player.getSnapshot())
  useEffect(function () {
    return player.subscribe(function () {
      pair[1](player.getSnapshot())
    })
  }, [])
  return pair[0]
}

function usePlayerTime() {
  var pair = useState(player.getTime())
  useEffect(function () {
    return player.subscribeTime(function () {
      pair[1](player.getTime())
    })
  }, [])
  return pair[0]
}

function usePrefs() {
  return useStore(prefsStore)
}

/** Milliseconds left until `deadline`, ticking once a second while it is set. */
function useCountdown(deadline) {
  var pair = useState(Date.now())
  var now = pair[0]
  var setNow = pair[1]
  useEffect(
    function () {
      if (!deadline || deadline <= Date.now()) return undefined
      var timer = setInterval(function () {
        setNow(Date.now())
      }, 1000)
      return function () {
        clearInterval(timer)
      }
    },
    [deadline],
  )
  return Math.max(0, (Number(deadline) || 0) - now)
}

function IconButton(props) {
  var button = h(
    'button',
    {
      type: 'button',
      className: cx('mp-iconbtn', props.active === true && 'is-on', props.className),
      title: props.title,
      'aria-label': props.title || props.label || '',
      disabled: props.disabled === true,
      onClick: props.onClick,
      onContextMenu: props.onContextMenu,
    },
    icon(props.icon, props.size || 16),
  )
  var HostTooltip = hostComponent('Tooltip')
  if (props.tooltip !== false && HostTooltip !== null && typeof props.title === 'string' && props.title !== '') {
    return h(HostTooltip, { label: props.title, side: 'bottom', delayMs: 400 }, button)
  }
  return button
}

/**
 * Button: the host `Button` when available (variant/size/icon per the official
 * primitive), otherwise the same geometry as a local fallback.
 *
 * Geometry (A_other/docs/主题与组件开发规范.md §2.3): `sm` = H28 / R8,
 * `md` = H36 / R12. Variants: primary / ghost / outline (default) / toolbar.
 */
function Button(props) {
  var variant = props.variant === 'primary'
    ? 'primary'
    : props.variant === 'ghost'
      ? 'ghost'
      : props.variant === 'toolbar'
        ? 'toolbar'
        : 'outline'
  var size = props.size === 'md' ? 'md' : 'sm'
  var HostButton = hostComponent('Button')
  if (HostButton !== null) {
    return h(
      HostButton,
      {
        variant: variant,
        size: size,
        icon: props.icon ? icon(props.icon, 16) : undefined,
        className: props.className,
        disabled: props.disabled === true,
        onClick: props.onClick,
        title: props.title,
      },
      props.children,
    )
  }
  return h(
    'button',
    {
      type: 'button',
      className: cx(
        'mp-btn',
        'is-' + variant,
        size === 'md' && 'is-md',
        props.className,
      ),
      disabled: props.disabled === true,
      onClick: props.onClick,
      title: props.title,
    },
    props.icon ? icon(props.icon, 14) : null,
    props.children,
  )
}

function Cover(props) {
  var failedPair = useState(false)
  var failed = failedPair[0]
  var setFailed = failedPair[1]
  useEffect(
    function () {
      setFailed(false)
    },
    [props.src],
  )
  var source = failed ? '' : props.src || ''
  return h(
    'div',
    { className: props.className, style: props.style },
    source === ''
      ? icon(props.icon || 'note', props.iconSize || 15)
      : h('img', {
          src: source,
          alt: '',
          loading: 'lazy',
          draggable: false,
          onError: function () {
            setFailed(true)
          },
        }),
  )
}

function Spinner() {
  return h('span', { className: 'mp-spinner', 'aria-hidden': 'true' })
}

function Empty(props) {
  return h(
    'div',
    { className: 'mp-empty' },
    icon(props.icon || 'note', 26),
    h('strong', null, props.title),
    props.hint ? h('span', null, props.hint) : null,
  )
}

function SeekBar(props) {
  var time = usePlayerTime()
  var pair = useState(null)
  var seeking = pair[0]
  var setSeeking = pair[1]
  var duration = effectivePlayerDuration(time.duration, props.fallbackDuration)
  var position = seeking !== null ? seeking : Math.min(time.currentTime, duration || 0)
  var percent = duration > 0 ? clamp(position / duration, 0, 1) * 100 : 0
  var buffered = Math.min(duration, Math.max(0, Number(time.buffered) || 0))
  var bufferedPercent = duration > 0 ? clamp(buffered / duration, 0, 1) * 100 : 0

  function commit() {
    if (seeking === null) return
    if (duration > 0) player.seek(seeking)
    setSeeking(null)
  }

  function preview(event) {
    if (duration <= 0 || typeof props.onPreview !== 'function') return
    var rect = event.currentTarget.getBoundingClientRect()
    var ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    props.onPreview(ratio * duration)
  }

  return h(
    'div',
    {
      className: 'mp-seek',
      style: { '--mp-p': percent + '%', '--mp-b': bufferedPercent + '%' },
      onPointerMove: preview,
      onPointerLeave: function () {
        if (typeof props.onPreview === 'function') props.onPreview(null)
      },
    },
    h('span', { className: 'mp-seek-buffer', style: { width: bufferedPercent + '%' } }),
    h('input', {
      type: 'range',
      min: 0,
      max: duration > 0 ? duration : 1,
      step: 0.5,
      value: position,
      disabled: duration <= 0,
      style: { '--mp-p': percent + '%', '--mp-b': bufferedPercent + '%' },
      'aria-label': t('page.duration'),
      onChange: function (event) {
        setSeeking(Number(event.target.value))
      },
      onPointerUp: commit,
      onKeyUp: commit,
      onBlur: commit,
    }),
  )
}

function Switch(props) {
  var HostSwitch = hostComponent('Switch')
  if (HostSwitch !== null) {
    return h(HostSwitch, {
      checked: props.value === true,
      onChange: function (next) {
        if (typeof props.onChange === 'function') props.onChange(next === true)
      },
      label: props.label || '',
      title: props.title,
      disabled: props.disabled === true,
    })
  }
  return h(
    'button',
    {
      type: 'button',
      className: cx('mp-switch', props.value === true && 'is-on'),
      role: 'switch',
      'aria-checked': props.value === true,
      'aria-label': props.label || '',
      disabled: props.disabled === true,
      onClick: function () {
        if (props.disabled === true) return
        if (props.onChange) props.onChange(!props.value)
      },
    },
    h('i'),
  )
}

function KitPill(props) {
  var HostPill = hostComponent('Pill')
  var content = [
    props.icon ? icon(props.icon, 13) : null,
    h('span', { key: 'label' }, props.children),
  ]
  if (HostPill !== null) {
    return h(
      HostPill,
      {
        active: props.active === true,
        className: props.className,
        title: props.title,
        onClick: props.onClick,
      },
      content,
    )
  }
  return h(
    'button',
    {
      type: 'button',
      className: cx('mp-pill', props.active === true && 'is-on', props.className),
      title: props.title,
      onClick: props.onClick,
    },
    content,
  )
}

/**
 * Dialog shell: the host Modal when available (focus trap, Escape, portal,
 * native chrome), otherwise the same overlay markup the plugin used before.
 *
 * The fallback still owns Escape (主题与组件开发规范 §5.2): only the top-most
 * fallback dialog closes, so a dialog opened from inside another one does not
 * dismiss both at once.
 */
var MP_MODAL_STACK = []

function KitModal(props) {
  var HostModal = hostComponent('Modal')
  var closeRef = useRef(props.onClose)
  closeRef.current = props.onClose
  var tokenRef = useRef(null)
  if (tokenRef.current === null) tokenRef.current = { id: {} }
  useEffect(
    function () {
      if (HostModal !== null) return undefined
      var token = tokenRef.current
      MP_MODAL_STACK.push(token)
      function onKey(event) {
        if (event.key !== 'Escape') return
        if (MP_MODAL_STACK[MP_MODAL_STACK.length - 1] !== token) return
        event.stopPropagation()
        if (typeof closeRef.current === 'function') closeRef.current()
      }
      window.addEventListener('keydown', onKey)
      return function () {
        window.removeEventListener('keydown', onKey)
        var at = MP_MODAL_STACK.indexOf(token)
        if (at >= 0) MP_MODAL_STACK.splice(at, 1)
      }
    },
    [],
  )
  if (HostModal !== null) {
    if (props.headless === true) {
      return h(HostModal, {
        open: true,
        onClose: props.onClose,
        headless: true,
        className: cx('mp-kit-modal', 'mp-kit-modal-headless', props.className),
        children: props.children,
      })
    }
    return h(
      HostModal,
      {
        open: true,
        onClose: props.onClose,
        title: props.title || '',
        closeLabel: t('v2.close'),
        children: h('div', { className: 'mp-kit-body' }, props.children),
        footer: props.footer,
        className: cx('mp-kit-modal', props.small === true && 'is-sm', props.className),
        contentClassName: 'mp-kit-content',
      },
    )
  }
  if (props.headless === true) {
    return h(
      'div',
      { className: 'mp-overlay is-on' },
      h('div', { className: 'mp-scrim', onClick: props.onClose }),
      props.children,
    )
  }
  return h(
    'div',
    { className: 'mp-overlay is-on' },
    h('div', { className: 'mp-scrim', onClick: props.onClose }),
    h(
      'div',
      {
        className: cx('mp-dialog', props.small === true && 'is-sm', props.className),
        role: 'dialog',
        'aria-label': props.title || '',
      },
      h(
        'div',
        { className: 'mp-d-head' },
        h('div', { className: 'mp-d-title' }, props.title || ''),
        props.onClose
          ? h(IconButton, { icon: 'x', size: 15, title: t('v2.close'), onClick: props.onClose })
          : null,
      ),
      h('div', { className: 'mp-d-body' }, props.children),
      props.footer ? h('div', { className: 'mp-d-foot' }, props.footer) : null,
    ),
  )
}

function SetRow(props) {
  return h(
    'div',
    { className: 'mp-set-row' },
    h(
      'div',
      { className: 'mp-set-text' },
      h('div', { className: 'mp-set-label' }, props.label),
      props.desc ? h('div', { className: 'mp-set-desc' }, props.desc) : null,
    ),
    h('div', { className: 'mp-set-control' }, props.children),
  )
}

/**
 * The host-first family below: each control renders the official DSH primitive when the
 * host bundle exposes it, and an equivalent local fallback otherwise. Both paths must
 * share the same props and the same geometry (A_other/docs/主题与组件开发规范.md §1.2/§3.2).
 */

/** Single-line text input. `icon` is a local icon name; `onChange(value)`. */
/** A small text button shared by the settings sheet and the player sheet. */
function mpSmallButton(label, onClick, title) {
  return h(
    'button',
    {
      key: 'btn-' + String(label),
      type: 'button',
      onClick: onClick,
      title: title || undefined,
      'aria-label': title || undefined,
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

/** A segmented control; the player sheet has a local copy with its own motion timing. */
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
            transition: 'background-color .22s cubic-bezier(.22,1,.36,1), opacity .22s',
          },
        },
        option.label,
      )
    }),
  )
}

function KitInput(props) {
  var value = props.value === null || props.value === undefined ? '' : String(props.value)
  var label = props.label || props.placeholder || ''
  function change(event) {
    if (typeof props.onChange === 'function') props.onChange(event.target.value, event)
  }
  var HostInput = hostComponent('Input')
  if (HostInput !== null) {
    return h(
      HostInput,
      {
        value: value,
        type: props.type || 'text',
        placeholder: props.placeholder || '',
        icon: props.icon ? icon(props.icon, 16) : undefined,
        disabled: props.disabled === true,
        readOnly: props.readOnly === true,
        'aria-label': label,
        onChange: change,
        onKeyDown: props.onKeyDown,
        onBlur: props.onBlur,
        className: props.className,
      },
    )
  }
  return h(
    'span',
    { className: cx('mp-kit-input-wrap', props.className) },
    props.icon ? icon(props.icon, 15) : null,
    h('input', {
      className: 'mp-kit-input',
      type: props.type || 'text',
      value: value,
      placeholder: props.placeholder || '',
      disabled: props.disabled === true,
      readOnly: props.readOnly === true,
      'aria-label': label,
      onChange: change,
      onKeyDown: props.onKeyDown,
      onBlur: props.onBlur,
    }),
  )
}

/** Labeled checkbox. `onChange(next)`. */
function KitCheckbox(props) {
  var HostCheckbox = hostComponent('Checkbox')
  if (HostCheckbox !== null) {
    return h(HostCheckbox, {
      checked: props.checked === true,
      onChange: function (next) {
        if (typeof props.onChange === 'function') props.onChange(next === true)
      },
      label: props.label || '',
      disabled: props.disabled === true,
      title: props.title,
      className: props.className,
    })
  }
  return h(
    'label',
    { className: cx('mp-check', props.disabled === true && 'is-disabled', props.className), title: props.title },
    h('input', {
      type: 'checkbox',
      checked: props.checked === true,
      disabled: props.disabled === true,
      onChange: function (event) {
        if (typeof props.onChange === 'function') props.onChange(event.target.checked)
      },
    }),
    h('span', null, props.label || ''),
  )
}

/** Mutually exclusive segments. `options` = [{ value, label }]; `onChange(value)`. */
function KitSegmented(props) {
  var options = Array.isArray(props.options) ? props.options : []
  var value = String(props.value === undefined ? '' : props.value)
  var label = props.label || ''
  var id = props.id || 'mp-segment'
  var HostSegmented = hostComponent('SegmentedControl')
  if (HostSegmented !== null) {
    return h(HostSegmented, {
      id: id,
      value: value,
      options: options.map(function (option) {
        return { value: String(option.value), label: option.label, disabled: option.disabled === true }
      }),
      onChange: function (next) {
        if (typeof props.onChange === 'function') props.onChange(next)
      },
      label: label,
      disabled: props.disabled === true,
      className: props.className,
    })
  }
  return h(
    'div',
    { className: cx('mp-segment', props.className), role: 'tablist', 'aria-label': label },
    options.map(function (option) {
      var on = String(option.value) === value
      return h(
        'button',
        {
          key: String(option.value),
          type: 'button',
          role: 'tab',
          'aria-selected': on ? 'true' : 'false',
          className: cx('mp-segment-tab', on && 'is-on'),
          disabled: props.disabled === true || option.disabled === true,
          onClick: function () {
            if (!on && typeof props.onChange === 'function') props.onChange(String(option.value))
          },
        },
        option.label,
      )
    }),
  )
}

/** Controlled tab list. `items` = [{ value, label, id, panelId }]; panels are caller-owned. */
function KitSegmentedTabs(props) {
  var items = Array.isArray(props.items) ? props.items : []
  var value = String(props.value === undefined ? '' : props.value)
  var size = props.size === 'sm' ? 'sm' : 'md'
  var HostTabs = hostComponent('SegmentedTabs')
  if (HostTabs !== null) {
    return h(HostTabs, {
      items: items,
      value: value,
      onChange: function (next) {
        if (typeof props.onChange === 'function') props.onChange(next)
      },
      label: props.label || '',
      size: size,
      className: props.className,
    })
  }
  return h(
    'div',
    {
      className: cx('mp-segment', 'mp-segment-tabs', size === 'sm' && 'is-sm', props.className),
      role: 'tablist',
      'aria-label': props.label || '',
    },
    items.map(function (item) {
      var on = String(item.value) === value
      return h(
        'button',
        {
          key: String(item.value),
          id: item.id,
          type: 'button',
          role: 'tab',
          'aria-selected': on ? 'true' : 'false',
          'aria-controls': item.panelId,
          tabIndex: on ? 0 : -1,
          className: cx('mp-segment-tab', on && 'is-on'),
          onClick: function () {
            if (typeof props.onChange === 'function') props.onChange(String(item.value))
          },
        },
        item.label,
      )
    }),
  )
}

/** Read-only badge. `tone` = outline | neutral | brand | success | warning | error | info | accent. */
function KitTag(props) {
  var tone = props.tone || 'outline'
  var HostTag = hostComponent('Tag')
  if (HostTag !== null) {
    return h(HostTag, { tone: tone, className: props.className }, props.children)
  }
  return h('span', { className: cx('mp-tag', props.className), 'data-tone': tone }, props.children)
}

/** 10px status dot. `state` = done | warning | error | idle | ongoing. */
function KitStateDot(props) {
  var state = props.state || 'idle'
  var HostDot = hostComponent('StateDot')
  if (HostDot !== null) return h(HostDot, { state: state })
  return h('span', { className: cx('mp-state-dot', 'is-' + state), 'aria-hidden': 'true' })
}

/**
 * Dropdown select. DSH has no Select primitive: the official pattern is an anchored
 * `Menu`, so the trigger is a field and the list is the host menu (`Menu`).
 */
function KitSelect(props) {
  var pair = useState(false)
  var open = pair[0]
  var setOpen = pair[1]
  var options = Array.isArray(props.options) ? props.options : []
  var value = String(props.value === undefined ? '' : props.value)
  var current = null
  for (var index = 0; index < options.length; index += 1) {
    if (String(options[index].value) === value) current = options[index]
  }
  var ref = useRef(null)
  var HostMenu = hostComponent('Menu')

  useEffect(
    function () {
      if (!open) return undefined
      if (HostMenu !== null) return undefined
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

  var trigger = h(
    'button',
    {
      type: 'button',
      className: cx('mp-select', open && 'is-open'),
      'aria-label': props.label || '',
      'aria-haspopup': 'listbox',
      'aria-expanded': open ? 'true' : 'false',
      disabled: props.disabled === true,
      onClick: function () {
        setOpen(!open)
      },
    },
    h('span', { className: 'mp-select-label' }, current ? current.label : props.placeholder || ''),
    icon('chevronDown', 14),
  )

  if (HostMenu !== null) {
    var hostItems = options.map(function (option) {
      return {
        id: String(option.value),
        label: option.label,
        disabled: option.disabled === true,
      }
    })
    return h(HostMenu, {
      open: open,
      anchor: trigger,
      items: hostItems,
      selectedId: value,
      onSelect: function (id) {
        setOpen(false)
        if (typeof props.onChange === 'function') props.onChange(id)
      },
      onClose: function () {
        setOpen(false)
      },
      side: 'bottom',
      align: 'start',
      portal: true,
      compact: true,
    })
  }
  return h(
    'div',
    { className: 'mp-select-wrap', ref: ref },
    trigger,
    open
      ? h(
          'div',
          { className: 'mp-select-pop', role: 'listbox', 'aria-label': props.label || '' },
          options.map(function (option) {
            var on = String(option.value) === value
            return h(
              'button',
              {
                key: String(option.value),
                type: 'button',
                role: 'option',
                'aria-selected': on ? 'true' : 'false',
                className: cx('mp-select-item', on && 'is-on'),
                disabled: option.disabled === true,
                onClick: function () {
                  setOpen(false)
                  if (typeof props.onChange === 'function') props.onChange(String(option.value))
                },
              },
              h('span', null, option.label),
              on ? icon('check', 13) : null,
            )
          }),
        )
      : null,
  )
}

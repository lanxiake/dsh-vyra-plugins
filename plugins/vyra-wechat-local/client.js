// Client half — two settings pages.
//
// "回复策略" is the reply policy, laid out like the local-WeChat channel card in the
// Lumii client: the channel card summarises who may be answered, and its 配置 button
// opens the per-person policy dialog (direct reply / draft / notify / blacklist).
// "状态信息" is the environment card: sidecar state, check_env, repair, tool chips.
//
// Everything stays inside the factory: plugin client bundles are concatenated into
// classic scripts, which share one lexical scope, so a top-level `const` here would
// collide with any other plugin that picked the same name.
window.__ModuleLoader__.load({
  id: 'vyra-wechat-local',
  factory(require) {
    const RPC = '/api/wechat-local/rpc'
    const React = require('react')
    const { useCallback, useEffect, useMemo, useState } = React
    const h = React.createElement

    async function call(op, extra) {
      const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(extra === undefined ? { op } : { op, ...extra }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || '请求失败')
      return data.data
    }

    // ---------------------------------------------------------------------------
    // Policy vocabulary — mirrors lumen's channel policy and the sidecar's rules.json.
    // ---------------------------------------------------------------------------

    const MODE_OPTIONS = [
      { value: 'auto', label: '直接代回' },
      { value: 'draft', label: '起草给我确认' },
      { value: 'notify', label: '只提醒我' },
      { value: 'ignore', label: '不处理（黑名单）' },
    ]
    const MODE_LABELS = new Map(MODE_OPTIONS.map((option) => [option.value, option.label]))

    /** Why a message the watcher saw was not handed to the agent. */
    const SKIP_LABELS = new Map([
      ['from_me', '你自己发的'],
      ['trigger_miss', '触发条件不匹配'],
      ['not_whitelisted', '名单外'],
      ['blacklisted', '黑名单'],
      ['private_off', '关闭了私聊'],
      ['quiet_hours', '静默时段'],
      ['self_skip', '文件传输助手'],
      ['disabled', '回复策略未启用'],
      ['legacy_rules', '旧版规则'],
    ])

    /** 名单外的人只能「不处理」或「只提醒」：名单外的消息不叫模型。 */
    const DEFAULT_MODE_OPTIONS = MODE_OPTIONS.filter(
      (option) => option.value === 'ignore' || option.value === 'notify',
    )

    const TRIGGER_OPTIONS = [
      { value: 'all', label: '每条都回' },
      { value: 'mention', label: '只回 @我的' },
      { value: 'keyword', label: '命中关键字才回' },
      { value: 'mention_or_keyword', label: '@我 或 命中关键字' },
    ]
    const PRIVATE_TRIGGER_OPTIONS = TRIGGER_OPTIONS.filter(
      (option) => option.value !== 'mention' && option.value !== 'mention_or_keyword',
    )
    const KEYWORD_TRIGGERS = ['keyword', 'mention_or_keyword']
    const GROUP_ONLY_TRIGGERS = ['mention', 'mention_or_keyword']
    const VISIBLE_LIMIT = 100

    const splitKeywords = (value) =>
      String(value ?? '')
        .split(/[,，、\s]+/)
        .map((word) => word.trim())
        .filter(Boolean)

    const isGroupId = (id) => String(id ?? '').trim().toLowerCase().endsWith('@chatroom')
    const nameOf = (row) => String(row.label ?? '').trim() || row.id

    const emptyDraft = (defaultMode = 'notify') => ({ defaultMode, rows: [] })

    const toDraftRows = (peers) =>
      (Array.isArray(peers) ? peers : []).map((peer) => ({
        id: String(peer.id ?? ''),
        label: String(peer.label ?? ''),
        mode: String(peer.mode ?? 'draft'),
        cooldownSeconds:
          peer.cooldown_seconds === null || peer.cooldown_seconds === undefined
            ? ''
            : String(peer.cooldown_seconds),
        trigger: String(peer.trigger ?? 'all'),
        keywords: (Array.isArray(peer.keywords) ? peer.keywords : []).join('，'),
      }))

    const toPeers = (rows) => {
      const out = []
      for (const row of rows) {
        if (!String(row.id).trim()) continue
        const cooldown = Number.parseInt(String(row.cooldownSeconds).trim(), 10)
        const keywords = splitKeywords(row.keywords)
        out.push({
          id: row.id.trim(),
          label: String(row.label ?? '').trim(),
          mode: row.mode,
          trigger: row.trigger,
          keywords: KEYWORD_TRIGGERS.includes(row.trigger) ? keywords : [],
          cooldownSeconds: Number.isFinite(cooldown) && cooldown >= 0 ? cooldown : null,
        })
      }
      return out
    }

    /** 账号键大小写不敏感（wxid 常混写）。 */
    const findDraftKey = (drafts, key) => {
      if (!key) return Object.hasOwn(drafts, '') ? '' : undefined
      if (Object.hasOwn(drafts, key)) return key
      return Object.keys(drafts).find((candidate) => candidate && candidate.toLowerCase() === key.toLowerCase())
    }

    // ---------------------------------------------------------------------------
    // Styles — DSH theme tokens, spacing from the Lumii channel card.
    // ---------------------------------------------------------------------------

    const S = {
      page: { padding: '8px 4px', maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '16px' },
      hint: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary, #666)' },
      card: {
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        border: '1px solid var(--dsw-alias-border-l1, #e5e5e5)',
        borderRadius: '12px',
        background: 'var(--dsw-alias-bg-layer-1, #fff)',
        overflow: 'hidden',
      },
      row: { display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', minWidth: 0, flexWrap: 'wrap' },
      icon: { display: 'inline-flex', flexShrink: 0 },
      text: { display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 },
      name: { fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: 'var(--dsw-alias-label-primary, #1a1a1a)' },
      descRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 },
      description: { fontSize: '12px', lineHeight: '16px', color: 'var(--dsw-alias-label-secondary, #666)', overflowWrap: 'anywhere' },
      capability: {
        flexShrink: 0,
        padding: '3px 8px',
        borderRadius: '999px',
        background: 'color-mix(in srgb, var(--dsw-alias-brand-primary, #4d9aff) 12%, transparent)',
        fontSize: '11px',
        lineHeight: '14px',
        color: 'var(--dsw-alias-brand-primary, #4d9aff)',
        whiteSpace: 'nowrap',
      },
      actions: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
      error: {
        padding: '10px 16px',
        borderTop: '1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary, #d1242f) 30%, transparent)',
        background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary, #d1242f) 12%, transparent)',
        color: 'var(--dsw-alias-state-error-primary, #d1242f)',
        fontSize: '12px',
        lineHeight: '18px',
        overflowWrap: 'anywhere',
      },
      meta: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px 32px',
        margin: 0,
        padding: '12px 16px',
        borderTop: '1px solid var(--dsw-alias-border-l1, #e5e5e5)',
        background: 'var(--dsw-alias-bg-layer-3, #fff)',
      },
      metaItem: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 },
      metaLabel: { fontSize: '11px', lineHeight: '14px', color: 'var(--dsw-alias-label-secondary, #666)', opacity: 0.7 },
      metaValue: { margin: 0, fontSize: '12px', fontWeight: 500, lineHeight: '16px', color: 'var(--dsw-alias-label-primary, #1a1a1a)', overflowWrap: 'anywhere' },
      children: { padding: '12px 16px 14px', display: 'flex', flexDirection: 'column', gap: '10px' },
      summary: { margin: 0, fontSize: '13px', lineHeight: '20px', color: 'var(--dsw-alias-label-secondary, #666)' },
      divider: { borderTop: '1px solid var(--dsw-alias-border-l1, #e5e5e5)', paddingTop: '10px' },
      envHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
      envTitle: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary, #666)' },
      envBody: { display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary, #666)', overflowWrap: 'anywhere' },
      note: { margin: 0, fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-state-warn-primary, #e8a33d)' },
      chipsLabel: { fontSize: '11px', lineHeight: '14px', color: 'var(--dsw-alias-label-secondary, #666)', opacity: 0.7 },
      chips: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
      chip: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 9px',
        borderRadius: '999px',
        border: '1px solid var(--dsw-alias-border-l1, #e5e5e5)',
        background: 'var(--dsw-alias-bg-layer-3, #fff)',
        fontSize: '12px',
        lineHeight: '16px',
        color: 'var(--dsw-alias-label-secondary, #666)',
      },
      chipDot: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--dsw-alias-state-success-primary, #2f9e44)', flexShrink: 0 },
      btn: {
        padding: '6px 12px',
        borderRadius: 'var(--dsw-radius-sm, 8px)',
        border: '1px solid var(--dsw-alias-border-l4, #d0d0d0)',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: '12px',
        lineHeight: '16px',
      },
      btnPrimary: {
        padding: '6px 12px',
        borderRadius: 'var(--dsw-radius-sm, 8px)',
        border: '1px solid var(--dsw-alias-brand-primary, #4d9aff)',
        background: 'var(--dsw-alias-brand-primary, #4d9aff)',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '12px',
        lineHeight: '16px',
      },
      btnQuiet: {
        padding: '6px 10px',
        borderRadius: 'var(--dsw-radius-sm, 8px)',
        border: '1px solid transparent',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary, #666)',
        cursor: 'pointer',
        fontSize: '12px',
        lineHeight: '16px',
      },
      input: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '6px 8px',
        borderRadius: 'var(--dsw-radius-sm, 8px)',
        border: '1px solid var(--dsw-alias-border-l4, #d0d0d0)',
        background: 'var(--dsw-alias-bg-layer-3, #fff)',
        color: 'var(--dsw-alias-label-primary, #1a1a1a)',
        fontSize: '13px',
      },
      label: { fontSize: '12px', lineHeight: '16px', color: 'var(--dsw-alias-label-secondary, #666)', marginBottom: '4px', display: 'block' },
      field: { display: 'flex', flexDirection: 'column', minWidth: 0 },
      overlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      },
      dialog: {
        width: 'min(720px, 100%)',
        maxHeight: '86vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '14px',
        border: '1px solid var(--dsw-alias-border-l1, #e5e5e5)',
        background: 'var(--dsw-alias-bg-layer-1, #fff)',
        color: 'var(--dsw-alias-label-primary, #1a1a1a)',
        overflow: 'hidden',
        boxShadow: '0 18px 60px rgba(0,0,0,.28)',
      },
      dialogHead: { display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '1px solid var(--dsw-alias-border-l1, #e5e5e5)' },
      dialogTitle: { fontSize: '15px', fontWeight: 600, flex: 1 },
      dialogBody: { padding: '14px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' },
      dialogFoot: { display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 16px', borderTop: '1px solid var(--dsw-alias-border-l1, #e5e5e5)' },
      tabs: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
      panel: { marginTop: '10px', border: '1px solid var(--dsw-alias-border-l1, #e5e5e5)', borderRadius: '10px', padding: '10px' },
      list: { marginTop: '10px', maxHeight: '46vh', overflowY: 'auto', paddingRight: '4px' },
      peerRow: { border: '1px solid var(--dsw-alias-border-l1, #e5e5e5)', borderRadius: '10px', padding: '10px 12px', marginTop: '8px' },
      peerHead: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
      peerName: { fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary, #1a1a1a)' },
      badge: { fontSize: '11px', padding: '1px 6px', borderRadius: '999px', border: '1px solid var(--dsw-alias-border-l1, #e5e5e5)', color: 'var(--dsw-alias-label-secondary, #666)' },
      mono: { fontFamily: 'monospace', fontSize: '11px', color: 'var(--dsw-alias-label-secondary, #666)' },
      rowInputs: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' },
      explanation: { padding: '8px 10px', borderRadius: '10px', background: 'var(--dsw-alias-bg-layer-3, #fff)', fontSize: '12px', lineHeight: '1.7', color: 'var(--dsw-alias-label-secondary, #666)' },
    }

    const TONES = {
      connected: 'var(--dsw-alias-state-success-primary, #2f9e44)',
      pending: 'var(--dsw-alias-state-warn-primary, #e8a33d)',
      idle: 'var(--dsw-alias-label-secondary, #666)',
      error: 'var(--dsw-alias-state-error-primary, #d1242f)',
    }

    function StatusPill({ tone, label }) {
      const color = TONES[tone]
      return h('span', {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
          padding: '5px 10px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 500,
          lineHeight: '16px',
          whiteSpace: 'nowrap',
          color,
          background: `color-mix(in srgb, ${color} 16%, transparent)`,
          boxShadow: tone === 'connected' ? `0 0 10px color-mix(in srgb, ${color} 18%, transparent)` : 'none',
        },
      },
        h('span', {
          style: {
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'currentColor',
            boxShadow: tone === 'connected' ? '0 0 6px currentColor' : 'none',
            flexShrink: 0,
          },
        }),
        label)
    }

    function WechatMark() {
      return h('svg', { width: 28, height: 28, viewBox: '0 0 64 64', 'aria-hidden': true },
        h('rect', { width: 64, height: 64, rx: 14, fill: '#07c160' }),
        h('path', { d: 'M18 20h28a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H32l-9 7v-7h-5a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4z', fill: '#fff' }),
        h('circle', { cx: 25, cy: 31, r: 2.6, fill: '#07c160' }),
        h('circle', { cx: 32, cy: 31, r: 2.6, fill: '#07c160' }),
        h('circle', { cx: 39, cy: 31, r: 2.6, fill: '#07c160' }))
    }

    /** Contact avatar from the Host's cached endpoint, with a letter fallback. */
    function Avatar({ account, talker, name, size = 28 }) {
      const [failed, setFailed] = useState(false)
      const letter = String(name || talker || '?').trim().slice(0, 1).toUpperCase()
      const src = `/api/wechat-local/avatar?account=${encodeURIComponent(account || '')}&talker=${encodeURIComponent(talker || '')}`
      return h('span', {
        title: name || talker,
        style: {
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          background: 'color-mix(in srgb, var(--dsw-alias-brand-primary, #4d9aff) 16%, transparent)',
          color: 'var(--dsw-alias-brand-primary, #4d9aff)',
          fontSize: Math.round(size * 0.42),
          fontWeight: 600,
          lineHeight: 1,
        },
      },
        // The letter shows while the image loads and stays if it fails.
        letter,
        failed || !talker
          ? null
          : h('img', {
            src,
            alt: '',
            width: size,
            height: size,
            style: { position: 'absolute', inset: 0, width: size, height: size, objectFit: 'cover', display: 'block' },
            onError: () => setFailed(true),
          }))
    }

    function TextInput(props) {
      return h('input', { ...props, style: { ...S.input, ...(props.style ?? {}) } })
    }

    function Select({ label, options, ...props }) {
      return h('label', { style: S.field },
        label === undefined ? null : h('span', { style: S.label }, label),
        h('select', { ...props, style: { ...S.input, colorScheme: 'inherit', ...(props.style ?? {}) } },
          options.map((option) => h('option', { key: option.value, value: option.value }, option.label))))
    }

    function Checkbox({ checked, onChange, label }) {
      return h('label', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: 'var(--dsw-alias-label-secondary, #666)' } },
        h('input', {
          type: 'checkbox',
          checked,
          'aria-label': label,
          onChange: (event) => onChange(event.target.checked),
        }),
        label)
    }

    function Button({ primary, quiet, ...props }) {
      const style = primary ? S.btnPrimary : quiet ? S.btnQuiet : S.btn
      return h('button', { type: 'button', ...props, style: { ...style, ...(props.style ?? {}) } })
    }

    function Modal({ open, title, onClose, footer, children }) {
      if (!open) return null
      return h('div', { style: S.overlay, role: 'presentation', onMouseDown: (event) => { if (event.target === event.currentTarget) onClose() } },
        h('div', { style: S.dialog, role: 'dialog', 'aria-modal': true, 'aria-label': title },
          h('div', { style: S.dialogHead },
            h('span', { style: S.dialogTitle }, title),
            h(Button, { quiet: true, onClick: onClose, 'aria-label': '关闭' }, '×')),
          h('div', { style: S.dialogBody }, children),
          footer === undefined ? null : h('div', { style: S.dialogFoot }, footer)))
    }

    // ---------------------------------------------------------------------------
    // Reply-policy dialog — the Lumii pcwechat PolicyModal, adapted to the sidecar's
    // per-account rules store. One tab per WeChat account, one row per peer.
    // ---------------------------------------------------------------------------

    function PolicyModal({ open, onClose, onSaved }) {
      const [accounts, setAccounts] = useState([])
      const [contactsByAccount, setContactsByAccount] = useState({})
      const [active, setActive] = useState('')
      const [drafts, setDrafts] = useState({})
      const [touched, setTouched] = useState(new Set())
      const [checked, setChecked] = useState(new Set())
      const [batchMode, setBatchMode] = useState('draft')
      const [pickerOpen, setPickerOpen] = useState(false)
      const [search, setSearch] = useState('')
      const [pickerChecked, setPickerChecked] = useState(new Set())
      const [loading, setLoading] = useState(false)
      const [saving, setSaving] = useState(false)
      const [error, setError] = useState('')

      const draftOf = (key) => {
        const found = findDraftKey(drafts, key)
        return (found !== undefined ? drafts[found] : undefined) ?? emptyDraft()
      }

      const loadContacts = useCallback(async (wxid) => {
        try {
          const res = await call('contacts', wxid ? { account: wxid } : {})
          if (res) setContactsByAccount((prev) => ({ ...prev, [wxid]: res }))
          return res
        } catch {
          return undefined
        }
      }, [])

      const applyPolicy = useCallback((wxid, policy) => {
        const rules = policy?.rules
        if (!rules) return undefined
        return {
          defaultMode: rules.default_mode === 'ignore' ? 'ignore' : 'notify',
          rows: toDraftRows(rules.peers),
        }
      }, [])

      useEffect(() => {
        if (!open) return undefined
        let cancelled = false
        setLoading(true)
        setError('')
        setPickerOpen(false)
        setPickerChecked(new Set())
        setChecked(new Set())
        void (async () => {
          try {
            const accountRes = await call('accounts')
            const list = (accountRes?.accounts ?? []).map((account) => ({
              wxid: account.wxid,
              running: Boolean(account.running),
            }))
            const targets = list.length > 0 ? list.map((account) => account.wxid) : ['']
            const policies = await Promise.all(
              targets.map((wxid) => call('policy', wxid ? { account: wxid } : {}).catch(() => undefined)),
            )
            if (cancelled) return
            const next = {}
            for (let index = 0; index < targets.length; index += 1) {
              next[targets[index]] = applyPolicy(targets[index], policies[index]) ?? emptyDraft()
            }
            setAccounts(list)
            setDrafts(next)
            setTouched(new Set())
            const first = list[0]?.wxid ?? ''
            setActive(first)
            if (first) void loadContacts(first)
          } catch (err) {
            if (!cancelled) setError(String(err?.message ?? err))
          } finally {
            if (!cancelled) setLoading(false)
          }
        })()
        return () => {
          cancelled = true
        }
      }, [open, applyPolicy, loadContacts])

      const current = draftOf(active)

      const mutateCurrent = useCallback((mutator) => {
        const key = active
        setDrafts((prev) => {
          const found = findDraftKey(prev, key)
          const seed = (found !== undefined ? prev[found] : undefined) ?? emptyDraft()
          const next = { ...prev }
          for (const candidate of Object.keys(next)) {
            if (candidate && candidate.toLowerCase() === key.toLowerCase() && candidate !== key) delete next[candidate]
          }
          next[key] = mutator(seed)
          return next
        })
        setTouched((prev) => {
          const keyName = key.toLowerCase()
          return prev.has(keyName) ? prev : new Set(prev).add(keyName)
        })
      }, [active])

      const setRows = useCallback((updater) => {
        mutateCurrent((draft) => ({ ...draft, rows: updater(draft.rows) }))
      }, [mutateCurrent])

      const switchAccount = (wxid) => {
        setActive(wxid)
        setChecked(new Set())
        setPickerOpen(false)
        setSearch('')
        setPickerChecked(new Set())
        if (Object.hasOwn(contactsByAccount, wxid)) return
        void loadContacts(wxid)
      }

      const resetAccount = () => {
        if (!active) return
        mutateCurrent(() => emptyDraft('notify'))
      }

      const accountName = (wxid) => {
        const self = contactsByAccount[wxid]?.self
        return self?.name && self.name.toLowerCase() !== wxid.toLowerCase() ? self.name : ''
      }

      const accountTabs = useMemo(() => {
        const out = [...accounts]
        const seen = new Set(accounts.map((account) => account.wxid.toLowerCase()))
        for (const key of Object.keys(drafts)) {
          if (!key || seen.has(key.toLowerCase())) continue
          out.push({ wxid: key, running: false })
          seen.add(key.toLowerCase())
        }
        return out
      }, [accounts, drafts])

      const candidates = (contactsByAccount[active]?.contacts ?? []).map((contact) => ({
        id: String(contact.talker),
        label: String(contact.name || contact.talker),
        isGroup: contact.kind === 'group',
      }))
      const inList = new Set(current.rows.map((row) => row.id.toLowerCase()))
      const selectable = candidates
        .filter((candidate) => !inList.has(candidate.id.toLowerCase()))
        .filter((candidate) => {
          const query = search.trim().toLowerCase()
          return query === '' || candidate.label.toLowerCase().includes(query) || candidate.id.toLowerCase().includes(query)
        })
      const visible = selectable.slice(0, VISIBLE_LIMIT)

      const openPicker = () => {
        setPickerOpen(true)
        setSearch('')
        setPickerChecked(new Set())
        if (!Object.hasOwn(contactsByAccount, active)) void loadContacts(active)
      }

      const addChecked = () => {
        // Resolve against the full candidate list, not the search-filtered one: the checked
        // set accumulates across searches, and the earlier picks may not be visible now.
        const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]))
        const resolved = [...pickerChecked].map((id) => byId.get(id)).filter(Boolean)
        if (resolved.length === 0) return
        setRows((prev) => prev.concat(resolved.map((candidate) => ({
          id: candidate.id,
          label: candidate.label,
          mode: 'draft',
          cooldownSeconds: '',
          trigger: candidate.isGroup ? 'mention' : 'all',
          keywords: '',
        }))))
        setPickerOpen(false)
        setPickerChecked(new Set())
      }

      const toggleChecked = (id, on) => {
        setChecked((prev) => {
          const next = new Set(prev)
          if (on) next.add(id)
          else next.delete(id)
          return next
        })
      }

      const applyBatchMode = () => {
        setRows((prev) => prev.map((row) => (checked.has(row.id) ? { ...row, mode: batchMode } : row)))
      }

      const removeChecked = () => {
        setRows((prev) => prev.filter((row) => !checked.has(row.id)))
        setChecked(new Set())
      }

      const save = async () => {
        setSaving(true)
        setError('')
        try {
          for (const key of touched) {
            const found = findDraftKey(drafts, key)
            const draft = (found !== undefined ? drafts[found] : undefined) ?? emptyDraft()
            // `touched` holds lower-cased keys; send the account exactly as the rules store
            // spelled it, or the sidecar would write a second directory for the same account.
            const account = found !== undefined ? found : key
            await call('policy.save', {
              ...(account ? { account } : {}),
              rules: { defaultMode: draft.defaultMode, peers: toPeers(draft.rows) },
            })
          }
          if (onSaved) onSaved()
          onClose()
        } catch (err) {
          setError(String(err?.message ?? err))
        } finally {
          setSaving(false)
        }
      }

      const footer = [
        h(Button, { key: 'cancel', quiet: true, onClick: onClose, disabled: saving }, '取消'),
        h(Button, { key: 'save', primary: true, onClick: () => void save(), disabled: loading || saving }, saving ? '保存中…' : '保存'),
      ]

      return h(Modal, { open, title: 'PC微信 · 回复策略', onClose, footer },
        error ? h('div', { style: { color: 'var(--dsw-alias-state-error-primary, #d1242f)', fontSize: '13px' } }, error) : null,

        h('div', null,
          h('div', { style: S.label }, '按账号配置'),
          h('div', { style: S.tabs },
            accountTabs.map((account) => h(Button, {
              key: account.wxid,
              primary: active.toLowerCase() === account.wxid.toLowerCase(),
              onClick: () => switchAccount(account.wxid),
              disabled: loading,
              title: '每个微信号独立配置名单与档位',
            }, h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
              h(Avatar, { account: account.wxid, talker: account.wxid, name: accountName(account.wxid) || account.wxid, size: 18 }),
              (() => {
                const name = accountName(account.wxid)
                return name ? `${name}（${account.wxid}）` : account.wxid
              })() + (account.running ? '' : ' · 离线')))),
            accountTabs.length === 0 && !loading
              ? h('span', { style: S.hint }, '没读到 PC 微信账号；确认微信已登录后再打开这个页面')
              : null)),

        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' } },
          h('div', { style: { flex: '1 1 200px', minWidth: 180 } },
            h(Select, {
              label: '名单外的人怎么处理',
              value: current.defaultMode,
              options: DEFAULT_MODE_OPTIONS,
              onChange: (event) => mutateCurrent((draft) => ({ ...draft, defaultMode: event.target.value })),
              disabled: loading,
              title: '名单外的人不叫模型；只能不处理或只提醒。',
            })),
          touched.has(active.toLowerCase())
            ? h(Button, {
              quiet: true,
              onClick: resetAccount,
              disabled: loading,
              title: '清空这个账号的名单与档位',
            }, '清空这个号的名单')
            : null),

        h('div', { style: S.divider },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
            h('span', {
              style: { fontSize: '13px', fontWeight: 600, color: 'var(--dsw-alias-label-primary, #1a1a1a)' },
              title: '只对当前账号生效；名单外的人不叫模型。',
            }, `谁可以被代回（${current.rows.length}）`),
            active ? h('span', { style: S.badge }, `当前：${accountName(active) || active}`) : null,
            h(Button, {
              onClick: openPicker,
              disabled: loading,
              title: '从微信通讯录挑人，勾选后加入名单',
            }, pickerOpen ? '收起' : '从微信里挑人')),
            current.rows.length > 0
              ? h(Button, {
                quiet: true,
                onClick: () => setChecked((prev) => (prev.size === current.rows.length ? new Set() : new Set(current.rows.map((row) => row.id)))),
                disabled: loading,
              }, checked.size === current.rows.length ? '取消全选' : `全选（${current.rows.length}）`)
              : null,

          pickerOpen
            ? h('div', { style: S.panel },
              h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
                h('div', { style: { flex: '1 1 220px', minWidth: 180 } },
                  h(TextInput, {
                    value: search,
                    onChange: (event) => setSearch(event.target.value),
                    placeholder: '搜名字或 wxid',
                  })),
                h(Button, {
                  quiet: true,
                  disabled: loading || visible.length === 0,
                  onClick: () => setPickerChecked((prev) => new Set([...prev, ...visible.map((candidate) => candidate.id)])),
                }, '全选'),
                h(Button, { quiet: true, onClick: () => setPickerChecked(new Set()), disabled: pickerChecked.size === 0 }, '清空勾选'),
                h(Button, { primary: true, onClick: addChecked, disabled: pickerChecked.size === 0 }, `加入名单（${pickerChecked.size}）`)),
              h('div', { style: { maxHeight: '240px', overflowY: 'auto', marginTop: '8px' } },
                loading ? h('div', { style: S.hint }, '正在读微信通讯录…') : null,
                !loading && selectable.length === 0
                  ? h('div', { style: S.hint }, search.trim() ? '没有匹配的人' : '没有可选的人（可能都已经在名单里了）')
                  : null,
                visible.map((candidate) => h('div', { key: candidate.id, style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' } },
                  h(Checkbox, {
                    checked: pickerChecked.has(candidate.id),
                    label: '',
                    onChange: (on) => setPickerChecked((prev) => {
                      const next = new Set(prev)
                      if (on) next.add(candidate.id)
                      else next.delete(candidate.id)
                      return next
                    }),
                  }),
                  h(Avatar, { account: active, talker: candidate.id, name: candidate.label, size: 24 }),
                  h('span', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-primary, #1a1a1a)' } }, candidate.label),
                  candidate.isGroup ? h('span', { style: S.badge }, '群') : null,
                  h('span', { style: S.mono }, candidate.id))))
              )
            : null,

          checked.size > 0
            ? h('div', { style: { ...S.panel, display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' } },
              h('span', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-secondary, #666)' } }, `已勾选 ${checked.size} 人：`),
              h('div', { style: { flex: '0 1 190px', minWidth: 160 } },
                h(Select, { value: batchMode, options: MODE_OPTIONS, onChange: (event) => setBatchMode(event.target.value) })),
              h(Button, { onClick: applyBatchMode }, '应用'),
              h(Button, { quiet: true, onClick: removeChecked }, '移出名单'))
            : null,

          h('div', { style: S.list },
            current.rows.length === 0
              ? h('div', { style: S.hint }, '名单为空。点「从微信里挑人」加入允许代回的好友。')
              : current.rows.map((row) => {
                const patch = (next) => setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, ...next } : item)))
                const group = isGroupId(row.id)
                const needsKeywords = KEYWORD_TRIGGERS.includes(row.trigger)
                return h('div', { key: row.id, style: { ...S.peerRow, background: checked.has(row.id) ? 'var(--dsw-alias-bg-layer-3, #fff)' : undefined } },
                  h('div', { style: S.peerHead },
                    h(Checkbox, { label: '', checked: checked.has(row.id), onChange: (on) => toggleChecked(row.id, on) }),
                    h(Avatar, { account: active, talker: row.id, name: nameOf(row), size: 28 }),
                    h('span', { style: S.peerName }, nameOf(row)),
                    h('span', { style: S.badge }, group ? '群' : '私聊'),
                    h('span', { style: { ...S.mono, marginLeft: 'auto' } }, row.id)),
                  h('div', { style: S.rowInputs },
                    h('div', { style: { flex: '1 1 170px', minWidth: 150 } },
                      h(Select, {
                        label: '怎么处理',
                        value: row.mode,
                        options: MODE_OPTIONS,
                        onChange: (event) => patch({ mode: event.target.value }),
                        title: '直接代回 / 起草确认 / 只提醒 / 黑名单',
                      })),
                    h('div', { style: { flex: '0 1 120px', minWidth: 108 } },
                      h('span', { style: S.label }, '冷却（秒）'),
                      h(TextInput, {
                        'aria-label': `${nameOf(row)} 的冷却秒数`,
                        title: '同一人两次自动动作的最小间隔；留空按 60 秒。',
                        value: row.cooldownSeconds,
                        placeholder: '60',
                        onChange: (event) => patch({ cooldownSeconds: event.target.value }),
                      })),
                    h('div', { style: { flex: '1 1 170px', minWidth: 150 } },
                      h(Select, {
                        label: '什么消息才惊动助手',
                        value: row.trigger,
                        options: group ? TRIGGER_OPTIONS : PRIVATE_TRIGGER_OPTIONS,
                        onChange: (event) => patch({ trigger: event.target.value }),
                        title: '不满足条件的消息不叫模型。',
                      })),
                    needsKeywords
                      ? h('div', { style: { flex: '1 1 100%' } },
                        h('span', { style: S.label }, '关键字（出现任一个才回，逗号分隔）'),
                        h(TextInput, {
                          'aria-label': `${nameOf(row)} 的关键字`,
                          value: row.keywords,
                          placeholder: '报错，上线，帮我看下',
                          onChange: (event) => patch({ keywords: event.target.value }),
                        }))
                      : null)
                )
              })),

        ))
    }

    // ---------------------------------------------------------------------------
    // Main settings page — the channel card plus the policy dialog.
    // ---------------------------------------------------------------------------

    function policySummary(policy) {
      const rules = policy?.rules ?? {}
      const peers = Array.isArray(rules.peers) ? rules.peers : []
      const sendable = peers.filter((peer) => peer.mode !== 'ignore')
      const defaultMode = rules.default_mode === 'ignore' ? 'ignore' : 'notify'
      return {
        sendable,
        defaultMode,
        summary:
          sendable.length === 0
            ? '还没配人：助手不会替任何人回消息'
            : sendable
              .slice(0, 4)
              .map((peer) => `${peer.label || peer.id}·${MODE_LABELS.get(peer.mode) ?? peer.mode}`)
              .join('，') + (sendable.length > 4 ? ` 等 ${sendable.length} 人` : ''),
      }
    }

    function PolicyView() {
      const [status, setStatus] = useState(null)
      const [env, setEnv] = useState(null)
      const [accounts, setAccounts] = useState(null)
      const [policy, setPolicy] = useState(null)
      const [open, setOpen] = useState(false)
      const [error, setError] = useState('')

      const load = useCallback(async () => {
        setError('')
        try {
          const nextStatus = await call('status')
          setStatus(nextStatus)
          const [nextEnv, accountRes] = await Promise.all([
            call('diagnose').then((answer) => answer.env).catch(() => undefined),
            call('accounts').catch(() => undefined),
          ])
          setEnv(nextEnv)
          setAccounts(accountRes)
          const wxid = nextEnv?.active_account || accountRes?.active || accountRes?.accounts?.[0]?.wxid || ''
          const nextPolicy = await call('policy', wxid ? { account: wxid } : {}).catch(() => undefined)
          setPolicy(nextPolicy)
        } catch (err) {
          setError(String(err?.message ?? err))
        }
      }, [])

      useEffect(() => {
        void load()
        const timer = setInterval(() => void call('status').then(setStatus).catch(() => undefined), 5000)
        return () => clearInterval(timer)
      }, [load])

      const watch = status?.watch
      const notifications = watch?.notifications ?? []
      const skips = watch?.skips ?? []
      const watchAction = async (op) => {
        try {
          const next = await call(op)
          setStatus((current) => (current ? { ...current, watch: next } : current))
        } catch (err) {
          setError(String(err?.message ?? err))
        }
      }

      const state = status?.state ?? 'idle'
      const ready = state === 'ready'
      // A hidden/tray window is still a live connection: the sender wakes it on
      // demand, so only the process and the data directory decide "connected".
      const connected = ready && env?.weixin_running === true && env?.db_ok === true
      const tone = connected ? 'connected' : state === 'failed' ? 'error' : state === 'starting' ? 'pending' : 'idle'
      const label = connected ? '已连接' : state === 'starting' ? '启动中' : state === 'failed' ? '未就绪' : ready ? '未就绪' : '未启动'
      const accountCount = accounts?.accounts?.length ?? 0
      const detail = policySummary(policy)

      return h(React.Fragment, null,
        h('section', { style: S.card },
          h('div', { style: S.row },
            h('span', { style: S.icon }, h(WechatMark)),
            h('div', { style: S.text },
              h('div', {
                style: S.name,
                title: '以你本人身份，跟这台电脑上登录的微信好友说话。',
              }, 'PC微信'),
              h('div', { style: S.descRow },
                h('span', { style: S.capability }, '只对名单里的人'))),
            h(StatusPill, { tone, label }),
            h('div', { style: S.actions },
              h(Button, {
                onClick: () => setOpen(true),
                title: '按人设置：直接代回 / 起草确认 / 只提醒 / 黑名单',
              }, '配置'))),

          error
            ? h('div', { style: S.error }, error)
            : null,

          h('dl', { style: S.meta },
            h('div', { style: S.metaItem },
              h('dt', { style: S.metaLabel }, '助手'),
              h('dd', {
                style: S.metaValue,
                title: '本地 Python 侧车版本；「状态信息」里有依赖与自检。',
              }, status?.version ? `v${status.version}` : '侧车')),
            h('div', { style: S.metaItem },
              h('dt', { style: S.metaLabel }, '在线'),
              h('dd', {
                style: S.metaValue,
                title: watch?.lastError || env?.reason || status?.error || '',
              }, connected ? '已就绪' : '未就绪')),
            h('div', { style: S.metaItem },
              h('dt', { style: S.metaLabel }, '可代回'),
              h('dd', {
                style: S.metaValue,
                title: detail.summary,
              },
                (detail.sendable.length === 0 ? '还没有人' : `${detail.sendable.length} 人`)
                + (accountCount > 1 ? ` · ${accountCount} 个号` : ''))),
            h('div', { style: S.metaItem },
              h('dt', { style: S.metaLabel }, '名单外'),
              h('dd', {
                style: S.metaValue,
                title: '名单外的人不叫模型；只能「不处理」或「只提醒」。',
              }, MODE_LABELS.get(detail.defaultMode) ?? detail.defaultMode)),
            h('div', { style: S.metaItem },
              h('dt', { style: S.metaLabel }, '监听'),
              h('dd', {
                style: S.metaValue,
                title: `每 ${watch?.pollSeconds ?? 2}s 检查；合并窗口 ${watch?.mergeWindowSeconds ?? 20}s；回复后按名单冷却。`,
              },
                watch === undefined
                  ? '未启动'
                  : watch.enabled === false ? '已关闭' : watch.running ? '运行中' : '已暂停'))),

          h('div', { style: S.children },
            h('div', { style: S.divider },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
                h('span', {
                  style: S.chipsLabel,
                  title: `合并窗口 ${watch?.mergeWindowSeconds ?? 20}s；同一个人再来消息会重新计时；回复后按名单冷却。`,
                }, watch?.enabled === false ? '实时监听已关闭' : watch?.running ? '实时监听中' : '实时监听已暂停'),
                h('span', { style: { display: 'flex', gap: '6px' } },
                  h(Button, {
                    quiet: true,
                    onClick: () => void watchAction('watch.tick'),
                    title: '立即执行一次检查和交付',
                  }, '立即检查'),
                  h(Button, {
                    onClick: () => void watchAction(watch?.running ? 'watch.stop' : 'watch.start'),
                    disabled: watch?.enabled === false,
                    title: '暂停/继续轮询新消息',
                  }, watch?.enabled === false ? '监听已关闭' : watch?.running ? '暂停监听' : '开始监听'))),
              watch?.lastError
                ? h('p', {
                  style: { ...S.note, color: 'var(--dsw-alias-state-error-primary, #d1242f)' },
                }, watch.lastError)
                : null,
              watch?.pending?.length
                ? h('div', { style: S.hint, title: '每条会话独立合并；冷却结束后整批交付给 Agent。' },
                  watch.pending.map((peer) => {
                    const talker = peer.key.split('|')[1]
                    const now = Date.now()
                    const cooling = Number(peer.cooldownUntil) > now
                    const waiting = Number(peer.awaitingUntil) > now
                    const timing = cooling
                      ? `冷却中 ${Math.max(1, Math.ceil((peer.cooldownUntil - now) / 1000))}s`
                      : waiting ? '等回复' : '合并中'
                    return `${talker} · ${peer.count} 条 · ${timing}`
                  }).join('，'))
                : null,
              watch?.lastDelivery
                ? h('div', {
                  style: { ...S.chipsLabel, cursor: 'default' },
                  title: `会话 ${watch.lastDelivery.sessionId}`,
                }, `最近交付：${watch.lastDelivery.name} · ${watch.lastDelivery.count} 条 · ${new Date(watch.lastDelivery.at).toLocaleTimeString()}`)
                : null,
              notifications.length > 0
                ? h('details', { style: S.chipsLabel },
                  h('summary', null, `最近提醒 · ${notifications.length}`),
                  notifications.slice(0, 8).map((item, index) => h('div', {
                    key: index,
                    style: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary, #666)', overflowWrap: 'anywhere', marginTop: '3px' },
                  }, `${item.name} · ${new Date(item.ts * 1000).toLocaleTimeString()} · ${item.text}`)))
                : null,
              skips.length > 0
                ? h('details', { style: S.chipsLabel, title: '监听看到了这些消息，但按回复策略没有交给 Agent。' },
                  h('summary', null, `最近跳过 · ${skips.length}`),
                  skips.slice(0, 8).map((item, index) => h('div', {
                    key: index,
                    style: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary, #666)', overflowWrap: 'anywhere', marginTop: '3px' },
                  }, `${item.name} · ${new Date(item.ts * 1000).toLocaleTimeString()} · ${item.text || '(无文字)'}（${SKIP_LABELS.get(item.reason) || item.reason}）`)))
                : null))),

        h(PolicyModal, {
          open,
          onClose: () => setOpen(false),
          onSaved: () => void load(),
        }))
    }

    // ---------------------------------------------------------------------------
    // Status settings page — sidecar state, environment self-check, tool chips.
    // ---------------------------------------------------------------------------

    const DB_SOURCE_LABELS = {
      env: '环境变量',
      ini: '微信设置',
      registry: '注册表',
      default: '默认路径',
      scan: '磁盘扫描',
    }

    function environmentLines(env, state) {
      if (!env) return { lines: ['环境自检：检测中…'], actions: [], versionHint: '' }
      const db = env.db_ok
        ? `数据目录：${env.db_root}（来源：${DB_SOURCE_LABELS[env.db_source] || env.db_source || '自动探测'}）`
        : '数据目录：未找到（确认微信已登录；换机后在微信「设置 → 文件管理」核对路径）'
      const wechat = !env.weixin_running
        ? '微信：未运行（打开并登录微信后重新检测）'
        : env.ok
          ? '微信：就绪'
          : `微信：已登录 · ${env.reason || '窗口不在前台'}`
      const missing = env.deps && !env.deps.ok
        ? ['pycryptodome', 'zstandard'].filter((name) => env.deps[name] === false)
        : []
      const deps = env.deps?.ok
        ? '依赖：pycryptodome / zstandard 就绪'
        : `依赖：缺少 ${missing.length > 0 ? missing.join('、') : 'pycryptodome'}`
      const version = env.wechat_version?.version
        ? `微信版本：${env.wechat_version.version}${env.wechat_version.verified ? '' : '（未验证）'}`
        : ''
      const account = env.active_account
        ? `账号：${env.active_account}${(env.accounts?.length ?? 0) > 1 ? `（共 ${env.accounts.length} 个）` : ''}`
        : ''
      const voice = env.asr
        ? env.asr.ready ? '语音转写：就绪' : `语音转写：${env.asr.hint || '未就绪'}`
        : ''
      const actions = []
      if (!env.weixin_running) actions.push('打开并登录微信')
      if (env.weixin_running && !env.db_ok) actions.push('确认微信数据目录')
      if (missing.length > 0) actions.push(`安装依赖：${missing.join('、')}`)
      if (state !== 'ready') actions.push('侧车未就绪：重启侧车')
      return {
        lines: [db, wechat, deps, voice, version, account].filter(Boolean),
        actions,
        versionHint: env.wechat_version?.hint || '',
      }
    }

    function StatusView() {
      const [status, setStatus] = useState(null)
      const [env, setEnv] = useState(null)
      const [error, setError] = useState('')
      const [busy, setBusy] = useState('')

      const refreshStatus = useCallback(async () => {
        try {
          setStatus(await call('status'))
          setError('')
        } catch (err) {
          setError(String(err?.message ?? err))
        }
      }, [])

      const diagnose = useCallback(async () => {
        setBusy('check')
        setError('')
        try {
          const next = await call('diagnose')
          setStatus(next.status)
          setEnv(next.env)
        } catch (err) {
          setError(String(err?.message ?? err))
        } finally {
          setBusy('')
        }
      }, [])

      useEffect(() => {
        void diagnose()
        const timer = setInterval(refreshStatus, 5000)
        return () => clearInterval(timer)
      }, [diagnose, refreshStatus])

      const run = async (op, tag) => {
        setBusy(tag)
        setError('')
        try {
          const next = await call(op)
          setStatus(op === 'repair' || op === 'diagnose' ? next.status : next)
          if (op === 'repair' || op === 'diagnose') setEnv(next.env)
          if (op === 'restart') {
            setEnv(null)
            void diagnose()
          }
        } catch (err) {
          setError(String(err?.message ?? err))
        } finally {
          setBusy('')
        }
      }

      const state = status?.state ?? 'idle'
      const runtime = status?.runtime
      const ready = state === 'ready'
      // A hidden/tray window is still a live connection: the sender wakes it on
      // demand, so only the process and the data directory decide "connected".
      const connected = ready && env?.weixin_running === true && env?.db_ok === true
      const tone = connected ? 'connected' : state === 'failed' ? 'error' : state === 'starting' ? 'pending' : 'idle'
      const label = connected ? '已连接' : state === 'starting' ? '启动中' : state === 'failed' ? '未就绪' : ready ? '未就绪' : '未启动'
      const environment = environmentLines(env, state)
      const registered = status?.registered ?? []
      const available = status?.tools?.length ?? 0
      // Sidecar status carries {name, description}; older hosts may still send names.
      const toolNotes = new Map((status?.tools ?? []).map((tool) => (
        typeof tool === 'string' ? [tool, ''] : [tool?.name ?? '', tool?.description || '']
      )))

      return h('section', { style: S.card },
          h('div', { style: S.row },
            h('span', { style: S.icon }, h(WechatMark)),
            h('div', { style: S.text },
              h('div', { style: S.name }, '状态信息'),
              h('div', { style: S.descRow },
                h('span', { style: S.description }, '侧车与环境自检'),
                h('span', { style: S.capability }, '读取 · 发送 · 导出'))),
            h(StatusPill, { tone, label }),
            h('div', { style: S.actions },
              h(Button, { onClick: () => void run('restart', 'restart'), disabled: busy !== '' },
                busy === 'restart' ? '重启中…' : '重启侧车'))),

          error || status?.error
            ? h('div', { style: S.error }, error || status.error)
            : null,

          h('dl', { style: S.meta },
            h('div', { style: S.metaItem },
              h('dt', { style: S.metaLabel }, '助手'),
              h('dd', { style: S.metaValue }, status?.version ? `PC微信侧车 v${status.version}` : 'PC微信侧车')),
            h('div', { style: S.metaItem },
              h('dt', { style: S.metaLabel }, '在线'),
              h('dd', { style: S.metaValue }, connected
                ? env?.ok === true ? 'PC微信已就绪' : '已连接 · 窗口未显示（发送时自动唤醒）'
                : env?.reason || status?.error || '检测中…')),
            h('div', { style: S.metaItem },
              h('dt', { style: S.metaLabel }, '工具'),
              h('dd', { style: S.metaValue }, `${registered.length} 个已注册 · ${available} 个可用`)),
            h('div', { style: S.metaItem },
              h('dt', { style: S.metaLabel }, '运行方式'),
              h('dd', { style: S.metaValue },
                runtime?.error ? '未找到解释器' : runtime?.source === 'uv' ? 'uv（依赖自动获取）' : '自定义 Python'))),

          h('div', { style: S.children },
            h('div', { style: S.divider },
              h('div', { style: S.envHead },
                h('span', { style: S.envTitle }, '环境自检'),
                h('span', { style: { display: 'flex', gap: '6px' } },
                  h(Button, { quiet: true, onClick: () => void run('diagnose', 'check'), disabled: busy !== '' },
                    busy === 'check' ? '检测中…' : '重新检测'),
                  h(Button, { onClick: () => void run('repair', 'repair'), disabled: busy !== '' },
                    busy === 'repair' ? '修复中…' : '一键修复'))),
              h('div', { style: S.envBody },
                environment.lines.map((line, index) => h('div', { key: index }, line)),
                environment.actions.length > 0
                  ? h('div', { style: { opacity: 0.75 } }, environment.actions.join('；'))
                  : null),
              environment.versionHint
                ? h('p', { style: S.note }, environment.versionHint)
                : null),

            h('div', { style: S.divider },
              h('div', { style: S.chipsLabel }, `已注册工具 · ${registered.length}`),
              registered.length === 0
                ? h('div', { style: S.chipsLabel }, '侧车未就绪，暂时没有工具')
                : h('div', { style: S.chips },
                  registered.map((tool) => h('span', {
                    key: tool,
                    style: S.chip,
                    title: toolNotes.get(tool) || '无描述',
                  },
                    h('span', { style: S.chipDot }),
                    tool)))),

            status?.stderrTail?.length
              ? h('details', { style: S.chipsLabel },
                h('summary', null, '侧车最近输出'),
                h('pre', {
                  style: {
                    margin: '6px 0 0',
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'var(--dsw-alias-bg-layer-3, #fff)',
                    border: '1px solid var(--dsw-alias-border-l1, #e5e5e5)',
                    fontSize: '12px',
                    lineHeight: 1.5,
                    maxHeight: '240px',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  },
                }, status.stderrTail.join('\n')))
              : null))
    }

    function WechatPage() {
      const [tab, setTab] = useState('policy')
      return h('div', { 'data-wechat-local-ui': '', style: S.page },
        h('h2', {
          style: { fontSize: '18px', fontWeight: 600, margin: '0' },
          title: '用这台电脑上登录的微信读写消息。',
        }, 'PC微信'),
        h('div', {
          style: {
            display: 'flex',
            gap: '6px',
            paddingBottom: '8px',
            borderBottom: '1px solid var(--dsw-alias-border-l1, #e5e5e5)',
          },
        },
          h(Button, { primary: tab === 'policy', onClick: () => setTab('policy') }, '回复策略'),
          h(Button, { primary: tab === 'status', onClick: () => setTab('status') }, '状态信息')),
        tab === 'policy' ? h(PolicyView) : h(StatusView))
    }

    function ChatIcon() {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M2 3.5h12v8H6.5L3.5 14v-2.5H2z', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' }),
        h('path', { d: 'M5 6.5h6M5 9h4', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const disposers = []
        const track = (fn) => {
          const dispose = fn()
          if (typeof dispose === 'function') disposers.push(dispose)
        }
        track(() =>
          ctx.slots.inject('settings.section', () =>
            ctx.slots.register(
              { name: 'settings.section', id: 'wechat-local', order: 41, label: 'PC微信' },
              WechatPage,
            ),
          ),
        )
        track(() =>
          ctx.slots.inject('settings.section.icon', () =>
            ctx.slots.register({ name: 'settings.section.icon', id: 'wechat-local' }, ChatIcon),
          ),
        )
        return () => {
          for (const dispose of disposers) dispose()
        }
      },
    }
  },
})
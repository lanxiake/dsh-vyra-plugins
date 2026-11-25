// OpenDesign 领域设置页：在「设置」里开关九个领域的技能包与 Agent。
//
// 数据都走宿主侧的两条路由（routes.mjs）：
//   GET   /open-design/config   读九个领域、启用状态、技能清单、Agent 状态
//   PATCH /open-design/config   改启用集合，宿主当场写配置并同步磁盘
//   POST  /open-design/agents   只重建 Agent 预设
//
// 不引入宿主 Client 包（dsh-doc 明令禁止 require 任何 @deepseek-ai/dsh-client-*），
// 所以开关是手写的：role="switch" + aria-checked，样式全部用 --dsw-alias-* 令牌。
window.__ModuleLoader__.load({
  id: 'open-design',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useRef } = React

    const API = '/open-design'

    async function callJson(path, init) {
      const response = await fetch(`${API}${path}`, {
        ...init,
        headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      })
      const text = await response.text()
      let body
      try {
        body = text === '' ? {} : JSON.parse(text)
      } catch {
        throw new Error(`接口返回了非 JSON 内容（HTTP ${response.status}）`)
      }
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`)
      return body
    }

    // ---- styles -----------------------------------------------------------
    const S = {
      wrap: { display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 2px', minHeight: 0 },
      header: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' },
      title: { fontSize: '15px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
      muted: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)', lineHeight: 1.6 },
      list: {
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '10px',
        background: 'var(--dsw-alias-bg-layer-1)',
        overflow: 'hidden',
      },
      row: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '11px 14px',
        borderTop: '1px solid var(--dsw-alias-border-l2)',
      },
      text: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 },
      name: { fontSize: '13px', fontWeight: 550, color: 'var(--dsw-alias-label-primary)' },
      desc: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', lineHeight: 1.55 },
      count: {
        fontSize: '11px',
        color: 'var(--dsw-alias-label-tertiary)',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      },
      switchRoot: {
        position: 'relative',
        flex: '0 0 auto',
        width: '34px',
        height: '20px',
        padding: 0,
        border: 'none',
        borderRadius: '999px',
        cursor: 'pointer',
        transition: 'background-color 120ms ease',
      },
      knob: {
        position: 'absolute',
        top: '2px',
        left: '2px',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: '#fff',
        transition: 'transform 120ms ease',
      },
      button: {
        padding: '6px 12px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: '12px',
        cursor: 'pointer',
      },
      buttonDisabled: { opacity: 0.5, cursor: 'default' },
      notice: {
        padding: '9px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        lineHeight: 1.6,
        border: '1px solid var(--dsw-alias-border-l2)',
        color: 'var(--dsw-alias-label-secondary)',
        background: 'var(--dsw-alias-bg-layer-1)',
      },
      noticeError: {
        borderColor: 'var(--dsw-alias-border-error)',
        color: 'var(--dsw-alias-label-error)',
      },
      details: { marginTop: '6px' },
      summary: {
        fontSize: '11px',
        color: 'var(--dsw-alias-label-tertiary)',
        cursor: 'pointer',
        userSelect: 'none',
      },
      chips: { display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '7px' },
      chip: {
        fontSize: '11px',
        padding: '2px 7px',
        borderRadius: '5px',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-secondary)',
        fontFamily: 'ui-monospace, monospace',
      },
      sectionLabel: {
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--dsw-alias-label-secondary)',
        marginTop: '4px',
      },
      agentRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        padding: '8px 14px',
        borderTop: '1px solid var(--dsw-alias-border-l2)',
        fontSize: '12px',
        color: 'var(--dsw-alias-label-secondary)',
      },
    }

    function Toggle({ checked, disabled, onChange, label }) {
      return h(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': checked,
          'aria-label': label,
          disabled,
          onClick: onChange,
          style: {
            ...S.switchRoot,
            background: checked ? 'var(--dsw-alias-bg-accent)' : 'var(--dsw-alias-bg-layer-3)',
            ...(disabled ? S.buttonDisabled : null),
          },
        },
        h('span', {
          style: { ...S.knob, transform: checked ? 'translateX(14px)' : 'translateX(0)' },
        }),
      )
    }

    function DomainRow({ domain, busy, onToggle, first }) {
      const total = domain.designSystems ? `${domain.skills.length} + 152 设计系统` : String(domain.skills.length)
      return h(
        'div',
        { style: first ? { ...S.row, borderTop: 'none' } : S.row },
        h(
          'div',
          { style: S.text },
          h('div', { style: S.name }, domain.name),
          h('div', { style: S.desc }, domain.description),
          h(
            'details',
            { style: S.details },
            h('summary', { style: S.summary }, `查看 ${total} 个技能`),
            h(
              'div',
              { style: S.chips },
              domain.skills.map((skill) => h('span', { key: skill, style: S.chip }, skill)),
              domain.designSystems
                ? h('span', { style: S.chip }, '…另有 152 套设计系统契约')
                : null,
            ),
          ),
        ),
        h('div', { style: S.count }, total),
        h(Toggle, {
          checked: domain.enabled,
          disabled: busy,
          label: `${domain.enabled ? '关闭' : '开启'} ${domain.name}`,
          onChange: () => onToggle(domain),
        }),
      )
    }

    function SettingsPanel() {
      const [state, setState] = useState(null)
      const [error, setError] = useState(null)
      const [notice, setNotice] = useState(null)
      const [busy, setBusy] = useState(false)
      const mounted = useRef(true)

      useEffect(() => {
        mounted.current = true
        return () => {
          mounted.current = false
        }
      }, [])

      const refresh = useCallback(async () => {
        try {
          const body = await callJson('/config')
          if (mounted.current) {
            setState(body)
            setError(null)
          }
        } catch (problem) {
          if (mounted.current) setError(problem.message)
        }
      }, [])

      useEffect(() => {
        void refresh()
      }, [refresh])

      const toggle = useCallback(
        async (domain) => {
          if (state === null || busy) return
          const next = domain.enabled
            ? state.domains.filter((d) => d.enabled && d.id !== domain.id).map((d) => d.id)
            : [...state.domains.filter((d) => d.enabled).map((d) => d.id), domain.id]
          setBusy(true)
          setNotice(null)
          try {
            const body = await callJson('/config', { method: 'PATCH', body: JSON.stringify({ enabled: next }) })
            if (!mounted.current) return
            setState(body)
            setError(null)
            const applied = body.applied ?? {}
            setNotice(
              `${domain.enabled ? '已关闭' : '已开启'}「${domain.name}」。` +
                `技能目录已更新${applied.removed?.length ? `，清理 ${applied.removed.join('、')}` : ''}。` +
                '当前会话的技能列表可能需要新建会话后才刷新。',
            )
          } catch (problem) {
            if (mounted.current) setError(problem.message)
          } finally {
            if (mounted.current) setBusy(false)
          }
        },
        [state, busy],
      )

      const regenerate = useCallback(async () => {
        setBusy(true)
        setNotice(null)
        try {
          const body = await callJson('/agents', { method: 'POST', body: '{}' })
          if (!mounted.current) return
          setState(body)
          setError(null)
          const written = body.applied?.agentsWritten ?? []
          setNotice(
            written.length > 0
              ? `已重建 Agent：${written.join('、')}。`
              : 'Agent 已是最新，无需重建。',
          )
        } catch (problem) {
          if (mounted.current) setError(problem.message)
        } finally {
          if (mounted.current) setBusy(false)
        }
      }, [])

      if (error !== null && state === null) {
        return h(
          'div',
          { style: S.wrap },
          h('div', { style: S.title }, 'OpenDesign 领域'),
          h('div', { style: { ...S.notice, ...S.noticeError } }, `读取失败：${error}`),
          h('div', { style: S.muted }, '仍可以用命令行管理：node ~/.dsh/profiles/<profile>/node_modules/open-design/bin/odx domains list'),
        )
      }

      if (state === null) {
        return h('div', { style: S.wrap }, h('div', { style: S.muted }, '正在读取…'))
      }

      const enabledCount = state.domains.filter((d) => d.enabled).length
      const presentAgents = state.agents.filter((a) => a.present)

      return h(
        'div',
        { style: S.wrap },
        h(
          'div',
          { style: S.header },
          h('div', { style: S.title }, 'OpenDesign 领域'),
          h(
            'div',
            { style: S.muted },
            `已开启 ${enabledCount} / ${state.domains.length} 个领域 · 共 ${state.counts?.total ?? 237} 个技能`,
          ),
        ),
        h(
          'div',
          { style: S.muted },
          '开启的领域会把技能包写进技能目录，并生成同名 Agent。关闭后技能目录立即移除，模型不再看到。',
        ),
        error !== null ? h('div', { style: { ...S.notice, ...S.noticeError } }, error) : null,
        notice !== null ? h('div', { style: S.notice }, notice) : null,
        h(
          'div',
          { style: S.list },
          state.domains.map((domain, index) =>
            h(DomainRow, { key: domain.id, domain, busy, onToggle: toggle, first: index === 0 }),
          ),
        ),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
          h(
            'button',
            { type: 'button', onClick: regenerate, disabled: busy, style: { ...S.button, ...(busy ? S.buttonDisabled : null) } },
            '重新生成 Agent',
          ),
          h('div', { style: S.muted }, `${presentAgents.length} 个 Agent 已在磁盘上`),
        ),
        h(
          'div',
          { style: S.list },
          h('div', { style: { ...S.agentRow, borderTop: 'none', fontWeight: 600 } }, h('span', null, 'Agent 预设'), h('span', null, '状态')),
          state.agents.map((agent, index) =>
            h(
              'div',
              { key: agent.id, style: index === 0 ? { ...S.agentRow, borderTop: 'none' } : S.agentRow },
              h('span', null, `${agent.name}（${agent.id}）`),
              h('span', { style: agent.present ? null : S.muted }, agent.present ? '已生成' : '未生成'),
            ),
          ),
        ),
        h(
          'div',
          { style: S.list },
          h('div', { style: { ...S.agentRow, borderTop: 'none', fontWeight: 600 } }, h('span', null, '设计总监可委派（花名册）'), h('span', null, `${(state.roster ?? []).length} 个`)),
          (state.roster ?? []).length === 0
            ? h('div', { ...{ style: S.muted } }, '还没有其他 Agent。用「Agent 管理」新建一个，重新生成后它就会出现在这里。')
            : state.roster.map((row, index) =>
                h(
                  'div',
                  { key: row.id, style: index === 0 ? { ...S.agentRow, borderTop: 'none' } : S.agentRow },
                  h('span', null, `${row.name}（${row.id}）`),
                  h('span', { style: S.muted }, row.description ?? ''),
                ),
              ),
        ),
        h(
          'div',
          { style: S.muted },
          '提示：技能列表在新建会话后刷新；花名册里的 Agent 都能被设计总监通过 subagent 调用。命令行等价操作：odx domains enable/disable <领域 id>、odx agents list。',
        ),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'open-design',
              order: 20,
              label: () => 'OpenDesign 领域',
            },
            SettingsPanel,
          ),
        )
        try {
          ctx.slots.inject('settings.section.icon', () =>
            ctx.slots.register(
              {
                name: 'settings.section.icon',
                id: 'open-design',
              },
              function OpenDesignIcon() {
                return h(
                  'svg',
                  { viewBox: '0 0 64 64', width: 18, height: 18, 'aria-hidden': true },
                  h('circle', { cx: 32, cy: 32, r: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 6 }),
                  h('circle', { cx: 32, cy: 32, r: 5, fill: 'currentColor' }),
                )
              },
            ),
          )
        } catch {
          // Older hosts render the label without a custom icon.
        }
      },
    }
  },
})
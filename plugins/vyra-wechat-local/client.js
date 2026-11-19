// Client half: the settings page. All work is in the Host + Python sidecar; this page
// only reports state and lets the user restart / run the environment self-check.
const RPC = '/api/wechat-local/rpc'

window.__ModuleLoader__.load({
  id: 'vyra-wechat-local',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useState } = React

    async function call(op) {
      const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ op }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || '请求失败')
      return data.data
    }

    const S = {
      page: { padding: '8px 4px', maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '16px' },
      card: {
        border: '1px solid var(--dsw-alias-border-l4, #d0d0d0)',
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      },
      row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', fontSize: '13px' },
      hint: { fontSize: '12px', opacity: 0.65, lineHeight: 1.6, margin: 0 },
      label: { opacity: 0.75 },
      btn: {
        padding: '7px 14px',
        borderRadius: 'var(--dsw-radius-sm, 8px)',
        border: '1px solid var(--dsw-alias-border-l4, #d0d0d0)',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: '13px',
      },
      pre: {
        margin: 0,
        padding: '10px',
        borderRadius: '8px',
        background: 'var(--dsw-alias-bg-layer-3, #fff)',
        border: '1px solid var(--dsw-alias-border-l1, #e5e5e5)',
        fontSize: '12px',
        lineHeight: 1.5,
        maxHeight: '320px',
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      },
      chip: {
        fontSize: '12px',
        padding: '2px 8px',
        borderRadius: '99px',
        background: 'var(--dsw-alias-bg-layer-3, #fff)',
        border: '1px solid var(--dsw-alias-border-l1, #e5e5e5)',
      },
    }

    const STATE_TEXT = { idle: '未启动', starting: '启动中', ready: '就绪', failed: '失败', stopped: '已停止' }

    function badge(state) {
      const color =
        state === 'ready'
          ? 'var(--dsw-alias-state-success-primary, #2f9e44)'
          : state === 'failed'
            ? 'var(--dsw-alias-state-error-primary, #d1242f)'
            : 'var(--dsw-alias-state-warn-primary, #e8a33d)'
      return h(
        'span',
        { style: { ...S.chip, color, borderColor: 'currentColor' } },
        STATE_TEXT[state] || state,
      )
    }

    function Row(props) {
      return h(
        'div',
        { style: S.row },
        h('span', { style: S.label }, props.label),
        h('span', { style: { textAlign: 'right', wordBreak: 'break-all' } }, props.value),
      )
    }

    function Page() {
      const [status, setStatus] = useState(null)
      const [env, setEnv] = useState(null)
      const [error, setError] = useState('')
      const [busy, setBusy] = useState('')

      const refresh = useCallback(async () => {
        try {
          setStatus(await call('status'))
          setError('')
        } catch (err) {
          setError(String(err?.message ?? err))
        }
      }, [])

      useEffect(() => {
        refresh()
        const timer = setInterval(refresh, 5000)
        return () => clearInterval(timer)
      }, [refresh])

      const run = async (op, tag) => {
        setBusy(tag)
        setError('')
        try {
          const next = await call(op)
          setStatus(op === 'diagnose' ? next.status : next)
          if (op === 'diagnose') setEnv(next.env)
        } catch (err) {
          setError(String(err?.message ?? err))
        } finally {
          setBusy('')
        }
      }

      const state = status?.state ?? 'idle'
      const runtime = status?.runtime
      return h(
        'div',
        { 'data-wechat-local-ui': '', style: S.page },
        h('div', null,
          h('h2', { style: { fontSize: '18px', fontWeight: 600, margin: '0 0 6px' } }, '本机微信'),
          h('p', { style: S.hint },
            '读取用户本人微信的会话与聊天记录，必要时以本人身份发送。仅 Windows；需要微信 4.x 已登录。',
            '只读路径不碰窗口；发送会抢前台。')),
        h(
          'div',
          { style: S.card },
          h(Row, {
            label: '侧车',
            value: h('span', { style: { display: 'inline-flex', gap: '8px', alignItems: 'center' } },
              badge(state),
              status?.version ? h('span', { style: S.hint }, `v${status.version}`) : null),
          }),
          h(Row, {
            label: '运行方式',
            value: runtime?.error
              ? h('span', { style: { color: 'var(--dsw-alias-state-error-primary, #d1242f)' } }, runtime.error)
              : `${runtime?.source ?? '—'}${runtime?.command ? ` · ${runtime.command}` : ''}`,
          }),
          h(Row, {
            label: '工具',
            value: `${status?.registered?.length ?? 0} 已注册 / 白名单 ${status?.whitelist?.length ?? 0}`,
          }),
          status?.error
            ? h('div', { style: { ...S.hint, color: 'var(--dsw-alias-state-error-primary, #d1242f)' } }, status.error)
            : null,
          h(
            'div',
            { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            h('button', {
              type: 'button',
              style: S.btn,
              disabled: busy !== '',
              onClick: () => run('restart', 'restart'),
            }, busy === 'restart' ? '重启中…' : '重启侧车'),
            h('button', {
              type: 'button',
              style: S.btn,
              disabled: busy !== '',
              onClick: () => run('diagnose', 'diagnose'),
            }, busy === 'diagnose' ? '自检中…' : '环境自检'),
          ),
          error ? h('div', { style: { ...S.hint, color: 'var(--dsw-alias-state-error-primary, #d1242f)' } }, error) : null,
          status?.stderrTail?.length
            ? h('details', { style: S.hint },
                h('summary', null, '侧车最近输出'),
                h('pre', { style: S.pre }, status.stderrTail.join('\n')))
            : null,
        ),
        env
          ? h('div', { style: S.card },
              h('h3', { style: { fontSize: '14px', fontWeight: 600, margin: 0 } }, '环境自检'),
              h('pre', { style: S.pre }, JSON.stringify(env, null, 2)))
          : null,
        h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
          (status?.whitelist ?? []).map((tool) => h('span', { key: tool, style: S.chip }, tool)),
        ),
      )
    }

    function Icon() {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
        h('path', {
          d: 'M2 3.5h12v8H6.5L3.5 14v-2.5H2z',
          stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round',
        }),
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
              { name: 'settings.section', id: 'wechat-local', order: 41, label: '本机微信' },
              Page,
            ),
          ),
        )
        track(() =>
          ctx.slots.inject('settings.section.icon', () =>
            ctx.slots.register({ name: 'settings.section.icon', id: 'wechat-local' }, Icon),
          ),
        )
        return () => {
          for (const dispose of disposers) dispose()
        }
      },
    }
  },
})
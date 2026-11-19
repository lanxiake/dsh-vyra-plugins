// Client half: the settings page, laid out like the local-WeChat channel card in the
// Lumii client — one wide card with a title row, a status pill, a meta strip, and an
// environment self-check block below it.
//
// Everything stays inside the factory: plugin client bundles are concatenated into
// classic scripts, which share one lexical scope, so a top-level `const` here would
// collide with any other plugin that picked the same name.
window.__ModuleLoader__.load({
  id: 'vyra-wechat-local',
  factory(require) {
    const RPC = '/api/wechat-local/rpc'
    const React = require('react')
    const { useCallback, useEffect, useState } = React
    const h = React.createElement

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

    /** 数据目录来源 → 人话（与 wechat_core 的探测来源对齐）。 */
    const DB_SOURCE_LABELS = {
      env: '环境变量',
      ini: '微信设置',
      registry: '注册表',
      default: '默认路径',
      scan: '磁盘扫描',
    }

    const S = {
      page: { padding: '8px 4px', maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '16px' },
      card: {
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        border: '1px solid var(--dsw-alias-border-l1, #e5e5e5)',
        borderRadius: '12px',
        background: 'var(--dsw-alias-bg-layer-1, #fff)',
        overflow: 'hidden',
        transition: 'border-color .2s, box-shadow .2s',
      },
      row: { display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', minWidth: 0, flexWrap: 'wrap' },
      icon: { display: 'inline-flex', flexShrink: 0 },
      text: { display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 },
      name: { fontSize: '14px', fontWeight: 500, lineHeight: '20px', color: 'var(--dsw-alias-label-primary, #1a1a1a)' },
      descRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 },
      description: {
        fontSize: '12px',
        lineHeight: '16px',
        color: 'var(--dsw-alias-label-secondary, #666)',
        overflowWrap: 'anywhere',
      },
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
      metaValue: {
        margin: 0,
        fontSize: '12px',
        fontWeight: 500,
        lineHeight: '16px',
        color: 'var(--dsw-alias-label-primary, #1a1a1a)',
        overflowWrap: 'anywhere',
      },
      children: { padding: '12px 16px 14px', display: 'flex', flexDirection: 'column', gap: '10px' },
      summary: { margin: 0, fontSize: '13px', lineHeight: '20px', color: 'var(--dsw-alias-label-secondary, #666)' },
      envHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
      envTitle: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary, #666)' },
      envBody: { display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary, #666)', overflowWrap: 'anywhere' },
      note: { margin: 0, fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-state-warn-primary, #e8a33d)' },
      divider: { borderTop: '1px solid var(--dsw-alias-border-l1, #e5e5e5)', paddingTop: '10px' },
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
      chipDot: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: 'var(--dsw-alias-state-success-primary, #2f9e44)',
        flexShrink: 0,
      },
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
        h('path', {
          d: 'M18 20h28a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H32l-9 7v-7h-5a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4z',
          fill: '#fff',
        }),
        h('circle', { cx: 25, cy: 31, r: 2.6, fill: '#07c160' }),
        h('circle', { cx: 32, cy: 31, r: 2.6, fill: '#07c160' }),
        h('circle', { cx: 39, cy: 31, r: 2.6, fill: '#07c160' }))
    }

    /** 「微信」「数据目录」等自检行，语义与 Lumii 的 pcwechat 卡片一致。 */
    function environmentLines(env, state) {
      if (!env) return { lines: ['环境自检：检测中…'], actions: [] }
      const db = env.db_ok
        ? `数据目录：${env.db_root}（来源：${DB_SOURCE_LABELS[env.db_source] || env.db_source || '自动探测'}）`
        : '数据目录：未找到（确认微信已登录；换机后在微信「设置 → 文件管理」核对路径）'
      const wechat = !env.weixin_running
        ? '微信：未运行（打开并登录微信后重新检测）'
        : env.ok
          ? '微信：就绪'
          : `微信：${env.reason || '不可用'}`
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
      const actions = []
      if (!env.weixin_running) actions.push('打开并登录微信')
      if (env.weixin_running && !env.db_ok) actions.push('确认微信数据目录')
      if (missing.length > 0) actions.push(`安装依赖：${missing.join('、')}`)
      if (state !== 'ready') actions.push('侧车未就绪：在下方重启侧车')
      return {
        lines: [db, wechat, deps, version, account].filter(Boolean),
        actions,
        versionHint: env.wechat_version?.hint || '',
      }
    }

    function Page() {
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
      const connected = ready && env?.ok === true && env?.weixin_running === true && env?.db_ok === true
      const tone = connected ? 'connected' : state === 'failed' ? 'error' : state === 'starting' ? 'pending' : 'idle'
      const label = connected ? '已连接' : state === 'starting' ? '启动中' : state === 'failed' ? '未就绪' : ready ? '未就绪' : '未启动'
      const environment = environmentLines(env, state)
      const registered = status?.registered ?? []
      const available = status?.tools?.length ?? 0

      return h('div', { 'data-wechat-local-ui': '', style: S.page },
        h('div', null,
          h('h2', { style: { fontSize: '18px', fontWeight: 600, margin: '0 0 6px' } }, '本机微信'),
          h('p', { style: { ...S.summary, margin: 0 } },
            '用这台电脑上登录的微信读写你自己的会话；只读路径不抢前台，发送会抢前台。仅 Windows。')),

        h('section', { style: S.card },
          h('div', { style: S.row },
            h('span', { style: S.icon }, h(WechatMark)),
            h('div', { style: S.text },
              h('div', { style: S.name }, '本机微信'),
              h('div', { style: S.descRow },
                h('span', { style: S.description }, '以你本人身份，跟你微信里的好友说话'),
                h('span', { style: S.capability }, '读取 · 发送 · 导出'))),
            h(StatusPill, { tone, label }),
            h('div', { style: S.actions },
              h('button', {
                type: 'button',
                style: S.btn,
                disabled: busy !== '',
                onClick: () => void run('restart', 'restart'),
              }, busy === 'restart' ? '重启中…' : '重启侧车'))),

          error || status?.error
            ? h('div', { style: S.error }, error || status.error)
            : null,

          h('dl', { style: S.meta },
            h('div', { style: S.metaItem },
              h('dt', { style: S.metaLabel }, '助手'),
              h('dd', { style: S.metaValue }, status?.version ? `本机微信侧车 v${status.version}` : '本机微信侧车')),
            h('div', { style: S.metaItem },
              h('dt', { style: S.metaLabel }, '在线'),
              h('dd', { style: S.metaValue },
                connected ? '本机微信已就绪' : env?.reason || status?.error || '检测中…')),
            h('div', { style: S.metaItem },
              h('dt', { style: S.metaLabel }, '工具'),
              h('dd', { style: S.metaValue }, `${registered.length} 个已注册 · ${available} 个可用`)),
            h('div', { style: S.metaItem },
              h('dt', { style: S.metaLabel }, '运行方式'),
              h('dd', { style: S.metaValue },
                runtime?.error ? '未找到解释器' : runtime?.source === 'uv' ? 'uv（依赖自动获取）' : '自定义 Python'))),

          h('div', { style: S.children },
            h('p', { style: S.summary },
              registered.length === 0
                ? '侧车还没交出工具：先看下面的自检，再重启侧车。'
                : `已向 Agent 开放 ${registered.length} 个工具；${registered.slice(0, 6).join('、')}${registered.length > 6 ? ` 等 ${registered.length} 个` : ''}。`),

            h('div', { style: S.divider },
              h('div', { style: S.envHead },
                h('span', { style: S.envTitle }, '环境自检'),
                h('span', { style: { display: 'flex', gap: '6px' } },
                  h('button', {
                    type: 'button',
                    style: S.btnQuiet,
                    disabled: busy !== '',
                    onClick: () => void run('diagnose', 'check'),
                  }, busy === 'check' ? '检测中…' : '重新检测'),
                  h('button', {
                    type: 'button',
                    style: S.btn,
                    disabled: busy !== '',
                    onClick: () => void run('repair', 'repair'),
                  }, busy === 'repair' ? '修复中…' : '一键修复'))),
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
                  registered.map((tool) => h('span', { key: tool, style: S.chip },
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
              : null)),
      )
    }

    function Icon() {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
        h('path', {
          d: 'M2 3.5h12v8H6.5L3.5 14v-2.5H2z',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinejoin: 'round',
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
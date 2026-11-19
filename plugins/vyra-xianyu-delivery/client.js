// 闲鱼自动发货面板：侧边栏入口 + 订单/卡券/发货记录三个标签页。
//
// 所有读写都走 host 的 /api/xianyu-delivery/rpc，前端不直接碰数据库或子进程。
window.__ModuleLoader__.load({
  id: 'vyra-xianyu-delivery',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback } = React

    const RPC = '/api/xianyu-delivery/rpc'

    const S = {
      page: { padding: '24px 28px', height: '100%', overflow: 'auto', font: 'inherit', color: 'inherit' },
      head: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
      title: { fontSize: '20px', fontWeight: 600, margin: 0 },
      tabs: { display: 'flex', gap: '6px', marginBottom: '16px' },
      tab: (active) => ({
        padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(127,127,127,.3)',
        background: active ? 'rgba(127,127,127,.18)' : 'transparent', fontWeight: active ? 600 : 400,
      }),
      btn: { padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(127,127,127,.35)', background: 'transparent', font: 'inherit', color: 'inherit' },
      card: { border: '1px solid rgba(127,127,127,.25)', borderRadius: '10px', padding: '14px 16px', marginBottom: '12px' },
      row: { display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr 1fr 2fr', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(127,127,127,.15)', fontSize: '13px', alignItems: 'center' },
      th: { fontWeight: 600, opacity: 0.7 },
      input: { padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(127,127,127,.35)', background: 'transparent', color: 'inherit', font: 'inherit', width: '100%', boxSizing: 'border-box' },
      area: { padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(127,127,127,.35)', background: 'transparent', color: 'inherit', font: 'inherit', width: '100%', boxSizing: 'border-box', minHeight: '110px', resize: 'vertical' },
      label: { fontSize: '12px', opacity: 0.65, marginBottom: '4px', display: 'block' },
      err: { color: '#d9534f', fontSize: '13px', marginBottom: '10px' },
      muted: { opacity: 0.6, fontSize: '13px' },
      mono: { fontFamily: 'monospace', fontSize: '12px' },
      tag: (state) => ({
        display: 'inline-block', padding: '1px 8px', borderRadius: '999px', fontSize: '12px',
        border: '1px solid rgba(127,127,127,.35)',
        background: state === 'completed' || state === 'success' ? 'rgba(46,160,67,.18)' : state === 'blocked' || state === 'send_failed' || state === 'failed' ? 'rgba(217,83,79,.16)' : 'transparent',
      }),
    }

    async function rpc(body, timeout = 120000) {
      const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'rpc failed')
      return json.data
    }

    const EMPTY_CARD = { itemId: '', specName: '', specValue: '', content: '' }

    function OrdersTab(props) {
      const { orders } = props
      if (!orders.length) return h('div', { style: { ...S.muted, padding: '16px 0' } }, '暂无订单')
      return h('div', null,
        h('div', { style: { ...S.row, ...S.th } },
          h('span', null, '订单号'), h('span', null, '商品'), h('span', null, '数量'),
          h('span', null, '状态'), h('span', null, '原因 / 时间')),
        orders.map((o) =>
          h('div', { key: o.order_no, style: S.row },
            h('span', { style: S.mono }, o.order_no),
            h('span', { style: S.mono }, o.item_id),
            h('span', null, `${o.delivered}/${o.quantity}`),
            h('span', null, h('span', { style: S.tag(o.state) }, o.state)),
            h('span', { style: { fontSize: '12px', opacity: 0.8 } }, `${o.fail_reason || '-'} · ${o.updated_at}`)
          )
        )
      )
    }

    function CardsTab(props) {
      const { cards, draft, setDraft, addCard, busy } = props
      return h('div', null,
        h('div', { style: S.card },
          h('div', { style: { fontWeight: 600, marginBottom: '10px' } }, '添加卡券'),
          h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' } },
            h('div', null,
              h('label', { style: S.label }, '商品 ID'),
              h('input', { style: S.input, value: draft.itemId, onChange: (e) => setDraft({ ...draft, itemId: e.target.value }) })),
            h('div', null,
              h('label', { style: S.label }, '规格名（可选）'),
              h('input', { style: S.input, value: draft.specName, onChange: (e) => setDraft({ ...draft, specName: e.target.value }) })),
            h('div', null,
              h('label', { style: S.label }, '规格值（可选）'),
              h('input', { style: S.input, value: draft.specValue, onChange: (e) => setDraft({ ...draft, specValue: e.target.value }) }))
          ),
          h('label', { style: S.label }, '卡券内容（多条用单独一行 --- 分隔）'),
          h('textarea', { style: S.area, value: draft.content, onChange: (e) => setDraft({ ...draft, content: e.target.value }) }),
          h('div', { style: { marginTop: '10px' } },
            h('button', { style: S.btn, onClick: addCard, disabled: !!busy }, busy === 'add' ? '保存中…' : '添加'))
        ),
        cards.length === 0
          ? h('div', { style: { ...S.muted, padding: '16px 0' } }, '还没有卡券')
          : h('div', null,
            h('div', { style: { ...S.row, ...S.th } },
              h('span', null, '商品'), h('span', null, '规格'), h('span', null, '名称'), h('span', null, '类型'), h('span', null, '状态')),
            cards.map((c) =>
              h('div', { key: c.id, style: S.row },
                h('span', { style: S.mono }, c.item_id),
                h('span', null, c.spec_value || '通用'),
                h('span', null, c.name),
                h('span', null, c.type),
                h('span', null, c.enabled ? '启用' : '停用')
              )
            )
          )
      )
    }

    function DeliveriesTab(props) {
      const { deliveries } = props
      if (!deliveries.length) return h('div', { style: { ...S.muted, padding: '16px 0' } }, '暂无发货记录')
      return h('div', null,
        h('div', { style: { ...S.row, ...S.th } },
          h('span', null, '订单'), h('span', null, '序号'), h('span', null, '结果'), h('span', null, '内容'), h('span', null, '时间')),
        deliveries.map((d) =>
          h('div', { key: d.id, style: S.row },
            h('span', { style: S.mono }, d.order_no),
            h('span', null, String(d.seq)),
            h('span', null, h('span', { style: S.tag(d.send_state) }, d.send_state)),
            h('span', { style: { ...S.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, d.content),
            h('span', { style: { fontSize: '12px', opacity: 0.8 } }, d.created_at)
          )
        )
      )
    }

    function XianyuDelivery() {
      const [tab, setTab] = useState('orders')
      const [status, setStatus] = useState(null)
      const [orders, setOrders] = useState([])
      const [deliveries, setDeliveries] = useState([])
      const [cards, setCards] = useState([])
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [draft, setDraft] = useState(EMPTY_CARD)

      const refresh = useCallback(async () => {
        try {
          const results = await Promise.all([
            rpc({ op: 'status' }),
            rpc({ op: 'orders', limit: 50 }),
            rpc({ op: 'deliveries', limit: 100 }),
            rpc({ op: 'cards' }),
          ])
          setStatus(results[0])
          setOrders(results[1])
          setDeliveries(results[2])
          setCards(results[3])
          setError('')
        } catch (err) {
          setError(String(err.message || err))
        }
      }, [])

      useEffect(() => {
        refresh()
        const timer = setInterval(refresh, 5000)
        return () => clearInterval(timer)
      }, [refresh])

      async function runTick() {
        setBusy('tick')
        setNotice('')
        try {
          const result = await rpc({ op: 'tick' }, 180000)
          setNotice(result && result.paused ? '熔断中，已暂停' : `本轮处理 ${(result && result.results && result.results.length) || 0} 单`)
          await refresh()
        } catch (err) {
          setError(String(err.message || err))
        } finally {
          setBusy('')
        }
      }

      async function addCard() {
        if (!draft.itemId || !draft.content.trim()) {
          setNotice('商品 ID 和卡券内容必填')
          return
        }
        setBusy('add')
        setNotice('')
        try {
          await rpc({
            op: 'addCard',
            itemId: draft.itemId.trim(),
            specName: draft.specName.trim(),
            specValue: draft.specValue.trim(),
            name: draft.itemId.trim(),
            type: 'data',
            content: draft.content,
          })
          setDraft(EMPTY_CARD)
          setNotice('卡券已添加')
          await refresh()
        } catch (err) {
          setError(String(err.message || err))
        } finally {
          setBusy('')
        }
      }

      const meta = status
        ? `轮询 ${status.config.pollSeconds}s · 模式 ${status.config.mode} · 可用卡密 ${status.cards} 张`
        : '正在读取状态…'

      return h('div', { style: S.page },
        h('div', { style: S.head },
          h('h2', { style: S.title }, '闲鱼自动发货'),
          h('button', { style: S.btn, onClick: runTick, disabled: !!busy },
            busy === 'tick' ? '处理中…' : '立即处理一轮')),
        h('div', { style: { ...S.muted, marginBottom: '12px' } }, meta),
        error ? h('div', { style: S.err }, error) : null,
        notice ? h('div', { style: { ...S.muted, marginBottom: '10px' } }, notice) : null,
        h('div', { style: S.tabs },
          ['orders', 'cards', 'deliveries'].map((k) =>
            h('div', { key: k, style: S.tab(tab === k), onClick: () => setTab(k) },
              { orders: '订单', cards: '卡券', deliveries: '发货记录' }[k]))),
        tab === 'orders' ? h(OrdersTab, { orders }) : null,
        tab === 'cards' ? h(CardsTab, { cards, draft, setDraft, addCard, busy }) : null,
        tab === 'deliveries' ? h(DeliveriesTab, { deliveries }) : null
      )
    }

    function Icon(props) {
      const size = props.size || 20
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
      },
      h('path', { d: 'M3 8l9-5 9 5v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z' }),
      h('path', { d: 'M8 12h8M8 16h5' }))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            { name: 'sidebar.panellist', id: 'xianyu-delivery', order: 60, label: () => '闲鱼发货' },
            Icon
          )
        )
        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: 'xianyu-delivery' }, XianyuDelivery)
        )
      },
    }
  },
})

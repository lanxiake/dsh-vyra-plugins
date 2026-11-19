// 闲鱼自动客服面板：侧边栏入口 + 订单/卡券/商品技能/发货记录四个标签页。
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
      mask:{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
      modal: { background: 'Canvas', color: 'CanvasText', borderRadius: '14px', padding: '22px 24px', width: '320px', boxShadow: '0 18px 50px rgba(0,0,0,.35)', textAlign: 'center' },
      qr: { width: '220px', height: '220px', display: 'block', margin: '12px auto', borderRadius: '8px' },
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

    function ItemsTab(props) {
      const { items, draft, setDraft, saveItem, busy } = props
      return h('div', null,
        h('div', { style: S.card },
          h('div', { style: { fontWeight: 600, marginBottom: '10px' } }, '商品绑定技能'),
          h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' } },
            h('div', null,
              h('label', { style: S.label }, '商品 ID'),
              h('input', { style: S.input, value: draft.itemId, onChange: (e) => setDraft({ ...draft, itemId: e.target.value }) })),
            h('div', null,
              h('label', { style: S.label }, '商品标题（可选）'),
              h('input', { style: S.input, value: draft.title, onChange: (e) => setDraft({ ...draft, title: e.target.value }) }))),
          h('label', { style: S.label }, '技能名（逗号分隔，正文从 skillsDir 下的 <name>/SKILL.md 读取）'),
          h('input', { style: S.input, value: draft.skills, onChange: (e) => setDraft({ ...draft, skills: e.target.value }), placeholder: 'xianyu-weflow, refund-policy' }),
          h('div', { style: { ...S.muted, marginTop: '8px' } }, '商品图片、文件、参数都写在技能里，回复时整段注入。'),
          h('div', { style: { marginTop: '10px' } },
            h('button', { style: S.btn, onClick: saveItem, disabled: !!busy }, busy === 'item' ? '保存中…' : '保存'))),
        items.length === 0
          ? h('div', { style: { ...S.muted, padding: '16px 0' } }, '还没有绑定技能的商品')
          : h('div', null,
            h('div', { style: { ...S.row, ...S.th } },
              h('span', null, '商品'), h('span', null, '标题'), h('span', null, '技能'), h('span', null, '更新时间'), h('span', null, '')),
            items.map((it) =>
              h('div', { key: it.item_id, style: S.row },
                h('span', { style: S.mono }, it.item_id),
                h('span', null, it.title || '-'),
                h('span', null, it.skills || '-'),
                h('span', { style: { fontSize: '12px', opacity: 0.8 } }, it.updated_at),
                h('span', null)))))
    }

    function LoginDialog(props) {
      const { login, onClose } = props
      let body
      if (login.state === 'waiting' && login.qr) {
        body = h('img', { style: S.qr, src: login.qr, alt: '闲鱼登录二维码' })
      } else if (login.state === 'done') {
        body = h('div', { style: { padding: '40px 0', color: '#2ea043' } }, '登录成功')
      } else if (login.state === 'error') {
        body = h('div', { style: { padding: '20px 0', color: '#d9534f', fontSize: '13px' } }, login.message || '登录失败')
      } else {
        body = h('div', { style: { padding: '40px 0' } }, '正在准备二维码…')
      }

      return h('div', { style: S.mask, onClick: onClose },
        h('div', { style: S.modal, onClick: (e) => e.stopPropagation() },
          h('div', { style: { fontWeight: 600 } }, '扫码登录闲鱼'),
          body,
          h('div', { style: { ...S.muted, marginTop: 8 } }, '用闲鱼 App 扫码，手机端确认'),
          h('div', { style: { marginTop: 12 } },
            h('button', { style: S.btn, onClick: onClose }, '关闭'))))
    }

    function XianyuDelivery() {
      const [tab, setTab] = useState('orders')
      const [status, setStatus] = useState(null)
      const [orders, setOrders] = useState([])
      const [deliveries, setDeliveries] = useState([])
      const [cards, setCards] = useState([])
      const [items, setItems] = useState([])
      const [itemDraft, setItemDraft] = useState({ itemId: '', title: '', skills: '' })
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [draft, setDraft] = useState(EMPTY_CARD)
      const [loginOpen, setLoginOpen] = useState(false)
      const [login, setLogin] = useState({ state: 'idle' })

      const refresh = useCallback(async () => {
        try {
          const results = await Promise.all([
            rpc({ op: 'status' }),
            rpc({ op: 'orders', limit: 50 }),
            rpc({ op: 'deliveries', limit: 100 }),
            rpc({ op: 'cards' }),
            rpc({ op: 'items' }),
          ])
          setStatus(results[0])
          setOrders(results[1])
          setDeliveries(results[2])
          setCards(results[3])
          setItems(results[4])
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

      async function saveItem() {
        if (!itemDraft.itemId.trim()) {
          setNotice('商品 ID 必填')
          return
        }
        setBusy('item')
        setNotice('')
        try {
          await rpc({
            op: 'setItem',
            itemId: itemDraft.itemId.trim(),
            title: itemDraft.title.trim(),
            skills: itemDraft.skills.trim(),
          })
          setNotice('商品资料已保存')
          await refresh()
        } catch (err) {
          setError(String(err.message || err))
        } finally {
          setBusy('')
        }
      }

      async function openLogin() {
        setLoginOpen(true)
        setLogin({ state: 'starting' })
        try {
          const st = await rpc({ op: 'login-start' }, 30000)
          setLogin(st || { state: 'starting' })
        } catch (err) {
          setLogin({ state: 'error', message: String(err.message || err) })
        }
      }

      async function closeLogin() {
        try {
          await rpc({ op: 'login-cancel' })
        } catch {
          // 取消失败不影响关闭弹层
        }
        setLoginOpen(false)
        setLogin({ state: 'idle' })
      }

      useEffect(() => {
        if (!loginOpen) return
        const timer = setInterval(async () => {
          try {
            const st = await rpc({ op: 'login-status' })
            setLogin(st)
            if (st.state === 'done') {
              await refresh()
              setTimeout(() => {
                setLoginOpen(false)
                setLogin({ state: 'idle' })
              }, 1200)
            }
          } catch {
            // 轮询失败不打扰用户
          }
        }, 1000)
        return () => clearInterval(timer)
      }, [loginOpen, refresh])

      const meta = status
        ? `轮询 ${status.config.pollSeconds}s · 实时 ${status.watch ? '开' : '关'} · AI 客服 ${status.ai ? '开' : '关'} · 可用卡密 ${status.cards} 张`
        : '正在读取状态…'

      return h('div', { style: S.page },
        h('div', { style: S.head },
          h('h2', { style: S.title }, '闲鱼自动客服'),
          h('button', { style: S.btn, onClick: openLogin }, '扫码登录'),
          h('button', { style: S.btn, onClick: runTick, disabled: !!busy },
            busy === 'tick' ? '处理中…' : '立即处理一轮')),
        h('div', { style: { ...S.muted, marginBottom: '12px' } }, meta),
        error ? h('div', { style: S.err }, error) : null,
        notice ? h('div', { style: { ...S.muted, marginBottom: '10px' } }, notice) : null,
        h('div', { style: S.tabs },
          ['orders', 'cards', 'items', 'deliveries'].map((k) =>
            h('div', { key: k, style: S.tab(tab === k), onClick: () => setTab(k) },
              { orders: '订单', cards: '卡券', items: '商品资料', deliveries: '发货记录' }[k]))),
        tab === 'orders' ? h(OrdersTab, { orders }) : null,
        tab === 'cards' ? h(CardsTab, { cards, draft, setDraft, addCard, busy }) : null,
        tab === 'items' ? h(ItemsTab, { items, draft: itemDraft, setDraft: setItemDraft, saveItem, busy }) : null,
        tab === 'deliveries' ? h(DeliveriesTab, { deliveries }) : null,
        loginOpen ? h(LoginDialog, { login, onClose: closeLogin }) : null
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
            { name: 'sidebar.panellist', id: 'xianyu-delivery', order: 60, label: () => '闲鱼客服' },
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

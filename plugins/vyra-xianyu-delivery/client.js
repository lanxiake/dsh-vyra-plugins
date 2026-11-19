// 闲鱼自动客服面板：侧边栏入口 + 订单/卡券/商品技能/发货记录四个标签页。
//
// 所有读写都走 host 的 /api/xianyu-delivery/rpc，前端不直接碰数据库或子进程。
window.__ModuleLoader__.load({
  id: 'vyra-xianyu-delivery',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useRef } = React

    const RPC = '/api/xianyu-delivery/rpc'

    const S = {
      page: { padding: '22px 26px', height: '100%', overflow: 'auto', font: 'inherit', color: 'inherit' },
      head: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' },
      title: { fontSize: '20px', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' },
      tabs: { display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' },
      tab: (active) => ({
        padding: '7px 15px', borderRadius: '999px', cursor: 'pointer', fontSize: '13px',
        border: `1px solid ${active ? '#0f9d6e' : 'rgba(127,127,127,.28)'}`,
        background: active ? '#0f9d6e' : 'transparent', color: active ? '#fff' : 'inherit',
        fontWeight: active ? 600 : 400, transition: 'background .15s, color .15s',
      }),
      btn: { padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(127,127,127,.3)', background: 'transparent', font: 'inherit', color: 'inherit', fontSize: '13px' },
      card: { border: '1px solid rgba(127,127,127,.22)', borderRadius: '12px', padding: '16px 18px', marginBottom: '14px' },
      row: (n = 5) => ({
        display: 'grid',
        gridTemplateColumns: n === 6 ? '1.8fr 1fr .7fr .5fr 1.3fr 1.2fr' : '2fr 1.4fr 1fr 1fr 2fr',
        gap: '10px', padding: '9px 12px', borderBottom: '1px solid rgba(127,127,127,.12)', fontSize: '13px', alignItems: 'center',
      }),
      th: { fontWeight: 600, opacity: 0.65 },
      tableWrap: { border: '1px solid rgba(127,127,127,.22)', borderRadius: '10px', overflow: 'hidden' },
      empty: { padding: '28px 0', textAlign: 'center', opacity: 0.6, fontSize: '13px' },
      muted: { opacity: 0.6, fontSize: '13px' },
      input: { padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(127,127,127,.35)', background: 'transparent', color: 'inherit', font: 'inherit', width: '100%', boxSizing: 'border-box' },
      area: { padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(127,127,127,.35)', background: 'transparent', color: 'inherit', font: 'inherit', width: '100%', boxSizing: 'border-box', minHeight: '110px', resize: 'vertical' },
      label: { fontSize: '12px', opacity: 0.65, marginBottom: '4px', display: 'block' },
      err: { color: '#d9534f', fontSize: '13px', marginBottom: '10px' },
      mask:{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
      modal: { background: 'Canvas', color: 'CanvasText', borderRadius: '14px', padding: '22px 24px', width: '320px', boxShadow: '0 18px 50px rgba(0,0,0,.35)', textAlign: 'center' },
      qr: { width: '220px', height: '220px', display: 'block', margin: '12px auto', borderRadius: '8px' },
      mono: { fontFamily: 'monospace', fontSize: '12px' },
      tag: (state) => tagStyle(state),
    }

    const TAG_COLORS = {
      ok: { fg: '#16a34a', bg: 'rgba(22,163,74,.12)', bd: 'rgba(22,163,74,.35)' },
      warn: { fg: '#d97706', bg: 'rgba(217,119,6,.12)', bd: 'rgba(217,119,6,.35)' },
      err: { fg: '#dc2626', bg: 'rgba(220,38,38,.12)', bd: 'rgba(220,38,38,.35)' },
      neutral: { fg: 'inherit', bg: 'rgba(127,127,127,.12)', bd: 'rgba(127,127,127,.3)' },
    }

    function tagStyle(state) {
      const text = String(state || '')
      const key = /completed|success|已发货|sent|ok/i.test(text)
        ? 'ok'
        : /failed|blocked|error|退款/i.test(text)
          ? 'err'
          : /confirm_failed|partial|pending|process|待发货/i.test(text)
            ? 'warn'
            : 'neutral'
      const color = TAG_COLORS[key]
      return {
        display: 'inline-block', padding: '2px 9px', borderRadius: '999px', fontSize: '12px', fontWeight: 500,
        color: color.fg, background: color.bg, border: `1px solid ${color.bd}`, whiteSpace: 'nowrap',
      }
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
      const { orders, localOrders, onRefresh, loading } = props
      const list = orders.length ? orders : localOrders
      const stateOf = (o) => o.local_state || o.state || ''
      const when = (o) => o.updated_at || o.created_at || ''

      return h('div', null,
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' } },
          h('span', { style: S.muted }, orders.length ? `闲鱼订单 ${list.length} 单` : '本地发货订单'),
          h('button', { style: S.btn, onClick: onRefresh, disabled: loading }, loading ? '读取中…' : '刷新')),
        (!loading && list.length === 0)
          ? h('div', { style: S.empty }, '暂无订单')
          : h('div', { style: S.tableWrap },
            h('div', { style: { ...S.row(6), ...S.th } },
              h('span', null, '订单号'), h('span', null, '买家'), h('span', null, '金额'),
              h('span', null, '数量'), h('span', null, '发货状态'), h('span', null, '时间')),
            list.map((o) =>
              h('div', { key: o.order_no, style: S.row(6) },
                h('span', { style: S.mono, title: o.order_no }, o.order_no),
                h('span', { title: o.buyer_nick || o.buyer_id || '' }, o.buyer_nick || o.buyer_id || '-'),
                h('span', null, o.amount ? `¥${o.amount}` : '-'),
                h('span', null, String(o.quantity || 1)),
                h('span', null,
                  stateOf(o)
                    ? h('span', { style: S.tag(stateOf(o)) }, o.local_state ? `${o.local_state} ${o.delivered || 0}张` : stateOf(o))
                    : h('span', { style: S.tag(o.status === '已发货' ? 'completed' : '') }, o.status || '未处理')),
                h('span', { style: { fontSize: '12px', opacity: 0.7 } }, when(o))
              )
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
            h('div', { style: { ...S.row(), ...S.th } },
              h('span', null, '商品'), h('span', null, '规格'), h('span', null, '名称'), h('span', null, '类型'), h('span', null, '状态')),
            cards.map((c) =>
              h('div', { key: c.id, style: S.row() },
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
        h('div', { style: { ...S.row(), ...S.th } },
          h('span', null, '订单'), h('span', null, '序号'), h('span', null, '结果'), h('span', null, '内容'), h('span', null, '时间')),
        deliveries.map((d) =>
          h('div', { key: d.id, style: S.row() },
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
      const { items, shopItems, skillList, agentList, settings, draft, setDraft, saveItem, setAgentPreset, busy } = props
      const picked = new Set(String(draft.skills || '').split(/[,，\s]+/).filter(Boolean))

      const toggleSkill = (name) => {
        const next = new Set(picked)
        if (next.has(name)) next.delete(name)
        else next.add(name)
        setDraft({ ...draft, skills: [...next].join(', ') })
      }

      const pickShopItem = (id) => {
        const hit = shopItems.find((it) => it.item_id === id)
        setDraft({ ...draft, itemId: id, title: hit ? hit.title : draft.title })
      }

      return h('div', null,
        h('div', { style: S.card },
          h('div', { style: { fontWeight: 600, marginBottom: '10px' } }, 'AI 客服 AGENT'),
          h('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-end' } },
            h('div', { style: { flex: 1 } },
              h('label', { style: S.label }, '绑定 Agent（Agent Manager 里创建的 preset；留空用 DSH 默认）'),
              h('select', {
                style: S.input,
                value: (settings && settings.agentPreset) || 'builtin',
                onChange: (e) => setAgentPreset(e.target.value),
              },
                h('option', { value: 'builtin' }, '内置客服（插件自带，默认）'),
                agentList.map((a) => h('option', { key: a.id, value: a.id }, `${a.name}（${a.id}）`)))),
            h('div', { style: { ...S.muted, width: '220px' } },
              agentList.length === 0 ? '没有找到已创建的 Agent' : `${agentList.length} 个可用`))),
        h('div', { style: S.card },
          h('div', { style: { fontWeight: 600, marginBottom: '10px' } }, '商品绑定技能'),
          h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' } },
            h('div', null,
              h('label', { style: S.label }, '选择商品'),
              h('select', {
                style: S.input,
                value: draft.itemId,
                onChange: (e) => pickShopItem(e.target.value),
              },
                h('option', { value: '' }, shopItems.length ? '请选择…' : '暂无在售商品，手动输入 ID'),
                shopItems.map((it) => h('option', { key: it.item_id, value: it.item_id }, `${it.title || '(无标题)'} · ${it.item_id}`)))),
            h('div', null,
              h('label', { style: S.label }, '商品 ID（可手动输入）'),
              h('input', { style: S.input, value: draft.itemId, onChange: (e) => setDraft({ ...draft, itemId: e.target.value }) }))),
          h('label', { style: S.label }, `勾选技能（已选 ${picked.size}，正文从技能的 SKILL.md 读取）`),
          skillList.length === 0
            ? h('div', { style: S.muted }, '没有扫描到已安装的技能')
            : h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '220px', overflow: 'auto', padding: '4px 0' } },
              skillList.map((s) => h('label', {
                key: s.name,
                title: s.description || s.name,
                style: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(127,127,127,.3)', background: picked.has(s.name) ? 'rgba(127,127,127,.16)' : 'transparent', fontSize: '13px' },
              },
                h('input', { type: 'checkbox', checked: picked.has(s.name), onChange: () => toggleSkill(s.name) }),
                s.name))),
          h('div', { style: { ...S.muted, marginTop: '8px' } }, '商品图片、文件、参数都写在技能里，回复时整段注入。'),
          h('div', { style: { marginTop: '10px' } },
            h('button', { style: S.btn, onClick: saveItem, disabled: !!busy }, busy === 'item' ? '保存中…' : '保存'))),
        items.length === 0
          ? h('div', { style: { ...S.muted, padding: '16px 0' } }, '还没有绑定技能的商品')
          : h('div', null,
            h('div', { style: { ...S.row(), ...S.th } },
              h('span', null, '商品'), h('span', null, '标题'), h('span', null, '技能'), h('span', null, '更新时间'), h('span', null, '')),
            items.map((it) =>
              h('div', { key: it.item_id, style: S.row() },
                h('span', { style: S.mono }, it.item_id),
                h('span', null, it.title || '-'),
                h('span', null, it.skills || '-'),
                h('span', { style: { fontSize: '12px', opacity: 0.8 } }, it.updated_at),
                h('span', null,
                  h('button', {
                    style: { ...S.btn, padding: '3px 8px', fontSize: '12px' },
                    onClick: () => setDraft({ itemId: it.item_id, title: it.title || '', skills: it.skills || '' }),
                  }, '编辑'))))))
    }

    const AVATAR_COLORS = ['#0f9d6e', '#2563eb', '#7c3aed', '#db2777', '#d97706', '#0891b2']

    function avatarOf(name) {
      const text = String(name || '?')
      let hash = 0
      for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
      return { letter: text.slice(0, 1).toUpperCase(), color: AVATAR_COLORS[hash % AVATAR_COLORS.length] }
    }

    function fmtTime(ts) {
      if (!ts) return ''
      const d = new Date(Number(ts))
      if (Number.isNaN(d.getTime())) return ''
      const now = new Date()
      return d.toDateString() === now.toDateString()
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString()
    }

    function Avatar({ name, size = 34 }) {
      const { letter, color } = avatarOf(name)
      return h('div', {
        style: {
          width: `${size}px`, height: `${size}px`, borderRadius: '50%', flex: 'none',
          background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: `${Math.round(size * 0.42)}px`, fontWeight: 600,
        },
      }, letter)
    }

    function ChatTab(props) {
      const { chats, activeChat, messages, replyText, setReplyText, onPick, onSend, onRefresh, busy, selfUserId } = props
      const bodyRef = useRef(null)
      useEffect(() => {
        const el = bodyRef.current
        if (el) el.scrollTop = el.scrollHeight
      }, [messages, activeChat])
      return h('div', { style: { display: 'grid', gridTemplateColumns: '280px 1fr', gap: '14px', height: 'calc(100vh - 280px)', minHeight: '440px' } },
        h('div', { style: { border: '1px solid rgba(127,127,127,.22)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '600px' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid rgba(127,127,127,.18)' } },
            h('span', { style: { fontWeight: 600, fontSize: '13px' } }, `会话（${chats.length}）`),
            h('button', { style: { ...S.btn, padding: '3px 10px', fontSize: '12px' }, onClick: onRefresh, disabled: busy === 'chats' }, busy === 'chats' ? '…' : '刷新')),
          h('div', { style: { overflow: 'auto', flex: 1 } },
            chats.length === 0 ? h('div', { style: S.empty }, '暂无会话') : null,
            chats.map((c) => {
              const active = activeChat && activeChat.session_id === c.session_id
              return h('div', {
                key: c.session_id,
                onClick: () => onPick(c),
                style: {
                  display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 12px', cursor: 'pointer',
                  borderBottom: '1px solid rgba(127,127,127,.1)',
                  background: active ? 'rgba(15,157,110,.10)' : 'transparent',
                },
              },
                h(Avatar, { name: c.peer_nick || c.peer_user_id }),
                h('div', { style: { flex: 1, minWidth: 0 } },
                  h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px' } },
                    h('span', { style: { fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, c.peer_nick || c.peer_user_id || c.session_id),
                    h('span', { style: { fontSize: '11px', opacity: 0.55, flex: 'none' } }, fmtTime(c.ts))),
                  h('div', { style: { fontSize: '12px', opacity: 0.65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' } }, c.last_msg || ''),
                ),
                c.unread > 0 ? h('span', { style: { flex: 'none', minWidth: '18px', height: '18px', borderRadius: '9px', background: '#dc2626', color: '#fff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' } }, String(c.unread)) : null
              )
            }))),
        h('div', { style: { display: 'flex', flexDirection: 'column', border: '1px solid rgba(127,127,127,.22)', borderRadius: '12px', overflow: 'hidden', minHeight: 0 } },
          activeChat === null
            ? h('div', { style: { ...S.empty, padding: '60px 0' } }, '选择左侧会话查看聊天记录')
            : [
              h('div', { key: 'head', style: { flex: 'none', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid rgba(127,127,127,.18)' } },
                h(Avatar, { name: activeChat.peer_nick || activeChat.peer_user_id, size: 28 }),
                h('span', { style: { fontWeight: 600, fontSize: '14px' } }, activeChat.peer_nick || activeChat.peer_user_id),
                h('span', { style: { ...S.muted, marginLeft: 'auto' } }, fmtTime(activeChat.ts))),
              h('div', { key: 'body', ref: bodyRef, style: { flex: 1, minHeight: 0, overflow: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' } },
                messages.length === 0 ? h('div', { style: S.empty }, '没有可显示的消息') : null,
                messages.map((m) => {
                  const mine = String(m.send_user_id) === String(selfUserId)
                  const text = (m.message && m.message.text && m.message.text.text) || (m.message && m.message.tip && m.message.tip.tip) || ''
                  if (!text) return null
                  return h('div', { key: m.message_id || `${m.created_at}-${text.length}`, style: { display: 'flex', gap: '8px', flexDirection: mine ? 'row-reverse' : 'row', alignItems: 'flex-start' } },
                    h(Avatar, { name: mine ? '我' : (m.send_user_name || activeChat.peer_nick), size: 28 }),
                    h('div', { style: { maxWidth: '70%' } },
                      h('div', { style: { padding: '8px 12px', borderRadius: '12px', background: mine ? '#0f9d6e' : 'rgba(127,127,127,.14)', color: mine ? '#fff' : 'inherit', fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, text),
                      h('div', { style: { fontSize: '11px', opacity: 0.5, textAlign: mine ? 'right' : 'left', marginTop: '3px' } }, fmtTime(m.created_at)))
                  )
                })),
              h('div', { key: 'compose', style: { flex: 'none', display: 'flex', gap: '8px', padding: '12px', borderTop: '1px solid rgba(127,127,127,.18)' } },
                h('input', {
                  style: S.input, value: replyText, placeholder: '回复买家…',
                  onChange: (e) => setReplyText(e.target.value),
                  onKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } },
                }),
                h('button', {
                  style: { ...S.btn, background: '#0f9d6e', color: '#fff', border: 'none', padding: '6px 16px', fontWeight: 600 },
                  onClick: onSend, disabled: busy === 'send' || !replyText.trim(),
                }, busy === 'send' ? '发送中…' : '发送')),
            ]
        )
      )
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
      const [auth, setAuth] = useState(null)
      const [settings, setSettings] = useState(null)
      const [skillList, setSkillList] = useState([])
      const [agentList, setAgentList] = useState([])
      const [shopItems, setShopItems] = useState([])
      const [chats, setChats] = useState([])
      const [activeChat, setActiveChat] = useState(null)
      const [chatMessages, setChatMessages] = useState([])
      const [replyText, setReplyText] = useState('')
      const [remoteOrders, setRemoteOrders] = useState([])
      const [remoteOrdersLoading, setRemoteOrdersLoading] = useState(false)
      const [accounts, setAccounts] = useState([])
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [draft, setDraft] = useState(EMPTY_CARD)
      const [loginOpen, setLoginOpen] = useState(false)
      const [login, setLogin] = useState({ state: 'idle' })

      const refresh = useCallback(async () => {
        try {
          // 每项单独容错：auth 拉起 worker 慢或失败时，不能把订单和发货记录一起清空。
          const safe = (p) => p.catch((err) => ({ __error: String(err.message || err) }))
          const [st, od, dl, cd, il, au, se, ac] = await Promise.all([
            safe(rpc({ op: 'status' })),
            safe(rpc({ op: 'orders', limit: 50 })),
            safe(rpc({ op: 'deliveries', limit: 100 })),
            safe(rpc({ op: 'cards' })),
            safe(rpc({ op: 'itemLinks' })),
            safe(rpc({ op: 'auth' })),
            safe(rpc({ op: 'settings' })),
            safe(rpc({ op: 'accounts' })),
          ])
          if (st && !st.__error) setStatus(st)
          if (od && !od.__error) setOrders(od)
          if (dl && !dl.__error) setDeliveries(dl)
          if (cd && !cd.__error) setCards(cd)
          if (il && !il.__error) setItems(il)
          if (au && !au.__error) setAuth(au)
          if (se && !se.__error) setSettings(se)
          if (ac && !ac.__error && Array.isArray(ac)) setAccounts(ac)
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

      async function switchAccount(unb) {
        if (!unb) return
        setBusy('switch')
        setNotice('')
        try {
          await rpc({ op: 'switchAccount', unb }, 60000)
          setRemoteOrders([])
          setChats([])
          setActiveChat(null)
          setChatMessages([])
          await refresh()
          setNotice(`已切换到 ${unb}`)
        } catch (err) {
          setError(String(err.message || err))
        } finally {
          setBusy('')
        }
      }

      async function doLogout() {
        setBusy('logout')
        setNotice('')
        try {
          await rpc({ op: 'logout' }, 30000)
          setAuth({ loading: false, valid: false, unb: '', tracknick: '' })
          setChats([])
          setActiveChat(null)
          setChatMessages([])
          await refresh()
          setNotice('已退出登录')
        } catch (err) {
          setError(String(err.message || err))
        } finally {
          setBusy('')
        }
      }

      async function setAgentPreset(value) {
        try {
          await rpc({ op: 'setSetting', key: 'ai.agentPreset', value })
          setSettings((s) => ({ ...(s || {}), agentPreset: value }))
          setNotice(value ? `AGENT 已切换为 ${value}` : 'AGENT 已恢复默认')
        } catch (err) {
          setError(String(err.message || err))
        }
      }

      async function loadChats() {
        setBusy('chats')
        try {
          const data = await rpc({ op: 'chats', fetchNum: 100 }, 60000)
          setChats((data && data.sessions) || [])
        } catch (err) {
          setError(String(err.message || err))
        } finally {
          setBusy('')
        }
      }

      async function loadChat(chat) {
        setActiveChat(chat)
        setChatMessages([])
        try {
          const list = await rpc({ op: 'history', cid: chat.session_id, limit: 200 }, 120000)
          setChatMessages(list || [])
        } catch (err) {
          setError(String(err.message || err))
        }
      }

      async function sendReply() {
        const text = replyText.trim()
        if (!text || !activeChat) return
        setBusy('send')
        try {
          await rpc({
            op: 'sendMessage',
            cid: activeChat.session_id,
            toid: activeChat.peer_user_id,
            itemId: activeChat.item_id || '',
            text,
          }, 60000)
          setReplyText('')
          await loadChat(activeChat)
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
        // 技能和 Agent 是本地扫描，只在挂载时读一次。
        void (async () => {
          try {
            const [s, a] = await Promise.all([rpc({ op: 'skills' }), rpc({ op: 'agents' })])
            setSkillList(s || [])
            setAgentList(a || [])
          } catch {
            // 扫描失败不影响其它面板
          }
        })()
      }, [])

      useEffect(() => {
        if (tab === 'chat' && chats.length === 0 && busy !== 'chats') void loadChats()
      }, [tab])

      async function loadRemoteOrders() {
        setRemoteOrdersLoading(true)
        try {
          const data = await rpc({ op: 'remoteOrders', queryCode: 'ALL' }, 60000)
          setRemoteOrders((data && data.orders) || [])
        } catch (err) {
          setError(String(err.message || err))
        } finally {
          setRemoteOrdersLoading(false)
        }
      }

      useEffect(() => {
        if (tab === 'orders' && remoteOrders.length === 0 && !remoteOrdersLoading) void loadRemoteOrders()
      }, [tab])

      useEffect(() => {
        // 商品列表要走闲鱼接口，只在第一次打开商品页时拉。
        if (tab !== 'items' || shopItems.length > 0 || busy === 'shop') return
        setBusy('shop')
        rpc({ op: 'shopItems', limit: 50 }, 60000)
          .then((r) => setShopItems((r && r.items) || []))
          .catch((err) => setError(String(err.message || err)))
          .finally(() => setBusy(''))
      }, [tab])

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

      const authLine = auth
        ? (auth.valid
          ? `已登录 ${auth.tracknick || auth.unb}${auth.tracknick && auth.unb ? `（unb ${auth.unb}）` : ''}`
          : (auth.error ? `未登录：${auth.error}` : '未登录'))
        : '正在读取登录态…'

      const meta = status
        ? `${authLine} · 轮询 ${status.config.pollSeconds}s · 实时 ${status.watch ? '开' : '关'} · AI 客服 ${status.ai ? '开' : '关'} · 可用卡密 ${status.cards} 张`
        : '正在读取状态…'

      return h('div', { style: S.page },
        h('div', { style: S.head },
          h('h2', { style: S.title }, '闲鱼自动客服'),
          h('span', {
            title: auth && auth.valid ? '已登录' : '未登录',
            style: { width: '8px', height: '8px', borderRadius: '50%', background: auth && auth.valid ? '#16a34a' : '#dc2626', flex: 'none' },
          }),
          accounts.length > 0 || (auth && auth.valid)
            ? h('select', {
              style: { padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(127,127,127,.3)', background: 'transparent', color: 'inherit', font: 'inherit', fontSize: '13px' },
              value: (auth && auth.unb) || '',
              disabled: busy === 'switch',
              title: '切换账号',
              onChange: (e) => switchAccount(e.target.value),
            },
              (auth && auth.valid) ? null : h('option', { value: '' }, '未登录'),
              accounts.map((a) => h('option', { key: a.unb, value: a.unb }, `${a.tracknick || a.unb}${a.unb === (auth && auth.unb) ? '（当前）' : ''}`)),
              (auth && auth.valid && auth.unb && !accounts.some((a) => a.unb === auth.unb))
                ? h('option', { value: auth.unb }, `${auth.tracknick || auth.unb}（当前）`)
                : null)
            : null,
          h('div', { style: { flex: 1 } }),
          h('button', { style: S.btn, onClick: openLogin }, '扫码登录'),
          (auth && auth.valid)
            ? h('button', {
              style: { ...S.btn, color: '#dc2626', borderColor: 'rgba(220,38,38,.4)' },
              onClick: doLogout, disabled: busy === 'logout',
            }, busy === 'logout' ? '退出中…' : '退出')
            : null,
          h('button', {
            style: { ...S.btn, background: '#0f9d6e', color: '#fff', border: 'none', fontWeight: 600 },
            onClick: runTick, disabled: !!busy,
          }, busy === 'tick' ? '处理中…' : '立即处理一轮')),
        h('div', { style: { ...S.muted, marginBottom: '14px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(127,127,127,.08)' } }, meta),
        error ? h('div', { style: S.err }, error) : null,
        notice ? h('div', { style: { ...S.muted, marginBottom: '10px' } }, notice) : null,
        h('div', { style: S.tabs },
          ['chat', 'orders', 'cards', 'items', 'deliveries'].map((k) =>
            h('div', { key: k, style: S.tab(tab === k), onClick: () => setTab(k) },
              { chat: '聊天', orders: '订单', cards: '卡券', items: '商品资料', deliveries: '发货记录' }[k]))),
        tab === 'chat' ? h(ChatTab, {
          chats, activeChat, messages: chatMessages, replyText, setReplyText,
          onPick: loadChat, onSend: sendReply, onRefresh: loadChats, busy,
          selfUserId: (auth && auth.unb) || '',
        }) : null,
        tab === 'orders' ? h(OrdersTab, {
          orders: remoteOrders, localOrders: orders,
          onRefresh: loadRemoteOrders, loading: remoteOrdersLoading,
        }) : null,
        tab === 'cards' ? h(CardsTab, { cards, draft, setDraft, addCard, busy }) : null,
        tab === 'items' ? h(ItemsTab, {
          items, shopItems, skillList, agentList, settings,
          draft: itemDraft, setDraft: setItemDraft, saveItem, setAgentPreset, busy,
        }) : null,
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

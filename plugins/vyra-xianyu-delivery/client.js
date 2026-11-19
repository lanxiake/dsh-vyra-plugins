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
                value: (settings && settings.agentPreset) || '',
                onChange: (e) => setAgentPreset(e.target.value),
              },
                h('option', { value: '' }, '默认（不指定 preset）'),
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
            h('div', { style: { ...S.row, ...S.th } },
              h('span', null, '商品'), h('span', null, '标题'), h('span', null, '技能'), h('span', null, '更新时间'), h('span', null, '')),
            items.map((it) =>
              h('div', { key: it.item_id, style: S.row },
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

    function ChatTab(props) {
      const { chats, activeChat, messages, replyText, setReplyText, onPick, onSend, onRefresh, busy, selfUserId } = props
      return h('div', { style: { display: 'grid', gridTemplateColumns: '260px 1fr', gap: '14px', minHeight: '420px' } },
        h('div', { style: { border: '1px solid rgba(127,127,127,.25)', borderRadius: '10px', overflow: 'auto', maxHeight: '560px' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid rgba(127,127,127,.2)' } },
            h('span', { style: { fontWeight: 600, fontSize: '13px' } }, '会话'),
            h('button', { style: { ...S.btn, padding: '2px 8px', fontSize: '12px' }, onClick: onRefresh, disabled: busy === 'chats' }, busy === 'chats' ? '…' : '刷新')),
          chats.length === 0 ? h('div', { style: { ...S.muted, padding: '12px' } }, '暂无会话') : null,
          chats.map((c) => h('div', {
            key: c.session_id,
            onClick: () => onPick(c),
            style: { padding: '9px 10px', borderBottom: '1px solid rgba(127,127,127,.12)', cursor: 'pointer', background: activeChat && activeChat.session_id === c.session_id ? 'rgba(127,127,127,.16)' : 'transparent' },
          },
            h('div', { style: { fontSize: '13px', fontWeight: 600 } }, c.peer_nick || c.peer_user_id || c.session_id),
            h('div', { style: { ...S.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, c.last_msg || '')))),
        h('div', { style: { display: 'flex', flexDirection: 'column', border: '1px solid rgba(127,127,127,.25)', borderRadius: '10px', minHeight: 0 } },
          activeChat === null
            ? h('div', { style: { ...S.muted, padding: '20px' } }, '选择左侧会话查看聊天记录')
            : h('div', { style: { flex: 1, overflow: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '480px' } },
              messages.map((m) => {
                const mine = String(m.send_user_id) === String(selfUserId)
                const text = (m.message && m.message.text && m.message.text.text) || (m.message && m.message.tip && m.message.tip.tip) || ''
                if (!text) return null
                return h('div', { key: m.message_id || `${m.created_at}-${text.length}`, style: { alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '72%' } },
                  h('div', { style: { padding: '7px 11px', borderRadius: '10px', background: mine ? 'rgba(46,160,67,.18)' : 'rgba(127,127,127,.14)', fontSize: '13px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, text),
                  h('div', { style: { fontSize: '11px', opacity: 0.55, textAlign: mine ? 'right' : 'left', marginTop: '2px' } }, new Date(Number(m.created_at) || 0).toLocaleString()))
              })),
          activeChat === null ? null : h('div', { style: { display: 'flex', gap: '8px', padding: '10px', borderTop: '1px solid rgba(127,127,127,.2)' } },
            h('input', { style: S.input, value: replyText, placeholder: '回复买家…', onChange: (e) => setReplyText(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } } }),
            h('button', { style: S.btn, onClick: onSend, disabled: busy === 'send' || !replyText.trim() }, busy === 'send' ? '发送中…' : '发送'))))
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
            rpc({ op: 'itemLinks' }),
            rpc({ op: 'auth' }),
            rpc({ op: 'settings' }),
          ])
          setStatus(results[0])
          setOrders(results[1])
          setDeliveries(results[2])
          setCards(results[3])
          setItems(results[4])
          setAuth(results[5])
          setSettings(results[6])
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
          const data = await rpc({ op: 'chats', fetchNum: 50 }, 60000)
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
          const list = await rpc({ op: 'history', cid: chat.session_id, limit: 30 }, 60000)
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
          h('button', { style: S.btn, onClick: openLogin }, '扫码登录'),
          h('button', { style: S.btn, onClick: runTick, disabled: !!busy },
            busy === 'tick' ? '处理中…' : '立即处理一轮')),
        h('div', { style: { ...S.muted, marginBottom: '12px' } }, meta),
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
        tab === 'orders' ? h(OrdersTab, { orders }) : null,
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

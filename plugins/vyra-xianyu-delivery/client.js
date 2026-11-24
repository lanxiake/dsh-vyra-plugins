// 闲鱼自动客服面板：侧边栏入口 + 订单/卡券/商品技能/发货记录四个标签页。
//
// 所有读写都走 host 的 /api/xianyu-delivery/rpc，前端不直接碰数据库或子进程。
window.__ModuleLoader__.load({
  id: 'dsh-vyra-xianyu-delivery',
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
        gridTemplateColumns: n === 7
          ? '1.5fr 1fr 1.5fr .7fr .8fr 1.4fr 1.1fr'
          : n === 6 ? '1.8fr 1fr .7fr .5fr 1.3fr 1.2fr' : '2fr 1.4fr 1fr 1fr 2fr',
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

    const EMPTY_CARD = { itemId: '', specName: '', specValue: '', content: '', mode: 'reuse', splitMode: 'sep' }

    // 订单失败原因的中文说明（数据库里存的是机器可读的 key）。
    const FAIL_TEXT = {
      no_card: '没有可用卡券',
      card_exhausted: '卡密已用完',
      ambiguous_card: '匹配到多张卡券',
      service_auto_deliver_off: '客服配置里关闭了自动发货',
      zero_amount: '0 元订单',
      refund: '买家退款中',
      generate_unavailable: '未启用生成型卡券',
      generate_empty: '网盘技能没有返回链接',
    }
    function failText(reason) {
      const key = String(reason || '')
      if (FAIL_TEXT[key]) return FAIL_TEXT[key]
      if (/has no provider\/model/i.test(key)) return '没有可用模型：请设置默认模型'
      if (/FAIL_SYS_TOKEN_EXOIRED|令牌过期/i.test(key)) return '登录已过期，请重新扫码'
      if (/未登录|AuthRequired/i.test(key)) return '未登录，请先扫码登录'
      if (key.startsWith('sensitive:')) return `含敏感词：${key.slice(10)}`
      if (key.startsWith('generate_failed:')) {
        const detail = key.slice(16)
        if (detail === 'empty-reply') return '生成失败：网盘技能没有返回链接'
        if (/agent-unavailable|agents-unavailable/.test(detail)) return '生成失败：DSH Agent 不可用'
        return `生成失败：${detail}`
      }
      if (key.startsWith('send:')) return `发送失败：${key.slice(5)}`
      return key
    }

    const DEFAULT_SERVICE_PROMPT = [
      '你是闲鱼店铺「weflow 聊天记录导出」的客服。语气自然、简短，像真人卖家。',
      '',
      '商品信息：',
      '- 名称：weflow 聊天记录导出',
      '- 价格：1.99 元',
      '- 交付：拍下后自动发送下载链接和提取码',
      '- 支持：Windows 电脑端，微信 4.0+，可多账号切换',
      '- 功能：聊天记录导出、通讯录导出、聊天记录分析、用户画像',
      '',
      '常见问题：',
      '- 能导出什么：聊天记录、通讯录、图片、文件，可按时间或联系人筛选',
      '- 怎么用：拍下后收到链接和提取码，下载解压即可使用',
      '- 支持 Mac 吗：暂只支持 Windows',
      '- 会不会封号：工具只读取本地数据，不修改微信，正常使用没问题',
      '- 能退款吗：虚拟商品已发货不支持退款，拍前可以先问',
      '- 没收到：先核对订单号和付款状态，再补发',
      '',
      '规则：',
      '- 不降价，2 块钱交个朋友',
      '- 不确定的版本或功能，让买家拍前确认',
      '- 不提"插件""外挂""破解"，说"工具""小助手"',
      '- 不发微信、QQ 等外部联系方式',
      '- 不承诺法律效力',
      '- 不提"AI""机器人""自动回复"',
    ].join('\n')

    const DEFAULT_DELIVER_TEMPLATE = '{card}\n有效期 7 天，过期联系我补。'

    function OrdersTab(props) {
      const { orders, localOrders, onRefresh, loading, onDetail } = props
      const list = orders.length ? orders : localOrders
      const when = (o) => o.updated_at || o.created_at || ''

      // 平台已发货 / 交易成功，或插件已完成的订单，不再显示历史失败原因。
      const showFail = (o) => {
        if (!o.fail_reason) return false
        const platform = String(o.status || '')
        const local = String(o.local_state || o.state || '')
        if (/已发货|交易成功|已完成/.test(platform)) return false
        if (/^(completed|sent)$/.test(local)) return false
        return true
      }

      // 平台状态优先：用户手动在闲鱼发货后，本地 blocked 不应盖过「已发货」。
      const renderState = (o) => {
        const platform = String(o.status || '')
        const local = String(o.local_state || o.state || '')
        const platformDone = /已发货|交易成功|已完成/.test(platform)
        if (platformDone) {
          return h('span', { style: S.tag('completed') },
            `${platform}${local && local !== 'completed' ? ` · 插件 ${local}` : ''}`)
        }
        if (local) {
          return h('span', { style: S.tag(local) }, `${local}${o.delivered ? ` ${o.delivered}张` : ''}`)
        }
        return h('span', { style: S.tag(platform) }, platform || '未处理')
      }

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
              h('div', {
                key: o.order_no,
                style: { ...S.row(6), cursor: 'pointer' },
                title: '点击查看订单详情',
                onClick: () => onDetail && onDetail(o),
              },
                h('span', { style: S.mono, title: o.order_no }, o.order_no),
                h('span', { title: o.buyer_nick || o.buyer_id || '' }, o.buyer_nick || o.buyer_id || '-'),
                h('span', null, o.amount ? `¥${o.amount}` : '-'),
                h('span', null, String(o.quantity || 1)),
                h('span', { title: o.fail_reason || '' },
                  renderState(o),
                  showFail(o)
                    ? h('div', { style: { fontSize: '11px', color: '#dc2626', marginTop: '2px' } }, failText(o.fail_reason))
                    : null),
                h('span', { style: { fontSize: '12px', opacity: 0.7 } }, when(o))
              )
            )
          )
      )
    }

    // 卡券页：左边是已配置的卡券，右边是编辑器。模式决定字段和示例，
    // 所以每种模式给的是它自己的输入方式和真实样例，而不是同一个空文本框。
    function CardsTab(props) {
      const { cards, shopItems = [], draft, setDraft, saveCard, editingId, onEdit, onToggle, onRemove, onCancelEdit, busy } = props

      const titleOf = (itemId) => {
        const hit = shopItems.find((it) => it.item_id === itemId)
        return hit ? (hit.title || hit.item_id) : itemId
      }

      const MODES = {
        reuse: {
          name: '复用链接',
          hint: '一条网盘分享链接，所有订单发同一份，不消耗',
          sample: '链接：https://pan.quark.cn/s/1cc79adb8f0e?pwd=xfrJ\n提取码：xfrJ\n有效期 7 天，过期联系我补。',
          needContent: true,
        },
        pool: {
          name: '多条库存',
          hint: '多条内容排成池子，每发一单消耗一条',
          sample: '链接：https://pan.quark.cn/s/aaaa?pwd=1111\n提取码：1111\n---\n链接：https://pan.quark.cn/s/bbbb?pwd=2222\n提取码：2222',
          needContent: true,
        },
        generate: {
          name: '每单生成',
          hint: '每笔订单调用夸克网盘技能，现做一条新链接',
          sample: '',
          needContent: false,
        },
      }
      const mode = draft.mode || 'reuse'
      const meta = MODES[mode] || MODES.reuse
      const isEditing = Boolean(editingId)

      // 池型两种粘贴方式：--- 分隔（一条内容可以多行），或每行一条（卡密列表）。
      const splitByLine = draft.splitMode === 'line'
      const blocks = splitByLine
        ? String(draft.content || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
        : String(draft.content || '').split(/\r?\n\s*---\s*\r?\n/).map((s) => s.trim()).filter(Boolean)

      // 买家实际会收到什么：用第一条内容 + 样例变量渲染。
      const previewCard = mode === 'generate'
        ? '链接：https://pan.quark.cn/s/新生成?pwd=xxxx\n提取码：xxxx\n有效期 7 天'
        : (blocks[0] || meta.sample.split('\n---\n')[0] || '（还没有内容）')
      const previewText = previewCard.replace(/\{card\}/g, previewCard)

      const panel = { border: '1px solid rgba(127,127,127,.22)', borderRadius: '12px', padding: '16px', background: 'rgba(127,127,127,.03)' }
      const tiny = { fontSize: '12px', opacity: 0.62, lineHeight: 1.6 }

      const stockCell = (c) => {
        if (c.mode === 'generate') return h('span', { style: { ...S.muted } }, '按需生成')
        if (c.mode === 'reuse') {
          return h('span', { style: { ...S.muted, color: c.remaining ? '#0f9d6e' : '#dc2626' } },
            c.remaining ? '可用，不消耗' : '内容为空')
        }
        const total = Number(c.total) || 0
        const left = Number(c.remaining) || 0
        const pct = total ? Math.max(0, Math.min(100, (left / total) * 100)) : 0
        return h('div', { style: { minWidth: '96px' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' } },
            h('span', { style: { color: left ? 'inherit' : '#dc2626' } }, `剩 ${left}`),
            h('span', { style: { opacity: 0.55 } }, `共 ${total}`)),
          h('div', { style: { height: '4px', borderRadius: '2px', background: 'rgba(127,127,127,.18)', overflow: 'hidden' } },
            h('div', { style: { width: `${pct}%`, height: '100%', background: '#0f9d6e' } })))
      }

      const modeCard = (value) => {
        const m = MODES[value]
        const active = mode === value
        return h('button', {
          key: value,
          onClick: () => setDraft({ ...draft, mode: value }),
          'aria-pressed': active,
          style: {
            flex: '1 1 0', minWidth: '150px', textAlign: 'left', cursor: 'pointer',
            padding: '10px 12px', borderRadius: '10px', font: 'inherit', color: 'inherit',
            border: `1px solid ${active ? '#0f9d6e' : 'rgba(127,127,127,.28)'}`,
            background: active ? 'rgba(15,157,110,.08)' : 'transparent',
          },
        },
          h('div', { style: { fontWeight: 600, fontSize: '13px', color: active ? '#0f9d6e' : 'inherit' } }, m.name),
          h('div', { style: { ...tiny, marginTop: '3px' } }, m.hint))
      }

      const editor = h('div', { style: panel },
        h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' } },
          h('div', { style: { fontWeight: 600, fontSize: '14px' } }, isEditing ? '编辑卡券' : '新建卡券'),
          isEditing ? h('button', { style: { ...S.btn, padding: '3px 8px', fontSize: '12px' }, onClick: onCancelEdit }, '取消') : null),

        h('label', { style: S.label }, '商品'),
        h('select', {
          style: { ...S.input, marginBottom: '10px' },
          value: draft.itemId,
          onChange: (e) => setDraft({ ...draft, itemId: e.target.value }),
        },
          h('option', { value: '' }, shopItems.length ? '选择商品…' : '暂无在售商品'),
          shopItems.map((it) => h('option', { key: it.item_id, value: it.item_id }, `${it.title || '(无标题)'} · ${it.item_id}`))),

        h('div', { style: { display: 'flex', gap: '8px', marginBottom: '10px' } },
          h('div', { style: { flex: 1 } },
            h('label', { style: S.label }, '规格名'),
            h('input', { style: S.input, value: draft.specName, placeholder: '不填 = 通用', onChange: (e) => setDraft({ ...draft, specName: e.target.value }) })),
          h('div', { style: { flex: 1 } },
            h('label', { style: S.label }, '规格值'),
            h('input', { style: S.input, value: draft.specValue, placeholder: '不填 = 通用', onChange: (e) => setDraft({ ...draft, specValue: e.target.value }) }))),

        h('label', { style: S.label }, '发货方式'),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' } },
          ['reuse', 'pool', 'generate'].map(modeCard)),

        meta.needContent
          ? h('div', null,
            h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' } },
              h('label', { style: S.label }, mode === 'pool' ? '库存内容' : '发给买家的内容'),
              h('div', { style: { display: 'flex', gap: '4px', alignItems: 'center' } },
                mode === 'pool' ? [
                  ['sep', '--- 分隔'],
                  ['line', '每行一条'],
                ].map(([value, label]) => h('button', {
                  key: value,
                  onClick: () => setDraft({ ...draft, splitMode: value }),
                  title: value === 'line' ? '适合直接粘贴一大段卡密，每行是一条' : '一条内容可以有多行（如链接 + 提取码），用单独一行 --- 隔开',
                  style: {
                    ...S.btn, padding: '1px 8px', fontSize: '12px',
                    color: ((draft.splitMode === 'line') ? 'line' : 'sep') === value ? '#0f9d6e' : 'inherit',
                    border: 'none', background: 'transparent',
                  },
                }, label)) : null,
                h('button', {
                  style: { ...S.btn, padding: '1px 8px', fontSize: '12px', border: 'none', background: 'transparent', color: '#0f9d6e' },
                  title: '把这一种模式的样例填进输入框',
                  onClick: () => setDraft({ ...draft, content: meta.sample }),
                }, '填入示例'))),
            h('textarea', {
              style: { ...S.area, minHeight: '120px', fontFamily: mode === 'pool' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit' },
              value: draft.content,
              placeholder: mode === 'reuse'
                ? '链接：https://pan.quark.cn/s/xxxx?pwd=abcd\n提取码：abcd\n有效期 7 天，过期联系我补。'
                : (splitByLine
                  ? 'CARD-A1B2-C3D4\nCARD-E5F6-G7H8\n（一行一条，直接粘贴）'
                  : '链接：https://pan.quark.cn/s/aaaa?pwd=1111\n提取码：1111\n---\n链接：https://pan.quark.cn/s/bbbb?pwd=2222\n提取码：2222'),
              onChange: (e) => setDraft({ ...draft, content: e.target.value }),
            }),
            mode === 'pool'
              ? h('div', { style: { ...tiny, marginTop: '6px', color: blocks.length ? '#0f9d6e' : undefined } },
                blocks.length ? `已识别 ${blocks.length} 条库存，每单消耗 1 条` : '还没有识别到库存：用单独一行 --- 分隔每一条')
              : h('div', { style: { ...tiny, marginTop: '6px' } }, '所有订单都发这一段，内容不会被消耗。'))
          : h('div', { style: { border: '1px dashed rgba(127,127,127,.35)', borderRadius: '10px', padding: '12px', marginBottom: '4px' } },
            h('div', { style: { fontSize: '13px', fontWeight: 600, marginBottom: '6px' } }, '夸克网盘 · 自动生成'),
            h('div', { style: tiny }, '每笔订单调用内置的 quarkclouddrive 技能：新建分享链接，有效期 7 天、单次访问，然后把链接和提取码发给买家。'),
            h('div', { style: { ...tiny, marginTop: '6px' } }, '需要本机已配置夸克网盘 CLI 的登录态；生成失败时订单会标记为「生成失败」并保留原因，不会当作已发货。')),

        h('div', { style: { marginTop: '14px' } },
          h('div', { style: { ...S.label, marginBottom: '6px' } }, '买家会收到'),
          h('div', {
            style: {
              border: '1px solid rgba(127,127,127,.2)', borderRadius: '12px', borderTopLeftRadius: '4px',
              padding: '10px 12px', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap',
              background: 'rgba(127,127,127,.08)', maxWidth: '92%', wordBreak: 'break-word',
            },
          }, previewText)),

        h('div', { style: { marginTop: '14px', display: 'flex', gap: '8px', alignItems: 'center' } },
          h('button', {
            style: { ...S.btn, background: '#0f9d6e', color: '#fff', border: 'none', padding: '7px 18px', fontWeight: 600 },
            onClick: saveCard,
            disabled: !!busy,
          }, busy === 'add' ? '保存中…' : (isEditing ? '保存修改' : '添加卡券')),
          h('span', { style: tiny }, '一个商品只绑一张启用的卡券')))

      const list = h('div', { style: { flex: '1 1 340px', minWidth: '300px' } },
        h('div', { style: { ...S.muted, marginBottom: '8px' } }, cards.length ? `${cards.length} 张卡券` : '还没有卡券'),
        cards.length === 0
          ? h('div', { style: { ...panel, textAlign: 'center', padding: '28px 16px' } },
            h('div', { style: { fontSize: '13px', marginBottom: '6px' } }, '还没有配置发货内容'),
            h('div', { style: tiny }, '先选一个商品，再把网盘链接粘到右边。一条链接就能开始自动发货。'))
          : cards.map((c) => h('div', {
            key: c.id,
            style: {
              ...panel, padding: '12px 14px', marginBottom: '8px',
              borderLeft: `3px solid ${c.enabled ? '#0f9d6e' : 'rgba(127,127,127,.35)'}`,
              opacity: c.enabled ? 1 : 0.7,
            },
          },
            h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' } },
              h('div', { style: { flex: 1, fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: c.item_id },
                titleOf(c.item_id)),
              h('span', { style: { ...tiny, flex: 'none' } }, MODES[c.mode] ? MODES[c.mode].name : '池型')),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('div', { style: { fontSize: '12px', opacity: 0.75, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: c.content || '' },
                  c.mode === 'generate' ? '每单调用网盘技能生成新链接' : (String(c.content || '').split(/\r?\n/)[0] || '（内容为空）')),
                h('div', { style: { ...tiny, marginBottom: '4px' } }, c.spec_value ? `规格 ${c.spec_value}` : '通用（不限规格）'),
                stockCell(c)),
              h('div', { style: { display: 'flex', gap: '4px', flex: 'none' } },
                h('button', { style: { ...S.btn, padding: '3px 8px', fontSize: '12px' }, onClick: () => onEdit(c) }, '编辑'),
                h('button', {
                  style: {
                    ...S.btn, padding: '3px 8px', fontSize: '12px',
                    color: c.enabled ? '#d97706' : '#16a34a',
                    borderColor: c.enabled ? 'rgba(217,119,6,.35)' : 'rgba(22,163,74,.35)',
                  },
                  onClick: () => onToggle(c),
                }, c.enabled ? '停用' : '启用'),
                h('button', { style: { ...S.btn, padding: '3px 8px', fontSize: '12px', color: '#dc2626', borderColor: 'rgba(220,38,38,.35)' }, onClick: () => onRemove(c) }, '删除'))))))

      return h('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' } },
        list,
        h('div', { style: { flex: '1 1 380px', minWidth: '320px' } }, editor))
    }

    function DeliveriesTab(props) {
      const { deliveries, onDetail } = props
      const note = h('div', { style: { ...S.muted, marginBottom: '10px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(127,127,127,.06)' } },
        '这里只显示插件自动发货发出的消息；你在闲鱼 App 里手动发出的消息不在其中。点任意一行看订单详情。')
      if (!deliveries.length) return h('div', null, note, h('div', { style: S.empty }, '暂无发货记录'))
      return h('div', null, note,
        h('div', { style: S.tableWrap },
          h('div', { style: { ...S.row(7), ...S.th } },
            h('span', null, '订单号'), h('span', null, '买家'), h('span', null, '商品'),
            h('span', null, '金额'), h('span', null, '结果'), h('span', null, '内容'), h('span', null, '时间')),
          deliveries.map((d) =>
            h('div', {
              key: d.id,
              style: { ...S.row(7), cursor: d.order_no ? 'pointer' : 'default' },
              title: d.content ? `发货内容：${d.content}` : '',
              onClick: () => d.order_no && onDetail && onDetail({ order_no: d.order_no }),
            },
              h('span', { style: S.mono, title: d.order_no }, d.order_no),
              h('span', { title: d.buyer_id || '' }, d.buyer_id || '-'),
              h('span', { title: d.item_title || d.delivery_item_id || '' }, d.item_title || d.delivery_item_id || '-'),
              h('span', null, d.amount ? `¥${d.amount}` : '-'),
              h('span', { title: d.error || '' },
                h('span', { style: S.tag(d.send_state) }, d.send_state),
                d.error ? h('div', { style: { fontSize: '11px', color: '#dc2626', marginTop: '2px', whiteSpace: 'normal' } }, failText(d.error)) : null),
              h('span', { style: { ...S.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, d.content),
              h('span', { style: { fontSize: '12px', opacity: 0.8 } }, d.created_at)
            )
          )
        )
      )
    }

    function ItemsTab(props) {
      const { items, shopItems, services = [], onDetail, onConfigure, loading } = props
      const linked = new Map(items.map((it) => [it.item_id, it]))
      return h('div', null,
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' } },
          h('span', { style: S.muted }, `在售商品 ${shopItems.length} 个`),
          loading ? h('span', { style: S.muted }, '读取中…') : null),
        shopItems.length === 0
          ? h('div', { style: S.empty }, '暂无在售商品')
          : h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' } },
            shopItems.map((it) => {
              const cfg = linked.get(it.item_id)
              const svc = cfg && cfg.service_id ? services.find((x) => x.id === cfg.service_id) : null
              return h('div', {
                key: it.item_id,
                style: { border: '1px solid rgba(127,127,127,.22)', borderRadius: '12px', overflow: 'hidden', background: 'rgba(127,127,127,.04)', cursor: 'pointer' },
                onClick: () => onDetail(it),
              },
                h('div', { style: { aspectRatio: '1 / 1', background: 'rgba(127,127,127,.12)', overflow: 'hidden' } },
                  it.image_url
                    ? h('img', { src: it.image_url, alt: it.title, loading: 'lazy', style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } })
                    : h('div', { style: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 } }, '无图')),
                h('div', { style: { padding: '10px 12px' } },
                  h('div', { style: { fontSize: '13px', fontWeight: 600, lineHeight: 1.35, height: '2.7em', overflow: 'hidden' } }, it.title || '(无标题)'),
                  h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' } },
                    h('span', { style: { color: '#ff5000', fontWeight: 700, fontSize: '15px' } }, it.price || ''),
                    h('span', { style: { fontSize: '12px', opacity: 0.6 } }, it.status || '')),
                  h('div', { style: { display: 'flex', gap: '6px', marginTop: '8px', alignItems: 'center' } },
                    h('span', { style: S.tag(svc && svc.enabled ? 'completed' : '') },
              svc ? svc.name : '未绑客服'),
                    h('button', {
                      style: { marginLeft: 'auto', ...S.btn, padding: '3px 10px', fontSize: '12px' },
                      onClick: (e) => { e.stopPropagation(); onConfigure(it) },
                    }, '绑定客服'))))
            }))
      )
    }

    function AgentConfigDialog({ item, agents, skills, current, onSave, onClose }) {
      const [agent, setAgent] = useState(current.agentPreset || 'builtin')
      const [aiOn, setAiOn] = useState(current.ai_enabled === 1)
      const [picked, setPicked] = useState(new Set(String(current.skills || '').split(/[,，\s]+/).filter(Boolean)))
      const [busy, setBusy] = useState(false)
      const [skillQuery, setSkillQuery] = useState('')
      const q = skillQuery.trim().toLowerCase()
      const filtered = skills.filter((s) => !q
        || String(s.name || '').toLowerCase().includes(q)
        || String(s.description || '').toLowerCase().includes(q))
      const toggle = (name) => {
        const next = new Set(picked)
        if (next.has(name)) next.delete(name)
        else next.add(name)
        setPicked(next)
      }
      const chip = {
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '8px',
        cursor: 'pointer', border: '1px solid rgba(127,127,127,.3)', fontSize: '13px', background: 'transparent',
      }
      return h('div', { style: S.mask, onClick: onClose },
        h('div', {
          style: { ...S.modal, width: 'min(720px, 92vw)', maxHeight: '84vh', display: 'flex', flexDirection: 'column', textAlign: 'left' },
          onClick: (e) => e.stopPropagation(),
        },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' } },
            h('h3', { style: { ...S.title, fontSize: '16px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
              `AI 配置 · ${item.title || item.item_id}`),
            h('button', { style: S.btn, onClick: onClose }, '关闭')),
          h('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '12px' } },
            h('input', { type: 'checkbox', checked: aiOn, onChange: (e) => setAiOn(e.target.checked) }),
            '为该商品开启 AI 自动回复'),
          h('label', { style: S.label }, 'AGENT'),
          h('select', { style: S.input, value: agent, onChange: (e) => setAgent(e.target.value) },
            h('option', { value: 'builtin' }, '内置客服（插件自带）'),
            agents.map((a) => h('option', { key: a.id, value: a.id }, `${a.name}（${a.id}）`))),
          h('div', { style: { ...S.muted, marginTop: '6px' } }, '需要新的 Agent 可以到「智能体管理」创建，再回这里选择。'),
          h('label', { style: { ...S.label, marginTop: '14px' } }, `技能（已选 ${picked.size} / 共 ${skills.length}）`),
          h('input', {
            style: { ...S.input, marginTop: '6px' },
            placeholder: '搜索技能名称或描述…',
            value: skillQuery,
            onChange: (e) => setSkillQuery(e.target.value),
          }),
          h('div', { style: { flex: 1, overflow: 'auto', marginTop: '8px', border: '1px solid rgba(127,127,127,.2)', borderRadius: '8px', maxHeight: '320px' } },
            filtered.length === 0
              ? h('div', { style: { ...S.muted, padding: '12px' } }, skills.length === 0 ? '没有扫描到已安装的技能' : '没有匹配的技能')
              : filtered.map((s) => h('div', {
                key: s.name,
                style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderBottom: '1px solid rgba(127,127,127,.1)' },
              },
                h('input', { type: 'checkbox', checked: picked.has(s.name), onChange: () => toggle(s.name) }),
                h('div', { style: { flex: 1, minWidth: 0 } },
                  h('div', { style: { fontSize: '13px', fontWeight: 600 } }, s.name),
                  h('div', { style: { fontSize: '12px', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, s.description || '无描述')),
                h('button', {
                  style: { ...S.btn, padding: '2px 8px', fontSize: '12px', flex: 'none' },
                  title: '打开技能所在位置',
                  onClick: () => { rpc({ op: 'openSkillDir', name: s.name }).catch(() => {}) },
                }, '打开')))),
          h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' } },
            h('button', { style: S.btn, onClick: onClose }, '取消'),
            h('button', {
              style: { ...S.btn, background: '#0f9d6e', color: '#fff', border: 'none', fontWeight: 600 },
              disabled: busy,
              onClick: async () => {
                setBusy(true)
                try { await onSave(item, agent, [...picked].join(', '), aiOn ? 1 : 0) } finally { setBusy(false) }
              },
            }, busy ? '保存中…' : '保存')))
      )
    }

    function ItemDetailDialog({ item, onClose }) {
      const [state, setState] = useState({ loading: true, error: '', data: null })
      useEffect(() => {
        let alive = true
        rpc({ op: 'itemDetail', itemId: item.item_id }, 60000)
          .then((data) => { if (alive) setState({ loading: false, error: '', data }) })
          .catch((err) => { if (alive) setState({ loading: false, error: String(err.message || err), data: null }) })
        return () => { alive = false }
      }, [item.item_id])
      const d = state.data || {}
      const raw = (d.raw && d.raw.data) || {}
      const it = raw.itemDO || {}
      const img = (it.imageInfos && it.imageInfos[0] && it.imageInfos[0].url) || item.image_url || ''
      return h('div', { style: S.mask, onClick: onClose },
        h('div', {
          style: { ...S.modal, width: 'min(760px, 92vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', textAlign: 'left' },
          onClick: (e) => e.stopPropagation(),
        },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' } },
            h('h3', { style: { ...S.title, fontSize: '16px', flex: 1 } }, '商品详情'),
            h('button', { style: S.btn, onClick: onClose }, '关闭')),
          state.loading
            ? h('div', { style: S.empty }, '读取中…')
            : state.error
              ? h('div', { style: { color: '#dc2626', fontSize: '13px' } }, state.error)
              : h('div', { style: { overflow: 'auto' } },
                h('div', { style: { display: 'flex', gap: '14px' } },
                  img ? h('img', { src: img, alt: d.title, style: { width: '220px', height: '220px', objectFit: 'cover', borderRadius: '10px', flex: 'none' } }) : null,
                  h('div', { style: { flex: 1, minWidth: 0 } },
                    h('div', { style: { fontSize: '16px', fontWeight: 700, lineHeight: 1.4 } }, d.title || item.title),
                    h('div', { style: { color: '#ff5000', fontSize: '22px', fontWeight: 700, marginTop: '8px' } }, d.price ? `¥${d.price}` : ''),
                    h('div', { style: { ...S.muted, marginTop: '6px' } }, [d.status, d.category, d.location].filter(Boolean).join(' · ')),
                    h('div', { style: { ...S.muted, marginTop: '4px' } },
                      `库存 ${it.quantity ?? '-'} · 想要 ${it.wantCnt ?? 0} · 浏览 ${it.browseCnt ?? 0}`))),
                h('div', { style: { marginTop: '14px', fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--dsw-alias-label-primary)' } },
                  d.description || it.desc || '暂无描述'))
        ))
    }
    function OrderDetailDialog({ orderId, onClose }) {
      const [state, setState] = useState({ loading: true, error: '', data: null })
      useEffect(() => {
        let alive = true
        rpc({ op: 'orderDetail', orderId }, 60000)
          .then((data) => { if (alive) setState({ loading: false, error: '', data }) })
          .catch((err) => { if (alive) setState({ loading: false, error: String(err.message || err), data: null }) })
        return () => { alive = false }
      }, [orderId])

      const d = state.data || {}
      const comps = d.components || []
      const statusInfo = (comps[0] && comps[0].data && comps[0].data.orderStatusInfo) || {}
      const itemData = (comps[1] && comps[1].data) || {}
      const item = itemData.itemInfo || {}
      const orderInfo = itemData.orderInfoList || []
      const priceInfo = itemData.priceInfo || {}
      const countdown = (statusInfo.descRichText || []).map((x) => x.text || '').join('')

      const card = (children) => h('div', {
        style: {
          border: '1px solid rgba(127,127,127,.18)', borderRadius: '12px', padding: '14px 16px',
          marginBottom: '12px', background: 'rgba(127,127,127,.03)',
        },
      }, children)

      return h('div', { style: S.mask, onClick: onClose },
        h('div', {
          style: { ...S.modal, width: 'min(680px, 92vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', textAlign: 'left', padding: '18px 20px' },
          onClick: (e) => e.stopPropagation(),
        },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' } },
            h('h3', { style: { ...S.title, fontSize: '16px', flex: 1 } }, '订单详情'),
            h('button', { style: S.btn, onClick: onClose }, '关闭')),
          h('div', { style: { overflow: 'auto', flex: 1 } },
            state.loading ? h('div', { style: S.empty }, '读取中…')
              : state.error ? h('div', { style: { color: '#dc2626', fontSize: '13px' } }, state.error)
                : [
                  card(h('div', { style: { display: 'flex', gap: '16px', alignItems: 'center' } },
                    h('div', { style: { flex: 1 } },
                      h('div', { style: { fontSize: '17px', fontWeight: 700, color: '#ff6a00' } }, statusInfo.title || '订单状态未知'),
                      countdown ? h('div', { style: { fontSize: '13px', color: '#ff8c00', marginTop: '6px' } }, countdown) : null),
                    statusInfo.rightImageUrl ? h('img', { src: statusInfo.rightImageUrl, alt: '', style: { width: '54px', height: '54px', flex: 'none' } }) : null)),
                  card(h('div', { style: { display: 'flex', gap: '12px' } },
                    item.itemMainPictCdnUrl ? h('img', { src: item.itemMainPictCdnUrl, alt: item.title, style: { width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', flex: 'none' } }) : null,
                    h('div', { style: { flex: 1, minWidth: 0 } },
                      h('div', { style: { fontSize: '14px', fontWeight: 600, lineHeight: 1.4 } }, item.title || ''),
                      item.skuInfo ? h('div', { style: { ...S.muted, marginTop: '4px' } }, item.skuInfo) : null,
                      h('div', { style: { marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } },
                        h('span', { style: { color: '#ff5000', fontWeight: 700 } }, item.price ? `¥${item.price}` : ''),
                        h('span', { style: S.muted }, `× ${item.buyAmount || 1}`))),
                    h('div', { style: { width: '110px', textAlign: 'right', flex: 'none' } },
                      h('div', { style: { ...S.muted } }, (priceInfo.amount && priceInfo.amount.title) || '成交价'),
                      h('div', { style: { fontSize: '16px', fontWeight: 700, marginTop: '4px' } }, (priceInfo.amount && priceInfo.amount.value) || item.price || '')))),
                  card(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                    orderInfo.map((row, i) => h('div', { key: i, style: { display: 'flex', gap: '12px', fontSize: '13px' } },
                      h('span', { style: { width: '84px', flex: 'none', opacity: 0.6 } }, row.title || ''),
                      h('span', { style: { flex: 1, wordBreak: 'break-all' } }, row.value || ''))))),
                ]))
      )
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

    function Avatar({ name, src, size = 34 }) {
      if (src) {
        return h('img', {
          src, alt: name || '', loading: 'lazy',
          style: { width: `${size}px`, height: `${size}px`, borderRadius: '50%', flex: 'none', objectFit: 'cover', background: 'rgba(127,127,127,.15)' },
          onError: (e) => { e.currentTarget.style.display = 'none' },
        })
      }
      const { letter, color } = avatarOf(name)
      return h('div', {
        style: {
          width: `${size}px`, height: `${size}px`, borderRadius: '50%', flex: 'none',
          background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: `${Math.round(size * 0.42)}px`, fontWeight: 600,
        },
      }, letter)
    }

    function ServicesTab(props) {
      const { services, items, onEdit, onCreate, onDelete } = props
      const countOf = (id) => items.filter((it) => it.service_id === id).length
      return h('div', null,
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } },
          h('span', { style: S.muted }, `客服配置 ${services.length} 个（全局共享，所有账号通用）`),
          h('button', {
            style: { ...S.btn, background: '#0f9d6e', color: '#fff', border: 'none', fontWeight: 600 },
            onClick: onCreate,
          }, '新建客服')),
        services.length === 0
          ? h('div', { style: S.empty }, '还没有客服配置')
          : h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' } },
            services.map((s) => h('div', {
              key: s.id,
              style: { border: '1px solid rgba(127,127,127,.22)', borderRadius: '12px', padding: '14px 16px', background: 'rgba(127,127,127,.04)' },
            },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                h('span', { style: { fontWeight: 700, fontSize: '15px' } }, s.name),
                h('span', { style: S.tag(s.enabled ? 'completed' : '') }, s.enabled ? '启用' : '停用')),
              h('div', { style: { ...S.muted, marginTop: '8px' } },
                `技能 ${String(s.skills || '').split(/[,，\s]+/).filter(Boolean).length} · 商品 ${countOf(s.id)} · ${s.auto_deliver ? '自动发货' : '不自动发货'}`),
              h('div', { style: { display: 'flex', gap: '6px', marginTop: '12px' } },
                h('button', { style: S.btn, onClick: () => onEdit(s) }, '编辑'),
                h('button', { style: { ...S.btn, color: '#dc2626', borderColor: 'rgba(220,38,38,.35)' }, onClick: () => onDelete(s) }, '删除')))))
      )
    }

    function ServiceDialog({ service, skills, toolNames = [], models = [], onSave, onDelete, onClose, busy }) {
      const fallback = {
        name: '闲鱼客服',
        system_prompt: DEFAULT_SERVICE_PROMPT,
        skills: 'baidu-drive, quarkclouddrive, xianyu-customer-service',
        model: '',
        auto_deliver: 1,
        deliver_template: DEFAULT_DELIVER_TEMPLATE,
        tools: '',
        enabled: 1,
      }
      const draft = service || fallback
      const [name, setName] = useState(draft.name || '')
      const [prompt, setPrompt] = useState(draft.system_prompt || '')
      const [model, setModel] = useState(draft.model || '')
      const [template, setTemplate] = useState(draft.deliver_template || '')
      const [autoDeliver, setAutoDeliver] = useState(draft.auto_deliver !== 0)
      const [enabled, setEnabled] = useState(draft.enabled !== 0)
      const [picked, setPicked] = useState(new Set(String(draft.skills || '').split(/[,，\s]+/).filter(Boolean)))
      const toolName = (tool) => (typeof tool === 'string' ? tool : tool.name)
      const [toolPicked, setToolPicked] = useState(() => {
        const fromDraft = String(draft.tools || '').split(/[,，\s]+/).filter(Boolean)
        return new Set(fromDraft.length ? fromDraft : toolNames.map(toolName))
      })
      const [query, setQuery] = useState('')
      const [saving, setSaving] = useState(false)
      const q = query.trim().toLowerCase()
      const filtered = skills.filter((s) => !q
        || String(s.name || '').toLowerCase().includes(q)
        || String(s.description || '').toLowerCase().includes(q))

      const toggle = (key) => {
        const next = new Set(picked)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        setPicked(next)
      }

      const toggleTool = (key) => {
        const next = new Set(toolPicked)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        setToolPicked(next)
      }

      const field = (label, node) => h('div', { style: { marginBottom: '10px' } },
        h('label', { style: S.label }, label), node)

      return h('div', { style: S.mask, onClick: onClose },
        h('div', {
          style: { ...S.modal, width: 'min(760px, 92vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', textAlign: 'left' },
          onClick: (e) => e.stopPropagation(),
        },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' } },
            h('h3', { style: { ...S.title, fontSize: '16px', flex: 1 } }, service ? '编辑客服' : '新建客服'),
            h('button', { style: S.btn, onClick: onClose }, '关闭')),
          h('div', { style: { overflow: 'auto', flex: 1 } },
            field('名称', h('input', { style: S.input, value: name, placeholder: '例如：闲鱼客服·主号', onChange: (e) => setName(e.target.value) })),
            h('div', { style: { display: 'flex', gap: '16px', marginBottom: '10px' } },
              h('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' } },
                h('input', { type: 'checkbox', checked: enabled, onChange: (e) => setEnabled(e.target.checked) }), '启用'),
              h('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' } },
                h('input', { type: 'checkbox', checked: autoDeliver, onChange: (e) => setAutoDeliver(e.target.checked) }), '自动发货')),
            field('系统提示词（留空用内置客服）',
              h('textarea', { style: S.area, value: prompt, placeholder: '角色、议价底线、发货/退款规则…', onChange: (e) => setPrompt(e.target.value) })),
            field('模型（留空用 profile 默认）',
              h('select', { style: S.input, value: model, onChange: (e) => setModel(e.target.value) },
                h('option', { value: '' }, '默认（profile 模型）'),
                models.map((m) => h('option', { key: `${m.provider}:${m.id}`, value: `${m.provider}:${m.id}` },
                  `${m.name}（${m.provider}）`)))),
            field('发货文案模板（可选，留空直接发卡券原文）',
              h('textarea', { style: S.area, value: template, placeholder: '可用 {card} {order_no} {buyer_nick}', onChange: (e) => setTemplate(e.target.value) })),
            h('label', { style: S.label }, `技能（已选 ${picked.size} / 共 ${skills.length}）`),
            h('input', { style: { ...S.input, marginTop: '6px' }, placeholder: '搜索技能名称或描述…', value: query, onChange: (e) => setQuery(e.target.value) }),
            h('div', { style: { marginTop: '8px', border: '1px solid rgba(127,127,127,.2)', borderRadius: '8px', maxHeight: '220px', overflow: 'auto' } },
              filtered.length === 0
                ? h('div', { style: { ...S.muted, padding: '12px' } }, skills.length === 0 ? '没有扫描到已安装的技能' : '没有匹配的技能')
                : filtered.map((s) => h('div', {
                  key: s.name,
                  style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderBottom: '1px solid rgba(127,127,127,.1)' },
                },
                  h('input', { type: 'checkbox', checked: picked.has(s.name), onChange: () => toggle(s.name) }),
                  h('div', { style: { flex: 1, minWidth: 0 } },
                    h('div', { style: { fontSize: '13px', fontWeight: 600 } }, s.name),
                    h('div', { style: { fontSize: '12px', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, s.description || '无描述')),
                  h('button', {
                    style: { ...S.btn, padding: '2px 8px', fontSize: '12px', flex: 'none' },
                    onClick: () => { rpc({ op: 'openSkillDir', name: s.name }).catch(() => {}) },
                  }, '打开'))))),
          h('label', { style: { ...S.label, marginTop: '14px' } }, `可调用工具（已选 ${toolPicked.size} / 共 ${toolNames.length}）`),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' } },
            toolNames.length === 0
              ? h('div', { style: S.muted }, '没有可用工具')
              : toolNames.map((tool) => {
                const name = toolName(tool)
                return h('label', {
                  key: name,
                  title: tool.description || name,
                  style: {
                    display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '3px 8px',
                    borderRadius: '6px', border: '1px solid rgba(127,127,127,.3)',
                    background: toolPicked.has(name) ? 'rgba(15,157,110,.12)' : 'transparent',
                  },
                },
                  h('input', { type: 'checkbox', checked: toolPicked.has(name), onChange: () => toggleTool(name) }),
                  name)
              })),
          h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' } },
            service ? h('button', {
              style: { ...S.btn, color: '#dc2626', marginRight: 'auto' },
              disabled: saving,
              onClick: async () => { setSaving(true); try { await onDelete(service) } finally { setSaving(false) } },
            }, '删除') : null,
            h('button', { style: S.btn, onClick: onClose }, '取消'),
            h('button', {
              style: { ...S.btn, background: '#0f9d6e', color: '#fff', border: 'none', fontWeight: 600 },
              disabled: saving || !name.trim(),
              onClick: async () => {
                setSaving(true)
                try {
                  await onSave({
                    id: service ? service.id : 0,
                    name: name.trim(),
                    systemPrompt: prompt,
                    skills: [...picked].join(', '),
                    model,
                    autoDeliver,
                    deliverTemplate: template,
                    tools: [...toolPicked].join(', '),
                    enabled,
                  })
                } finally {
                  setSaving(false)
                }
              },
            }, saving ? '保存中…' : '保存')))
      )
    }
    function BindServiceDialog({ item, services, current, onSave, onClose }) {
      const [serviceId, setServiceId] = useState(Number(current.service_id) || 0)
      return h('div', { style: S.mask, onClick: onClose },
        h('div', { style: { ...S.modal, width: '440px', textAlign: 'left' }, onClick: (e) => e.stopPropagation() },
          h('h3', { style: { ...S.title, fontSize: '16px', marginBottom: '12px' } }, `绑定客服 · ${item.title || item.item_id}`),
          h('select', { style: S.input, value: serviceId, onChange: (e) => setServiceId(Number(e.target.value)) },
            h('option', { value: 0 }, '不绑定（不自动回复）'),
            services.map((s) => h('option', { key: s.id, value: s.id }, s.name))),
          h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' } },
            h('button', { style: S.btn, onClick: onClose }, '取消'),
            h('button', {
              style: { ...S.btn, background: '#0f9d6e', color: '#fff', border: 'none', fontWeight: 600 },
              onClick: () => onSave(item, serviceId),
            }, '保存')))
      )
    }

    function MessageContent({ message, mine }) {
      const c = message || {}
      const bubble = {
        padding: '8px 12px', borderRadius: '12px', fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        background: mine ? '#0f9d6e' : 'rgba(127,127,127,.13)', color: mine ? '#fff' : 'inherit',
      }
      if (c.text && c.text.text) return h('div', { style: bubble }, c.text.text)
      if (c.tip && c.tip.tip) {
        // 系统提示里带 HTML 片段（<a size=13 data-intent=...>），按纯文本显示。
        const plain = String(c.tip.tip).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        return h('div', { style: { fontSize: '12px', opacity: 0.6, textAlign: 'center', padding: '4px 0' } }, plain)
      }
      if (c.dxCard) {
        const main = (c.dxCard.item && c.dxCard.item.main) || {}
        const ex = main.exContent || {}
        const title = main.title || ex.title || ex.text || '卡片消息'
        const desc = main.desc || ex.desc || ''
        const pic = main.picUrl || ex.picUrl || ''
        const btn = (ex.button && (ex.button.text || '')) || ''
        // 订单卡片：标题 + 说明 + 按钮文案，一眼能看出是「已拍下 / 待付款」还是「已付款」。
        return h('div', {
          style: { border: '1px solid rgba(127,127,127,.25)', borderRadius: '10px', overflow: 'hidden', maxWidth: '280px', background: 'rgba(127,127,127,.06)' },
          title: desc || title,
        },
          pic ? h('img', { src: pic, alt: title, style: { width: '100%', display: 'block' } }) : null,
          h('div', { style: { padding: '9px 11px' } },
            h('div', { style: { fontSize: '13px', fontWeight: 600 } }, title),
            desc ? h('div', { style: { fontSize: '12px', opacity: 0.6, marginTop: '3px', lineHeight: 1.5 } }, desc) : null,
            btn ? h('div', {
              style: {
                marginTop: '8px', fontSize: '12px', textAlign: 'center', padding: '5px 0',
                borderRadius: '6px', background: '#ffe60f', color: '#333', fontWeight: 600,
              },
            }, btn) : null))
      }
      const img = (c.image && (c.image.picUrl || c.image.url)) || c.picUrl || c.imageUrl
      if (img) return h('img', { src: img, alt: '图片', style: { maxWidth: '220px', borderRadius: '10px', display: 'block' } })
      return h('div', { style: { ...bubble, opacity: 0.6 } }, '[暂不支持的消息类型]')
    }

    function ChatTab(props) {
      const { chats: rawChats, activeChat, messages, replyText, setReplyText, onPick, onSend, onRefresh, busy, selfUserId, avatars = {} } = props
      const chats = [...rawChats].sort((a, b) => (b.ts || 0) - (a.ts || 0))
      const bodyRef = useRef(null)
      useEffect(() => {
        const el = bodyRef.current
        if (el) el.scrollTop = el.scrollHeight
      }, [messages, activeChat])
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
        h('div', { style: { display: 'grid', gridTemplateColumns: '280px 1fr', gap: '14px', height: 'calc(100vh - 400px)', minHeight: '400px' } },
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
                h(Avatar, { name: c.peer_nick || c.peer_user_id, src: avatars[c.session_id] }),
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
                h(Avatar, { name: activeChat.peer_nick || activeChat.peer_user_id, src: avatars[activeChat.session_id], size: 28 }),
                h('div', { style: { flex: 1, minWidth: 0 } },
                  h('div', { style: { fontWeight: 600, fontSize: '14px' } }, activeChat.peer_nick || activeChat.peer_user_id),
                  activeChat.item_title ? h('div', { style: { ...S.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, activeChat.item_title) : null),
                h('span', { style: { ...S.muted, flex: 'none' } }, fmtTime(activeChat.ts))),
              h('div', { key: 'body', ref: bodyRef, style: { flex: 1, minHeight: 0, overflow: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' } },
                messages.length === 0 ? h('div', { style: S.empty }, '没有可显示的消息') : null,
                messages.map((m) => {
                  const mine = String(m.send_user_id) === String(selfUserId)
                  const c = m.message || {}
                  const isTip = Boolean(c.tip && c.tip.tip) && !(c.text && c.text.text)
                  const key = m.message_id || `${m.created_at}-${Object.keys(c).join('')}`
                  if (isTip) {
                    return h('div', { key, style: { textAlign: 'center' } }, h(MessageContent, { message: c, mine }))
                  }
                  return h('div', { key, style: { display: 'flex', gap: '8px', flexDirection: mine ? 'row-reverse' : 'row', alignItems: 'flex-start' } },
                    h(Avatar, { name: mine ? '我' : (m.send_user_name || activeChat.peer_nick), src: mine ? '' : avatars[activeChat.session_id], size: 28 }),
                    h('div', { style: { maxWidth: '70%' } },
                      h(MessageContent, { message: c, mine }),
                      h('div', { style: { fontSize: '11px', opacity: 0.5, textAlign: mine ? 'right' : 'left', marginTop: '3px' } }, fmtTime(m.created_at)))
                  )
                })),
              h('div', { key: 'compose', style: { flex: 'none', display: 'flex', gap: '8px', padding: '12px', borderTop: '1px solid rgba(127,127,127,.18)' } },
                h('button', {
                  style: { ...S.btn, padding: '6px 10px', flex: 'none' },
                  title: '插入表情（闲鱼把 [表情名] 当表情渲染）',
                  onClick: () => setReplyText(`${replyText}[微笑]`),
                }, '😊'),
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
      ),
        h('div', { style: { border: '1px solid rgba(127,127,127,.18)', borderRadius: '8px', padding: '10px 12px' } },
          h('div', { style: { fontWeight: 600, fontSize: '13px', marginBottom: '6px' } }, '最近消息处理（诊断）'),
          (props.events || []).length === 0
            ? h('div', { style: S.muted }, '还没有收到消息事件；如果刚发过消息，看顶部「实时」是否为「开」')
            : h('div', null,
              props.events.slice(0, 8).map((e, i) => h('div', {
                key: i,
                style: { display: 'grid', gridTemplateColumns: '.8fr .6fr 1.2fr 1.4fr', gap: '10px', padding: '5px 0', fontSize: '12px', opacity: 0.8, borderTop: i ? '1px solid rgba(127,127,127,.08)' : 'none' },
              },
                h('span', null, e.at),
                h('span', null, e.kind),
                h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, e.from || e.cid || ''),
                h('span', null, e.action))))))
    }

    function InfoDialog({ title, loading, error, data, onClose }) {
      return h('div', { style: S.mask, onClick: onClose },
        h('div', {
          style: { ...S.modal, width: 'min(720px, 92vw)', maxHeight: '82vh', display: 'flex', flexDirection: 'column', textAlign: 'left' },
          onClick: (e) => e.stopPropagation(),
        },
          h('div', { style: { display: 'flex', alignItems: 'center', marginBottom: '10px', gap: '10px' } },
            h('h3', { style: { ...S.title, fontSize: '16px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, title),
            h('button', { style: S.btn, onClick: onClose }, '关闭')),
          loading
            ? h('div', { style: S.empty }, '读取中…')
            : error
              ? h('div', { style: { color: '#dc2626', fontSize: '13px' } }, error)
              : h('pre', {
                style: {
                  flex: 1, overflow: 'auto', margin: 0, fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word', background: 'rgba(127,127,127,.06)', borderRadius: '8px', padding: '12px',
                },
              }, JSON.stringify(data, null, 2))))
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

    // 开始使用：把「能不能用」拆成几件能点的事，不懂技术也能照着做。
    function StartTab(props) {
      const { steps, shopItems = [], onLogin, onGo, onQuickSetup, busy, notice } = props
      const [itemId, setItemId] = useState('')
      const [content, setContent] = useState('')
      const [mode, setMode] = useState('reuse')
      const [local, setLocal] = useState('')

      const s = steps || {}
      const rows = [
        {
          key: 'login', done: Boolean(s.loggedIn),
          title: '登录闲鱼账号',
          hint: s.loggedIn ? `已登录 ${s.account || ''}` : '用小号扫码，插件要靠它收发消息',
          action: s.loggedIn ? null : { label: '扫码登录', onClick: onLogin },
        },
        {
          key: 'service', done: Number(s.serviceCount) > 0,
          title: '有一个客服配置',
          hint: '决定 Agent 用什么提示词、哪些技能和工具',
          action: { label: '去客服页', onClick: () => onGo('services') },
        },
        {
          key: 'bind', done: Number(s.boundCount) > 0,
          title: '商品绑定到客服',
          hint: '买家问这个商品时走对应客服',
          action: { label: '去商品页', onClick: () => onGo('items') },
        },
        {
          key: 'card', done: Number(s.cardCount) > 0,
          title: '配置发货内容',
          hint: '网盘链接或卡密，拍下自动发',
          action: { label: '去卡券页', onClick: () => onGo('cards') },
        },
        {
          key: 'im', done: Boolean(s.imReady),
          title: '消息通道已连接',
          hint: Boolean(s.imReady) ? `自动回复${s.watchOn ? '已开启' : '只在轮询'} · AI 客服${s.aiOn ? '可用' : '不可用'}` : '正在连接，稍等几秒',
          action: null,
        },
      ]
      const doneCount = rows.filter((r) => r.done).length
      const panel = { border: '1px solid rgba(127,127,127,.22)', borderRadius: '12px', padding: '16px', background: 'rgba(127,127,127,.03)' }

      const submit = async () => {
        if (!itemId) { setLocal('先选一个商品'); return }
        if (mode !== 'generate' && !content.trim()) { setLocal('把网盘链接粘进来'); return }
        setLocal('')
        await onQuickSetup({ itemId, content: content.trim(), mode })
      }

      return h('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' } },
        h('div', { style: { flex: '1 1 360px', minWidth: '320px' } },
          h('div', { style: { ...panel, marginBottom: '12px' } },
            h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '10px' } },
              h('div', { style: { fontWeight: 600 } }, '准备情况'),
              h('div', { style: { ...S.muted } }, `${doneCount} / ${rows.length}`)),
            rows.map((r) => h('div', {
              key: r.key,
              style: { display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 0', borderTop: '1px solid rgba(127,127,127,.1)' },
            },
              h('span', {
                style: {
                  width: '18px', height: '18px', borderRadius: '50%', flex: 'none', fontSize: '11px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: r.done ? '#0f9d6e' : 'rgba(127,127,127,.18)',
                  color: r.done ? '#fff' : 'inherit',
                },
              }, r.done ? '✓' : ''),
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('div', { style: { fontSize: '13px', fontWeight: r.done ? 400 : 600 } }, r.title),
                h('div', { style: { fontSize: '12px', opacity: 0.6 } }, r.hint)),
              r.action ? h('button', { style: { ...S.btn, padding: '3px 10px', fontSize: '12px', flex: 'none' }, onClick: r.action.onClick }, r.action.label) : null))),

          notice ? h('div', { style: { ...S.muted, marginBottom: '10px' } }, notice) : null),

        h('div', { style: { flex: '1 1 380px', minWidth: '320px' } },
          h('div', { style: panel },
            h('div', { style: { fontWeight: 600, marginBottom: '4px' } }, '一键配置一个商品'),
            h('div', { style: { fontSize: '12px', opacity: 0.6, marginBottom: '12px' } },
              '选商品、粘链接，剩下的（客服、绑定、卡券）自动完成。'),
            h('label', { style: S.label }, '商品'),
            h('select', {
              style: { ...S.input, marginBottom: '10px' },
              value: itemId,
              onChange: (e) => setItemId(e.target.value),
            },
              h('option', { value: '' }, shopItems.length ? '选择商品…' : '暂无在售商品'),
              shopItems.map((it) => h('option', { key: it.item_id, value: it.item_id }, `${it.title || '(无标题)'} · ${it.item_id}`))),
            h('label', { style: S.label }, '发货方式'),
            h('div', { style: { display: 'flex', gap: '6px', marginBottom: '10px' } },
              [['reuse', '复用链接'], ['pool', '多条库存'], ['generate', '每单生成']].map(([value, label]) => h('button', {
                key: value,
                onClick: () => setMode(value),
                style: {
                  ...S.btn, padding: '3px 10px', fontSize: '12px',
                  color: mode === value ? '#0f9d6e' : undefined,
                  borderColor: mode === value ? '#0f9d6e' : undefined,
                },
              }, label))),
            mode === 'generate'
              ? h('div', { style: { fontSize: '12px', opacity: 0.6, marginBottom: '10px' } }, '每单调用夸克网盘技能生成新链接，不用填内容。')
              : h('div', null,
                h('label', { style: S.label }, mode === 'pool' ? '库存内容（每条之间用 --- 分隔）' : '网盘链接'),
                h('textarea', {
                  style: { ...S.area, minHeight: '90px' },
                  value: content,
                  placeholder: '链接：https://pan.quark.cn/s/xxxx?pwd=abcd\n提取码：abcd',
                  onChange: (e) => setContent(e.target.value),
                })),
            local ? h('div', { style: { color: '#dc2626', fontSize: '12px', margin: '8px 0' } }, local) : null,
            h('button', {
              style: { ...S.btn, marginTop: '12px', background: '#0f9d6e', color: '#fff', border: 'none', fontWeight: 600, width: '100%', padding: '8px' },
              onClick: submit,
              disabled: !!busy,
            }, busy === 'quick' ? '配置中…' : '一键配置')),
          h('div', { style: { fontSize: '12px', opacity: 0.55, marginTop: '10px', lineHeight: 1.7 } },
            '配置完成后，买家拍下会自动发货，咨询由客服 Agent 回复。卡券和客服都可以在各自页面继续微调。')))
    }

    function XianyuDelivery() {
      const [tab, setTab] = useState('start')
      const autoJumped = useRef(false)
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
      const [models, setModels] = useState([])
      const [shopItems, setShopItems] = useState([])
      const [chats, setChats] = useState([])
      const [activeChat, setActiveChat] = useState(null)
      const [chatMessages, setChatMessages] = useState([])
      const [replyText, setReplyText] = useState('')
      const [remoteOrders, setRemoteOrders] = useState([])
      const [remoteOrdersLoading, setRemoteOrdersLoading] = useState(false)
      const [accounts, setAccounts] = useState([])
      const [services, setServices] = useState([])
      const [editingCard, setEditingCard] = useState(null)
      const [events, setEvents] = useState([])
      const [serviceDialog, setServiceDialog] = useState(null)
      const [bindItem, setBindItem] = useState(null)
      const [avatars, setAvatars] = useState({})
      const [selfAvatar, setSelfAvatar] = useState('')
      const [orderDetailId, setOrderDetailId] = useState(null)
      const [itemDetailItem, setItemDetailItem] = useState(null)
      const [agentConfig, setAgentConfig] = useState(null)
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [draft, setDraft] = useState(EMPTY_CARD)
      const [loginOpen, setLoginOpen] = useState(false)
      const [login, setLogin] = useState({ state: 'idle' })
      const [steps, setSteps] = useState(null)

      const refresh = useCallback(async () => {
        try {
          // 每项单独容错：auth 拉起 worker 慢或失败时，不能把订单和发货记录一起清空。
          const safe = (p) => p.catch((err) => ({ __error: String(err.message || err) }))
          const [st, od, dl, cd, il, au, se, ac, sv, ev, ck] = await Promise.all([
            safe(rpc({ op: 'status' })),
            safe(rpc({ op: 'orders', limit: 50 })),
            safe(rpc({ op: 'deliveries', limit: 100 })),
            safe(rpc({ op: 'cards' })),
            safe(rpc({ op: 'itemLinks' })),
            safe(rpc({ op: 'auth' })),
            safe(rpc({ op: 'settings' })),
            safe(rpc({ op: 'accounts' })),
            safe(rpc({ op: 'services' })),
            safe(rpc({ op: 'events' })),
            safe(rpc({ op: 'checklist' })),
          ])
          if (st && !st.__error) setStatus(st)
          if (od && !od.__error) setOrders(od)
          if (dl && !dl.__error) setDeliveries(dl)
          if (cd && !cd.__error) setCards(cd)
          if (il && !il.__error) setItems(il)
          if (au && !au.__error) setAuth(au)
          if (se && !se.__error) setSettings(se)
          if (ac && !ac.__error && Array.isArray(ac)) setAccounts(ac)
          if (sv && !sv.__error && Array.isArray(sv)) setServices(sv)
          if (ev && !ev.__error && Array.isArray(ev)) setEvents(ev)
          if (ck && !ck.__error) {
            setSteps(ck)
            // 配置齐全的人自动进聊天页，不用每次落在引导页。
            if (!autoJumped.current && ck.loggedIn && ck.serviceCount > 0 && ck.cardCount > 0) {
              autoJumped.current = true
              setTab('chat')
            }
          }
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

      async function quickSetup({ itemId, content, mode }) {
        setBusy('quick')
        setNotice('')
        try {
          const result = await rpc({ op: 'quickSetup', itemId, content, mode }, 120000)
          setNotice(`已配置：客服 #${result.serviceId} · 卡券 #${result.cardId}`)
          await refresh()
        } catch (err) {
          setError(String(err.message || err))
        } finally {
          setBusy('')
        }
      }

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

      function openOrderDetail(order) { setOrderDetailId(order.order_no) }

      function openItemDetail(item) { setItemDetailItem(item) }

      function editCard(card) {
        setEditingCard(card.id)
        setDraft({
          itemId: card.item_id,
          specName: card.spec_name || '',
          specValue: card.spec_value || '',
          content: card.content || '',
          mode: card.mode || 'pool',
          splitMode: 'sep',
        })
        setTab('cards')
      }

      async function saveCard() {
        const mode = draft.mode || 'reuse'
        if (!draft.itemId) { setNotice('商品必填'); return }
        if (mode !== 'generate' && !String(draft.content || '').trim()) {
          setNotice('卡券内容必填')
          return
        }
        // 池型选了「每行一条」时，存库前统一转成 --- 分隔的标准格式。
        const content = mode === 'pool' && draft.splitMode === 'line'
          ? String(draft.content || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).join('\n---\n')
          : draft.content
        setBusy('add')
        try {
          if (editingCard) {
            await rpc({ op: 'updateCard', id: editingCard, name: draft.itemId, content, specName: draft.specName, specValue: draft.specValue, mode })
            setEditingCard(null)
            setDraft(EMPTY_CARD)
            setNotice('卡券已更新')
          } else {
            await rpc({ op: 'addCard', itemId: draft.itemId, specName: draft.specName, specValue: draft.specValue, name: draft.itemId, type: 'data', content, mode })
            setDraft(EMPTY_CARD)
            setNotice('卡券已添加')
          }
          await refresh()
        } catch (err) {
          setError(String(err.message || err))
        } finally {
          setBusy('')
        }
      }

      async function toggleCard(card) {
        try {
          await rpc({ op: 'updateCard', id: card.id, enabled: card.enabled ? 0 : 1 })
          await refresh()
        } catch (err) {
          setError(String(err.message || err))
        }
      }

      async function removeCard(card) {
        if (typeof window !== 'undefined' && window.confirm && !window.confirm('删除这张卡券？')) return
        try {
          await rpc({ op: 'deleteCard', id: card.id })
          if (editingCard === card.id) {
            setEditingCard(null)
            setDraft(EMPTY_CARD)
          }
          await refresh()
        } catch (err) {
          setError(String(err.message || err))
        }
      }

      async function saveService(data) {
        try {
          await rpc({ op: 'saveService', ...data })
          setServiceDialog(null)
          setNotice('客服配置已保存')
          await refresh()
        } catch (err) {
          setError(String(err.message || err))
        }
      }

      async function removeService(service) {
        if (!service) return
        if (typeof window !== 'undefined' && window.confirm && !window.confirm(`删除客服「${service.name}」？绑定它的商品会解除绑定。`)) return
        try {
          await rpc({ op: 'deleteService', id: service.id })
          setServiceDialog(null)
          await refresh()
        } catch (err) {
          setError(String(err.message || err))
        }
      }

      async function bindService(item, serviceId) {
        try {
          await rpc({ op: 'setItemService', itemId: item.item_id, serviceId })
          setBindItem(null)
          await refresh()
        } catch (err) {
          setError(String(err.message || err))
        }
      }

      async function saveAgentConfig(item, agent, skills, aiEnabled = 0) {
        try {
          await rpc({ op: 'setSetting', key: 'ai.agentPreset', value: agent })
          await rpc({ op: 'setItem', itemId: item.item_id, title: item.title || '', skills, aiEnabled })
          setSettings((s) => ({ ...(s || {}), agentPreset: agent }))
          setAgentConfig(null)
          setNotice('AI 配置已保存')
          await refresh()
        } catch (err) {
          setError(String(err.message || err))
        }
      }

      async function toggleAi() {
        const next = status && status.ai ? '0' : '1'
        try {
          await rpc({ op: 'setSetting', key: 'ai.enabled', value: next })
          setStatus((s) => (s ? { ...s, ai: next === '1' } : s))
          setNotice(next === '1' ? 'AI 客服已开启' : 'AI 客服已关闭')
        } catch (err) {
          setError(String(err.message || err))
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
          const next = (data && data.sessions) || []
          // 增量合并：没变化的会话复用原对象，避免整表重渲染和闪烁。
          setChats((prev) => {
            const old = new Map(prev.map((c) => [c.session_id, c]))
            return next.map((s) => {
              const before = old.get(s.session_id)
              return before && before.ts === s.ts && before.unread === s.unread && before.peer_nick === s.peer_nick
                ? before
                : s
            })
          })
        } catch (err) {
          setError(String(err.message || err))
        } finally {
          setBusy('')
        }
      }

      async function loadChat(chat, keepMessages = false) {
        setActiveChat(chat)
        if (!keepMessages) setChatMessages([])
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
            const [s, a, m] = await Promise.all([
              rpc({ op: 'skills' }),
              rpc({ op: 'agents' }),
              rpc({ op: 'models' }, 60000),
            ])
            setSkillList(s || [])
            setAgentList(a || [])
            setModels(m || [])
          } catch {
            // 扫描失败不影响其它面板
          }
        })()
      }, [])

      useEffect(() => {
        if (tab !== 'chat') return undefined
        void loadChats()
        const timer = setInterval(() => { void loadChats() }, 10000)
        return () => clearInterval(timer)
      }, [tab])

      // 会话列表刷新后，当前打开的会话有新消息就重拉正文（不清空，避免闪）。
      useEffect(() => {
        if (!activeChat) return
        const next = chats.find((c) => c.session_id === activeChat.session_id)
        if (next && next.ts !== activeChat.ts) void loadChat(next, true)
      }, [chats])

      // 头像走 user.query 接口，逐个补；先补列表前 15 个，串行避免风控。
      useEffect(() => {
        if (tab !== 'chat' || chats.length === 0) return undefined
        let alive = true
        void (async () => {
          for (const c of chats.slice(0, 15)) {
            if (!c.session_id) continue
            try {
              const info = await rpc({ op: 'userInfo', cid: c.session_id }, 30000)
              if (!alive) return
              if (info && info.avatar) setAvatars((prev) => ({ ...prev, [c.session_id]: info.avatar }))
            } catch {
              // 单个头像失败不影响列表
            }
          }
        })()
        return () => { alive = false }
      }, [tab, chats.length])

      // 当前账号头像：借任意一个会话查 owner 资料。
      useEffect(() => {
        if (!(auth && auth.valid) || chats.length === 0 || selfAvatar) return undefined
        let alive = true
        void (async () => {
          try {
            const info = await rpc({ op: 'userInfo', cid: chats[0].session_id, owner: true }, 30000)
            if (alive && info && info.avatar) setSelfAvatar(info.avatar)
          } catch {
            // 查不到就继续用首字头像
          }
        })()
        return () => { alive = false }
      }, [auth && auth.unb, chats.length])

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
        if ((tab !== 'items' && tab !== 'cards') || shopItems.length > 0 || busy === 'shop') return
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
        ? `${authLine} · 轮询 ${status.config.pollSeconds}s · AI 客服 ${status.ai ? '开' : '关'} · 可用卡密 ${status.cards} 张`
        : '正在读取状态…'

      const toggleWatch = async () => {
        try {
          await rpc({ op: 'setWatch', enabled: !status.watchEnabled })
          await refresh()
        } catch (err) {
          setError(String(err.message || err))
        }
      }
      const watchChip = status
        ? h('span', {
          role: 'button',
          title: status.watchEnabled ? '点击关闭实时监听（只用轮询）' : '点击开启实时监听',
          onClick: toggleWatch,
          style: {
            cursor: 'pointer', padding: '1px 8px', borderRadius: '999px', marginLeft: '6px',
            border: '1px solid ' + (status.watch ? 'rgba(15,157,110,.45)' : 'rgba(127,127,127,.35)'),
            background: status.watch ? 'rgba(15,157,110,.14)' : 'transparent',
            color: status.watch ? '#0f9d6e' : 'inherit',
            fontWeight: 600,
          },
        }, `实时 ${status.watch ? '开' : '关'}`)
        : null

      return h('div', { style: S.page },
        h('div', { style: S.head },
          h('h2', { style: S.title }, '闲鱼自动客服'),
          (auth && auth.valid)
            ? h(Avatar, { name: auth.tracknick || auth.unb, src: selfAvatar, size: 28 })
            : h('span', {
              title: '未登录',
              style: { width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626', flex: 'none' },
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
            title: '立即轮询一次待发货订单并发货，不用等下一次自动轮询',
            onClick: runTick, disabled: !!busy,
          }, busy === 'tick' ? '处理中…' : '立即处理一轮')),
        h('div', { style: { ...S.muted, marginBottom: '14px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(127,127,127,.08)', display: 'flex', alignItems: 'center', flexWrap: 'wrap' } }, meta, watchChip),
        error ? h('div', { style: S.err }, error) : null,
        notice ? h('div', { style: { ...S.muted, marginBottom: '10px' } }, notice) : null,
        h('div', { style: S.tabs },
          ['start', 'chat', 'orders', 'cards', 'items', 'services', 'deliveries'].map((k) =>
            h('div', { key: k, style: S.tab(tab === k), onClick: () => setTab(k) },
              { start: '开始使用', chat: '聊天', orders: '订单', cards: '卡券', items: '商品', services: '客服', deliveries: '发货记录' }[k]))),
        tab === 'start' ? h(StartTab, {
          steps, shopItems, busy, notice,
          onLogin: openLogin,
          onGo: setTab,
          onQuickSetup: quickSetup,
        }) : null,
        tab === 'chat' ? h(ChatTab, {
          chats, activeChat, messages: chatMessages, replyText, setReplyText,
          onPick: loadChat, onSend: sendReply, onRefresh: loadChats, busy,
          selfUserId: (auth && auth.unb) || '', avatars, events,
        }) : null,
        tab === 'orders' ? h(OrdersTab, {
          orders: remoteOrders, localOrders: orders,
          onRefresh: loadRemoteOrders, loading: remoteOrdersLoading,
          onDetail: openOrderDetail,
        }) : null,
        tab === 'cards' ? h(CardsTab, {
          cards, shopItems, draft, setDraft,
          saveCard, editingId: editingCard,
          onEdit: editCard,
          onToggle: toggleCard,
          onRemove: removeCard,
          onCancelEdit: () => { setEditingCard(null); setDraft(EMPTY_CARD) },
          busy,
        }) : null,
        tab === 'items' ? h(ItemsTab, {
          items, shopItems, agentList, settings, services, loading: busy === 'shop',
          onDetail: openItemDetail,
          onConfigure: (it) => setBindItem(it),
        }) : null,
        tab === 'services' ? h(ServicesTab, {
          services, items,
          onCreate: () => setServiceDialog({ service: null }),
          onEdit: (s) => setServiceDialog({ service: s }),
          onDelete: removeService,
        }) : null,
        tab === 'deliveries' ? h(DeliveriesTab, { deliveries, onDetail: (o) => setOrderDetailId(o.order_no) }) : null,
        loginOpen ? h(LoginDialog, { login, onClose: closeLogin }) : null,
        orderDetailId ? h(OrderDetailDialog, { orderId: orderDetailId, onClose: () => setOrderDetailId(null) }) : null,
        itemDetailItem ? h(ItemDetailDialog, { item: itemDetailItem, onClose: () => setItemDetailItem(null) }) : null,
        agentConfig ? h(AgentConfigDialog, {
          item: agentConfig.item,
          agents: agentList,
          skills: skillList,
          current: { agentPreset: agentConfig.agentPreset, skills: agentConfig.current.skills || '' },
          onSave: saveAgentConfig,
          onClose: () => setAgentConfig(null),
        }) : null,
        serviceDialog ? h(ServiceDialog, {
          service: serviceDialog.service,
          skills: skillList,
          toolNames: (settings && settings.tools) || [],
          models,
          onSave: saveService,
          onDelete: removeService,
          onClose: () => setServiceDialog(null),
        }) : null,
        bindItem ? h(BindServiceDialog, {
          item: bindItem,
          services,
          current: items.find((x) => x.item_id === bindItem.item_id) || {},
          onSave: bindService,
          onClose: () => setBindItem(null),
        }) : null
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

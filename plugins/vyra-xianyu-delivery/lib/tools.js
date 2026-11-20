// 暴露给主 Agent 的闲鱼工具。写操作会真实作用在账号上，工具描述里已写明。
//
// 统一返回 { ok, data }，render 成 JSON 文本，模型不用猜字段。

function text(value) {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

function definition({ name, description, parameters, run }) {
  return {
    name,
    description,
    parameters,
    output: {
      schema: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, data: {} },
        required: ['ok'],
      },
      render: (_args, value) => text(value),
    },
    async execute(args) {
      try {
        return { ok: true, data: await run(args ?? {}) }
      } catch (err) {
        return { ok: false, data: { error: String(err?.message || err) } }
      }
    },
  }
}

export function createXianyuTools({ cli, store, dispatcher, getAccount = () => '' }) {
  const account = () => String(getAccount() || '')

  return [
    definition({
      name: 'xianyu_list_chats',
      description: '列出当前闲鱼账号的最近会话（网页 IM 分页接口）。返回 session_id、对方昵称、最后一条消息、未读数和时间。',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: '最多返回多少条，默认 50，最大 200' },
        },
      },
      async run(args) {
        const page = await cli.chats(Math.min(Number(args.limit) || 50, 200))
        return { sessions: page.sessions || [], total: page.total || 0 }
      },
    }),

    definition({
      name: 'xianyu_read_history',
      description: '读取一个闲鱼会话最近的聊天记录。cid 来自 xianyu_list_chats 的 session_id。',
      parameters: {
        type: 'object',
        properties: {
          cid: { type: 'string', description: '会话 ID（session_id）' },
          limit: { type: 'integer', description: '最近多少条，默认 50，最大 200' },
        },
        required: ['cid'],
      },
      async run(args) {
        if (!args.cid) throw new Error('缺少 cid')
        return cli.history(String(args.cid), Math.min(Number(args.limit) || 50, 200))
      },
    }),

    definition({
      name: 'xianyu_send_message',
      description: '以卖家身份给闲鱼买家发一条消息。这是真实发送，无法撤回。新会话可以只给 toid + itemId；已有会话给 cid + toid。',
      parameters: {
        type: 'object',
        properties: {
          toid: { type: 'string', description: '买家用户 ID' },
          text: { type: 'string', description: '要发送的文本' },
          cid: { type: 'string', description: '会话 ID；不知道时留空并传 itemId' },
          itemId: { type: 'string', description: '商品 ID，用于创建新会话' },
        },
        required: ['toid', 'text'],
      },
      async run(args) {
        if (!args.toid || !args.text) throw new Error('缺少 toid 或 text')
        return cli.send({
          cid: String(args.cid || '0'),
          toid: String(args.toid),
          itemId: String(args.itemId || ''),
          text: String(args.text),
        })
      },
    }),

    definition({
      name: 'xianyu_list_items',
      description: '列出当前账号的在售商品（ID、标题、价格、状态、图片）。',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer', description: '默认 50，最大 100' } },
      },
      async run(args) {
        return cli.items(Math.min(Number(args.limit) || 50, 100))
      },
    }),

    definition({
      name: 'xianyu_get_item',
      description: '读取一个闲鱼商品的详情：标题、描述、价格、状态、分类、库存、图片。',
      parameters: {
        type: 'object',
        properties: { itemId: { type: 'string', description: '商品 ID' } },
        required: ['itemId'],
      },
      async run(args) {
        if (!args.itemId) throw new Error('缺少 itemId')
        return cli.itemDetail(String(args.itemId))
      },
    }),

    definition({
      name: 'xianyu_list_orders',
      description: '列出卖家的闲鱼订单。queryCode: ALL（全部）/ NOT_SHIP（待发货）/ NOT_RATE（待评价）。',
      parameters: {
        type: 'object',
        properties: {
          queryCode: { type: 'string', enum: ['ALL', 'NOT_SHIP', 'NOT_RATE'] },
          page: { type: 'integer', description: '页码，默认 1' },
        },
      },
      async run(args) {
        const page = await cli.soldList(Number(args.page) || 1, String(args.queryCode || 'ALL'))
        return { total: page.total || 0, orders: page.orders || [] }
      },
    }),

    definition({
      name: 'xianyu_order_detail',
      description: '读取一笔闲鱼订单的详情（状态、商品、金额、买家、时间）。',
      parameters: {
        type: 'object',
        properties: { orderId: { type: 'string', description: '订单号' } },
        required: ['orderId'],
      },
      async run(args) {
        if (!args.orderId) throw new Error('缺少 orderId')
        return cli.orderDetail(String(args.orderId))
      },
    }),

    definition({
      name: 'xianyu_list_cards',
      description: '查看当前账号配置的自动发货卡券（商品、规格、类型、启用状态）。',
      parameters: { type: 'object', properties: {} },
      async run() {
        return store.listCards(account())
      },
    }),

    definition({
      name: 'xianyu_add_card',
      description: '给某个商品添加自动发货卡券。content 是发给买家的内容，多条库存用单独一行 --- 分隔。',
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string', description: '商品 ID' },
          content: { type: 'string', description: '卡券内容（网盘链接+提取码等）' },
          name: { type: 'string', description: '卡券名称，可省略' },
          specName: { type: 'string', description: '多规格商品时的规格名' },
          specValue: { type: 'string', description: '多规格商品时的规格值' },
        },
        required: ['itemId', 'content'],
      },
      async run(args) {
        if (!args.itemId || !args.content) throw new Error('缺少 itemId 或 content')
        const id = store.addCard({
          accountId: account(),
          itemId: String(args.itemId),
          specName: String(args.specName || ''),
          specValue: String(args.specValue || ''),
          name: String(args.name || 'default'),
          type: 'data',
          content: String(args.content),
        })
        return { id }
      },
    }),

    definition({
      name: 'xianyu_deliver',
      description: '对一笔待发货订单执行自动发货：匹配卡券、发送内容、确认发货。已发货或不在待发货列表的订单会返回 not_pending。',
      parameters: {
        type: 'object',
        properties: { orderNo: { type: 'string', description: '订单号' } },
        required: ['orderNo'],
      },
      async run(args) {
        if (!args.orderNo) throw new Error('缺少 orderNo')
        return dispatcher.reconcile(String(args.orderNo))
      },
    }),
  ]
}

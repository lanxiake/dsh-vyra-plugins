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
      description: '查看当前账号配置的自动发货卡券：商品、规格、类型、模式（pool 池型 / reuse 复用 / generate 每单生成）、总量、已用、剩余。',
      parameters: { type: 'object', properties: {} },
      async run() {
        return store.listCards(account())
      },
    }),

    definition({
      name: 'xianyu_add_card',
      description: '给某个商品添加自动发货卡券。content 是发给买家的内容：池型（pool）多条库存用单独一行 --- 分隔；复用型（reuse）只填一条，反复发同一内容；生成型（generate）留空，每单由网盘技能现生成。',
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string', description: '商品 ID' },
          content: { type: 'string', description: '卡券内容（网盘链接+提取码等）；generate 模式可留空' },
          name: { type: 'string', description: '卡券名称，可省略' },
          mode: { type: 'string', description: 'pool=多条库存每条用一次（默认）；reuse=一条链接反复使用；generate=每单调用网盘技能生成' },
          specName: { type: 'string', description: '多规格商品时的规格名' },
          specValue: { type: 'string', description: '多规格商品时的规格值' },
          template: { type: 'string', description: '发送模板，支持 {card} {order_no} {buyer_nick} 等' },
        },
        required: ['itemId'],
      },
      async run(args) {
        if (!args.itemId) throw new Error('缺少 itemId')
        const mode = ['pool', 'reuse', 'generate'].includes(String(args.mode)) ? String(args.mode) : 'pool'
        if (mode !== 'generate' && !args.content) throw new Error('pool/reuse 模式必须提供 content')
        const id = store.addCard({
          accountId: account(),
          itemId: String(args.itemId),
          specName: String(args.specName || ''),
          specValue: String(args.specValue || ''),
          name: String(args.name || 'default'),
          type: 'data',
          content: String(args.content || ''),
          template: String(args.template || ''),
          mode,
        })
        return { id, mode }
      },
    }),

    definition({
      name: 'xianyu_save_service',
      description: '新建或修改一个闲鱼客服配置（客服是插件里的轻量实体，全局共享，可覆盖多个商品）。不传 id 就是新建。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: '要修改的客服 id；不传则新建' },
          name: { type: 'string', description: '客服名称，会作为 DSH 会话标题前缀' },
          systemPrompt: { type: 'string', description: '系统提示词（商品资料/常见问题/规则）' },
          skills: { type: 'string', description: '绑定的技能名，逗号分隔' },
          model: { type: 'string', description: '模型，格式 provider:model；留空用默认' },
          autoDeliver: { type: 'boolean', description: '是否自动发货' },
          deliverTemplate: { type: 'string', description: '发货模板，支持 {card} {order_no} {buyer_nick}' },
          tools: { type: 'string', description: '允许 AI 调用的闲鱼工具名，逗号分隔；留空=全部' },
        },
        required: ['name'],
      },
      async run(args) {
        if (!args.name) throw new Error('缺少 name')
        const id = store.saveService({
          id: args.id ? Number(args.id) : undefined,
          name: String(args.name),
          systemPrompt: String(args.systemPrompt || ''),
          skills: String(args.skills || ''),
          model: String(args.model || ''),
          autoDeliver: args.autoDeliver === false ? 0 : 1,
          deliverTemplate: String(args.deliverTemplate || ''),
          tools: String(args.tools || ''),
          enabled: 1,
        })
        return { id }
      },
    }),

    definition({
      name: 'xianyu_bind_item',
      description: '把闲鱼商品绑定到某个客服；serviceId 传 0 表示解绑。绑定后该商品的咨询和自动发货都跟随这个客服。',
      parameters: {
        type: 'object',
        properties: {
          itemId: { type: 'string', description: '商品 ID' },
          serviceId: { type: 'integer', description: '客服 id；0 = 解绑' },
          title: { type: 'string', description: '商品标题（可选，用于面板展示）' },
        },
        required: ['itemId', 'serviceId'],
      },
      async run(args) {
        if (!args.itemId) throw new Error('缺少 itemId')
        store.setItemService(String(args.itemId), Number(args.serviceId) || 0, account(), String(args.title || ''))
        return { ok: true }
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

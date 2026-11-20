// SQLite 存储。用 Node 24 内置的 node:sqlite，不引入 native 依赖。
// ponytail: 单进程假设。多实例同时跑会重复消费卡密；真要水平扩展再换服务端 DB。
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cards (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    TEXT NOT NULL DEFAULT '',
  item_id       TEXT NOT NULL DEFAULT '',
  spec_name     TEXT NOT NULL DEFAULT '',
  spec_value    TEXT NOT NULL DEFAULT '',
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'data',
  content       TEXT NOT NULL DEFAULT '',
  template      TEXT NOT NULL DEFAULT '',
  delay_seconds INTEGER NOT NULL DEFAULT 0,
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_cards_item ON cards(item_id, enabled);

CREATE TABLE IF NOT EXISTS orders (
  order_no      TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL DEFAULT '',
  item_id       TEXT NOT NULL DEFAULT '',
  spec_name     TEXT NOT NULL DEFAULT '',
  spec_value    TEXT NOT NULL DEFAULT '',
  buyer_id      TEXT NOT NULL DEFAULT '',
  quantity      INTEGER NOT NULL DEFAULT 1,
  amount        TEXT NOT NULL DEFAULT '',
  state         TEXT NOT NULL,
  fail_reason   TEXT,
  delivered     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_orders_state ON orders(state, updated_at);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS items (
  item_id    TEXT NOT NULL DEFAULT '',
  account_id TEXT NOT NULL DEFAULT '',
  title      TEXT NOT NULL DEFAULT '',
  knowledge  TEXT NOT NULL DEFAULT '',
  skills     TEXT NOT NULL DEFAULT '',
  ai_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (item_id, account_id)
);

CREATE TABLE IF NOT EXISTS customer_services (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  system_prompt    TEXT NOT NULL DEFAULT '',
  skills           TEXT NOT NULL DEFAULT '',
  model            TEXT NOT NULL DEFAULT '',
  auto_deliver     INTEGER NOT NULL DEFAULT 1,
  deliver_template TEXT NOT NULL DEFAULT '',
  enabled          INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS deliveries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no   TEXT NOT NULL,
  account_id TEXT NOT NULL DEFAULT '',
  card_id    INTEGER,
  seq        INTEGER NOT NULL DEFAULT 1,
  content    TEXT NOT NULL DEFAULT '',
  send_state TEXT NOT NULL,
  error      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_deliveries_order ON deliveries(order_no, id);
`

function splitBlocks(content) {
  return String(content ?? '')
    .split(/\r?\n\s*---\s*\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// 老库升级：CREATE TABLE IF NOT EXISTS 不会补列，逐列 ALTER。
function ensureColumn(db, table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`)
  }
}

/**
 * 0.4.1 之前 items 的主键只有 item_id。多账号后需要 (item_id, account_id)，
 * 而 SQLite 不能改主键：升级时重建表并保留旧数据（account_id 记为空，即共享）。
 */
function migrateItems(db) {
  const cols = db.prepare('PRAGMA table_info(items)').all()
  if (!cols.length) return
  const pk = cols.filter((c) => c.pk > 0).map((c) => c.name)
  if (pk.length > 1) return
  const hasAccount = cols.some((c) => c.name === 'account_id')
  db.exec('ALTER TABLE items RENAME TO items_legacy')
  db.exec(`
    CREATE TABLE items (
      item_id    TEXT NOT NULL DEFAULT '',
      account_id TEXT NOT NULL DEFAULT '',
      title      TEXT NOT NULL DEFAULT '',
      knowledge  TEXT NOT NULL DEFAULT '',
      skills     TEXT NOT NULL DEFAULT '',
      ai_enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      PRIMARY KEY (item_id, account_id)
    )`)
  db.exec(
    `INSERT INTO items (item_id, account_id, title, knowledge, skills, updated_at)
     SELECT item_id, ${hasAccount ? "IFNULL(account_id, '')" : "''"}, title, knowledge, skills, updated_at
     FROM items_legacy`,
  )
  db.exec('DROP TABLE items_legacy')
}

/**
 * 把旧版「商品自带 skills」迁移成一个默认客服「内置客服」，并把商品指过去。
 * 迁移只做一次：已经有 service 的商品不再处理。
 */
function migrateServices(db) {
  const legacy = db
    .prepare("SELECT item_id, account_id, skills, ai_enabled FROM items WHERE service_id = 0 AND skills <> ''")
    .all()
  if (!legacy.length) return

  const skills = new Set()
  let aiOn = false
  for (const row of legacy) {
    for (const name of String(row.skills || '').split(/[,，\s]+/)) {
      if (name) skills.add(name.trim())
    }
    if (row.ai_enabled === 1) aiOn = true
  }

  const existing = db.prepare('SELECT id FROM customer_services WHERE name = ?').get('内置客服')
  let serviceId = existing && existing.id
  if (!serviceId) {
    const info = db
      .prepare(
        `INSERT INTO customer_services (name, system_prompt, skills, model, auto_deliver, deliver_template, enabled)
         VALUES (?, '', ?, '', 1, '', ?)`,
      )
      .run('内置客服', [...skills].join(', '), aiOn ? 1 : 0)
    serviceId = info.lastInsertRowid
  }
  db.prepare('UPDATE items SET service_id = ? WHERE service_id = 0 AND skills <> \'\'').run(serviceId)
}

export function createStore(file) {
  mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec(SCHEMA)
  ensureColumn(db, 'cards', 'spec_name', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(db, 'cards', 'spec_value', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(db, 'cards', 'template', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(db, 'orders', 'spec_name', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(db, 'orders', 'spec_value', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(db, 'deliveries', 'account_id', "TEXT NOT NULL DEFAULT ''")
  // 必须放在 SCHEMA 之后、prepare 之前：旧表主键不对会让 upsertItem 的
  // ON CONFLICT 在 prepare 时抛错，整个插件加载失败。
  migrateItems(db)
  // 先重建 items（补 account_id），再做客服迁移，否则旧表没有这两列。
  ensureColumn(db, 'items', 'ai_enabled', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(db, 'items', 'service_id', 'INTEGER NOT NULL DEFAULT 0')
  migrateServices(db)

  // 旧库的时间列是 datetime('now')（UTC），比本地少 8 小时。只迁移一次；
  // 中国无夏令时，固定 +8 是安全的。
  const tzDone = db.prepare("SELECT value FROM settings WHERE key = 'migration.local_time'").get()
  if (!tzDone) {
    db.exec("UPDATE orders SET created_at = datetime(created_at, '+8 hours'), updated_at = datetime(updated_at, '+8 hours')")
    db.exec("UPDATE deliveries SET created_at = datetime(created_at, '+8 hours')")
    db.exec("UPDATE items SET updated_at = datetime(updated_at, '+8 hours')")
    db.exec("INSERT INTO settings (key, value) VALUES ('migration.local_time', '1')")
  }

  const tx = (fn) => {
    db.exec('BEGIN IMMEDIATE')
    try {
      const out = fn()
      db.exec('COMMIT')
      return out
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }

  const q = {
    order: db.prepare('SELECT * FROM orders WHERE order_no = ?'),
    insertOrder: db.prepare(
      `INSERT INTO orders (order_no, account_id, item_id, spec_name, spec_value, buyer_id, quantity, amount, state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing')`,
    ),
    updateOrder: db.prepare(
      `UPDATE orders SET state = ?, fail_reason = ?, delivered = ?, updated_at = datetime('now','localtime')
       WHERE order_no = ?`,
    ),
    pendingConfirm: db.prepare(
      `SELECT * FROM orders WHERE state = 'confirm_failed'
       AND (account_id = ? OR account_id = '') ORDER BY updated_at LIMIT 20`,
    ),
    recentOrders: db.prepare(
      `SELECT * FROM orders WHERE (account_id = ? OR account_id = '')
       ORDER BY updated_at DESC LIMIT ?`,
    ),
    insertDelivery: db.prepare(
      `INSERT INTO deliveries (order_no, account_id, card_id, seq, content, send_state, error)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ),
    recentDeliveries: db.prepare(
      `SELECT * FROM deliveries WHERE (account_id = ? OR account_id = '')
       ORDER BY id DESC LIMIT ?`,
    ),
    matchCard: db.prepare(
      `SELECT * FROM cards WHERE enabled = 1 AND item_id = ?
       AND (account_id = ? OR account_id = '')
       AND ((spec_name = ? AND spec_value = ?) OR (spec_name = '' AND spec_value = ''))
       ORDER BY CASE WHEN spec_name = '' THEN 1 ELSE 0 END, account_id DESC, id`,
    ),
    cardById: db.prepare('SELECT * FROM cards WHERE id = ?'),
    updateCardContent: db.prepare(
      'UPDATE cards SET content = ? WHERE id = ? AND content = ?',
    ),
    insertCard: db.prepare(
      `INSERT INTO cards (account_id, item_id, spec_name, spec_value, name, type, content, template, delay_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    listCards: db.prepare(
      `SELECT id, account_id, item_id, spec_name, spec_value, name, type, enabled, delay_seconds
       FROM cards WHERE (account_id = ? OR account_id = '') ORDER BY id`,
    ),
    getItem: db.prepare(
      `SELECT * FROM items WHERE item_id = ? AND (account_id = ? OR account_id = '')
       ORDER BY account_id DESC LIMIT 1`,
    ),
    lastItemForBuyer: db.prepare(
      `SELECT item_id FROM orders WHERE buyer_id = ? AND (account_id = ? OR account_id = '')
       ORDER BY updated_at DESC LIMIT 1`,
    ),
    upsertItem: db.prepare(
      `INSERT INTO items (item_id, account_id, title, knowledge, skills, ai_enabled, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))
       ON CONFLICT(item_id, account_id) DO UPDATE SET
         title = excluded.title, knowledge = excluded.knowledge,
         skills = excluded.skills, ai_enabled = excluded.ai_enabled,
         updated_at = datetime('now','localtime')`,
    ),
    listItems: db.prepare(
      `SELECT * FROM items WHERE (account_id = ? OR account_id = '')
       ORDER BY updated_at DESC`,
    ),
    listServices: db.prepare('SELECT * FROM customer_services ORDER BY id'),
    getService: db.prepare('SELECT * FROM customer_services WHERE id = ?'),
    insertService: db.prepare(
      `INSERT INTO customer_services (name, system_prompt, skills, model, auto_deliver, deliver_template, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ),
    updateService: db.prepare(
      `UPDATE customer_services SET name = ?, system_prompt = ?, skills = ?, model = ?,
         auto_deliver = ?, deliver_template = ?, enabled = ?, updated_at = datetime('now','localtime')
       WHERE id = ?`,
    ),
    deleteService: db.prepare('DELETE FROM customer_services WHERE id = ?'),
    clearServiceItems: db.prepare('UPDATE items SET service_id = 0 WHERE service_id = ?'),
    itemsOfService: db.prepare('SELECT item_id, account_id, title, service_id FROM items WHERE service_id = ?'),
    setItemService: db.prepare(
      `UPDATE items SET service_id = ? WHERE item_id = ? AND (account_id = ? OR account_id = '')`,
    ),
    getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
    setSetting: db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ),
    countCards: db.prepare(
      `SELECT COUNT(*) AS n FROM cards WHERE enabled = 1 AND content <> ''
       AND (account_id = ? OR account_id = '')`,
    ),
  }

  return {
    db,

    getOrder: (orderNo) => q.order.get(orderNo) ?? null,

    // 返回 { created, order }。同一订单号只会有一列，并发/重复触发都靠主键兜住。
    beginOrder(meta) {
      const existing = q.order.get(meta.order_no)
      if (existing) return { created: false, order: existing }
      q.insertOrder.run(
        meta.order_no,
        meta.account_id ?? '',
        meta.item_id ?? '',
        meta.spec_name ?? '',
        meta.spec_value ?? '',
        meta.buyer_id ?? '',
        meta.quantity ?? 1,
        meta.amount ?? '',
      )
      return { created: true, order: q.order.get(meta.order_no) }
    },

    finishOrder(orderNo, state, { failReason = null, delivered = 0 } = {}) {
      q.updateOrder.run(state, failReason, delivered, orderNo)
    },

    pendingConfirm: (accountId = '') => q.pendingConfirm.all(String(accountId)),
    recentOrders: (limit = 50, accountId = '') => q.recentOrders.all(String(accountId), limit),
    recentDeliveries: (limit = 100, accountId = '') => q.recentDeliveries.all(String(accountId), limit),

    // 商品必须唯一匹配一张卡券；0 张或多张都算配置错误，宁可不发。
    // 规格精确匹配优先，匹配不到再退回该商品的无规格通用卡券。
    matchCard(itemId, specName = '', specValue = '', accountId = '') {
      const rows = q.matchCard.all(String(itemId), String(accountId), String(specName), String(specValue))
      if (!rows.length) return { error: 'no_card', count: 0 }
      const exact = rows.filter((r) => r.spec_name === specName && r.spec_value === specValue)
      if (exact.length === 1) return exact[0]
      if (exact.length > 1) return { error: 'ambiguous_card', count: exact.length }
      if (rows.length === 1) return rows[0]
      return { error: 'ambiguous_card', count: rows.length }
    },

    // CAS 消费：只有 content 仍是读到的旧值时才更新成功，防止并发重复派发。
    // 条目之间用单独一行 `---` 分隔；条目内部可以多行（网盘链接 + 提取码 + 说明）。
    consumeCard(cardId) {
      return tx(() => {
        const row = q.cardById.get(cardId)
        if (!row) return null
        const blocks = splitBlocks(row.content)
        if (!blocks.length) return null
        const [first, ...rest] = blocks
        const info = q.updateCardContent.run(rest.length ? rest.join('\n---\n') : '', cardId, row.content)
        return info.changes === 1 ? first : null
      })
    },

    addDelivery({ orderNo, accountId = '', cardId, seq, content, state, error = null }) {
      q.insertDelivery.run(orderNo, String(accountId), cardId ?? null, seq ?? 1, content, state, error)
    },

    addCard({
      accountId = '', itemId = '', specName = '', specValue = '',
      name, type = 'data', content, template = '', delaySeconds = 0,
    }) {
      return q.insertCard.run(
        accountId, itemId, specName, specValue, name, type, content, template, delaySeconds,
      ).lastInsertRowid
    },

    listCards: (accountId = '') => q.listCards.all(String(accountId)),
    availableCards: (accountId = '') => q.countCards.get(String(accountId)).n,

    getItem: (itemId, accountId = '') => q.getItem.get(String(itemId), String(accountId)) ?? null,
    lastItemForBuyer: (buyerId, accountId = '') => {
      const row = q.lastItemForBuyer.get(String(buyerId), String(accountId))
      return row ? row.item_id : ''
    },
    setItem({ itemId, accountId = '', title = '', knowledge = '', skills = '', aiEnabled = 0 }) {
      q.upsertItem.run(String(itemId), String(accountId), title, knowledge, skills, aiEnabled ? 1 : 0)
    },
    listItems: (accountId = '') => q.listItems.all(String(accountId)),

    listServices: () => q.listServices.all(),
    getService(id) {
      const row = q.getService.get(Number(id))
      return row ?? null
    },
    saveService(data) {
      const id = Number(data.id) || 0
      if (id) {
        q.updateService.run(
          data.name, data.systemPrompt ?? '', data.skills ?? '', data.model ?? '',
          data.autoDeliver ? 1 : 0, data.deliverTemplate ?? '', data.enabled === false ? 0 : 1,
          id,
        )
        return id
      }
      return q.insertService.run(
        data.name, data.systemPrompt ?? '', data.skills ?? '', data.model ?? '',
        data.autoDeliver ? 1 : 0, data.deliverTemplate ?? '', data.enabled === false ? 0 : 1,
      ).lastInsertRowid
    },
    deleteService(id) {
      const serviceId = Number(id)
      q.clearServiceItems.run(serviceId)
      q.deleteService.run(serviceId)
    },
    itemsOfService(id) {
      return q.itemsOfService.all(Number(id))
    },
    setItemService(itemId, serviceId, accountId = '') {
      q.setItemService.run(Number(serviceId) || 0, String(itemId), String(accountId))
    },

    getSetting(key) {
      const row = q.getSetting.get(String(key))
      return row ? row.value : ''
    },
    setSetting(key, value) {
      q.setSetting.run(String(key), String(value ?? ''))
    },
  }
}

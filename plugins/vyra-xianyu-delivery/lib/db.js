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
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
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
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_orders_state ON orders(state, updated_at);

CREATE TABLE IF NOT EXISTS items (
  item_id    TEXT PRIMARY KEY,
  title      TEXT NOT NULL DEFAULT '',
  knowledge  TEXT NOT NULL DEFAULT '',
  skills     TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deliveries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no   TEXT NOT NULL,
  card_id    INTEGER,
  seq        INTEGER NOT NULL DEFAULT 1,
  content    TEXT NOT NULL DEFAULT '',
  send_state TEXT NOT NULL,
  error      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
      `UPDATE orders SET state = ?, fail_reason = ?, delivered = ?, updated_at = datetime('now')
       WHERE order_no = ?`,
    ),
    pendingConfirm: db.prepare(
      `SELECT * FROM orders WHERE state = 'confirm_failed' ORDER BY updated_at LIMIT 20`,
    ),
    recentOrders: db.prepare('SELECT * FROM orders ORDER BY updated_at DESC LIMIT ?'),
    insertDelivery: db.prepare(
      `INSERT INTO deliveries (order_no, card_id, seq, content, send_state, error)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ),
    recentDeliveries: db.prepare('SELECT * FROM deliveries ORDER BY id DESC LIMIT ?'),
    matchCard: db.prepare(
      `SELECT * FROM cards WHERE enabled = 1 AND item_id = ?
       AND ((spec_name = ? AND spec_value = ?) OR (spec_name = '' AND spec_value = ''))
       ORDER BY CASE WHEN spec_name = '' THEN 1 ELSE 0 END, id`,
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
      'SELECT id, account_id, item_id, spec_name, spec_value, name, type, enabled, delay_seconds FROM cards ORDER BY id',
    ),
    getItem: db.prepare('SELECT * FROM items WHERE item_id = ?'),
    lastItemForBuyer: db.prepare(
      'SELECT item_id FROM orders WHERE buyer_id = ? ORDER BY updated_at DESC LIMIT 1',
    ),
    upsertItem: db.prepare(
      `INSERT INTO items (item_id, title, knowledge, skills, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(item_id) DO UPDATE SET
         title = excluded.title, knowledge = excluded.knowledge,
         skills = excluded.skills, updated_at = datetime('now')`,
    ),
    listItems: db.prepare('SELECT * FROM items ORDER BY updated_at DESC'),
    countCards: db.prepare("SELECT COUNT(*) AS n FROM cards WHERE enabled = 1 AND content <> ''"),
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

    pendingConfirm: () => q.pendingConfirm.all(),
    recentOrders: (limit = 50) => q.recentOrders.all(limit),
    recentDeliveries: (limit = 100) => q.recentDeliveries.all(limit),

    // 商品必须唯一匹配一张卡券；0 张或多张都算配置错误，宁可不发。
    // 规格精确匹配优先，匹配不到再退回该商品的无规格通用卡券。
    matchCard(itemId, specName = '', specValue = '') {
      const rows = q.matchCard.all(String(itemId), String(specName), String(specValue))
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

    addDelivery({ orderNo, cardId, seq, content, state, error = null }) {
      q.insertDelivery.run(orderNo, cardId ?? null, seq ?? 1, content, state, error)
    },

    addCard({
      accountId = '', itemId = '', specName = '', specValue = '',
      name, type = 'data', content, template = '', delaySeconds = 0,
    }) {
      return q.insertCard.run(
        accountId, itemId, specName, specValue, name, type, content, template, delaySeconds,
      ).lastInsertRowid
    },

    listCards: () => q.listCards.all(),
    availableCards: () => q.countCards.get().n,

    getItem: (itemId) => q.getItem.get(String(itemId)) ?? null,
    lastItemForBuyer: (buyerId) => {
      const row = q.lastItemForBuyer.get(String(buyerId))
      return row ? row.item_id : ''
    },
    setItem({ itemId, title = '', knowledge = '', skills = '' }) {
      q.upsertItem.run(String(itemId), title, knowledge, skills)
    },
    listItems: () => q.listItems.all(),
  }
}

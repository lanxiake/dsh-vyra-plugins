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
  tools            TEXT NOT NULL DEFAULT '',
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

-- ---- 0.10：会话镜像、去重、待人工、分享台账、通知 ----

-- 会话消息镜像：面板回放、断线补扫、重启后仍能恢复上下文。
CREATE TABLE IF NOT EXISTS chat_messages (
  cid            TEXT NOT NULL,
  message_id     TEXT NOT NULL,
  account_id     TEXT NOT NULL DEFAULT '',
  send_user_id   TEXT NOT NULL DEFAULT '',
  send_user_name TEXT NOT NULL DEFAULT '',
  content_type   INTEGER NOT NULL DEFAULT 0,
  text           TEXT NOT NULL DEFAULT '',
  created_at     INTEGER NOT NULL DEFAULT 0,
  raw            TEXT NOT NULL DEFAULT '',
  stored_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (cid, message_id)
);
CREATE INDEX IF NOT EXISTS ix_chat_messages_time ON chat_messages(created_at);

-- 已处理事件：替代内存里的 handledMsg / handledOrders。
CREATE TABLE IF NOT EXISTS handled_events (
  kind       TEXT NOT NULL,
  ref        TEXT NOT NULL,
  cid        TEXT NOT NULL DEFAULT '',
  action     TEXT NOT NULL DEFAULT '',
  handled_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (kind, ref)
);

-- 会话水位：轮询基线 + 该会话最近处理过的订单。
CREATE TABLE IF NOT EXISTS chat_state (
  cid             TEXT PRIMARY KEY,
  account_id      TEXT NOT NULL DEFAULT '',
  last_ts         INTEGER NOT NULL DEFAULT 0,
  last_order_no   TEXT NOT NULL DEFAULT '',
  last_message_id TEXT NOT NULL DEFAULT '',
  updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 会话元信息（昵称、商品、未读、最后一条）。面板列表只读这张表，不再每次开 IM 连接。
CREATE TABLE IF NOT EXISTS chat_meta (
  cid          TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL DEFAULT '',
  peer_nick    TEXT NOT NULL DEFAULT '',
  peer_user_id TEXT NOT NULL DEFAULT '',
  item_id      TEXT NOT NULL DEFAULT '',
  item_title   TEXT NOT NULL DEFAULT '',
  session_type INTEGER NOT NULL DEFAULT 0,
  unread       INTEGER NOT NULL DEFAULT 0,
  ts           INTEGER NOT NULL DEFAULT 0,
  last_msg     TEXT NOT NULL DEFAULT '',
  updated_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_chat_meta_ts ON chat_meta(ts);

-- 待人工队列：生成失败、发送失败、补发、可疑发货。
CREATE TABLE IF NOT EXISTS pending_tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL DEFAULT '',
  kind       TEXT NOT NULL,
  order_no   TEXT NOT NULL DEFAULT '',
  item_id    TEXT NOT NULL DEFAULT '',
  buyer_nick TEXT NOT NULL DEFAULT '',
  detail     TEXT NOT NULL DEFAULT '',
  state      TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_pending_state ON pending_tasks(state, created_at);

-- 分享链接台账：每次生成的分享都留痕，可追溯、可校验。
CREATE TABLE IF NOT EXISTS share_ledger (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id   TEXT NOT NULL DEFAULT '',
  provider     TEXT NOT NULL DEFAULT 'quark',
  item_id      TEXT NOT NULL DEFAULT '',
  spec_value   TEXT NOT NULL DEFAULT '',
  source_path  TEXT NOT NULL DEFAULT '',
  fid          TEXT NOT NULL DEFAULT '',
  share_url    TEXT NOT NULL DEFAULT '',
  passcode     TEXT NOT NULL DEFAULT '',
  url_type     INTEGER NOT NULL DEFAULT 2,
  expired_at   TEXT NOT NULL DEFAULT '',
  strategy     TEXT NOT NULL DEFAULT 'reuse',
  order_no     TEXT NOT NULL DEFAULT '',
  verified     INTEGER NOT NULL DEFAULT 0,
  verify_error TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_share_item ON share_ledger(item_id, provider);

-- 商品（+规格）到网盘路径的映射。
CREATE TABLE IF NOT EXISTS card_sources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  TEXT NOT NULL DEFAULT '',
  item_id     TEXT NOT NULL DEFAULT '',
  spec_value  TEXT NOT NULL DEFAULT '',
  provider    TEXT NOT NULL DEFAULT 'quark',
  path        TEXT NOT NULL DEFAULT '',
  fid         TEXT NOT NULL DEFAULT '',
  strategy    TEXT NOT NULL DEFAULT 'reuse',
  expire_days INTEGER NOT NULL DEFAULT 7,
  last_check  TEXT NOT NULL DEFAULT '',
  check_error TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (item_id, spec_value, account_id)
);

-- 通知出口（dsh-im 的 bot + 目标）。
CREATE TABLE IF NOT EXISTS im_channels (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_id     TEXT NOT NULL,
  target_id  TEXT NOT NULL,
  channel    TEXT NOT NULL DEFAULT '',
  label      TEXT NOT NULL DEFAULT '',
  enabled    INTEGER NOT NULL DEFAULT 1,
  last_ok_at TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT '',
  UNIQUE (bot_id, target_id)
);

-- 通知日志：sent 之外的都要能在面板上看到。
CREATE TABLE IF NOT EXISTS notify_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,
  ref        TEXT NOT NULL DEFAULT '',
  text       TEXT NOT NULL DEFAULT '',
  state      TEXT NOT NULL DEFAULT 'pending',
  error      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  sent_at    TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_notify_state ON notify_events(state, created_at);
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
  // 卡券模式：pool = 每条用一次；reuse = 一条链接反复发（网盘分享）；
  // generate = 每单调用网盘技能生成新链接。
  ensureColumn(db, 'cards', 'mode', "TEXT NOT NULL DEFAULT 'pool'")
  // 必须放在 SCHEMA 之后、prepare 之前：旧表主键不对会让 upsertItem 的
  // ON CONFLICT 在 prepare 时抛错，整个插件加载失败。
  migrateItems(db)
  // 先重建 items（补 account_id），再做客服迁移，否则旧表没有这两列。
  ensureColumn(db, 'items', 'ai_enabled', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(db, 'items', 'service_id', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(db, 'customer_services', 'tools', "TEXT NOT NULL DEFAULT ''")
  migrateServices(db)

  // ---- 0.10 迁移：只加列，不动已有数据 ----
  ensureColumn(db, 'cards', 'source_id', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(db, 'cards', 'strategy', "TEXT NOT NULL DEFAULT 'reuse'")
  ensureColumn(db, 'cards', 'expire_days', 'INTEGER NOT NULL DEFAULT 7')
  ensureColumn(db, 'items', 'netdisk_path', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(db, 'items', 'netdisk_provider', "TEXT NOT NULL DEFAULT ''")

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
    resetOrder: db.prepare(
      `UPDATE orders SET state = 'processing', fail_reason = NULL, updated_at = datetime('now','localtime')
       WHERE order_no = ?`,
    ),
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
      `SELECT d.*, o.buyer_id, o.item_id AS delivery_item_id, o.quantity, o.amount,
              o.created_at AS order_time, i.title AS item_title
       FROM deliveries d
       LEFT JOIN orders o ON d.order_no = o.order_no AND (o.account_id = d.account_id OR o.account_id = '')
       LEFT JOIN items i ON o.item_id = i.item_id AND (i.account_id = o.account_id OR i.account_id = '')
       WHERE (d.account_id = ? OR d.account_id = '')
       ORDER BY d.id DESC LIMIT ?`,
    ),
    matchCard: db.prepare(
      `SELECT * FROM cards WHERE enabled = 1 AND item_id = ?
       AND (account_id = ? OR account_id = '')
       AND ((spec_name = ? AND spec_value = ?) OR (spec_name = '' AND spec_value = ''))
       ORDER BY CASE WHEN spec_name = '' THEN 1 ELSE 0 END, account_id DESC, id`,
    ),
    cardById: db.prepare('SELECT * FROM cards WHERE id = ?'),
    usedForCard: db.prepare(
      "SELECT COUNT(*) AS n FROM deliveries WHERE card_id = ? AND send_state = 'success'",
    ),
    allEnabledCards: db.prepare(
      `SELECT * FROM cards WHERE enabled = 1 AND item_id = ?
       AND (account_id = ? OR account_id = '') ORDER BY id`,
    ),
    updateCard: db.prepare(
      `UPDATE cards SET name = ?, type = ?, content = ?, template = ?, spec_name = ?, spec_value = ?,
         enabled = ?, mode = ?, source_id = ?, strategy = ?, expire_days = ? WHERE id = ?`,
    ),
    deleteCard: db.prepare('DELETE FROM cards WHERE id = ?'),
    updateCardContent: db.prepare(
      'UPDATE cards SET content = ? WHERE id = ? AND content = ?',
    ),
    insertCard: db.prepare(
      `INSERT INTO cards (account_id, item_id, spec_name, spec_value, name, type, content, template,
         delay_seconds, mode, source_id, strategy, expire_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    listCards: db.prepare(
      `SELECT c.id, c.account_id, c.item_id, c.spec_name, c.spec_value, c.name, c.type, c.enabled,
              c.delay_seconds, c.content, c.template, c.mode, c.source_id, c.strategy, c.expire_days,
              s.path AS source_path, s.provider AS source_provider
       FROM cards c
       LEFT JOIN card_sources s ON s.id = c.source_id
       WHERE (c.account_id = ? OR c.account_id = '') ORDER BY c.id`,
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
      `INSERT INTO customer_services (name, system_prompt, skills, model, auto_deliver, deliver_template, tools, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    updateService: db.prepare(
      `UPDATE customer_services SET name = ?, system_prompt = ?, skills = ?, model = ?,
         auto_deliver = ?, deliver_template = ?, tools = ?, enabled = ?, updated_at = datetime('now','localtime')
       WHERE id = ?`,
    ),
    deleteService: db.prepare('DELETE FROM customer_services WHERE id = ?'),
    clearServiceItems: db.prepare('UPDATE items SET service_id = 0 WHERE service_id = ?'),
    itemsOfService: db.prepare('SELECT item_id, account_id, title, service_id FROM items WHERE service_id = ?'),
    setItemService: db.prepare(
      `UPDATE items SET service_id = ? WHERE item_id = ? AND (account_id = ? OR account_id = '')`,
    ),
    ensureItem: db.prepare(
      `INSERT OR IGNORE INTO items (item_id, account_id, title) VALUES (?, ?, ?)`,
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

    // ---- 0.10 ----
    upsertMessage: db.prepare(
      `INSERT INTO chat_messages (cid, message_id, account_id, send_user_id, send_user_name,
         content_type, text, created_at, raw)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(cid, message_id) DO UPDATE SET
         text = excluded.text, raw = excluded.raw, content_type = excluded.content_type`,
    ),
    messages: db.prepare(
      'SELECT * FROM chat_messages WHERE cid = ? ORDER BY created_at DESC, message_id DESC LIMIT ?',
    ),
    messagesAsc: db.prepare(
      'SELECT * FROM chat_messages WHERE cid = ? ORDER BY created_at ASC, message_id ASC LIMIT ?',
    ),
    hasMessage: db.prepare('SELECT 1 AS hit FROM chat_messages WHERE cid = ? AND message_id = ?'),
    pruneMessages: db.prepare('DELETE FROM chat_messages WHERE created_at < ?'),

    handled: db.prepare('SELECT 1 AS hit FROM handled_events WHERE kind = ? AND ref = ?'),
    markHandledStmt: db.prepare(
      `INSERT INTO handled_events (kind, ref, cid, action) VALUES (?, ?, ?, ?)
       ON CONFLICT(kind, ref) DO UPDATE SET action = excluded.action`,
    ),
    pruneHandled: db.prepare("DELETE FROM handled_events WHERE handled_at < datetime('now','localtime',?)"),

    chatState: db.prepare('SELECT * FROM chat_state WHERE cid = ?'),
    upsertChatMeta: db.prepare(
      `INSERT INTO chat_meta (cid, account_id, peer_nick, peer_user_id, item_id, item_title,
         session_type, unread, ts, last_msg)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(cid) DO UPDATE SET
         peer_nick = excluded.peer_nick, peer_user_id = excluded.peer_user_id,
         item_id = excluded.item_id, item_title = excluded.item_title,
         session_type = excluded.session_type, unread = excluded.unread,
         ts = excluded.ts, last_msg = excluded.last_msg,
         updated_at = datetime('now','localtime')`,
    ),
    listChatMeta: db.prepare(
      'SELECT * FROM chat_meta WHERE (account_id = ? OR account_id = \'\') ORDER BY ts DESC LIMIT ?',
    ),
    upsertChatState: db.prepare(
      `INSERT INTO chat_state (cid, account_id, last_ts, last_order_no, last_message_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(cid) DO UPDATE SET
         last_ts = MAX(chat_state.last_ts, excluded.last_ts),
         last_order_no = CASE WHEN excluded.last_order_no <> '' THEN excluded.last_order_no ELSE chat_state.last_order_no END,
         last_message_id = CASE WHEN excluded.last_message_id <> '' THEN excluded.last_message_id ELSE chat_state.last_message_id END,
         updated_at = datetime('now','localtime')`,
    ),

    insertPending: db.prepare(
      `INSERT INTO pending_tasks (account_id, kind, order_no, item_id, buyer_nick, detail)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ),
    listPending: db.prepare('SELECT * FROM pending_tasks WHERE state = ? ORDER BY id DESC LIMIT ?'),
    resolvePending: db.prepare(
      "UPDATE pending_tasks SET state = ?, updated_at = datetime('now','localtime') WHERE id = ?",
    ),
    openPendingForOrder: db.prepare(
      "SELECT id FROM pending_tasks WHERE order_no = ? AND state = 'open' LIMIT 1",
    ),

    insertShare: db.prepare(
      `INSERT INTO share_ledger (account_id, provider, item_id, spec_value, source_path, fid,
         share_url, passcode, url_type, expired_at, strategy, order_no, verified, verify_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    lastShare: db.prepare(
      `SELECT * FROM share_ledger WHERE item_id = ? AND provider = ? AND verified = 1
       AND expired_at > ? ORDER BY id DESC LIMIT 1`,
    ),

    insertChannel: db.prepare(
      `INSERT INTO im_channels (bot_id, target_id, channel, label) VALUES (?, ?, ?, ?)
       ON CONFLICT(bot_id, target_id) DO UPDATE SET channel = excluded.channel, label = excluded.label`,
    ),
    listChannels: db.prepare('SELECT * FROM im_channels ORDER BY id'),
    toggleChannel: db.prepare('UPDATE im_channels SET enabled = ? WHERE id = ?'),
    channelOk: db.prepare("UPDATE im_channels SET last_ok_at = datetime('now','localtime'), last_error = '' WHERE id = ?"),
    channelFail: db.prepare("UPDATE im_channels SET last_error = ? WHERE id = ?"),

    insertNotify: db.prepare(
      'INSERT INTO notify_events (kind, ref, text, state, error) VALUES (?, ?, ?, ?, ?)',
    ),
    recentNotify: db.prepare('SELECT * FROM notify_events ORDER BY id DESC LIMIT ?'),
    unsentNotify: db.prepare("SELECT COUNT(*) AS n FROM notify_events WHERE state <> 'sent'"),
    lastSentOfKind: db.prepare(
      `SELECT sent_at FROM notify_events WHERE kind = ? AND state = 'sent' ORDER BY id DESC LIMIT 1`,
    ),
    pruneNotify: db.prepare("DELETE FROM notify_events WHERE created_at < datetime('now','localtime',?)"),

    getSource: db.prepare(
      `SELECT * FROM card_sources WHERE item_id = ? AND spec_value = ? AND (account_id = ? OR account_id = '')
       ORDER BY account_id DESC LIMIT 1`,
    ),
    upsertSource: db.prepare(
      `INSERT INTO card_sources (account_id, item_id, spec_value, provider, path, fid, strategy, expire_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(item_id, spec_value, account_id) DO UPDATE SET
         provider = excluded.provider, path = excluded.path, fid = excluded.fid,
         strategy = excluded.strategy, expire_days = excluded.expire_days,
         updated_at = datetime('now','localtime')`,
    ),
    listSources: db.prepare(
      `SELECT * FROM card_sources WHERE (account_id = ? OR account_id = '') ORDER BY item_id, spec_value`,
    ),
    setSourceCheck: db.prepare(
      `UPDATE card_sources SET last_check = datetime('now','localtime'), check_error = ?, fid = ?
       WHERE id = ?`,
    ),
  }

  return {
    db,

    getOrder: (orderNo) => q.order.get(orderNo) ?? null,

    // 返回 { created, order }。同一订单号只会有一列，并发/重复触发都靠主键兜住。
    beginOrder(meta) {
      const existing = q.order.get(meta.order_no)
      if (existing) {
        // 什么都没发出去（无卡券/卡密耗尽/生成失败）的订单，补好卡券后允许重试。
        // 旧版本把卡密耗尽记成了 send_failed，这里一并兼容：只要 delivered = 0 就安全。
        const retryable = /^(no_card|card_exhausted|generate_)/.test(existing.fail_reason || '')
        const nothingSent = existing.state === 'blocked'
          || (existing.state === 'send_failed' && !existing.delivered)
        if (retryable && nothingSent) {
          q.resetOrder.run(meta.order_no)
          return { created: true, order: q.order.get(meta.order_no) }
        }
        return { created: false, order: existing }
      }
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
    // 面板「账号级」读取：当前账号还没识别出来（''）时不要返回空表，否则登录态刷新前
    // 订单/卡券会整片消失。只有明确给了账号才做隔离。
    recentOrdersFor: (accountId = '', limit = 50) => (accountId
      ? q.recentOrders.all(String(accountId), limit)
      : db.prepare('SELECT * FROM orders ORDER BY updated_at DESC LIMIT ?').all(limit)),
    recentDeliveries: (limit = 100, accountId = '') => q.recentDeliveries.all(String(accountId), limit),

    // 商品必须唯一匹配一张卡券；0 张或多张都算配置错误，宁可不发。
    // 规格精确匹配优先，匹配不到再退回该商品的无规格通用卡券。
    matchCard(itemId, specName = '', specValue = '', accountId = '') {
      const rows = q.matchCard.all(String(itemId), String(accountId), String(specName), String(specValue))
      if (rows.length) {
        const exact = rows.filter((r) => r.spec_name === specName && r.spec_value === specValue)
        if (exact.length === 1) return exact[0]
        if (exact.length > 1) return { error: 'ambiguous_card', count: exact.length }
        if (rows.length === 1) return rows[0]
        return { error: 'ambiguous_card', count: rows.length }
      }
      // 规格没对上时，该商品只有一张启用卡券就直接用——单卡券商品不需要规格。
      const all = q.allEnabledCards.all(String(itemId), String(accountId))
      if (all.length === 1) return all[0]
      if (all.length > 1) return { error: 'ambiguous_card', count: all.length }
      return { error: 'no_card', count: 0 }
    },

    // CAS 消费：只有 content 仍是读到的旧值时才更新成功，防止并发重复派发。
    // 条目之间用单独一行 `---` 分隔；条目内部可以多行（网盘链接 + 提取码 + 说明）。
    updateCard(id, data) {
      const current = q.cardById.get(Number(id))
      if (!current) throw new Error('卡券不存在')
      q.updateCard.run(
        data.name ?? current.name,
        data.type ?? current.type,
        data.content ?? current.content,
        data.template ?? current.template,
        data.specName ?? current.spec_name,
        data.specValue ?? current.spec_value,
        data.enabled === undefined ? current.enabled : (data.enabled ? 1 : 0),
        data.mode ?? current.mode ?? 'pool',
        data.sourceId === undefined ? (current.source_id ?? 0) : Number(data.sourceId) || 0,
        data.strategy ?? current.strategy ?? 'reuse',
        data.expireDays === undefined ? (current.expire_days ?? 7) : Number(data.expireDays) || 7,
        Number(id),
      )
    },
    deleteCard(id) {
      q.deleteCard.run(Number(id))
    },

    consumeCard(cardId) {
      return tx(() => {
        const row = q.cardById.get(cardId)
        if (!row) return null
        const blocks = splitBlocks(row.content)
        if (!blocks.length) return null
        // 复用型卡券（网盘分享链接）不消耗，每次发同一条。
        if (row.mode === 'reuse') return blocks[0]
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
      name, type = 'data', content, template = '', delaySeconds = 0, mode = 'pool',
      sourceId = 0, strategy = 'reuse', expireDays = 7,
    }) {
      return q.insertCard.run(
        accountId, itemId, specName, specValue, name, type, content, template, delaySeconds, mode,
        Number(sourceId) || 0, String(strategy || 'reuse'), Number(expireDays) || 7,
      ).lastInsertRowid
    },

    listCards: (accountId = '') => q.listCards.all(String(accountId)).map((card) => {
      const remaining = splitBlocks(card.content).length
      const used = q.usedForCard.get(card.id).n
      // 复用型没有「消耗」概念：库存按 1 条算，剩余也按 1 条展示。
      const reusable = card.mode === 'reuse'
      return {
        ...card,
        total: reusable ? 1 : remaining + used,
        used,
        remaining: reusable ? (remaining ? 1 : 0) : remaining,
      }
    }),
    availableCards: (accountId = '') => q.countCards.get(String(accountId)).n,

    getItem: (itemId, accountId = '') => q.getItem.get(String(itemId), String(accountId)) ?? null,
    lastItemForBuyer: (buyerId, accountId = '') => {
      const row = q.lastItemForBuyer.get(String(buyerId), String(accountId))
      return row ? row.item_id : ''
    },
    setItem({ itemId, accountId = '', title = '', knowledge = '', skills = '', aiEnabled = 0, netdiskPath = null, netdiskProvider = null }) {
      q.upsertItem.run(String(itemId), String(accountId), title, knowledge, skills, aiEnabled ? 1 : 0)
      // 网盘路径是可选字段：传了才更新，没传保持原值。
      if (netdiskPath !== null) {
        db.prepare('UPDATE items SET netdisk_path = ?, netdisk_provider = ? WHERE item_id = ? AND account_id = ?')
          .run(String(netdiskPath), String(netdiskProvider || 'quark'), String(itemId), String(accountId))
      }
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
          data.autoDeliver ? 1 : 0, data.deliverTemplate ?? '', data.tools ?? '', data.enabled === false ? 0 : 1,
          id,
        )
        return id
      }
      return q.insertService.run(
        data.name, data.systemPrompt ?? '', data.skills ?? '', data.model ?? '',
        data.autoDeliver ? 1 : 0, data.deliverTemplate ?? '', data.tools ?? '', data.enabled === false ? 0 : 1,
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
    setItemService(itemId, serviceId, accountId = '', title = '') {
      const id = String(itemId)
      const acc = String(accountId)
      // 商品还没登记过（没被扫描绑定过）时先建一行，否则 UPDATE 无处可改。
      q.ensureItem.run(id, acc, String(title || ''))
      q.setItemService.run(Number(serviceId) || 0, id, acc)
    },

    getSetting(key) {
      const row = q.getSetting.get(String(key))
      return row ? row.value : ''
    },
    setSetting(key, value) {
      q.setSetting.run(String(key), String(value ?? ''))
    },

    // ---- 0.10：会话镜像与去重 ----
    upsertMessage(row) {
      q.upsertMessage.run(
        String(row.cid), String(row.messageId), String(row.accountId ?? ''),
        String(row.sendUserId ?? ''), String(row.sendUserName ?? ''),
        Number(row.contentType ?? 0), String(row.text ?? ''), Number(row.createdAt ?? 0),
        String(row.raw ?? ''),
      )
    },
    messages: (cid, limit = 50) => q.messages.all(String(cid), Number(limit)),
    /** 面板从旧到新展示，库里按时间正序返回。 */
    messagesAscending: (cid, limit = 200) => q.messagesAsc.all(String(cid), Number(limit)),
    hasMessage: (cid, messageId) => Boolean(q.hasMessage.get(String(cid), String(messageId))),

    // ---- 会话元信息（面板列表读这个，不再每次开 IM 连接）----
    upsertChatMeta(row) {
      q.upsertChatMeta.run(
        String(row.cid), String(row.accountId ?? ''),
        String(row.peerNick ?? ''), String(row.peerUserId ?? ''),
        String(row.itemId ?? ''), String(row.itemTitle ?? ''),
        Number(row.sessionType ?? 0), Number(row.unread ?? 0),
        Number(row.ts ?? 0), String(row.lastMsg ?? ''),
      )
    },
    listChatsFromDb(accountId = '', limit = 200) {
      const rows = q.listChatMeta.all(String(accountId), Number(limit))
      return rows.map((r) => ({
        session_id: r.cid,
        peer_nick: r.peer_nick,
        peer_user_id: r.peer_user_id,
        item_id: r.item_id,
        item_title: r.item_title,
        session_type: r.session_type,
        unread: r.unread,
        ts: r.ts,
        last_msg: r.last_msg,
        source: 'db',
      }))
    },
    pruneChatMessages(days = 30) {
      return q.pruneMessages.run(Date.now() - Number(days) * 86400000).changes
    },

    markHandled(kind, ref, { cid = '', action = '' } = {}) {
      q.markHandledStmt.run(String(kind), String(ref), String(cid), String(action))
    },
    isHandled: (kind, ref) => Boolean(q.handled.get(String(kind), String(ref))),
    pruneHandled(days = 30) {
      return q.pruneHandled.run(`-${Number(days)} days`).changes
    },

    getChatState(cid) {
      return q.chatState.get(String(cid)) ?? null
    },
    setChatState(cid, patch = {}) {
      const current = q.chatState.get(String(cid)) ?? {
        account_id: '', last_ts: 0, last_order_no: '', last_message_id: '',
      }
      q.upsertChatState.run(
        String(cid),
        String(patch.accountId ?? current.account_id ?? ''),
        Number(patch.lastTs ?? current.last_ts ?? 0),
        String(patch.lastOrderNo ?? ''),
        String(patch.lastMessageId ?? ''),
      )
    },

    // ---- 待人工 ----
    addPendingTask({ kind, orderNo = '', itemId = '', buyerNick = '', detail = '', accountId = '' }) {
      // 同一单同一类失败不重复堆砌，避免每次轮询都新增一条。
      if (orderNo && q.openPendingForOrder.get(String(orderNo))) return null
      return Number(q.insertPending.run(
        String(accountId), String(kind), String(orderNo), String(itemId), String(buyerNick), String(detail),
      ).lastInsertRowid)
    },
    listPendingTasks: (state = 'open', limit = 200) => q.listPending.all(String(state), Number(limit)),
    resolvePendingTask(id, state = 'resolved') {
      q.resolvePending.run(String(state), Number(id))
    },

    // ---- 分享台账 ----
    addShare(row) {
      return Number(q.insertShare.run(
        String(row.accountId ?? ''), String(row.provider ?? 'quark'),
        String(row.itemId ?? ''), String(row.specValue ?? ''),
        String(row.sourcePath ?? ''), String(row.fid ?? ''),
        String(row.shareUrl ?? ''), String(row.passcode ?? ''),
        Number(row.urlType ?? 2), String(row.expiredAt ?? ''),
        String(row.strategy ?? 'reuse'), String(row.orderNo ?? ''),
        row.verified ? 1 : 0, String(row.verifyError ?? ''),
      ).lastInsertRowid)
    },
    lastShare: ({ itemId, provider = 'quark' }) => q.lastShare.get(
      String(itemId), String(provider), new Date().toISOString(),
    ) ?? null,

    // ---- 通知出口 ----
    addChannel({ botId, targetId, channel = '', label = '' }) {
      q.insertChannel.run(String(botId), String(targetId), String(channel), String(label))
      return q.listChannels.all().find((c) => c.bot_id === String(botId) && c.target_id === String(targetId)) ?? null
    },
    listChannels: () => q.listChannels.all(),
    setChannelEnabled(id, enabled) {
      q.toggleChannel.run(enabled ? 1 : 0, Number(id))
    },
    removeChannel(id) {
      db.prepare('DELETE FROM im_channels WHERE id = ?').run(Number(id))
    },
    markChannelOk(id) {
      q.channelOk.run(Number(id))
    },
    markChannelError(id, error) {
      q.channelFail.run(String(error ?? ''), Number(id))
    },

    recordNotify({ kind, ref = '', text = '', state = 'pending', error = '' }) {
      q.insertNotify.run(String(kind), String(ref), String(text), String(state), String(error))
      return Number(db.prepare('SELECT last_insert_rowid() AS id').get().id)
    },
    recentNotify: (limit = 100) => q.recentNotify.all(Number(limit)),
    unsentNotifyCount: () => Number(q.unsentNotify.get().n ?? 0),
    lastSentAtOfKind(kind) {
      const row = q.lastSentOfKind.get(String(kind))
      return row ? String(row.sent_at) : ''
    },

    // ---- 商品网盘路径 ----
    getCardSource: (itemId, specValue = '', accountId = '') =>
      q.getSource.get(String(itemId), String(specValue ?? ''), String(accountId ?? '')) ?? null,
    upsertCardSource({
      accountId = '', itemId = '', specValue = '', provider = 'quark',
      path = '', fid = '', strategy = 'reuse', expireDays = 7,
    }) {
      q.upsertSource.run(
        String(accountId), String(itemId), String(specValue ?? ''), String(provider),
        String(path), String(fid ?? ''), String(strategy), Number(expireDays) || 7,
      )
      return q.getSource.get(String(itemId), String(specValue ?? ''), String(accountId ?? '')) ?? null
    },
    listCardSources: (accountId = '') => q.listSources.all(String(accountId)),
    getCardSourceById(id) {
      return db.prepare('SELECT * FROM card_sources WHERE id = ?').get(Number(id)) ?? null
    },
    recordSourceCheck(id, { error = '', fid = '' } = {}) {
      const row = db.prepare('SELECT fid FROM card_sources WHERE id = ?').get(Number(id))
      q.setSourceCheck.run(String(error ?? ''), String(fid || row?.fid || ''), Number(id))
    },
  }
}

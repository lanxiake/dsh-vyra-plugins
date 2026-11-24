# dsh-sync — 同步模式：把 4×4 策略矩阵降为三选一

**Date:** 2026-11-24
**Plugin:** `plugins/dsh-sync/` (`@weibaohui/dsh-sync`)
**Status:** design approved in discussion, ready for implementation plan
**Decision:** 新增顶层配置项 `syncMode`（`mirror` / `backup` / `custom`），作为唯一的用户可见概念；四个 `*Strategy` 键降级为 `custom` 模式的载体。同时修复「本地删除永不同步」的语义缺陷，并把同步结果显示成一句人话 + 动作按钮。

---

## 1. 要解决的问题

用户面对的第一道坎不是 Git，是**策略矩阵**。要在两台机器间同步数据，用户得先理解：

- 4 个类别开关（skills / sessions / settings / plugins）
- 每个类别 4 个策略（备份 / 并集 / 覆盖·远端为准 / 覆盖·本地为准）
- 「实例 ID」是什么、`backup/<实例ID>/` 为什么永远不回读到本机
- 为什么填了同一个仓库，两台机器却各推各的分支、谁也不合并

实测反馈就是最后这一条：默认四个类别里三个是 `backup`，两台机器的内容落在**互不重叠的路径**里（`backup/A机/…` vs `backup/B机/…`），推上去的 PR 恒可合并——合了也等于没同步。用户看到的是「各自一个分支，没有合并」，而界面上没有任何文字解释这件事。

**目标**：用户填仓库地址 + token，保存，然后两台机器开始真正同步。不需要理解策略矩阵。

**非目标**：不让 sessions / settings / plugins 跨机合并（方案 A 的边界，见 §2）。

---

## 2. 决策记录（为什么是 A）

讨论中确认了「两台机器保持一致」的三档范围，选择 A：

| 档 | 含义 | 结论 |
|---|---|---|
| **A（采纳）** | 技能跨机一致；sessions / settings / plugins 保持按机器隔离，但可整机恢复 | 采纳 |
| B | A + settings 逐键白名单跨机合并 | 不做（数据层改造，留待后续） |
| C | 四类全部跨机一致 | 否决：会话是追加写的 jsonl，两台同时写会同 ID 冲突；插件清单跨机覆盖有宿主 crash loop 的真实故障记录（`src/index.js:1303-1306`） |

同时明确了两条在讨论中被纠正的认知：

1. **自动合并本来就有**。`runPush` 推完分支立刻查 `mergeable` 并 squash 合并、删源分支（`src/index.js:1020-1041`）。用户看到「两个分支没人合」的根因是 backup 策略让内容不重叠，以及 GitHub/GitLab/自建走到 `prSkipped`（`src/index.js:981-992`）——都不是「缺少合并功能」。所以本设计**不改合并链路**，改的是「让默认值落到真正会合并的那条路上」和「让用户看得见为什么没合并」。
2. **镜像模式与当前默认值的策略完全一致**。`mirror` = `{skills: union, 其余: backup}`，`DEFAULT_SYNC_SETTINGS` 今天就是这个组合。**方案 A 的收益不是改变默认行为，而是把认知路径从 16 个组合降到一个单选。**

---

## 3. 配置模型

### 3.1 新键

`DEFAULT_SYNC_SETTINGS` 增加：

```js
syncMode: 'mirror',       // 'mirror' | 'backup' | 'custom'
allowRemoteDelete: true,  // union 组是否镜像远端删除（§4）
```

`syncSettingsSchema()` 同步加两个字段（`S.string()` / `S.boolean()`），否则宿主 `describe()` 投影不到、面板保存不落盘（0.4.3 的教训）。

### 3.2 解析函数（纯函数，可单测）

```js
const SYNC_MODE_VALUES = ['mirror', 'backup', 'custom']
const SYNC_MODE_PRESETS = {
  mirror: { skillsStrategy: 'union',  sessionsStrategy: 'backup', settingsStrategy: 'backup', pluginsStrategy: 'backup' },
  backup: { skillsStrategy: 'backup', sessionsStrategy: 'backup', settingsStrategy: 'backup', pluginsStrategy: 'backup' },
}

/** 把 syncMode 折叠成实际生效的四个策略键。
 *  custom → 原样返回用户选的四键（已做白名单校验与默认回填）。
 *  mirror/backup → 预设值覆盖四键，用户遗留的四键值被忽略。 */
function resolveStrategies(eff) { ... }
```

所有读取策略的地方**统一改走 `resolveStrategies(eff)`**，不再直接读 `eff.*Strategy`。目前唯一的读取点是 `syncSpec()`（`src/index.js:757-797`），它的入参就是 `eff`（或 `{...eff, 四键被覆盖}` 的副本）；`backupLayoutSpec()` 正是靠把四键强制改成 `backup` 再调 `syncSpec` 实现「纯备份协议永远走 backup 布局」——这条语义必须保留，不能被 `syncMode` 覆盖。

实现方式：`resolveStrategies(eff)` 在 `eff` 上**已经带合法四键值时优先用它们**，只有四键缺失/非法时才回落到 `SYNC_MODE_PRESETS[syncMode]`。这样 `backupLayoutSpec` 的强制覆盖继续有效，而面板上选镜像是通过 §3.4「保存时展开预设」把四键一起写进去来实现的。这是本次最核心的接线点：漏一处就会出现「模式选镜像、实际按旧值跑」。

### 3.3 迁移（老用户不被静默改行为）

在 `syncSettings()` 的合并之后加一步 `migrateSyncMode(merged, sources)`：

- `merged.syncMode` 已经是合法值 → 直接返回（幂等）。
- 三个来源层（`config.sync`、宿主文档 `docSync`、自持 `fileSettings`）里**没有任何一个 `*Strategy` 键**被显式写过 → `syncMode = 'mirror'`（新装用户走推荐档）。
- 只要写过任意一个 → `syncMode = 'custom'`，四个键原样保留，行为与升级前**逐字节一致**。

迁移结果只体现在返回的 `eff` 对象上，不主动写盘；用户下次在面板保存时才落盘。

### 3.4 `PUT /dsh-sync/api/settings`

- 接受 `syncMode`（白名单校验，非法值进 `ignored`）与 `allowRemoteDelete`（boolean）。
- 接受 `syncMode` 时**同时**把预设展开写进四个 `*Strategy` 键（值取 `SYNC_MODE_PRESETS[mode]`），这样即使将来 `syncMode` 被外部清掉，落盘的策略仍是用户看到的那套。
- `syncMode === 'custom'` 时仍接受四个 `*Strategy`，行为同今天。

---

## 4. 删除传播（行为修复）

### 4.1 缺陷

A 删掉一个技能并推送 → B 的 `reconcileRemote` 把它归入 `remoteDeleted` 且**不回写 live**（`src/index.js:1294-1299`）→ B 下次 `runPush` 的 `mirrorLiveToShadow` 把 B 本地那份重新铺回影子仓库 → 提交出去 → **删除被 B 复活**。两台机器会在这一个文件上来回打。

### 4.2 规则

只对 `union` 策略组生效，`backup` / `local` / `remote` 组**一行不动**。当 reconcile 发现「远端删除了一个本机也存在的文件」时，按**从上到下第一条命中**的规则处理：

| 顺序 | 条件 | 行为 |
|---|---|---|
| 1 | 组策略不是 `union` | 不删，走今天的行为 |
| 2 | `allowRemoteDelete === false` | 不删，计入 `remoteDeleted`（今天的行为） |
| 3 | 首次接入 / 无共同基线（`noCommonBase`） | 不删 |
| 4 | 本机文件**改动过**（与 `fileBase` 字节不一致） | 不删，计入 `bothModified`（继续走 AI/手动） |
| 5 | 本机文件自基线以来**未改动**（与 `fileBase` 字节一致） | 删除 live 文件，计入 `applied` |

删除前不做额外备份：每日自动快照（`snapshotAuto`）与云端 `backup/<实例ID>/` 已提供兜底，且删除传播只作用于用户主动删除过的路径。

`pendingBoth` 的清理：文件被删除后从 `pendingBoth` 移除，避免下一轮按「未解决冲突」继续 preserve 一个不存在的文件。

---

## 5. UI

### 5.1 同步模式卡片（通用页签顶部）

三个单选，默认选中 `mirror`：

```
◉ 镜像同步（推荐）   两台机器保持一致：技能双向同步，设置/会话/插件清单按机器隔离
○ 仅备份             各机独立存档，可整机恢复
○ 自定义             逐类指定策略（保留原有 4×4 矩阵）
```

- `mirror` / `backup` 选中时，下方「类别开关 + 策略下拉」整块折叠，只显示一行灰字：
  「镜像同步下：技能跨机一致；设置 / 会话 / 插件清单留在这台机器，可从「浏览远端」或快照整机恢复。」
- `custom` 选中时展开现有矩阵，行为不变。

### 5.2 状态条

读 `status.lastResult`，按下表映射成一句话 + 动作按钮，10 秒级时长（不打断）。文案走现有 `t()`，中英双份：

| `lastResult` 形态 | 文案 | 动作 |
|---|---|---|
| `push.merged` 或 `push.prSkipped` | 「已同步 · N 个文件已回填」 | — |
| `push.prConflict && mergeRejected` | 「分支已推送，合并被拒：{reason}」 | 重试合并 · 清理遗留分支 |
| `push.prFailed` | 「分支已推送，创建 PR 失败：{reason}」 | 清理遗留分支 |
| `push.prSkipped`（GitHub/GitLab/自建） | 「已推送分支；该托管方需手动合并到 {branch}」 | 打开仓库 |
| `push.nothingToCommit` | 「已是最新」 | — |
| `pushError` / `pullError` / `reconcileError` | 「同步出错：{error}」 | 查看诊断 |
| 首次（无 `lastResult`） | 「尚未同步」 | 立即同步 |

第一版实现「重试合并」与「清理遗留分支」两个动作按钮；后者复用已有的 `POST /dsh-sync/api/prune-branches`，在不支持的托管方上按钮置灰并提示。

---

## 6. 组件与改动面

| 文件 | 改动 | 可独立理解 |
|---|---|---|
| `src/index.js` | `syncMode`/`allowRemoteDelete` 默认值与 schema；`resolveStrategies()`；`migrateSyncMode()`；策略读取全部改走 `resolveStrategies`；reconcile 删除传播；PUT 校验；`status` 增加 `syncMode`/`allowRemoteDelete` 回显 | 是，全部是 `src/index.js` 内的独立纯函数 + 两处循环改动 |
| `client/index.js` | 模式卡片、折叠矩阵、状态条、动作按钮、i18n 中英双份 | 是，只读现有 API 字段（`status.strategies`、`lastResult`、`pendingConflict`），不新增端点 |
| `client/bundle.js` | `npm run build:client` 产物 | — |
| `test/sync-mode.test.mjs`（新） | §3 的纯函数与迁移、PUT 校验 | 是 |
| `test/remote-delete.test.mjs`（新） | §4 的五个条件分支 | 是 |
| `README.md` | 使用章节改成「填仓库 → 选模式 → 保存」；更新日志追加一节 | — |

**不做**：不改合并链路（`runPush` 的 PR 流程）、不改 WebDAV / 本地文件夹协议、不动快照、不动凭据处理。

---

## 7. 测试与验收

离线测试（沿用 `test/*.test.mjs` 的 bare repo + stub 夹具）：

1. `resolveStrategies`：mirror / backup / custom / 非法值四种输入；以及 `backupLayoutSpec` 的强制 backup 覆盖优先级不被破坏；
2. `migrateSyncMode`：全新 → `mirror`；写过任一策略 → `custom` 且四键原值保留；幂等；`syncMode` 已显式设置时不被覆盖；
3. PUT：`syncMode=backup` 落盘时同时展开四个策略键；非法 `syncMode` 进 `ignored`；
4. 删除传播五分支（按 §4.2 的优先级顺序）：非 union 组不删、`allowRemoteDelete=false` 不删、无共同基线不删、改过的不删且进 `bothModified`、未改动的删且进 `applied`；
5. 状态条映射：§5.2 的七种 `lastResult` 形态各映射到预期文案与动作；
6. `npm run check` 与全量 `npm test` 保持全绿（现有 94 项不回归）。

真机验收（同一 profile 的两个实例目录，或两台机器）：

- A 新建技能 → B 同步后出现在 `~/.dsh/skills`；
- B 新建技能 → A 同步后出现；
- A 删除该技能 → B 同步后**也消失**（本轮修复的关键指标）；
- 两台机器的 `settings.yaml` 内容**各自独立不互相覆盖**；
- 保存配置后重启 dsh，`syncMode` 仍生效。

---

## 8. 风险

| 风险 | 缓解 |
|---|---|
| 删除传播误删用户文件 | 仅 `union` 组；仅「自基线未改动」；首次接入与无共同基线一律不删；提供 `allowRemoteDelete=false` 一键回到只增不删；云端 `backup/<实例ID>/` 与每日快照可恢复 |
| 老用户升级后行为被静默改变 | §3.3 迁移规则：写过策略即锁定 `custom` |
| 漏改某处策略读取，导致「选镜像、跑备份」 | 策略读取集中在 `resolveStrategies`，`test/sync-mode.test.mjs` 断言 `syncSpec` 产出的 `to` 路径 |
| 状态条把「已推送未合并」显示成成功 | §5.2 为 `prSkipped` / `mergeRejected` / `prFailed` 各自单列文案，测试用例 5 覆盖 |
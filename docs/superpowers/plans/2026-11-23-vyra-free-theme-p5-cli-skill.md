# vyra-free-theme P5（vft CLI + 技能）实施计划与执行记录

> **状态**：已完成（2026-11-23），提交 `f1f8819`、`7d6e378`。

**Goal:** 人类在面板里能做的每件事，Agent 都能用命令行做完；且 CLI 不存在时，Agent 仍能靠"写 `theme.json` + 跑校验"完成任务。

**Architecture:** CLI 是**离线编辑器**——直接读写 `theme.json`、`selection.json`、`state.json`，不需要 DSH 进程在跑。为了让 `vft theme apply` 有落笔之处，**主题选择权从 localStorage 上移到宿主**（`selection.json` + 两条路由），客户端启动时采纳、切换时回写。

**Spec:** `docs/superpowers/specs/2026-11-23-vyra-free-theme-design.md` §11、§12

## 关键决策

| # | 决策 | 理由 |
| --- | --- | --- |
| P5-D1 | 选择权归宿主（`selection.json`），`?skin=` 仍然最高优先 | 只存在浏览器里的选择，Agent 改不了、第二个浏览器也读不到；一句话：CLI 的 `apply` 必须有地方落笔 |
| P5-D2 | CLI 全部走纯文件操作，不走 HTTP | 不需要 DSH 在跑；也避免"CLI 依赖宿主 API"导致一环坏全坏 |
| P5-D3 | CLI 打成一个 ESM 包（`lib/cli.mjs`） | 发布包只带 `lib/`，源码版 `cli/vft.mjs` 依赖 `src/`；不打包就会在安装后 import 失败（本轮实际踩到） |
| P5-D4 | 只读主题（内置/预设）上的写操作 → 退出码 3 并给出 `theme create --from` 的下一步 | "确认"与"报错"分开，Agent 能据此决定是否先复制 |
| P5-D5 | 技能由宿主在启动时写入 `~/.dsh/skills/vyra-free-theme/`，内容变才写 | 与录屏插件的既有做法一致；只读 HOME 时静默跳过，不阻塞主题加载 |
| P5-D6 | `wallpaper gen/video` 先返回退出码 3 + `pending: "comfyui"` | 命令面先立住，P6 接 ComfyUI 时只补实现，不改 CLI 契约 |

## 任务与证据

### Task 1: 宿主选择存储

**Files:** `src/host/themes/selection.js`（新建）、`src/client/selection-sync.js`（新建）、路由 `GET/POST /vyra-free-theme/selection`、`src/index.js` 接线、`client/index.js` 接线

**证据：** `tests/selection.test.mjs` 5/5 —— 原子写往返、`official` 合法、`../escape` 被拒、手改坏的 `selection.json` 读成 null 而不会抛、`clearSelection` 删除文件、技能与垫片"装一次 + 内容变了才重写"。

### Task 2: CLI（19 个子命令）

**Files:** `cli/vft.mjs`（导出 `run(argv, opts)` 以便测试）、`bin/vft`、`bin/vft.cmd`

命令面：`theme list/show/create/rename/delete/apply/reset/export/import/check`、`wallpaper list/add/set/gen/video`、`sidebar list/set/tune`、`colors suggest`、`brand set`、`appearance set`、`reset`。全部 `--json`；退出码 `0/2/3/1`。

**证据：** `tests/cli.test.mjs` 14/14：
- `list` 同时给出内置（nebula / ink-landscape）与预设（mono…），每条带 `score/pass`
- `create --from mono --id mine --name 我的主题` 落盘且能再被校验；重复 id → 退出码 3
- 改内置主题（`sidebar set nebula obsidian`）→ 退出码 3 + "只读"提示
- `apply` 写 `selection.json`，`theme list --json` 的 `active` 跟着变；`reset` 写回 `official`
- 糊配色主题 `theme check` → 退出码 2；正常主题 → 0
- `delete` 无 `--force` → 3；有 → 0 且目录消失
- `wallpaper add` 复制文件并重写 `wallpaper` 块（`assets/wall.webp`）
- `appearance set --coverage-shell on --scopes sidebar,topbar` 正确落盘
- `colors suggest` 给三种和谐方式排序，`--apply` 后仍过门禁
- `export`/`import --id copied` 往返成功
- 未知子命令 → 1；`wallpaper gen` → 3 且 `pending: comfyui`

### Task 3: 技能文档

**Files:** `skill/SKILL.md`

内容：数据目录与"`theme.json` 是唯一真相"；完整命令表；三条工作流（一张图造主题 / ComfyUI 出一套壁纸含动态 / 导入导出回滚）；视频与代码壁纸的 JSON 写法与 `art.mount(canvas, env)` 契约；配色门禁语义；6 条铁律（先 check 再交付、内置只读、删主题要确认…）；故障对照表。

**证据：** 由 Task 1 的技能安装测试覆盖（写入 + 幂等）。

### Task 4: 运行期安装技能与垫片

**Files:** `src/host/install-skill.js`（新建）；`src/index.js` 在 apply 里调用

写入 `~/.dsh/skills/vyra-free-theme/SKILL.md` 与 `~/.dsh/vyra-free-theme/bin/{vft,vft.cmd}`，优先指向打包后的 `lib/cli.mjs`。

### Task 5: CLI 打包（本轮修复）

`scripts/build-client.mjs` 增加第三个产物 `lib/cli.mjs`（esm / node22 / bundle），并校验产物含命令面标记。

**证据：** `npx` 无关，直接跑安装副本：
```
node <profile>/node_modules/vyra-free-theme/lib/cli.mjs theme list
→ pass 79 builtin ink-landscape / pass 91 builtin nebula / …
```

## 汇总证据

- `node --test tests/*.test.mjs` → **100/100**
- `npm run build` → `lib/client.js` 380246 B、`lib/index.js` 85981 B、`lib/cli.mjs` 70701 B
- profile 内已刷新（复制式安装，见 P4 事故说明）并实测 CLI 可跑
- 提交：`f1f8819`（主体）、`7d6e378`（CLI 打包修复）

## 偏差与遗留

1. **`theme export` 导出的是目录，不是 zip**（无 zip 依赖）。规格写的是 zip；后续若要单文件分享再引入压缩实现。
2. **`wallpaper gen/video` 未接线**（P6）。
3. **面板尚未加"侧栏样式选择器 / 配色评分卡"UI**：本轮把能力做在 CLI 与共享模块里，面板 UI 与 CLI 的对等性由测试保证（CLI 已覆盖全部面板语义动作），面板 UI 留到 P7 收尾或用户明确要求时再做。
4. `theme check` 的 `failures` 是**逐维低分项**，`pass` 是加权结论 —— 可能出现"通过但列了 hue 建议"（ink-landscape 就是这样：79 分通过，同时提示色相偏离常见区间）。这是有意为之：告警不等于不合格。

## 下一阶段入口

P6：内置 5 套主题出图（ComfyUI）+ 动态壁纸 + `wallpaper gen/video` 接线 + 可选像素采样器（让配色门禁的"壁纸干扰度"真正生效）+ 打包门禁。

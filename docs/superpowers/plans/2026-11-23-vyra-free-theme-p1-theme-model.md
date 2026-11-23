# vyra-free-theme P1（主题数据模型）实施计划与执行记录

> **状态**：已完成（2026-11-23）。本文既是计划也是执行记录：任务按实现顺序排列，证据取自实际测试输出。

**Goal:** 让"主题是文件"这条地基成立——一份 `theme.json` 与一个编译进代码的主题，产出**同一份 `SkinEffects`**，面板/宿主对二者一视同仁。

**Architecture:** 复用现有投影核（`client/skins/translucency.js` 的 `createProjection`）：JSON 主题只负责把 `theme.json` 编译成投影表（`tableFromTheme`），之后走同一条 `project → normalizeEffects` 管线。字段目录（壁纸/标语/通透度）由 `fieldsFromTheme` 生成并注册进共享 catalog，于是宿主存储与客户端面板无需知道主题来源。

**Spec:** `docs/superpowers/specs/2026-11-23-vyra-free-theme-design.md` §5

## 关键决策

| # | 决策 | 理由 |
| --- | --- | --- |
| P1-D1 | JSON 主题不新增渲染路径，只喂现有投影核 | 一条管线 = 一套降级逻辑；避免"内置能用的能力自定义用不了" |
| P1-D2 | 通透度语义定为 `alpha = P/100`（默认 `baked = anchor`） | 滑块读作"表面多不透明"：0=壁纸全透，100=全遮；主题可用 `translucency.baked` 给单个令牌抬高或压低地板 |
| P1-D3 | 无壁纸资产时用 `baked-gradient` 双停渐变兜底（本主题基色 × alpha） | 复用编译期皮肤的分支，空资产不会渲染成透明 |
| P1-D4 | 外部皮肤注册表（`registerExternalSkin`）而非改造 `SKINS` 常量 | 内置仍由编译期保证完整；外部条目可注销，主题删掉后不留残留 |
| P1-D5 | 校验 fail-closed，一次返回全部问题（`{code, path, message}`） | 面板能一次性列出所有毛病；坏主题绝不半注册 |
| P1-D6 | 宿主先注册再开路由 | 存储校验任何一次写入都必须先认识该主题的字段 |
| P1-D7 | 新增 `runtime.refreshSelection()` | 文件主题晚于首帧到达；没有它，用户存的主题 id 会在启动时被静默降级 |

## 任务与证据

### Task 1: `theme.json` 模型

**Files:** `src/shared/personalization/theme-model.js`（新建）、`tests/theme-model.test.mjs`

**Interfaces:**
- `normalizeTheme(raw) -> { ok: true, theme } | { ok: false, issues: [{code, path, message}] }`
- `fieldsFromTheme(theme, profile) -> Field[]`（`wallpaper` / `slogan` / `panelOpacity`）
- `tableFromTheme(theme, profile) -> Table`（喂 `createProjection`）
- `bodyAttributeFor(id) -> string`、`hexToRgb(hex) -> "r, g, b"`、`TRANSLUCENT_TOKENS`

校验覆盖：schema 版本、id 形状、`{zh,en}` 双名、light/dark 令牌集合一致、随动令牌必须 `#RRGGBB`、`--dsw-alias-bg-base` 必填、未知顶层字段、未知 brand/translucency 字段、`translucency.baked` 只认随动令牌、壁纸 kind 白名单（P1 仅 `image`）。

**证据：** `node --test tests/theme-model.test.mjs` → 11/11。含两条关键断言：
- `panelOpacity=55` 时 `--dsw-alias-bg-base` → `rgba(247, 245, 242, 0.55)`；`0` → `0.00`；`100` → `1.00`
- 无壁纸资产时 `backdrop.imageLight` 是双停渐变而非 `null`

### Task 2: 共享 catalog 的外部皮肤注册表

**Files:** `src/shared/personalization/catalog.js`（改）、`tests/catalog-external.test.mjs`

新增 `registerExternalSkin({id, fields, builtinAssets})` / `unregisterExternalSkin` / `getExternalSkin` / `listExternalSkinIds`；`getSkinSchema` / `getField` / `listAssetFields` / `defaultWallpaperRef` / `validateImageRef` 统一走 `skinEntry()`（内置优先，外部其次）。内置行为不变（desktop 的 `panelOpacity: 66` 默认仍只作用于编译期皮肤——外部主题的默认值来自它自己的 `translucency`）。

**证据：** 5/5。含：外部皮肤的越界值被拒（`panelOpacity: 101`）、未知字段被拒、`builtin:other:art` 被拒、id 与内置同名时抛错、空字段表抛错。

### Task 3: 宿主主题仓库

**Files:** `src/host/themes/repository.js`（新建）、`src/host/personalization-routes.js`（新增 `GET /vyra-free-theme/themes`）、`src/index.js`（接线）、`tests/theme-repository.test.mjs`

`createThemeRepository({dirs, profile})`：扫内置（包内 `themes/`）与用户（`<dataDir>/themes/`）两处，目录名必须等于 `theme.id`，同 id 内置优先并报 `shadowed`，`sync()` 先注销上一轮再注册（删掉的主题不会残留），`discover()` 不做副作用。

**证据：** 6/6。含：坏 JSON 只产出一条 `bad-json` 问题而不是崩；`dir-id-mismatch`；`shadowed`；删目录后再 `sync()` 注册表同步消失。

### Task 4: 客户端安装器

**Files:** `src/client/themes.js`（新建）、`src/client/runtime.js`（加 `refreshSelection`）、`src/client/index.js`（接线）、`tests/client-themes.test.mjs`

`installFileThemes({runtime, jsx, profile})` 把每个主题变成与编译期皮肤**同形**的 7 字段对象：`label/description` 用 `{zh,en}`，`Mark`/`Name` 用 `jsx` 画品牌位（`Name` 渲染主题自己的名字，即"替换产品字标"），`project` 是 `createProjection(tableFromTheme(...))`。单个主题注册失败不影响其它；目录不可达则 reject（不静默）。

**证据：** 4/4。含：注册后的皮肤 `project()` 产出 `bodyAttribute: "vftNebula"`、`titleBrand: "主题nebula"`、`Name()` 渲染该标题；与内置同名的 `openbmc` 被拒但 `nebula` 仍装上；HTTP 500 → 抛错。

### Task 5: 两套原创主题

**Files:** `themes/nebula/theme.json`、`themes/ink-landscape/theme.json`

只带配色/形状/通透度/覆盖默认值（壁纸留给 P2/P6）。`nebula`：紫罗兰冷调，`translucency.web=45`；`ink-landscape`：宣纸暖调 + 松烟墨，`translucency.web=50`。

**证据：** 仓库测试用临时目录验证过同一套校验；构建后 `themes/` 随包安装（profile 内可见 `ink-landscape`、`nebula`）。

### Task 6: 构建、全量测试、装回 profile

**证据：**
- `npm run build` → `lib/client.js` 355591 B、`lib/index.js` 69660 B
- `node --test tests/*.test.mjs` → **37/37**
- `node --check` 双产物通过；`/vyra-free-theme/themes` 在宿主产物 1 处、客户端 1 处
- profile 内已刷新为 355591 B 且带 `themes/`；`cordis.patch.yml` 仍 14 条、三条 `disabled`（含旧两插件）

## 偏差与遗留

1. `titleBrand` 取 `brand.title.zh ?? name.zh`（编译期皮肤用单一字符串，无 `{zh,en}`），英文环境会显示中文标题——P3 做品牌位时改为按 locale 取值。
2. 主题级 `Mark` 目前是中性圆环 SVG；`brand.mark` 的路径/内联 SVG 解析留到 P2（需要主题资源路由）。
3. 壁纸只接受 `image` 且尚未真正渲染（需要 `/vyra-free-theme/theme/<id>/<file>` 资源路由）——P2 一并做。
4. `coverage` / `sidebar` / `decorations` 只校验与透传，未参与投影——P2/P3 接上。
5. `GET /themes` 路由本身没有独立路由测试（它只是 `sendJson(themes())` 的一层薄壳，逻辑已被仓库测试覆盖）。

## 下一阶段入口

P2 需要：壁纸四通道 + 主题资源路由 + `coverage` 接线 + `builtinAssets` 填充（让文件主题的内置壁纸出现在面板里）。

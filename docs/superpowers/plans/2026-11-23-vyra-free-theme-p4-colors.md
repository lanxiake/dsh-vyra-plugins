# vyra-free-theme P4（配色评估）实施计划与执行记录

> **状态**：已完成（2026-11-23），提交 `0e7422d`。

**Goal:** 主题配色的好坏要**可计算、可复现、可拦截**：五维打分器 + 6 套内置配色预设 + 一条 `verify:colors` 门禁，低于 70 分不许当成品交付。

**Architecture:** 打分器是纯函数（`shared/personalization/color-score.js`），不碰 DOM、不依赖图像解码器，所以测试、CLI、面板、门禁脚本用的是**同一份实现**。像素证据（壁纸细节度）是可选输入：拿不到就排除该维度并重新归一化权重，报告里明说 `excluded`，而不是猜一个分数。

**Spec:** `docs/superpowers/specs/2026-11-23-vyra-free-theme-design.md` §8

## 关键决策

| # | 决策 | 理由 |
| --- | --- | --- |
| P4-D1 | 无采样时排除"壁纸干扰度"并重归一化，不填 0 也不填满分 | 填 0 会冤枉好主题，填满分会放过花壁纸；两种都在撒谎 |
| P4-D2 | 明度分布用**感知明度（HSL L）**而非 WCAG 相对亮度 | 相对亮度在近黑处压缩极狠，深色主题明明有层次却测成"一片糊"（实测 nebula 深色 0.006 vs 0.045） |
| P4-D3 | 色相和谐只认三档：单色 0–15°、类似 0–45°、互补 150–210°，区间外线性衰减 | 与规格一致；90° 那种"不上不下"的配色要能被扣分 |
| P4-D4 | 建议配色是确定性函数（种子色 + 和谐方式） | 同输入同输出，才能进测试、才能被 CLI/面板/Agent 复现 |
| P4-D5 | 预设就是完整的 `theme.json`（放在 `presets/colors/`） | 预设与主题同构，`theme create --from preset` 直接复制即可，不用第二套模型 |
| P4-D6 | 门禁脚本与 `npm run check` 串联 | 配色不合格 = 构建不合格，不靠人记得跑 |

## 任务与证据

### Task 1: 五维打分器

**Files:** `src/shared/personalization/color-score.js`（新建）

导出：`parseColor` / `relativeLuminance` / `contrastRatio` / `composite` / `rgbToHsl` / `hslToRgb` / `hueHarmonyScore` / `scoreTheme` / `suggestPalette` / `rankPalettes` / `SCORE_THRESHOLD`。

维度权重按规格：对比度 30、品牌色 20、明度分布 20、色相 15、干扰度 15。每个失败项都带一句可执行的 `fix`（"把 label-secondary 调向背景反方向"、"提高 overlay 不透明度"…）。

**证据：** `tests/color-score.test.mjs` 8/8：
- `#000` vs `#fff` 对比度 = 21；50% 混合得 `rgb(128,128,128)`
- 色相：0°/20°/180°/205° → 100 分；90° → 0 分
- 糊主题（前景 `#DDD8EE` 压 `#F4F2FF`）→ `pass:false`，失败项含 contrast 与 brand，且每条都有 `fix`
- 花壁纸（`edgeEnergy 0.30 / stdLuma 0.42`）→ 干扰度命中、总分下降；平静壁纸（0.01/0.02）→ 干扰度满分、无干扰失败项

### Task 2: 建议配色

`suggestPalette(seed, {harmony})` 从种子色派生完整明暗令牌集（bg-base/layer1-3/module/sidebar/brand/label），品牌色按明暗分别保证 ≥3:1；`rankPalettes` 用同一打分器给三种和谐方式排序。

**证据：** 三种和谐方式生成的调色板全部过门禁（≥70）；`#6D4AFF` 两次调用结果完全一致。

### Task 3: 6 套内置配色预设

**Files:** `presets/colors/{warm-organic,macos-glass,cyber-neon,morandi,paper,mono}/theme.json`

前 5 套由 `suggestPalette` 以各自种子色生成（米色琥珀 / 系统蓝 / 品红 / 灰蓝 / 纸黄），第 6 套 `mono` 手写中性灰阶。全部是完整主题，可直接被 `theme create --from` 复制。

**证据：** `tests/color-presets.test.mjs` 4/4；`node scripts/check-colors.mjs`：

```
colour gate · threshold 70
pass  91  theme  nebula
pass  79  theme  ink-landscape
pass  89  preset cyber-neon
pass  95  preset macos-glass
pass  94  preset morandi
pass  92  preset mono
pass  88  preset paper
pass  91  preset warm-organic
8/8 at or above threshold
```

### Task 4: 门禁脚本

**Files:** `scripts/check-colors.mjs`（新建）、`package.json`（`verify:colors`、并入 `check`）

支持 `--table`（逐维明细）、`--json`（机器可读）；任一项不合格 → 退出码 2。

## 汇总证据

- `node --test tests/*.test.mjs` → **81/81**
- `node scripts/check-colors.mjs` → 8/8 过线，退出码 0
- `npm run build` → `lib/client.js` 378794 B、`lib/index.js` 80923 B
- 提交：`0e7422d`

## 偏差与遗留

1. **面板评分卡**未做：本轮只交付打分器 + CLI 门禁。面板 UI 与 CLI 的"操作对等"在 P5 一起做（避免两次动面板）。
2. **壁纸像素采样**未接：规格里"壁纸干扰度"需要真实像素。当前打分器接受 `sampled` 输入，但没人产出它。计划在 P6（有真实生成壁纸时）加一个可选采样器（优先纯 JS 解码 webp 或调用本机 ComfyUI 的图片统计），拿不到就继续 `excluded`。
3. 又一次踩到编码坑：PowerShell `Get-Content`/`Set-Content` 往返会把中文写坏（`？` 变 `?`、引号截断）。文件级的修改从此只用 write 整份重写，脚本只做新增/删除。

## 下一阶段入口

P5：`vft` CLI + 技能写入。CLI 要覆盖：主题 CRUD、壁纸导入/生成、侧栏包、品牌、覆盖开关、配色建议/门禁、导入导出、回官方。命令全部 `--json`，退出码 0/2/3 可判；技能写进 `~/.dsh/skills/vyra-free-theme/`。

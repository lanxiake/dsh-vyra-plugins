# vyra-free-theme P6（壁纸生产：代码生成 + ComfyUI 接线）实施记录

> **状态**：代码生成通道已完成并出货（`80d9ca0`）；ComfyUI 通道已实现并通过假传输测试，真实 GPU 生成**待认证/待空闲**。

**Goal:** 主题不能只"能配壁纸"，还要**能生成壁纸**——而且要有一类完全不依赖 GPU 的生成方式，否则 Agent 在没有显存时什么都做不了。

## 三条生成路径（互为备份）

| 路径 | 产物 | 依赖 | 代表主题 |
| --- | --- | --- | --- |
| 运行时 canvas 代码 | `art.js`，实时绘制 | 无 | `nebula`（星云，220 星 + 光雾） |
| 程序化静帧 | PNG（图片通道） | 无（纯 Node + zlib） | `ink-landscape`（水墨云山，明暗两版） |
| 程序化动态 | 48 帧 → ffmpeg → 循环 MP4（视频通道） | ffmpeg | `aurora`（流体极光） |
| ComfyUI 生成 | PNG / 任意 | 本机 ComfyUI（认证 + 空闲显存） | 待生成 |

## 关键决策

| # | 决策 | 理由 |
| --- | --- | --- |
| P6-D1 | 程序化图形用**纯 Node 写像素**，不引入 canvas/sharp | 零原生依赖；同一份代码在测试、CLI、构建脚本里跑，产物可复现 |
| P6-D2 | 图形库是"配方 + 种子 + 尺寸"的确定函数 | 主题资源可以随时重建；删了资产不等于丢了主题 |
| P6-D3 | PNG 统计自己解码（zlib + 反滤波），不装 sharp | 让"壁纸干扰度"这维真正生效，同时保持零依赖 |
| P6-D4 | 统计默认全像素（`step=1`） | 子采样会和周期性图案发生混叠：2px 棋盘按 2 取样会读成"纯色"，等于把花壁纸判成干净 |
| P6-D5 | 动态壁纸用 ffmpeg 编码静音循环 mp4，先探 `-version` | 缺 ffmpeg 时给"缺 ffmpeg"而不是堆栈 |
| P6-D6 | `aurora` 只用一条片子服务明暗两个模式 | fluid 配方本身适配深色；省一半体积，明暗差异交给主题遮罩 |
| P6-D7 | ComfyUI 生成走 HTTP（`/prompt` → `/history` → `/view`），注入 `fetch`/`sleep` | 全流程可单测；真机只差地址与凭据 |

## 交付物

**新增模块**
- `src/shared/art-recipes.js` — 6 个配方：`starfield` / `ink-wash`（含 `tone: dark`）/ `fluid` / `neon-grid` / `paper-grain` / `ridge-dawn`；`starfield` 与 `fluid` 支持 `time` 参数（动起来就是视频）
- `src/shared/png-stats.js` — PNG 解码（8-bit、非隔行、全部滤波类型）+ `stdLuma`/`edgeEnergy` + PNG 编码器（测试用）
- `src/host/art-video.js` — 逐帧渲染 → ffmpeg（libx264 / yuv420p / faststart / 无音轨）→ 校验 ≤50MB
- `src/shared/comfy-workflow.js` — Qwen-Image 2.1 工作流构造（`UNETLoader` + `CLIPLoader(qwen_image)` + `VAELoader` + `EmptySD3LatentImage`（16ch）+ `KSampler` + `VAEDecode` + `SaveImage`）+ 结构校验
- `src/host/comfy.js` — ComfyUI 客户端（submit / wait / download / ping，Basic 或 Bearer 认证）
- `scripts/build-theme-art.mjs` — 内置主题壁纸的确定性重建脚本（`npm run build:art`）

**新增 CLI 能力**
```
vft wallpaper recipes
vft wallpaper art  <id> --recipe ink-wash --size desktop --side both
vft wallpaper anim <id> --recipe fluid --frames 48 --fps 24
vft wallpaper gen  <id> --prompt "…"        # ComfyUI
```
`wallpaper art/anim` 会同时写 `wallpaper-stats.json`，让配色门禁的干扰度维度立即生效。

**新增主题** `aurora`（极光）：流体视频壁纸 + 霓虹侧栏包 + 外壳透壁纸。

## 证据

- `node --test tests/*.test.mjs` → **125/125**（新增 6 项图形配方 + 3 项 CLI art + 8 项 ComfyUI/PNG）
- `node scripts/check-colors.mjs` → **9/9 过线**，且 `ink-landscape` / `aurora` 带真实像素统计（干扰度维度已参与打分）
- 产物尺寸：`ink-light 2048×1280 / 1.1MB`、`ink-dark 993KB`、`aurora 1280×720 48帧@24fps / 335KB + poster 692KB`
- 数值抽检（我无法看图，只能量）：ink 亮版 mean RGB `189,186,179`、52.5% 高光像素；ink 暗版 mean `58,61,68`、52.1% 暗像素；aurora poster mean `66,103,136`（青蓝）
- 已装进 profile（`themes: aurora, ink-landscape, nebula`，含全部资源）

## 未完成 / 待用户

1. **ComfyUI 真实生成未跑**：本机 `http://127.0.0.1:8188` 返回 401（需要凭据），且当前队列里有 1 个运行中 + 1 个排队任务、空闲显存仅 0.8G。`vft wallpaper gen` 已实现并通过假传输测试，缺的是 `COMFYUI_AUTH`（或 `--comfy-auth`）与空闲显存。
2. **视频壁纸的 ComfyUI 路线（图生视频）** 仍是 `exit 3`：需要一条经过验证的 i2v 工作流模板（本机有 `minimax_h3_fl2va` / `hunyuanvideo1.5_i2v` 权重，但图节点契约未验证）。
3. `aurora` 的明暗共用一条片子——如果你希望两种模式色温不同，加一条 dark 片子即可（`build:art` 里把 sides 恢复成两边）。

## 下一阶段入口

P7：迁移/退役/发布——旧两插件从 `docs/index.json` 下架、profile 禁用条目固化、README/NOTICE 重写、`vyra-free-theme@0.1.0` 发布、市场索引更新；顺带把"面板 UI 侧栏选择器/配色评分卡"补上或明确列为后续。

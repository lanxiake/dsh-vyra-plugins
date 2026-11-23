---
name: vyra-free-theme
description: 用 vft CLI 或直接编辑 theme.json 管理「自由主题」插件的主题、壁纸（静态/视频/动图/代码）、左侧菜单样式、品牌与覆盖开关，并对配色打分。当用户说「换主题」「做个壁纸」「配一下侧栏」「这套配色行不行」「导入/导出主题」时使用。
---

# 自由主题（vyra-free-theme）

**先记住一句话：`theme.json` 是唯一真相。** CLI 只是对它的谨慎编辑；CLI 不可用时，直接写文件再跑 `vft theme check` 同样成立。

## 位置

- 数据目录：Web `$DSH_HOME/vyra-free-theme/`　Desktop `$DSH_HOME/vyra-free-theme-desktop/`
- 用户主题：`<数据目录>/themes/<id>/theme.json`（内置主题在包的 `themes/`，**只读**）
- 配色预设：包的 `presets/colors/`（只读，用于 `theme create --from`）
- 当前选择：`<数据目录>/selection.json`（宿主所有，客户端读它）
- 个性化覆盖：`<数据目录>/state.json` 的 `skins.<id>`
- CLI：`~/.dsh/vyra-free-theme/bin/vft`（sh）或 `vft.cmd`（PowerShell）

不确定路径时先跑 `vft theme list --json`，返回里带 `active` 与每个主题的 `score`。

## 命令表

```
vft theme list [--json]
vft theme show <id> [--json]                       # 含 resolved.sidebar 与 colour 报告
vft theme create --from <id> --id <新id> [--name 名称] [--name-en Name]
vft theme rename <id> --name <中文名> [--name-en <English>]
vft theme delete <id> --force
vft theme apply <id>                               # 写 selection.json，客户端刷新后生效
vft theme reset <id>                               # 清该主题的个性化覆盖（不是回官方）
vft theme export <id> --out <目录>
vft theme import <目录> [--id 新id]
vft theme check [id…] [--json]                     # 校验 + 配色门禁（<70 退出码 2）

vft wallpaper list <id> [--json]
vft wallpaper add <id> <图片…> [--mode light|dark|both]
vft wallpaper set <id> --src assets/x.webp [--mode …]
vft wallpaper recipes                              # 程序化图形库（无需 GPU）
vft wallpaper art <id> --recipe starfield [--size portrait|desktop|square] [--side both] [--seed 1]
vft wallpaper anim <id> --recipe fluid [--frames 48] [--fps 24] [--size …]   # 需 ffmpeg
vft wallpaper gen <id> --prompt "…" [--size …] [--seed N]   # 需本机 ComfyUI
vft wallpaper video <id> …                         # 需视频工作流（未接线）

vft sidebar list                                   # 5 款包
vft sidebar set <id> <inherit|frost|hairline|obsidian|neon>
vft sidebar tune <id> [--blur 14] [--radius-card 16] [--radius-item 10] \
                      [--density compact|cozy|comfortable] [--icon-light #333] [--icon-dark #eee]

vft colors suggest <id> [--seed #RRGGBB] [--apply]
vft brand set <id> [--title 中文] [--title-en English] [--slogan 中文] [--slogan-en English] [--mark 路径或SVG]
vft appearance set <id> [--translucency-web 45] [--translucency-desktop 66] \
                        [--coverage-shell on|off] [--scopes sidebar,topbar]
vft reset                                          # 回官方主题
```

退出码：`0` 成功 · `2` 校验或配色未过 · `3` 需要确认（删主题、改只读主题、功能未接线）· `1` 错误。所有命令都接受 `--json`。

## 三条工作流

### ① 一张图造主题

```bash
vft theme create --from mono --id my-kiro --name "我的主题" --name-en "My Theme"
vft wallpaper add my-kiro ./wallpaper.webp
vft colors suggest my-kiro --apply        # 从壁纸/品牌色派生一套过门禁的配色
vft theme check my-kiro                    # 必须 exit 0 才算完成
vft theme apply my-kiro
```

### ② 用代码出壁纸（推荐先走这条：零算力、可复现）

```bash
vft wallpaper recipes                     # 看有哪些程序化图形
vft wallpaper art  my-kiro --recipe ink-wash --size desktop --side both
vft wallpaper anim my-kiro --recipe fluid --size desktop --frames 48 --fps 24   # 动态壁纸
```

`art` 直接写 PNG（静帧，图片通道），`anim` 渲染 N 帧再用 ffmpeg 编成静音循环 mp4（视频通道，需要 ffmpeg）。
内置主题里：`ink-landscape` 是代码生成的静帧，`aurora` 是代码生成的动态壁纸，`nebula` 是运行时 canvas 动画（`art.js`，不落文件）。

### ③ 用 ComfyUI 出壁纸（需要本机 GPU）

视频/代码壁纸的 `theme.json` 写法：

```json
"wallpaper": { "kind": "video",
  "light": { "src": "assets/loop-light.mp4", "poster": "assets/loop-light.webp" },
  "dark":  { "src": "assets/loop-dark.mp4",  "poster": "assets/loop-dark.webp" } }
```

```json
"wallpaper": { "kind": "code", "entry": "art.js" }
```

代码壁纸契约（单文件、不得 `import`、≤256KB）：

```js
export const art = {
  mount(canvas, env) {
    // env = { width, height, dpr, mode: "light"|"dark", reducedMotion }
    // 自己 requestAnimationFrame；返回 { destroy() {} }
  },
};
```

它跑在不透明源的沙箱 iframe 里，CSP 禁止一切网络；首帧 2 秒未出或抛错 → 自动降级成主题渐变，界面不受影响。

### ③ 导入 / 导出 / 回滚

```bash
vft theme export my-kiro --out ./my-kiro.vft
vft theme import ./my-kiro.vft --id my-kiro-2
vft theme apply nebula      # 不满意就切回去
```

## 配色门禁

五维：文字对比度 30、品牌色 20、明度分布 20、色相和谐 15、壁纸干扰度 15（无像素数据时该维**排除**并重归一化，报告里 `excluded` 会写出来）。

`vft theme check` 低于 70 → 退出码 2，结果里每条 `failures` 都带 `fix` 建议。**没跑过 check 的主题不算交付。**

## 铁律

1. 先 `vft theme check`，再交付；改完 `theme.json` 一定重跑。
2. 内置主题只读：要改先 `theme create --from <内置id> --id <新id>`。
3. 删主题要用户确认；确认后才加 `--force`。
4. 代码壁纸必须自带兜底：`mount` 里不要假设 canvas 上下文一定可用。
5. 第三方 IP 角色图只放进标记为 `ip` 的主题，且卡片要有"非官方 · 版权归原作者"角标。
6. 不要改宿主 DOM、不要改 `lib/`（构建产物）。

## 出问题怎么查

| 现象 | 查法 |
| --- | --- |
| 面板里看不到主题 | `vft theme list` 有没有它；`theme.json` 是否 `dir 名 == id` |
| 切换没反应 | `selection.json` 的 `skinId`；客户端要刷新 |
| 壁纸不显示 | `vft wallpaper list <id>`；`wallpaper.light.src` 路径是否存在 |
| 侧栏没变化 | `vft sidebar list` 看包名；该主题是否 `coverage.shell` |
| 配色被打回 | `vft theme check <id> --json` 看 `failures[].fix` |

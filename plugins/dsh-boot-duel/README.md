# 开工大吉

每次打开 DSH Web 界面，先来一局**打工人火柴人对决**：按 `Enter` 起势，把对手血条打空即可进入首页，按 `Esc` 或右下角「跳过」直接放行。

一个办公室，两个打工人，一场说不清是加班、优化还是改稿的对峙。打完，接着上班。

## 这一版做了什么

- **十一质点 Verlet 骨架。** 整副身体由 11 个质点加距离约束构成，站立时是程序化姿势，被打倒时交给 Verlet 积分器——所以击飞是身体真的飞出去，不是换一张图。
- **由一个标量驱动的姿势。** 每个招式只写一个 `e ∈ [-1, 1]`，髋部、脊椎、脚步、配重手全部由它推出来。出手永远全身一起动，不可能「手到了身子没到」。
- **胶囊命中。** 判定圆心是**画出来的拳头或脚**，对被击者的骨骼线段算距离。看得见打得到，看得见躲得开。
- **办公室场景。** 窗墙、城市剪影、三组工位（显示器 / 椅子 / 马克杯 / 纸张）、白板、挂钟、书架、门、盆栽、浅色地板网格。
- **拳皇式打击感。** 顿帧、慢放、变焦冲击、琥珀色星芒、放射速度线、屏幕边缘白闪、连击计数。
- **水墨笔触。** 命中时一道带干笔飞白的主笔触扫过打击点，重击才有交叉第二笔。
- **三套打工人故事。** 加班 / 组长、优化 / HR、改稿 / 甲方。台词按**游戏事件**触发（开局、三连、命中、被击倒、放大招、KO、嘲讽），头顶气泡显示，每句都出场过才会重复。每局随机抽一套，不会连续重复。
- **设置面板。** 右上角齿轮：开关开局动画、音效、对手强度、13 个键位自定义、再来一局、恢复默认键位。设置存 `localStorage`。
- **真实音效。** 打击 / 金属 / 衣料音来自 Kenney 的 CC0 音效包；路由不可用时回落到 WebAudio 合成音。

## 安装

本地目录安装，不发布 npm：

```js
plugin_manager({ action: 'install_bundle', target: '<绝对路径>/plugins/dsh-boot-duel' })
```

或在 DSH 的「插件」页用 **Add plugin** 选择一个本地目录，然后刷新页面。

卸载：在「插件」页移除该 bundle，刷新后彻底消失（插件不写任何 Host 状态）。

## 操作

| 输入 | 动作 |
| --- | --- |
| `Enter` | 开始（对峙阶段） |
| `A` / `D`、`←` / `→` | 移动 |
| `J` | 直拳 |
| `H` | 摆拳 |
| `K` | 踢击 |
| `F` | 上勾（浮空） |
| `G` | 扫腿（击倒） |
| `N` | 滑铲 |
| `L`（按住） | 格挡（下段招式无视格挡） |
| `S`（按住） | 下蹲 |
| `Shift` | 后跳（拉开距离） |
| `空格` | 跳跃 |
| `J` / `K`（空中） | 空袭 |
| `U` | 大招「破军」（需气满） |
| `Esc` / 「跳过」按钮 | 跳过整局 |

键位可在设置面板里全部改掉。

## 配置

```yaml
- insert:
    - id: boot-duel
      name: dsh-boot-duel
      config:
        enabled: true    # false 关闭开机动画
        difficulty: easy # easy | normal
        sound: true      # 音效总开关
```

浏览器端通过本插件注册的两个只读路由读取资源与配置：

- `GET /plugins/dsh-boot-duel/config` → `{ enabled, difficulty, sound }`
- `GET /plugins/dsh-boot-duel/sfx/<name>.ogg` → 插件自带的 CC0 音效（只认 `sfx/` 下的普通文件名）

读不到配置就用同一组默认值；音效 404 就回落到合成音。两者都不会卡住动画。

设置面板里改的是**玩家自己的偏好**（`localStorage`），与上面的 Host 配置分开：Host 配置决定插件装不装，设置面板决定这局怎么打。

## 开发

```bash
# 生成单文件 client.js（宿主按 window.__ModuleLoader__ 加载，客户端无法 require 包内相对文件）
node scripts/build-client.mjs

# 全部单测（含 client.js 与源码一致性检查、骨骼 / IK / 命中测试）
node --test test/*.test.mjs

# 引擎自检：骨架、姿势、命中、输入、键位、回合节奏
node scripts/check-core.mjs
node scripts/check-arena.mjs
node scripts/check-input.mjs
node scripts/check-keys.mjs
```

浏览器端回归（不需要 DSH 在跑）：

```bash
node scripts/shoot.mjs          # 真实插件 + 假 shell 的截图
node scripts/shoot-story.mjs    # 三套故事的对话气泡
node scripts/shoot-fx.mjs       # 打击特效逐帧
```

### 结构

```
index.js               Host 侧：Config + 只读配置路由 + CC0 音效路由
src/client.body.js     客户端模板：shell.overlay 条目、HUD、设置面板、键盘契约
js/rig.js              骨架：11 质点 Verlet、距离约束、地面与墙壁响应
js/fighter.js          火柴人：程序化姿势、两骨 IK、招式表、AI
js/combat.js           胶囊命中判定、伤害、反应阶梯（硬直 / 浮空 / 击倒）
js/juice.js            顿帧、慢放、震屏、变焦冲击、缓动
js/arena.js            竞技场：固定 60Hz 世界、回合状态、气槽、连击、台词调度
js/story.js            三套打工人故事 + 洗牌袋抽词
js/backdrop.js         办公室场景（窗墙、工位、道具、地板）
js/effects.js          拳皇式打击特效 + 水墨笔触 + 对话气泡
js/render.js           Canvas 渲染器
js/adapter.js          把 Arena 套进客户端认识的 duel 接口
js/audio.js            音效（CC0 采样 + 合成回退）
js/loop.js             固定步长帧循环
scripts/build-client.mjs   把 js/*.js 内联成单文件 client.js
sfx/*.ogg              Kenney CC0 音效 + CREDITS.txt
locale/{zh,en}.json    界面文案
docs/DETAIL.md         插件详情页正文
```

`js/` 里的模型层不碰 DOM、不依赖 React，所以 `node --test` 能直接驱动整局战斗和逐帧姿势。

### 已废弃的旧引擎

`rig.js`、`render.js`、`sim/` 是上一版引擎，只保留给旧的测试套件；`package.json` 的 `files` 不包含它们，不会进入安装包。新代码一律写在 `js/` 下。详见 `sim/README.md`。

### 客户端能力边界

`window.__ModuleLoader__` 的工厂**只拿得到 `require`**。`host.call` / `styles.insert` 是动态插件运行器（`evaluateClientHalf`）才有的对象，在 bundle 客户端里引用它们会抛 `ReferenceError`。所以：

- 样式由客户端自己 `document.head.appendChild(<style data-plugin="dsh-boot-duel">)`；
- 配置与音效走 Host 侧注册的只读路由；
- 键盘监听挂在 `window` 捕获阶段，输入框 / 可编辑区 / 其他模态框除外；`Esc` 在任何阶段都退出。

## 许可

MIT。动画与战斗的技术方案参考了 `Waleee7/ragdoll-riot`（该仓库未提供开源许可，仅阅读学习后独立实现），场景、特效、故事与音效为独立创作或 CC0。详见 `THIRD_PARTY_NOTICES.md`。

## 交流群

有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 1121362543" src="./assets/qq-group.png" width="220" />
</picture>

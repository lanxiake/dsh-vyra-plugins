# 多模态学习产物 · 需求与 MVP 计划

> 状态：草案（待评审）
> 范围：在现有「课件阅读 + 作答 + 实操」之外，为每门课增加 **音频课、视频课、互动游戏** 三种体验方式。
> 原则：不改变现有学习循环与内容格式；产物从同一份课件源文件生成；离线可用；失败可见。

---

## 0. 术语与优先级

| 术语 | 含义 |
|---|---|
| 课件源文件 | `lessons/<NNNN>-<nodeId>.md` + `lessons/<NNNN>-<nodeId>.quiz.json` |
| 讲解脚本 | 从课件块树抽出的结构化中间表示（场景 / 旁白 / 画面 / 题目锚点） |
| 产物 | 音频、视频、游戏等可独立打开或播放的文件集合 |
| 产物清单 | `manifest.json`：版本、源文件哈希、文件列表、章节、时长、告警 |
| stale | 源文件变了但产物还没重新生成 |
| P0 / P1 / P2 | MVP 必须 / 应该 / 以后 |

**一条铁律：产物是派生物，不是新的事实来源。** 学生改课件、改题库后，产物应可重建；产物永远不反向写回课件或题库。

---

## 1. 背景与问题

当前 StudyMate 的学习闭环是：

```
大纲 → 课件（讲解 + 题目位置）→ 题库 → 阅读端渲染 → 作答 / 实操 → 评估
```

阅读端擅长「读、看、做」，但存在三个体验缺口：

1. **通勤 / 碎片时间**：只能看屏幕，不能听。
2. **视觉型学习者**：纯文字 + 静态配图，缺少节奏化的讲解画面。
3. **低动机 / 复习阶段**：重复读课件枯燥，缺少即时反馈与闯关感。

本需求把同一份课件转成三种新载体，让用户按场景选择学习方式，而不是重做一套内容。

---

## 2. 目标与非目标

### 2.1 目标

- **G1** 一门已有课件的课，能一键生成可播放的音频。
- **G2** 一门已有课件的课，能生成带旁白、画面、字幕的视频。
- **G3** 一门有题库的科目，能生成按大纲节点组织的闯关游戏。
- **G4** 三种产物都能在阅读端被发现、打开，并在离线导出后继续使用。
- **G5** 产物生成不阻塞学习循环；失败时明确降级，不伪造成功。
- **G6** 不引入新的运行时 npm 依赖；外部能力（TTS、ffmpeg、浏览器）通过配置探测。

### 2.2 非目标（MVP 明确不做）

- 不做双人对谈式播客、背景音乐、音效。
- 不做数字人、实拍、复杂动画；视频以清晰切页 + 淡入为主。
- 不做实时对战、3D、物理引擎；游戏以题库闯关为核心。
- 不做云端账号、课程发布、社区、排行榜。
- 不做「学习过程中实时生成」；生成是显式的、可取消的后台任务。
- 不改现有课件内容格式与阅读端渲染契约。

---

## 3. 用户与场景

### 3.1 用户故事

| 编号 | 角色 | 故事 | 验收 |
|---|---|---|---|
| US-A1 | 学生 | 我在通勤时想听今天这一课 | 课页点「听这一课」，有音频、章节、文字稿 |
| US-A2 | 学生 | 我想跳到「递归」那一节重听 | 章节列表可跳转 |
| US-A3 | 学生 | 我没听清一个术语 | 文字稿可看、可搜索 |
| US-V1 | 学生 | 我想看一遍带画面的讲解 | 课页点「看视频」，画面与旁白同步 |
| US-V2 | 学生 | 我想开字幕 | 字幕开关可用，字幕与旁白一致 |
| US-G1 | 学生 | 我想用闯关的方式复习这门课 | 科目页点「开始闯关」，按大纲解锁关卡 |
| US-G2 | 学生 | 我答错了，想知道为什么 | 即时反馈 + 解释；错题进复习队列 |
| US-G3 | 学生 | 我中途退出，下次接着玩 | 本地进度保留；DSH 内写回作答数据 |
| US-T1 | 主教练 / 学生 | 我改完课件，希望产物别过期 | 产物标记 stale，提示重新生成 |

### 3.2 默认决策（有争议时按此执行）

- 音频：**单人口播**，不做对谈。
- 视频：**幻灯片式讲解**，不做动画大片。
- 游戏：**整门课一个游戏包**，按 `curriculum.yaml` 的节点顺序分关。
- 生成时机：**按需生成**，不在每节课结束时自动生成。

---

## 4. 产品形态定义

### 4.1 音频课（听课）

**输入**：课件 Markdown + 题库 + 大纲标题。
**输出**：`media/audio/<NNNN>-<nodeId>/`

```
lesson.wav | lesson.mp3      音频主体
chapters.json                章节：标题 / 开始 / 结束 / 场景 id
transcript.md                文字稿（与音频逐段对应）
manifest.json                产物清单
```

**体验**：
- 课页顶部出现「听这一课」；展开后是内嵌播放器。
- 播放器：播放/暂停、进度、倍速（0.75/1/1.25/1.5/2）、上一章/下一章、章节列表、文字稿。
- 离线导出的页面同样可播。

**内容规则**：
- 按 `##` 分章；每章旁白由该节段落组成。
- 代码块不逐字朗读，旁白说「看这段代码」并保留画面；公式同理。
- 列表项逐条朗读；表格先读表头再读每行。
- 题库锚点处插入一句「这里有一道题，回到阅读端做一下」，不朗读题目本身。

**边界**：MVP 不做背景音乐、音效、双人对话。

### 4.2 视频课（看课）

**输入**：讲解脚本（场景 + 旁白 + 画面）。
**输出**：`media/video/<NNNN>-<nodeId>/`

```
video.mp4                    有 ffmpeg + 浏览器时生成
video-web/                   无依赖时的定时播放页（index.html + data.js）
subtitles.srt                字幕
cover.png                    封面（可选）
storyboard.json              分镜 / 场景数据
manifest.json                产物清单
```

**体验**：
- 课页「看视频」；内嵌或新窗口播放。
- 章节跳转、字幕开关、全屏；移动端可看。
- 无 `video.mp4` 时自动使用 `video-web`，并在界面说明缺什么。

**内容规则**：
- 每幕 = 一个场景 = 一张画面 + 一段旁白。
- 画面类型：标题、要点列表、代码、公式、配图、表格、SVG。
- 代码高亮与公式排版复用现有离线资源与阅读端的呈现规则。
- MVP 只做切页 + 淡入，不做复杂转场。

**边界**：不做数字人、实拍、动画特效。

### 4.3 互动游戏（玩课）

**输入**：题库 + 大纲 + 可选进度。
**输出**：`media/game/<subjectSlug>/`

```
index.html                   游戏本体（离线可玩）
game.json                    关卡、题目、答案、解释、解锁关系
assets/…                     配图（按需）
manifest.json                产物清单 + 各关源文件哈希
```

**玩法（MVP）**：
- 关卡地图按 `curriculum.yaml` 的节点顺序排列，完成前一关解锁下一关。
- 每关 3–8 题，来自该课 `.quiz.json`。
- 客观题：点选即时判分 + 一句解释。
- 开放题 / 交付物题：以「挑战卡」呈现，展开参考答案与判分要点，学生自评。
- 计分：答对 +10、连击加成、答错 -1 命；命用完可重来本关。
- 错题进入「复习队列」，关卡结束前可重答。
- 结算页：正确率、用时、掌握程度、是否解锁下一关。

**进度保存**：
- 独立打开：`localStorage`。
- 在 DSH 内打开：POST 到现有 `attempts` 路由，写回 `attempts/<NNNN>-<nodeId>.json`。
- 离线页面：只写 `localStorage`，并明确提示「作答未同步到工作区」。

**边界**：不做实时对战、3D、复杂物理；不伪造开放题的自动判分。

---

## 5. 共享能力（三种产物共用）

### 5.1 讲解脚本（中间表示）

所有产物都从同一份 `lesson-script.json` 生成，避免三套解析逻辑。

```json
{
  "version": 1,
  "kind": "lesson-script",
  "subject": "cpp",
  "node": "basics.branch",
  "title": "分支与循环",
  "goal": "能用 if/else 把一段判断流程写完整",
  "language": "zh-CN",
  "source": {
    "lesson": "lessons/0001-basics.branch.md",
    "quiz": "lessons/0001-basics.branch.quiz.json",
    "lessonSha256": "…",
    "quizSha256": "…"
  },
  "scenes": [
    {
      "id": "s1",
      "heading": "为什么需要分支",
      "narration": "……",
      "pauseAfterMs": 600,
      "visuals": [
        { "type": "title", "title": "分支与循环" },
        { "type": "paragraph", "text": "……" },
        { "type": "code", "lang": "cpp", "text": "if (x > 0) { … }" },
        { "type": "formula", "tex": "x > 0" },
        { "type": "figure", "src": "assets/img/pool/xxx.png", "alt": "……" },
        { "type": "table", "head": ["a", "b"], "rows": [["1", "2"]] }
      ],
      "quizAnchors": ["什么情况下用 else if"]
    }
  ]
}
```

**生成规则（确定性基线）**：
1. 用现有 `parseLesson` 拿块树，不重新解析 Markdown。
2. 每个 `##` 开一个新场景；`###` 并入当前场景。
3. 段落 → 旁白 + 段落画面；列表 → 逐项旁白 + 列表画面。
4. 代码块 → 不朗读代码正文，旁白说「看这段代码」，画面保留代码。
5. 公式 → 旁白说「看这个公式」，画面保留 TeX。
6. 图片 / 表格 → 画面保留，旁白读图注 / 表头。
7. `::: quiz` → 只记锚点，不朗读题目。
8. 可选增强：`learning-coach` 写 `lessons/<NNNN>-<nodeId>.narration.md`，按 `## 场景` 覆盖自动旁白；MVP 先不强制。

### 5.2 产物目录

```
<subject>/
└── media/
    ├── audio/<NNNN>-<nodeId>/
    ├── video/<NNNN>-<nodeId>/
    └── game/
```

- 不放进 `lessons/`（那是源文件唯一位置）。
- 不放进 `assets/`（那是图片库）。
- 产物目录可整体删除、可重建。

### 5.3 产物清单

```json
{
  "version": 1,
  "kind": "audio",
  "subject": "cpp",
  "node": "basics.branch",
  "createdAt": "2026-11-22T10:00:00+08:00",
  "generator": "studymate/2.1.0",
  "source": {
    "lessonSha256": "…",
    "quizSha256": "…"
  },
  "files": [
    { "path": "lesson.wav", "role": "audio", "bytes": 1234567, "mime": "audio/wav" }
  ],
  "chapters": [
    { "title": "为什么需要分支", "startMs": 0, "endMs": 42000, "sceneId": "s1" }
  ],
  "durationMs": 420000,
  "provider": { "name": "native", "voice": "zh-CN" },
  "warnings": []
}
```

规则：
- 写入采用「临时目录 + 原子 rename」；失败不留半份产物。
- `source` 哈希与当前源文件不一致 → 阅读端标记 `stale`。
- `warnings` 必须可展示，不允许静默降级。

### 5.4 任务模型

三种生成各注册一种任务类型：

| kind | prefix | 用途 |
|---|---|---|
| `音频` | `audio` | 单课音频生成 |
| `视频` | `video` | 单课视频生成 |
| `游戏` | `game` | 整门课游戏生成 |

复用现有 `lib/tasks`：
- `progress(line, steps)` 报告进度。
- `job.signal` 取消时终止 TTS / ffmpeg / 浏览器子进程。
- `durable: true`，重开 DSH 可 resume。
- 产物路径通过 `job.artifact()` 登记，取消回执能说清保留了什么。

### 5.5 原生命令与工具

新增一个工具（不重载 `studymate_export`）：

```
studymate_media
  action: plan | generate | status | validate
  kind: audio | video | game
  subject: <slug>
  node: <nodeId>          # audio/video 必填；game 可省略（整门课）
  overwrite: boolean
  voice: string           # 可选，覆盖配置
  provider: string        # 可选，none | native | command | edge-tts
```

行为：
- `plan`：只生成脚本 / 分镜 / 关卡 JSON，不落媒体文件；用于预览与调试。
- `generate`：登记任务，返回任务 id；用现有 `studymate_task_wait` 等待。
- `status`：读 manifest 摘要与 stale 状态。
- `validate`：校验 manifest、文件存在性、源哈希、路径安全。

### 5.6 阅读端与导出

**阅读端数据**：在 `readLibrary()` 的节点上增加只读摘要：

```json
{
  "media": {
    "audio": { "present": true, "durationMs": 420000, "stale": false, "provider": "native" },
    "video": { "present": false, "reason": "未生成" }
  }
}
```

科目级增加：

```json
{ "media": { "game": { "present": true, "levels": 12, "stale": false } } }
```

**阅读端入口**：
- 课页标题区增加「听这一课 / 看视频」按钮；有产物时可点，无产物时显示「生成」入口（可选，P1）。
- 科目页增加「开始闯关」。
- 播放器与游戏页面通过新路由取文件，不把大文件塞进 library payload。

**新路由**：

```
GET /api/studymate/media?subject=&node=&kind=&file=
```

- 只允许读 `<subject>/media/` 下的文件。
- 拒绝 `..`、绝对路径、符号链接逃逸。
- 正确返回 `content-type` 与 `cache-control: no-store`。

**导出**：
- 主导出页面增加产物入口与内嵌音频播放器。
- 视频 / 游戏体积大，默认**只链接不内嵌**；后续可提供「导出含媒体」选项。
- 离线产物自身必须无网络依赖。

### 5.7 配置

写入 `~/.dsh/studymate-config.yaml`（或在学习工作区配置中）：

```yaml
media:
  tts:
    provider: native          # none | native | command | edge-tts
    voice: ""                 # 空 = provider 默认；中文建议 zh-CN-*
    rate: 0                   # -50..50
    command: []               # argv 数组，不用 shell
    timeoutMs: 120000
  video:
    ffmpeg: "ffmpeg"
    browser: ""               # 空 = 自动探测
    width: 1280
    height: 720
    fps: 24
  game:
    theme: "auto"             # auto | light | dark
    maxQuestionsPerLevel: 8
```

**安全约束**：
- `command` 是 **argv 数组**，不是 shell 字符串；`spawn(..., { shell: false })`。
- 占位符 `{input}` / `{output}` / `{voice}` / `{rate}` 各替换为一个 argv 元素。
- 任何配置路径都要做工作区边界检查。
- 不允许把密钥写进 manifest 或日志。

### 5.8 TTS provider 矩阵

| provider | 依赖 | 联网 | 质量 | 用途 |
|---|---|---|---|---|
| `none` | 无 | 否 | 无音频 | 只出脚本 / 文字稿；永远可用 |
| `native` | Windows SAPI / macOS `say` / Linux `espeak-ng` | 否 | 一般 | 默认本地路径 |
| `command` | 用户配置的 CLI | 取决于 CLI | 取决于 CLI | 推荐：edge-tts / piper / 自建服务 |
| `edge-tts` | 已安装 `edge-tts` | 是 | 较好 | 中文效果优先时的快捷路径 |

**失败处理**：provider 失败时任务失败，保留脚本与文字稿，不写 manifest；错误信息带 provider stderr 摘要。不得用静音文件冒充成功。

### 5.9 视频依赖矩阵

| 能力 | 依赖 | 缺失时的行为 |
|---|---|---|
| `video-web` 定时播放页 | 无 | 永远可用 |
| 幻灯片截图 | 无头浏览器（Playwright / Chrome） | 用 HTML 幻灯片在页面内渲染，不截图 |
| `video.mp4` | ffmpeg + 截图能力 | 只出 `video-web`，manifest 记 warning |
| 字幕 | 场景时长 | 永远可用（按场景切分） |

---

## 6. 功能需求清单

### 6.1 共享底座

| ID | 需求 | 优先级 |
|---|---|---|
| S1 | 建立 `media/` 产物目录与路径安全函数 | P0 |
| S2 | 定义并校验三种 manifest | P0 |
| S3 | 源文件 SHA-256 与 stale 判定 | P0 |
| S4 | `GET /api/studymate/media` 路由 | P0 |
| S5 | `studymate_media` 工具（plan/generate/status/validate） | P0 |
| S6 | 三种任务类型注册 | P0 |
| S7 | library payload 增加 media 摘要 | P0 |
| S8 | 生成失败 / 缺依赖的可见降级 | P0 |
| S9 | 配置解析与探测（TTS / ffmpeg / 浏览器） | P0 |
| S10 | 使用文档与故障排查 | P1 |

### 6.2 音频

| ID | 需求 | 优先级 |
|---|---|---|
| A1 | 从课件生成讲解脚本 | P0 |
| A2 | `none` / `command` / `native` provider | P0 |
| A3 | 分章与时间轴 | P0 |
| A4 | 文字稿 | P0 |
| A5 | 阅读端播放器（播放、进度、倍速、章节） | P0 |
| A6 | 离线播放 | P0 |
| A7 | 源变更检测与重新生成 | P0 |
| A8 | 进度、取消、resume | P1 |
| A9 | `edge-tts` 快捷 provider | P1 |
| A10 | LLM 润色旁白 | P2 |

### 6.3 视频

| ID | 需求 | 优先级 |
|---|---|---|
| V1 | 分镜 / 场景生成 | P0 |
| V2 | 幻灯片模板（标题、要点、代码、公式、图、表） | P0 |
| V3 | `video-web` 定时播放页 | P0 |
| V4 | 旁白音频（复用音频管线） | P0 |
| V5 | 字幕（SRT） | P0 |
| V6 | 阅读端入口与播放 | P0 |
| V7 | `video.mp4`（ffmpeg + 浏览器） | P1 |
| V8 | 封面与章节图 | P1 |
| V9 | 批量生成整门课 | P2 |

### 6.4 互动游戏

| ID | 需求 | 优先级 |
|---|---|---|
| G1 | 关卡生成（节点 → 关卡，题库 → 题目） | P0 |
| G2 | 客观题即时判分与解释 | P0 |
| G3 | 开放题 / 交付物题挑战卡与自评 | P0 |
| G4 | 计分、连击、生命、结算 | P0 |
| G5 | 错题复习队列 | P0 |
| G6 | 本地进度保存 | P0 |
| G7 | DSH 内写回 `attempts/` | P0 |
| G8 | 关卡解锁地图 | P0 |
| G9 | 移动端与键盘可玩 | P1 |
| G10 | 主题与音效 | P2 |

---

## 7. 非功能需求

| 维度 | 要求 |
|---|---|
| 性能 | 10 分钟课的音频生成（不含 TTS 服务延迟）≤ 2 分钟；游戏首屏本地打开 ≤ 1 秒；10 分钟课视频渲染在参考机上 ≤ 15 分钟 |
| 体积 | 音频 ≤ 1 MB/分钟（单声道 64 kbps）；视频目标 720p/24fps，≤ 30 MB/分钟；游戏 ≤ 2 MB（不含图片） |
| 可靠性 | 幂等；原子写入；取消不留半份 manifest；重跑覆盖旧产物 |
| 兼容性 | Chrome / Edge / Firefox / Safari 当前版本；移动端可播放 / 可玩 |
| 可访问性 | 音频有文字稿；视频有字幕；键盘可操作；尊重 `prefers-reduced-motion`；对比度达标 |
| 安全 | 路径越界拒绝；内容转义；无 shell；无密钥入日志 / manifest；产物不联网 |
| 可移植 | Windows / macOS / Linux；路径用 Node `path`；文本 UTF-8 |
| 可观测 | 任务进度、manifest warnings、生成日志；失败可定位到文件和 provider |

---

## 8. 错误与降级矩阵

| 情况 | 行为 |
|---|---|
| 未配置 TTS 或 `provider: none` | 生成脚本 + 文字稿 + manifest（`audio: null`），warning 说明如何配置 |
| TTS 中途失败 | 任务失败，删除半成品目录，保留上一份好产物；错误带 provider stderr 摘要 |
| 未安装 ffmpeg | 只出 `video-web`，warning 说明安装方式 |
| 未安装无头浏览器 | 幻灯片在页面内渲染，不出 mp4，warning |
| 课件没有题库 | 音频/视频照常；游戏跳过该关；整门课零题时不生成游戏 |
| 题库 schema 错 | 阻止生成，复用现有 `validate_*` 的文件 + 行号错误 |
| 源文件已更新 | manifest 标记 stale；阅读端提示「内容已更新，产物可能过期」 |
| 磁盘满 / 权限不足 | 任务失败，原子写入保证不留半份 manifest |
| 用户取消 | abort 子进程；删除本次临时目录；保留已完成的上一份产物 |
| 产物文件被手动删除 | `status` / `validate` 报 missing；阅读端不展示入口 |

---

## 9. MVP 分段计划

> 原则：每阶段独立可验收、可回滚；先做垂直切片，再扩展。推荐顺序：底座 → 音频 → 游戏 → 视频。
> 理由：音频最短链路，且 TTS 管线会被视频复用；游戏纯本地、反馈最快；视频依赖最重，放最后。

### Phase 0 · 共享底座（2–3 人日）

> **状态（2026-11-22）**：第一批完成——schema / script / manifest / stale / 真实课件测试已落地；`library.ts` 的 media 摘要按约定留到 Phase 1 开头。

**目标**：不生成任何媒体，只把「课件 → 讲解脚本 → 产物清单」的骨架跑通。

任务：
- [ ] 0.1 新增 schemas：`lesson-script.schema.json`、`media-manifest.schema.json`
- [ ] 0.2 新增 `lib/media/paths.ts`：产物目录、路径安全、原子写入
- [ ] 0.3 新增 `lib/media/script.ts`：用 `parseLesson` 块树生成场景 / 旁白 / 画面
- [ ] 0.4 新增 `lib/media/manifest.ts`：读写、源哈希、stale 判定
- [ ] 0.5 新增 `lib/media/index.ts`：`plan` 入口
- [ ] 0.6 `lib/library.ts` 给节点加 `media` 摘要（只读）
- [ ] 0.7 测试：fixture 课件 → 脚本 JSON 快照；路径越界；坏课件报错

**验收**：
- 对一个真实课件执行 `plan`，得到结构正确、可读的 `lesson-script.json`。
- 源文件改动后，`status` 能报 stale。
- 不新增任何运行时依赖。
- 现有 `npm test` 全绿。

### Phase 1 · 音频（4–6 人日）

**目标**：从课件到可播放音频的完整垂直切片。

任务：
- [ ] 1.1 TTS provider 抽象（`none` 先跑通）
- [ ] 1.2 `command` provider：argv 数组、无 shell、超时、取消
- [ ] 1.3 `native` provider：Windows SAPI / macOS `say` / Linux `espeak-ng` 探测
- [ ] 1.4 场景音频合成、章节时间轴、文字稿、manifest
- [ ] 1.5 任务类型 `音频` + `studymate_media` 工具接入
- [ ] 1.6 离线播放器 HTML（播放、倍速、章节、文字稿）
- [ ] 1.7 阅读端课页入口与内嵌播放器
- [ ] 1.8 `GET /api/studymate/media` 路由
- [ ] 1.9 测试：假 TTS 命令写 WAV；章节数学；取消；缺 provider 的降级；浏览器冒烟

**验收**：
- 一条命令生成 `media/audio/<NNNN>-<node>/`，包含音频、章节、文字稿、清单。
- 播放器可播放、跳章、倍速；离线打开可用。
- 改课件后提示 stale，重生成覆盖旧产物。
- 无 TTS 时仍产出脚本与文字稿，并明确告知下一步。
- 任务可取消，取消后不留半份 manifest。

### Phase 2 · 互动游戏（5–7 人日）

**目标**：整门课的题库变成可玩的闯关游戏。

任务：
- [ ] 2.1 关卡生成：`curriculum.yaml` + `quiz.json` → `game.json`
- [ ] 2.2 游戏运行时：地图、关卡、题目、反馈、结算
- [ ] 2.3 客观题判分；开放题 / 交付物题挑战卡与自评
- [ ] 2.4 计分、连击、生命、错题复习队列
- [ ] 2.5 本地进度保存（localStorage）
- [ ] 2.6 DSH 内写回 `attempts/`（复用现有路由）
- [ ] 2.7 科目页入口与离线导出入口
- [ ] 2.8 测试：关卡生成、判分、解锁、存档、浏览器冒烟

**验收**：
- 一门有题库的科目生成 `media/game/<slug>/`，可离线打开。
- 客观题即时判分；开放题可展开参考答案自评。
- 刷新页面进度保留；DSH 内作答写入 `attempts/`。
- 无题库的节点跳过并在 manifest 记 warning；零题时明确不生成。

### Phase 3 · 视频（8–12 人日）

**目标**：先保证「总能看」，再在有依赖时升级为 mp4。

任务：
- [ ] 3.1 分镜生成（场景 → 画面 + 旁白 + 时长）
- [ ] 3.2 幻灯片模板：标题、要点、代码、公式、图、表
- [ ] 3.3 `video-web` 定时播放页（无依赖，永远可用）
- [ ] 3.4 复用音频管线生成旁白
- [ ] 3.5 字幕生成（按场景时间轴）
- [ ] 3.6 无头浏览器截图（可选依赖）
- [ ] 3.7 ffmpeg 合成 mp4（可选依赖）
- [ ] 3.8 阅读端入口、播放、章节、字幕开关
- [ ] 3.9 测试：分镜、模板转义、字幕时间轴、依赖探测、浏览器冒烟；ffmpeg 集成测试按环境跳过

**验收**：
- 无 ffmpeg / 浏览器：产出 `video-web`，能看能听，明确列出缺失项。
- 有 ffmpeg + 浏览器：产出 `video.mp4`，音画同步，字幕对齐，章节可跳。
- 10 分钟课渲染在可接受时间内完成；取消不留坏文件。
- 现有阅读端渲染行为不变。

### Phase 4 · 打磨（持续）

- [ ] 4.1 旁白润色（LLM 可选增强，保留确定性基线）
- [ ] 4.2 整门课批量生成
- [ ] 4.3 语音 / 语速 / 主题配置
- [ ] 4.4 产物清理与体积管理
- [ ] 4.5 学习记录联动（听/看/玩是否计入学习证据，需单独评审）
- [ ] 4.6 用户文档、故障排查、示例

---

## 10. 测试策略

| 层 | 内容 |
|---|---|
| 单元测试 | 脚本抽取、场景切分、章节时间轴、manifest、源哈希、路径安全、关卡生成、判分 |
| 集成测试 | 假 TTS 命令写小 WAV；假 ffmpeg 脚本；任务进度 / 取消 / resume；路由取文件 |
| 浏览器测试 | 音频播放器、游戏、`video-web` 的真渲染与交互；控制台无错误 |
| 快照测试 | fixture 课件的 `lesson-script.json`、`game.json` 结构快照 |
| 离线测试 | 断网打开导出产物；音频 / 视频 / 游戏均可运行 |
| 回归测试 | 现有 `npm test`、阅读端渲染、导出页面必须保持绿色 |

**测试数据**：使用临时科目，不碰真实学习工作区；fixture 覆盖标题、段落、列表、代码、公式、图片、表格、题目锚点。

---

## 11. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 修改 `lib/client.js` 引入回归 | 阅读端崩溃 | 新 UI 隔离为小组件；浏览器冒烟覆盖；不改现有渲染逻辑 |
| TTS 语音质量差 / 平台差异 | 音频不可用 | provider 抽象 + `none` 降级；文档给出推荐命令 |
| ffmpeg / 浏览器未安装 | 视频不可用 | `video-web` 永远可用；清单明确缺失项 |
| 生成耗时长 | 阻塞会话 | 任务模型；进度 / 取消 / resume；按需生成 |
| 旁白机械 | 体验差 | 确定性基线 + 可选 LLM 润色；先保证可用 |
| 产物体积增长 | 占盘 | 体积上限；后续清理命令；导出不默认内嵌 |
| 内容转义遗漏 | XSS | 复用 `escText` / `escAttr`；游戏渲染统一走转义函数 |
| 路径越界 | 读写工作区外 | 所有媒体路径统一走 `paths.ts`；路由与工具共用 |
| 音频与文字稿不同步 | 体验差 | 按场景合成 + 时间轴；文字稿以场景为单位 |
| 游戏判分与题库字段漂移 | 判分错误 | 复用 `lib/core/questions.ts` 的题型与字段判据 |

---

## 12. 开放问题（已有默认决策）

| 问题 | 默认决策 |
|---|---|
| 音频是单人还是双人对谈？ | 单人；对谈放 P2 |
| 视频是幻灯片还是动画？ | 幻灯片；动画放 P2 |
| 游戏按课还是按科目？ | 按科目一个包，内部按节点分关 |
| 是否自动生成产物？ | 不自动；用户显式触发 |
| 主导出是否内嵌视频？ | 不内嵌，只链接；后续提供选项 |
| 是否允许产物参与学习记录？ | MVP 不参与；单独评审 |

---

## 13. 完成定义（Definition of Done）

一个阶段完成，必须同时满足：

- 需求清单中该阶段的 P0 项全部实现。
- 新增代码有对应测试，且现有测试全绿。
- 真实课件端到端跑通一次，产物可打开、可操作。
- 失败路径有可见提示，不静默成功。
- 文档更新：使用方式、配置项、已知限制。
- 不破坏现有学习循环、阅读端渲染与导出。

---

## 14. 决策记录与待确认项（2026-11-22）

### 14.1 已确认

| 编号 | 决策 | 对设计的影响 |
|---|---|---|
| D1 | MVP 成功标准 = **真实可用** | 旁白 / 配音质量进 P0；Phase 1 结束要用 1–3 节真实课试用；验收不只看“能生成” |
| D2 | 旁白 = **LLM 预生成 + 校验** | 新增 `lessons/<NNNN>-<nodeId>.narration.md`；按 `##` 与课件对齐，校验器检查；机械抽取只做兜底 |
| D3 | TTS = **edge-tts 优先，本地多 provider** | 默认 edge-tts（云端免费）；本地支持 native / breeze-tts-cli / 通用 command；首次云端生成前告知内容上传 |
| D4 | 视频 = **mp4 + 网页都要** | `video-web` 保底；mp4 为正式交付；复用 `code-video-showcase` 的 Playwright + FFmpeg 管线，新增课件幻灯片模板与长课渲染档 |

### 14.2 与现有 Lumii 技能的对接

- `code-video-showcase`（`E:\testsoft\Lumii-data\skills\视频创作\code-video-showcase`）
  - 可复用：`render-segment.mjs`（Playwright 逐帧 / 静帧 + ffmpeg）、`concat-and-encode.sh`、`common.js`、`themes.js`、主题与字体规范。
  - 不直接复用：61s / 120BPM 的卡点结构与 `synth_audio.py`（教学课不需要卡点配乐；BGM 可选）。
  - 新增：课件幻灯片模板（标题 / 要点 / 代码 / 公式 / 图 / 表）与“静帧 + 停留 + 淡入”的长课渲染档。
  - 依赖：Node 20+、Playwright/Chromium、FFmpeg（libx264+AAC）。只有 BGM 才需要 Python + numpy/scipy。
- `breeze-tts-cli`（`E:\testsoft\Lumii-data\skills\breeze-tts-cli`）
  - 本地 TTS：24 kHz 单声道 WAV，支持 voice design / clone / 情绪指令 / 批量。
  - 接入方式：新增 `breeze` provider；优先调用 HTTP API（`python -m breeze_infer.api`），否则走批量 CLI；路径必须可配置（当前 `run.ts` 硬编码 `E:\ai\breeze-tts`）。
  - 许可：模型权重为非商业许可；个人 / 教学可用，商用需授权；克隆声音需本人同意。
- `teaching-video`（同目录）
  - 更贴合“教学视频”，有 plan / produce / revise 三工具、edge 音色、字幕、动画与质量档。
  - 但依赖 `teaching_video_*` 工具（mtbot 环境），DSH 插件里当前没有；暂不作为主路径，作为质量基准 / 后续桥接。

### 14.3 已确认（第二轮）

| 编号 | 决策 | 对设计的影响 |
|---|---|---|
| D5 | 视频引擎 = **改造 `code-video-showcase`** | 复用 Playwright + FFmpeg + 主题管线；新增课件幻灯片模板；保留 MIT 许可与出处 |
| D6 | 长课渲染 = **混合** | 静态页为主，关键处 3–5 秒动画；音频先出，场景时长按 TTS 实际时长定 |
| D7 | 发布形态 = **内置最小渲染器，可发布** | 渲染脚本/模板裁进插件；Playwright / FFmpeg 采用探测 + doctor，不把整套浏览器塞进包 |
| D8 | 旁白作者 = **`learning-coach` 学习时写** | `narration.md` 进入 `deliver/` 与交接门禁；内容与旁白同源、可校验 |

### 14.4 仍待确认（不阻塞 Phase 0）

1. **edge-tts 发布形态**：依赖 Python CLI + doctor（推荐 MVP）/ 内置 Node WebSocket 客户端（免 Python，但非官方端点，维护风险高）。
2. **FFmpeg 发布形态**：要求系统安装 + doctor（推荐 MVP）/ 可选 `ffmpeg-static`（包大但免安装）。
3. **Playwright 发布形态**：`playwright-core` + 系统 Edge（推荐）/ 完整 `playwright` + 自带 Chromium（包大）。
4. **产物存储**：外部缓存（默认）/ 工作区 `media/` / 两者。
5. **游戏深度**：题库闯关（默认）/ 轻剧情探索 / 先不做。
6. **游戏作答**：只写每题到 `attempts/`（默认）/ 新增局内统计 / 不写回。
7. **旁白成本**：每课都写 / 按科目开关 / 按需生成。建议 `subject.yaml` 增加 `media.narration: auto|on|off`，默认 `auto`（有媒体需求才写）。
8. **试点科目与 1–3 节课**：用哪门课验收“真实可用”。
9. **fork 维护策略**：本地 fork / 同步上游 / 提 PR。当前是对 `@yunmiao/studymate` 的本地改造，上游更新会冲突，需要定策略。

### 14.5 环境探测结果（2026-11-22，本机）

| 组件 | 结果 | 结论 |
|---|---|---|
| edge-tts | 7.2.8（conda） | Phase 1 默认 provider 可立即用 |
| FFmpeg | 7.1（gyan.dev） | 视频合成可立即用 |
| Node | v22.13.1 | 满足要求 |
| Python | 3.12.7 | breeze / BGM 可立即用 |
| Playwright | `code-video-showcase` 内可用 | 原型可立即用；发布需内置策略 |

结论：Phase 1 音频与 Phase 3 视频原型都能在本机跑通；发布形态的依赖问题留到 Phase 3 前定。

### 14.6 计划修订（覆盖 §9 的工期）

| 阶段 | 原工期 | 修订 | 变化原因 |
|---|---|---|---|
| Phase 0 | 2–3 人日 | 3–4 人日 | 增加 narration schema / validator / 源哈希 |
| Phase 1 | 4–6 人日 | 6–8 人日 | 多 TTS provider + narration 工作流 + 3 节课试用 |
| Phase 2 | 5–7 人日 | 5–7 人日 | 不变 |
| Phase 3 | 8–12 人日 | 12–18 人日 | 内置渲染器 + 混合渲染 + mp4 + 字幕 |
| Phase 4 | 持续 | 持续 | 不变 |

总量：约 26–37 人日（5–7 周）。在“真实可用”标准下，不建议压缩 Phase 1 的试用环节。

### 14.7 技术落点（Phase 0–1 最小清单）

**新增**

- `schemas/narration.schema.json`
- `schemas/lesson-script.schema.json`
- `schemas/media-manifest.schema.json`
- `lib/media/paths.ts`
- `lib/media/manifest.ts`
- `lib/media/script.ts`
- `lib/media/narration.ts`
- `lib/media/tts/index.ts` + `edge.ts` / `breeze.ts` / `native.ts` / `command.ts`
- `lib/media/audio.ts`
- `lib/media/tasks.ts`
- `lib/media/tool.ts`
- `lib/media/route.ts`
- `scripts/tests/test_media_*.mjs`

**修改**

- `preset/skills/learning-coach/SKILL.md`：交付 `narration.md`
- `preset/skills/learning-system/SKILL.md`：交付清单与门禁加入 narration
- `preset/skills/lesson-design/SKILL.md`：旁白与场景对齐规则
- `lib/tools/index.ts`：注册 `studymate_media` 与任务类型
- `lib/library.ts`：节点 `media` 摘要
- `docs/规范/文件归属.md`：`narration.md` 归属
- `docs/规范/课件内容格式.md`：narration 格式（或另开一份规范）

---

## 15. Phase 0 第一批完成记录（2026-11-22）

**已完成**

- `schemas/lesson-script.schema.json`
- `schemas/media-manifest.schema.json`
- `schemas/narration.schema.json`
- `lib/media/paths.ts`：产物根、路径安全、原子写
- `lib/media/manifest.ts`：清单读写、源哈希、stale
- `lib/media/narration.ts`：narration.md 解析与章节对齐
- `lib/media/script.ts`：课件块树 → 场景 / 旁白 / 画面 / 题目锚点
- `lib/media/index.ts`：findLessonFiles / planLesson / readLessonScript
- `scripts/media-plan.mjs`：手动规划命令
- `scripts/tests/test_media_script.mjs`：真实试点课 + schema + stale + 路径安全
- `docs/规范/旁白格式.md`
- 根 `package.json`：`test:studymate-media`、`media:plan`

**试点验收**

- 课程：`self-media-product-launch` / `intro.why-content-works`
- 结果：7 场，约 14 分钟；5 个题目锚点全部对上；画面类型覆盖 title / heading / paragraph / list / table / svg / practice / links / quiz。
- 测试：`npm run test:studymate-media` → `ok · media phase 0`

**约定**

- 本机 Node 22.13 低于插件要求的 22.19；测试用 `--experimental-strip-types`，DSH 运行时仍走 `bin/typescript-runtime.mjs`。
- 当前旁白是确定性抽取；Phase 1 由 `learning-coach` 写 `narration.md` 覆盖。
- `lib/library.ts` 的 media 摘要按「第一批不碰阅读端」的约定留到 Phase 1 开头。

**Phase 1 第一批建议**

1. TTS provider 抽象 + `edge-tts` 默认
2. 场景音频合成、实际时长、chapters / transcript / manifest
3. 离线播放器
4. 给试点课写 `narration.md` 并重跑音频
5. 阅读端入口与 library 摘要

---

## 16. Phase 1.1 完成记录（2026-11-22）

**已完成**

- `lib/media/tts.ts`：provider 抽象、edge-tts、ffprobe 时长、版本检测
- `lib/media/audio.ts`：场景合成、单场 / 多场、chapters / transcript / manifest
- `scripts/media-audio.mjs`：手动生成命令
- `scripts/tests/test_media_tts.mjs`：假 provider 单场组装 + schema + stale
- 根 `package.json`：`media:audio`、`test:studymate-media` 跑两套测试

**真实试听**

- 课程：`self-media-product-launch` / `intro.why-content-works`
- 音色：`zh-CN-XiaoxiaoNeural`
- 场景：s1 + s2，48.9 秒，mp3 24 kHz 单声道，2 个 chapter
- 1.2× 重新生成：40.7 秒，章节 0–21456 / 21456–40728；试听页已同步
- 产物：`C:/Users/Administrator/AppData/Local/Temp/studymate-preview/self-media-product-launch/audio/intro.why-content-works/lesson.mp3`
- 临时旁白：`C:/Users/Administrator/AppData/Local/Temp/studymate-narration/0001-intro.why-content-works.narration.md`（未写学习工作区）
- 多场拼接用 ffmpeg，已验证

**发现**

- 全局 `edge-tts` 已从 7.2.8 升级到 **7.3.1**；PATH 上的默认命令可用，试听不再依赖临时 venv。
- provider 在版本低于 7.3.1 时仍会在 manifest 的 `warnings` 里提示升级。
- `ffprobe` 能读真实时长，chapter 不用文本估算；读不到时才退回估算并记 warning。

**下一步**

1. 等试听反馈：音色、语速、旁白长度是否可接受
2. Phase 1.2：播放器 + `library` 摘要 + 全课音频 + Breeze / native provider

---

## 17. 纯音频研究结论（2026-11-22）

完整文档：[纯音频课件：理论、证据与讲解方法](纯音频课件-理论与方法.md)。

**对 StudyMate 的硬结论**

1. 音频不是念课件；`narration.md` 要按耳朵重写：短句、第二人称、口头路标、去视觉指代、公式口语化、代码讲意图。
2. 音频有适配度：概念 / 方法 / 案例高；代码 / 图表 / 公式 / 实操低。低适配课只做“概念音频”，不假装替代视觉与动手。
3. 1.2× 是合理默认，但不是普适：播放器必须 0.8–1.5× 可调；复杂内容建议 1.0–1.1×。
4. 结构模板：冷开场 → 路线图 → 3–5 块 → 例子 / 边界 / 小结 → 嵌入回忆 → 总结 → 迁移 → 下一步。
5. 记忆靠提取：章末问题、答案前 3–5 秒停顿、跨课复习、教回法。
6. 实证：播客教学知识保留不劣于传统教学；OCRAT 23 条纯音频设计准则；音频不是永远优于文本，优势在“眼睛被占用”的场景。

**Phase 1.2 要接的校验**

- 视觉指代、代码 / 表格 / HTML：阻断。
- 单句过长、单节过长、无小结：提醒。
- `audio_fit` 字段与低适配课的边界提示。
- 播放器：章节、倍速记忆、倒退 15 秒、续听。

---

## 18. Phase 1.2 完成记录（2026-11-22）

**已完成**

- 全局 `edge-tts` 升级到 **7.3.1**；PATH 上的默认命令可用，试听不再依赖临时 venv。
- `lib/media/audio-rules.ts`：视觉指代、空间指代、长句、长节、无小结的纯音频提醒。
- `lib/media/player.ts`：自包含 `player.html`，含章节、相对倍速、倒退 15 秒、续听、文字稿链接。
- `lib/media/audio.ts`：音频产物自动生成播放器，manifest 增加 `player` 文件。
- `lib/media/summary.ts`：节点音频 / 视频摘要、整门课游戏摘要（存在 / 时长 / provider / stale / warnings）。
- `lib/library.ts`：`SubjectNode.media` 与 `SubjectPayload.media.game`，阅读端不用加载媒体文件。
- 测试：`test_media_script.mjs` 增加 audio rules；`test_media_tts.mjs` 增加 player 断言；`test_media_library.mjs` 覆盖摘要与 stale。
- `media-audio.mjs` 打印音频提醒与播放器路径。

**全课音频（完整旁白版）**

- 最终：7 章、9 分 12 秒（552.2s）、3.2 MB，`lesson.mp3` + `transcript.md` + `chapters.json` + `player.html` + `manifest.json`。
- 默认媒体缓存：`C:/Users/Administrator/.dsh/studymate/media-cache/970db757e82f83b3/self-media-product-launch/audio/intro.why-content-works/`
- 正式旁白：`C:/Users/Administrator/StudyMate/.learning/subjects/self-media-product-launch/lessons/0001-intro.why-content-works.narration.md`
- `library` 摘要：`present: true`、`stale: false`、`durationMs: 552168`、`provider: edge-tts`。
- 加入 `@instruction` 后已用 edge 重生成默认缓存；edge 忽略语气指令，时长仍是 552.2s，`stale: false`。
- 7 节全覆盖；`media:plan` 约 11 分钟，**0 条音频提醒**。
- 结构：冷开场 → 三关 → 每关操作 → 转发 → 拆解 → 用产品走一遍；每节都有小结与暂停回忆。

**阅读端入口**

- `GET /api/studymate/media?subject=&kind=audio|video|game&node=&file=`
  - 路径解析与 MIME 在 `lib/media/route.ts`；越界一律 400。
  - 已在 `bin/dsh-plugin.ts` 挂载；端到端返回 `200 text/html`。
- `lib/library.ts` 的 `SubjectNode.media` / `SubjectPayload.media.game` 提供摘要，不加载媒体文件。
- `lib/client.js` 课页顶部新增「听这一课」链接（新标签打开 player.html）；离线导出没有 Host 半，暂时隐藏。
- 测试：`test_media_route.mjs` 覆盖路径越界、默认文件与 MIME；`test_media_library.mjs` 覆盖摘要与 stale。

**下一步**

1. Breeze / native provider（推荐顺序里的第 3 步）。
2. 视频 / 游戏产物。
3. 主导出打包媒体（现在导出页隐藏音频入口）。
4. 真实用户 A/B：1.0× vs 1.2×、完整旁白 vs 自动旁白。

---

## 19. Phase 1.3 本地 provider（2026-11-22）

**native（已完成并验证）**

- `provider: native`；Windows 用 SAPI，macOS 用 `say`，Linux 用 `espeak-ng`。
- Windows 默认音色 `Microsoft Huihui Desktop`，输出 WAV（PCM 16-bit / 22.05 kHz / mono）。
- 试听：s1，44.5 秒，1.9 MB。
  - `C:/Users/Administrator/AppData/Local/Temp/studymate-preview-native/self-media-product-launch/audio/intro.why-content-works/player.html`
- 测试：Windows 上真实调用 SAPI，断言产出 WAV 与可读时长。

**breeze-api（已接入，假服务验证）**

- `provider: breeze` 现在走 Breeze 的 **FastAPI 服务**，不再逐场景调 `infer.py`（那会反复加载 7GB 模型）。
- 先启动服务：

```bash
cd E:/ai/breeze-tts
E:/ai/breeze-tts/.venv/Scripts/python.exe -m breeze_infer.api E:/ai/breeze-tts-2 --host 127.0.0.1 --port 7860
```

- 然后生成：`--provider breeze --breeze-api http://127.0.0.1:7860`。
- 本机 7860 被系统拒绝（WinError 10013），实际用 **7861**：启动加 `--port 7861`，生成加 `--breeze-api http://127.0.0.1:7861`。
- 支持 `--breeze-instruction`、`cfg-scale`、`seed`、克隆参考音频；自然语速；非商业许可。
- **分节语气**：`narration.md` 的 front matter `instruction` 是全课基调；每节 `@instruction:` 覆盖它。provider 把分节指令传给 Breeze 的 `instruction` 表单字段；edge / native 忽略。
- 本机启动日志有 `SoX could not be found` 警告；API 仍能启动并返回 200，是否影响具体音频后处理待验收。
- 自动化测试用本地假服务验证 `PCM → WAV` 包装、时长与表单里的语气指令；真实模型冒烟进行中。
- API 没启动时，provider 会报错并打印上面的启动命令。

**CLI**

```bash
npm run media:audio -- ... --provider native
npm run media:audio -- ... --provider breeze --breeze-instruction "professional teacher explaining clearly"
```

**下一步**

- GPU 空闲时跑一次真实 Breeze 冒烟；成功后用它生成 s1 与 edge 对比。
- 视频 / 游戏产物。

---

## 20. Breeze 语气指令（2026-11-22）

Breeze 的强项是**自然语言描述音色、语气、情绪**。我们已经把它接进旁白格式与脚本链路：

- `narration.md` front matter `instruction`：全课默认语气。
- 每节 `@instruction:`：分节覆盖；必须紧跟在 `##` 标题下。
- 解析器把 `@instruction` 从正文里剥掉，文字稿与音频只含口播正文。
- `LessonScene.instruction` 随脚本进入音频生成；Breeze provider 把它写进 API 的 `instruction` 表单字段。
- edge / native 忽略该字段；同一份旁白可以在不同 provider 上复用。

试点课 7 节现在各有语气：

| 节 | 语气 |
|---|---|
| s1 三关 | curious and engaging, slightly brisk |
| s2 第一关 | clear and explanatory, emphasizing the key contrast |
| s3 第二关 | calm and structured, like walking through a checklist |
| s4 第三关 | serious but reassuring, emphasizing trust and small steps |
| s5 转发 | warm storyteller, conversational, a little surprised |
| s6 拆解 | practical and methodical, guiding an exercise |
| s7 用产品走一遍 | encouraging and confident, pointing forward |

测试覆盖：解析、全局/分节覆盖、指令不进正文、schema、provider 透传、Breeze 表单体里真的带上了指令。

**真实 Breeze 冒烟结果**

- s1：46.6 秒，WAV（PCM 16-bit / 24 kHz / mono），2.1 MB。
- 路径：`C:/Users/Administrator/AppData/Local/Temp/studymate-preview-breeze/self-media-product-launch/audio/intro.why-content-works/player.html`
- provider：`breeze-api`，自然语速（`+0%`）；播放器里可调相对倍速。
- 请求确实带上了 s1 的分节语气指令；API 返回 200，PCM 已成功包成 WAV。
- 无 flash-attn 时速度较慢：46 秒音频耗时数分钟。edge 仍是整课默认；Breeze 适合高质量单场或克隆。
- 想加速可试 API 启动参数 `--fast-all`（本机未验证），或安装 flash-attn。
- SoX 缺失警告没有阻塞本次合成。
- 冒烟结束后已停止 API，显存从 14.3GB 回落到 6.2GB（空闲 9.7GB）。

---

## 21. Phase 2 互动游戏完成记录（2026-11-22）

**已完成**

- `schemas/game.schema.json`：关卡 / 题目 / 版本 / 端点。
- `lib/media/game.ts`：curriculum + 每课 quiz → 关卡；只收有课件且有题库的节点。
- `lib/media/game-html.ts`：自包含游戏页面（地图、关卡、判分、自评、复习、存档、attempts 同步）。
- `scripts/media-game.mjs` + 根命令 `media:game`。
- `test_media_game.mjs`：构建、schema、页面内联、manifest、library 摘要。
- `lib/client.js` 科目页「开始闯关」链接；`lib/media/route.ts` 已能按 `kind=game&file=index.html` 投送。
- `library` 的 `subject.media.game` 摘要。

**试点数据**

- 5 关 / 46 题：0001 7 题、0002 11 题、0003 6 题、0004 14 题、0005 8 题。
- 16 个节点没有课件，跳过并记入构建提示；页面上只显示「还有 16 个节点没有课件，暂未成关」。

**玩法**

- 顺序解锁；每关 3 条生命；答对加分 + 连击；答错扣命并进关末复习。
- 客观题即时判分；开放题 / 交付物 / 预测题展开参考内容后自评（答对了 / 答了一半 / 没答上）。
- 进度存 `localStorage`；在 DSH 里按队列写回 `attempts/`，带 `expectedVersion` 与 `operationId`。
- 离线 `file://` 可玩，只是不写回作答数据。

**验证**

- Edge + Playwright：地图、关卡、选项反馈、完整通关（100% / 52 分）、错题复习（86% / 36 分）、下一关解锁。
- 假 HTTP API：游戏同步徽标显示「已同步」，请求体包含正确的题 id、选项与 `expectedVersion`。
- 自动化测试五套全绿：script / tts / library / route / game。

**限制**

- 只有同时有课件和题库的节点会成关；课程未写完时关卡会少。
- 题目答案内联在 HTML 里（学习用途，不作为防作弊产品）。
- attempts 同步是 best-effort；版本冲突保留本地进度。
- 游戏内没有 lab 代跑；完成游戏暂不写学习记录。
- 离线导出暂不显示游戏入口。

**下一步**

- Phase 3 视频（code-video-showcase + 混合渲染 + mp4/video-web）。

---

## 22. 第 1 课工作坊 MVP（2026-11-22）

题库闯关被指出“太简单、只是换皮”。重新设计后的第一个切片是第 1 课《谁在停下来？》，目标是让展示、了解、学习、实践连起来。

**五幕**

1. 读者模式：6 条模拟信息流，只能停 3 次；每次选停下来的理由，结束后看“注意力账单”。
2. 缺口实验：拖滑块看缺口太小 / 合适 / 太大时，停下来的可能怎么变。
3. 钩子工坊：用“处境 / 缺口 / 承诺”三个槽给模板包写开头，带预览与示例。
4. 模拟信息流：小林 / 阿May / 老周三个人格刷这个开头，显示停下 / 读完 / 想动手与具体评论。
5. 复盘：判断处境型 / 产品型 / 好奇型 / 数字型 / 模糊型，写一句“下次我会……”，保存“钩子卡”。

**实现**

- `lib/media/workshop-html.ts`：试点课专用的自包含工作坊页面，内容先写死。
- `GameSpec.workshop` + 游戏地图顶部入口；`workshop.html` 进 manifest。
- 模拟用作者写的钩子原型 + 人格规则，不调用模型；页面明说“这是模拟，不是真实数据”。
- 工作坊暂不写 attempts；题库闯关那条链路仍然保留。

**浏览器验证**

- 读者模式停 3 次、缺口滑块、钩子示例、模拟漏斗与评论、复盘、保存钩子卡全部跑通。
- 示例钩子得到 3 曝光 / 2 停下 / 2 读完 / 1 想动手；老周因“没看出对团队有什么用”划走，阿May 读完但没动手。
- 游戏地图顶部「第 1 课工作坊：谁在停下来？」入口正常。

**限制**

- 内容写死在第 1 课；还没有通用的工作坊 YAML / 编辑器。
- 模拟是启发式，不是 LLM 判分；设计上刻意如此，保证离线与可复现。
- 工作坊不写 attempts；只存本地钩子卡。
- 只允许改一次再发；没有作品集导出。
- 其他课仍然是题库闯关。

**下一步**

- 重点转向 Phase 3 教学视频；通用工作坊格式留到视频之后。

---

## 23. Phase 3 视频完成记录（整课 + 全内容页入场动画，2026-11-22）

**已完成**

- `lib/media/video-sample.ts`：`buildFullStoryboard` 按 `lesson-script.json` 自动生成 7 节分镜；标题、SVG、文本页、表格 / 练习 / 题目页都有入场动画。
- `scripts/media-video.mjs` + 根命令 `media:video`：逐页 edge-tts → 幻灯片 HTML → code-video-showcase 静帧 / 逐帧渲染 → ffmpeg 合成；文本页停留段默认做缓慢推镜。
- `video.mp4`：1920×1080、24fps、H.264 + AAC，带 `mov_text` 字幕轨。
- `player.html`：44 张幻灯片 + 旁白 + 字幕开关 + 章节跳转，自包含、离线可用；切页淡入，标题与要点逐个出现，幻灯片轻微放大。
- `subtitles.srt`、`cover.jpg`、`storyboard.json`、`manifest.json`。
- 阅读端课页新增「看视频」入口；媒体路由按 `kind=video&file=player.html|video.mp4|subtitles.srt` 投送。
- `test_media_video.mjs` 覆盖整课分镜、动画页、幻灯片页面、播放器数据；六套测试全绿。

**整课规格**

- 44 张幻灯片：1 张标题 + 34 张旁白文本页 + 9 张短暂停页（SVG / 表格 / 练习 / 想一想）。
- **所有内容页都有入场动画**：标题淡入；三关 / 缺口曲线按 SVG 分组逐层出现；文本页 eyebrow / 标题 / 要点逐个出现；表格行、练习、题目页同样入场。
- 文本页只渲染**前 2 秒动画**，剩余时长用末帧停留；停留段做 1.0 → 1.03 的缓慢推镜。
- 标题 / SVG / 短暂停页 2.5 秒完整动画；网页播放器也有轻微缩放。
- 时长 **565.2 秒（9:25）**，1920×1080 / 24fps，44.2 MB（约 655 kbps），44 个章节。
- 推镜会显著增大文件；`--no-motion` 可关闭，回退到约 15.8 MB 的纯静帧停留版。
- 路径：`C:/Users/Administrator/.dsh/studymate/media-cache/970db757e82f83b3/self-media-product-launch/video/intro.why-content-works/`
- `library` 视频摘要：`present: true`、`stale: false`、`durationMs: 565240`。

**验证**

- 内容页抽帧：s1-t1 在 0.3s 只露出标题、2.0s 标题与三条要点完整；标题页 0.5s 半显、2.0s 完整。
- 停留段首尾帧对比：同一页末尾比开头轻微放大，文字仍清晰；三关 / 缺口曲线分组动画末帧完整。
- 表格页、练习页、想一想页、小结页正常。
- video-web：44 个章节、标题卡、表格页切换、字幕文本、播放器缩放正常；切页与要点入场动画生效。
- 路由：`player.html` 200 text/html、`video.mp4` 200 video/mp4、`subtitles.srt` 200 application/x-subrip、`audio.mp3` 200 audio/mpeg。
- 修过四处：分段 mp4 用 `-t` 截到音频时长；播放器注入幻灯片 CSS 并限定 `.slide`；自动摘要补省略号；练习页改用完整首句。

**限制**

- 还没有跨页转场与配乐；文本页 2 秒入场后靠缓慢推镜保持轻微运动。
- 推镜把 mp4 从约 15.8 MB 拉到 44.2 MB；要小文件用 `--no-motion`。
- 依赖外部 code-video-showcase 的 Playwright/Edge 和系统 FFmpeg；尚未内置最小渲染器。
- 离线导出暂不显示视频入口。
- `video.mp4` 与 `audio.mp3` 有约 0.7 秒的 AAC/容器尾巴差异，不影响观看。

**下一步**

- 跨页转场与配乐（可选，教学视频不一定要 BGM）。
- 把视频产物接进导出打包。
- 若要控制体积：720p 或提高 CRF，再和推镜效果做取舍。
- 把分镜生成从“按段落启发式”升级为可编辑的 `video-storyboard.yaml`。
- 评估内置最小渲染器（可发布形态）。

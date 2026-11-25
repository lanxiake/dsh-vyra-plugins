# dsh-vyra-plugins

DeepSeek Harness 的插件与技能市场，随 [dsh-Veyra](../dsh-Veyra) fork 维护。

上游 `deepseek-ai/deepseek-harness` 不接受外部 PR，因此这里所有内容都是独立于上游仓库独立演进的。

## 安装

在 DSH 客户端里打开 **设置 → 插件 → 索引源**，按网络情况选一个。索引分两份，内容相同、**安装源不同**：

| 用途 | 索引内容里的 git 源 | URL |
|---|---|---|
| 国内 | GitCode | `https://ghproxy.net/https://raw.githubusercontent.com/lanxiake/dsh-vyra-plugins/master/docs/index.json` |
| 海外 | GitHub | `https://raw.githubusercontent.com/lanxiake/dsh-vyra-plugins/master/docs/index-github.json` |

国内备用源（jsDelivr CDN，可能有几小时缓存）：

```
https://fastly.jsdelivr.net/gh/lanxiake/dsh-vyra-plugins@master/docs/index.json
```

海外也可以用 GitHub Pages：

```
https://lanxiake.github.io/dsh-vyra-plugins/index-github.json
```

站点首页（插件目录浏览页）：https://lanxiake.github.io/dsh-vyra-plugins/

两份索引由同一个 manifest 生成：`docs/index.json` 把所有版本安装源重写成 GitCode，`docs/index-github.json` 重写成 GitHub。同一批 commit 已推送到 GitHub、GitCode、AtomGit，按 SHA 从任一远端都能装。

然后在插件市场里搜索下面的中文名或包名安装。索引是实时拉取的，**这个仓库更新后客户端重新打开插件页就能看到**，不需要改上面的 URL。

想只用某一个插件也可以，每个插件都是独立的 npm 包，按包名从 Git 安装即可（安装源见各条目的 `version.source`）。

**插件市场本身也发布在 npm**，不走索引源也能装：

```sh
dsh plugin --profile <profile> add dsh-vyra-plugin-market
```

## 已发布的插件

| 插件 | 名称 | 介绍 |
|---|---|---|
| `dsh-vyra-tool-usage-stats` | 工具自进化 | 统计每次工具调用、记下每次失败的原因，定时交给 Agent 诊断那些反复出错的工具，给出可一键应用的修复。减少重复报错，也减少为同样错误反复烧掉的 token |
| `dsh-vyra-agent-manager` | 智能体管理 | 用面板而不是配置文件来创建和管理智能体：每个智能体有自己的提示词、能力集、工具限制与优选技能，主智能体也能替你创建它们 |
| `dsh-vyra-smart-compaction` | 智能压缩 | 分层、由智能体决定的高质量上下文压缩：压力阶梯、以「真的回收了多少」为门槛的确定性预剪枝，以及模型可自行调用的压缩工具。让长会话活得下去，又不会反复冲掉提示缓存 |
| `dsh-vyra-skill-mcp-manager` | 技能与 MCP 管理 | 在一个面板里浏览、搜索、安装技能与 MCP 服务器，不必为每一件都手改 profile 配置行 |
| `dsh-vyra-ssh-terminal` | SSH 终端 | 把 SSH 终端搬进 DSH：连接档案、跳板、SFTP、端口转发与主机密钥固定。密码只进凭据服务，档案文件里没有任何秘密 |
| `dsh-vyra-system-selection` | 系统级划词 | 在任何应用里划词，弹出原生工具条：AI 搜索、翻译、总结、解释、复制。它接管右键，所以应用自带的右键菜单不会再冒出来跟你抢。**仅 Windows** |
| `dsh-vyra-plugin-market` | 插件市场 | 在「已安装」旁边多一个卡片式市场标签页：切换市场源、搜索，并批量安装、更新、卸载、启用或停用。读取与改动都走客户端自己的 Remote 接口，所以源列表就是「设置 → 插件 → 索引源」那一份。**已发布 npm**：[`dsh-vyra-plugin-market`](https://www.npmjs.com/package/vyra-plugin-market) |
| `dsh-vyra-agent-cli-manager` | Agent CLI 管理 | 在 DSH 里驱动 Claude Code、Codex、OpenCode 等 Agent CLI：安装升级，并统一管理它们的 MCP、技能与提示词 |
| `dsh-vyra-studymate` | StudyMate 学习 | 学习技能与课程引擎：定计划、讲知识、做项目。每门课还能派生音频课、旁白视频和动手工作坊，支持 DSH、Google Antigravity、Codex 与 ChatGPT Work。基于 [Cattofu 的 StudyMate](https://github.com/Miaotofu01/Study-Mate)（MIT）

插件的版本、图标、分类与安装来源以 [`docs/index.json`](docs/index.json) 为准——那份是生成物，改的是 [`scripts/market-manifest.ts`](scripts/market-manifest.ts)。

### 收录的第三方插件

下面这些**不是本仓库开发的**，代码由原作者以 MIT 许可发布，这里只是把一份快照放进 `plugins/` 以便市场能装到。包名、LICENSE、介绍都保持原样，**没有改名**——改名会抹掉出处。上游发新版需要重新收录，本仓库不会自动跟。

| 包 | 名称 | 介绍 | 作者 |
|---|---|---|---|
| `@xmanrui/dsh-im` | 即时通讯桥接 | 把微信、飞书、企微、钉钉、QQ、Telegram、WhatsApp、Slack、Discord、Matrix 接入 DSH | [xmanrui](https://github.com/xmanrui/dsh-im) |
| `@yuehancn/dsh-tool-ocr` | 图像文字识别 | 从图片和 PDF 里取文字：数字版 PDF 直接读文字层，扫描件走 OCR | [yuehancn](https://github.com/yuehancn/dsh-tool-ocr) |
| `@anht3889/dsh-superpowers` | Superpowers 技能集 | obra Superpowers 技能集，附带会话引导 | [anht3889](https://github.com/anht3889/dsh-superpowers) |
| `@xiaoso/dsh-workflow-lite` | 轻量工作流 | 一个工作流就是一份 JSON（React Flow 原生），内联提示词，编译成模型自己执行的分派计划 | [xiaoso456](https://github.com/xiaoso456/dsh-workflow-lite) |
| `dsh-expert-orchestrator` | 专家编排 | 多智能体任务编排：分诊、PM 规划、专家委派、依赖 DAG 任务板、消息总线与经验池 | [mario841859784](https://github.com/mario841859784/dsh-expert-orchestrator) |
| `@nanmicoder/dsh-agent-teams` | 智能体团队 | 多智能体团队协作：队长、成员、带依赖的任务与消息，自然语言驱动，带树形监控面板 | [NanmiCoder](https://github.com/NanmiCoder/dsh-agent-teams) |

`dsh-h3-video`（[kingcharleslzy-ai](https://github.com/kingcharleslzy-ai/dsh-h3-video)）**没有收录**：它未声明任何许可证，既没有 `license` 字段也没有 LICENSE 文件，默认保留全部权利。要收录得先取得作者授权，或等它补上许可证。

## 两个入口

DSH 有两条互不相同的扩展通道，这个仓库分别服务它们：

| 通道 | 内容 | 用户怎么用 |
|---|---|---|
| **插件市场索引** | `docs/index.json`（GitCode 源）、`docs/index-github.json`（GitHub 源），format 1 | 客户端「设置 → 插件 → 索引源」加入上面的 URL |
| **技能目录** | `skills/<name>/SKILL.md` | profile 的 `skill-filesystem` 行加 `customSkillDirs` 指向本目录 |

技能不需要打包成插件——DSH 的 `dsh-skill-filesystem` 在任意本地目录扫描 `SKILL.md` 并**监听变更**，改技能无需重启。

## 目录结构

```
dsh-vyra-plugins/
├── docs/index.json         # 生成物，勿手改（build-index 产出，GitCode 源）；随站点一起发布，供客户端拉取
├── docs/index-github.json  # 同上，安装源重写成 GitHub
├── web/                    # 站点首页（React + Vite），由 .github/workflows/pages.yml 构建发布
│   └── public/site/        # 构建产物，勿提交：CI 用 build-site-data 全量生成
├── plugins/                # 每个插件一个 npm 包（独立可发布）
├── skills/                 # SKILL.md 目录，直接给 customSkillDirs 用
├── scripts/
│   ├── market-manifest.ts  # 市场清单的唯一事实来源
│   ├── build-index.ts      # manifest → docs/index.json
│   ├── verify-index.ts     # 用 DSH 自己的解析器校验
│   ├── import-plugin.mjs   # 把仓库外维护的插件搬进来并改名
│   ├── normalize-plugins.mjs   # 补发布所需字段（去 private、加 license/repository）
│   ├── sync-manifest-icons.mjs # 从各插件 icon.svg 生成清单里的内联图标
│   ├── pin-version.mjs     # 把某个版本的占位 commit 换成真实 SHA
│   └── print-skill-config.ts
└── LICENSE                 # MIT，各插件目录下另有一份
```

## 工作流

```sh
# 生成并校验索引
pnpm run verify

# 只生成
pnpm run build:index

# 插件自检（纯逻辑 + 桩渲染）
pnpm run test:market

# 打印 skills/ 的挂载配置
pnpm run print:skills
```

`verify-index.ts` 直接从同级 `dsh-Veyra` checkout 加载已构建的
`@deepseek-ai/dsh-plugin-market-index`，所以不需要安装任何依赖，校验用的就是 fork 当前的解析规则。
checkout 不在同级时用 `DSH_SOURCE=/path/to/dsh-Veyra` 覆盖。

### 站点（GitHub Pages）

首页由 `.github/workflows/pages.yml` 在 push 到 `master` 时自动构建发布，无需手动提交数据：
CI 会拉取全部索引源生成 `web/public/site/`，构建后把 `docs/index.json` 与 `docs/index-github.json`
一并复制到产物根目录，因此上面两个索引 URL 在站点域名下继续可用。

本地预览需要先生成数据，否则页面会因拿不到 `/site/*.json` 而报加载失败：

```sh
npm run build:site-data:all   # 全部源；离线可用 npm run build:site-data（仅自有源）
npm run dev:site              # http://127.0.0.1:7000/
```

`web/public/site/` 与 `.cache/sources/` 都是构建产物，已加入 `.gitignore`，不要提交。

### 发布插件市场到 npm

`dsh-vyra-plugin-market` 同时以 npm 包发布，npm 是它的第一条安装通道。发布前先自检并核对包里装的是哪些文件：

```sh
pnpm run test:market                       # 纯逻辑自检 + 桩渲染
cd plugins/vyra-plugin-market
npm pack --dry-run                         # 确认 11 个文件：index.js / client.js / cli.mjs / locale / icon.svg / cordis.patch.yml / README / LICENSE / assets
npm publish                                # 需要已 npm login，且当前账号是包的所有者
npm view dsh-vyra-plugin-market version        # 回读 registry 确认版本已入库（npm 入库是异步的，可能要等几分钟）
```

**npm 入库是异步的，`npm publish` 返回 `+ pkg@x.y.z` 不代表已经可安装。** 实测要等约 1 分钟以上 registry 才可见；用 `npm install dsh-vyra-plugin-market` 真的装一次，比对 `node_modules/.bin/` 和入口 `import`，才算验完。

**首次发布会进暂存审核**：npm CLI 11.15+ 用 `npm publish` 发一个尚不存在的包名时，会先建立一个 `0.0.0-stage` 占位版，随后提交的版本进入 **Validating** 状态，审核通过前 `npm install` 装不到。看 npmjs.com 的包页「Version History」确认状态转为 Published 后再对外宣布。想显式走这条路，用 `npm stage publish`，之后 `npm stage list` / `npm stage approve <stage-id>` 管理（批准需要 2FA）。

**`bin` 的路径不要带 `./` 前缀**：写成 `"./cli.mjs"` 时 npm 11 会在打包时把整个 `bin` 字段静默移除（`npm publish` 只给一行 `warn`），发布出来就没有 `vyra-market` 命令。写成 `"cli.mjs"` 才保留。`npm pack --dry-run` 的输出里搜一下 `bin[` 就能提前发现。

`package.json` 的 `files` 是白名单：改了包内文件名或新增目录，记得同步改它，否则 `npm pack` 产出的包里缺文件，装上去会加载失败。
版本号改 `package.json` 的 `version`；`package.json` 的 `repository.directory` 指向本仓库的 `plugins/vyra-plugin-market`，详情页与 `npm view` 都按它定位源码。

## 加一个插件

**在仓库外维护的插件**（本地 profile 里是 `link:` / `file:`）：

```sh
node scripts/import-plugin.mjs <源目录> <新包名>   # 拷贝 + 改包名
node scripts/normalize-plugins.mjs                # 补发布字段
node scripts/sync-manifest-icons.mjs              # 生成内联图标
```

再在 `scripts/market-manifest.ts` 加一条、跑 `pnpm run verify`。

**包名改动不是纯改名**：客户端 bundle 里的 `__ModuleLoader__.load({id})` **必须等于包名**
（`packages/client/tsdown.client.ts:187`），模块系统按包名匹配启动行；bundle 注册旧名就永远
满足不了那一行，插件会**静默不挂载**。`import-plugin.mjs` 一次改掉全部四处并做校验。

**仓库内新建**：

1. 在 `plugins/<name>/` 建 npm 包，`package.json` 里带 `dsh.bundle` 声明
2. 包内放 `cordis.patch.yml`，行按**包名**引用插件模块
3. 在 `scripts/market-manifest.ts` 的 `plugins` 数组加一条，填 `versions`
4. `pnpm run verify`

**安装来源只能是 npm 或 Git**（`MarketSource` 类型限定）。本地目录、分支名都不是有效的市场来源。

### 每个插件的必备项（开发规范）

以下三项**所有插件都必须有**，缺一项 `pnpm run check:installable` 会直接失败：

1. **`README.md` 末尾的交流群块**：QQ 群号 **1121362543** + 二维码图片。不要手抄，跑
   `pnpm run contact`（`scripts/add-contact-block.mjs`，幂等）自动追加。
2. **`assets/qq-group.png`**：二维码图片本身。README 的 `<picture>` 指向它，缺图会让插件详情页
   渲染出裂图。
3. **`package.json` 的 `files` 里带上 `assets/qq-group.png`**，否则发布出去的包里没有这张图。

```sh
cp plugins/<已有插件>/assets/qq-group.png plugins/<新插件>/assets/
pnpm run contact
```

## 加一个技能

1. 在 `skills/<name>/SKILL.md` 写 frontmatter（`name` + `description` 必需）
2. 脚本/资源放同目录
3. 用户端 `customSkillDirs` 已指向 `skills/`，DSH 会自动发现

技能**不进市场索引**——它们不需要安装步骤，也不需要版本管理。

## 许可与商标

按上游 [BRAND_GUIDELINES.md](../dsh-Veyra/BRAND_GUIDELINES.md)：可用 "DSH" 缩写指代生态，不得在项目名中使用完整 "DeepSeek Harness" 商标，不得暗示官方背书。

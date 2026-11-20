# dsh-vyra-plugins

DeepSeek Harness 的插件与技能市场，随 [dsh-Veyra](../dsh-Veyra) fork 维护。

上游 `deepseek-ai/deepseek-harness` 不接受外部 PR，因此这里所有内容都是独立于上游仓库独立演进的。

## 安装

在 DSH 客户端里打开 **设置 → 插件 → 索引源**，国内网络推荐用 AtomGit（无需代理）：

```
https://raw.atomgit.com/qq_42997950111111111111111sfq/dsh-vyra-plugins/raw/master/docs/index.json
```

海外或能直连 GitHub 时也可以用 GitHub Pages：

```
https://lanxiake.github.io/dsh-vyra-plugins/index.json
```

最新版本的插件安装源已经指向 AtomGit，国内安装不必经过 GitHub。

然后在插件市场里搜索下面的中文名或包名安装。索引是实时拉取的，**这个仓库更新后客户端重新打开插件页就能看到**，不需要改上面的 URL。

想只用某一个插件也可以，每个插件都是独立的 npm 包，按包名从 Git 安装即可（安装源见各条目的 `version.source`）。

## 已发布的插件

| 插件 | 名称 | 介绍 |
|---|---|---|
| `vyra-tool-usage-stats` | 工具自进化 | 统计每次工具调用、记下每次失败的原因，定时交给 Agent 诊断那些反复出错的工具，给出可一键应用的修复。减少重复报错，也减少为同样错误反复烧掉的 token |
| `vyra-agent-manager` | 智能体管理 | 用面板而不是配置文件来创建和管理智能体：每个智能体有自己的提示词、能力集、工具限制与优选技能，主智能体也能替你创建它们 |
| `vyra-smart-compaction` | 智能压缩 | 分层、由智能体决定的高质量上下文压缩：压力阶梯、以「真的回收了多少」为门槛的确定性预剪枝，以及模型可自行调用的压缩工具。让长会话活得下去，又不会反复冲掉提示缓存 |
| `vyra-skill-mcp-manager` | 技能与 MCP 管理 | 在一个面板里浏览、搜索、安装技能与 MCP 服务器，不必为每一件都手改 profile 配置行 |
| `vyra-ssh-terminal` | SSH 终端 | 把 SSH 终端搬进 DSH：连接档案、跳板、SFTP、端口转发与主机密钥固定。密码只进凭据服务，档案文件里没有任何秘密 |
| `vyra-system-selection` | 系统级划词 | 在任何应用里划词，弹出原生工具条：AI 搜索、翻译、总结、解释、复制。它接管右键，所以应用自带的右键菜单不会再冒出来跟你抢。**仅 Windows** |
| `vyra-theme-styles` | 主题风格 | 把整个客户端的配色换成第三方主题：暖感有机风，或 macOS 毛玻璃。覆盖的是既有组件自己的主题令牌，不会出现「一半换了另一半没换」 |
| `vyra-plugin-market` | 插件市场 | 在「已安装」旁边多一个卡片式市场标签页：切换市场源、搜索，并批量安装、更新、卸载、启用或停用。读取与改动都走客户端自己的 Remote 接口，所以源列表就是「设置 → 插件 → 索引源」那一份 |
| `vyra-agent-cli-manager` | Agent CLI 管理 | 在 DSH 里驱动 Claude Code、Codex、OpenCode 等 Agent CLI：安装升级，并统一管理它们的 MCP、技能与提示词 |

插件的版本、图标、分类与安装来源以 [`docs/index.json`](docs/index.json) 为准——那份是生成物，改的是 [`scripts/market-manifest.ts`](scripts/market-manifest.ts)。

### 收录的第三方插件

下面三个**不是本仓库开发的**，代码由原作者以 MIT 许可发布，这里只是把一份快照放进 `plugins/` 以便市场能装到。包名、LICENSE、介绍都保持原样，**没有改名**——改名会抹掉出处。上游发新版需要重新收录，本仓库不会自动跟。

| 包 | 名称 | 介绍 | 作者 |
|---|---|---|---|
| `@xmanrui/dsh-im` | 即时通讯桥接 | 把微信、飞书、企微、钉钉、QQ、Telegram、WhatsApp、Slack、Discord、Matrix 接入 DSH | [xmanrui](https://github.com/xmanrui/dsh-im) |
| `@yuehancn/dsh-tool-ocr` | 图像文字识别 | 从图片和 PDF 里取文字：数字版 PDF 直接读文字层，扫描件走 OCR | [yuehancn](https://github.com/yuehancn/dsh-tool-ocr) |
| `@anht3889/dsh-superpowers` | Superpowers 技能集 | obra Superpowers 技能集，附带会话引导 | [anht3889](https://github.com/anht3889/dsh-superpowers) |

`dsh-h3-video`（[kingcharleslzy-ai](https://github.com/kingcharleslzy-ai/dsh-h3-video)）**没有收录**：它未声明任何许可证，既没有 `license` 字段也没有 LICENSE 文件，默认保留全部权利。要收录得先取得作者授权，或等它补上许可证。

## 两个入口

DSH 有两条互不相同的扩展通道，这个仓库分别服务它们：

| 通道 | 内容 | 用户怎么用 |
|---|---|---|
| **插件市场索引** | `docs/index.json`（format 1） | 客户端「设置 → 插件 → 索引源」加入上面的 URL |
| **技能目录** | `skills/<name>/SKILL.md` | profile 的 `skill-filesystem` 行加 `customSkillDirs` 指向本目录 |

技能不需要打包成插件——DSH 的 `dsh-skill-filesystem` 在任意本地目录扫描 `SKILL.md` 并**监听变更**，改技能无需重启。

## 目录结构

```
dsh-vyra-plugins/
├── docs/index.json         # 生成物，勿手改（build-index 产出）；GitHub Pages 从 docs/ 根发布
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

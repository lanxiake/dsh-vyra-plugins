# dsh-vyra-plugins

DeepSeek Harness 的插件与技能市场，随 [dsh-Veyra](../dsh-Veyra) fork 维护。

上游 `deepseek-ai/deepseek-harness` 不接受外部 PR，因此这里所有内容都是独立于上游仓库独立演进的。

## 两个入口

DSH 有两条互不相同的扩展通道，这个仓库分别服务它们：

| 通道 | 内容 | 用户怎么用 |
|---|---|---|
| **插件市场索引** | `docs/index.json`（format 1） | 客户端「设置 → 插件 → 索引源」加入 URL |
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
│   └── print-skill-config.ts
└── LICENSE                 # MIT，各插件目录下另有一份
```

## 已发布的插件

| 插件 | 做什么 |
|---|---|
| `vyra-tool-usage-stats` | 工具自进化：统计调用与失败原因，交 Agent 诊断并给出可一键应用的修复 |
| `vyra-agent-manager` | 智能体管理：面板化创建智能体，各自的提示词、能力、工具限制与技能 |
| `vyra-smart-compaction` | 智能压缩：压力感知 + 有回收门槛的预剪枝 + 模型可调用的压缩工具 |
| `vyra-skill-mcp-manager` | 技能与 MCP 管理：一个面板里浏览、搜索、安装 |
| `vyra-page-translator` | 整页翻译：按 DOM 切分、批量提交、译文原位写回 |
| `vyra-ssh-terminal` | SSH 终端：连接档案、跳板、SFTP、端口转发、主机密钥固定 |

## 工作流

```sh
# 生成并校验索引
pnpm run verify

# 只生成
pnpm run build:index

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

## 加一个技能

1. 在 `skills/<name>/SKILL.md` 写 frontmatter（`name` + `description` 必需）
2. 脚本/资源放同目录
3. 用户端 `customSkillDirs` 已指向 `skills/`，DSH 会自动发现

技能**不进市场索引**——它们不需要安装步骤，也不需要版本管理。

## 许可与商标

按上游 [BRAND_GUIDELINES.md](../dsh-Veyra/BRAND_GUIDELINES.md)：可用 "DSH" 缩写指代生态，不得在项目名中使用完整 "DeepSeek Harness" 商标，不得暗示官方背书。

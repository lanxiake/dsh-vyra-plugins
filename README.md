# vyra-plugins

DeepSeek Harness 的插件与技能市场，随 [dsh-Veyra](../dsh-Veyra) fork 维护。

上游 `deepseek-ai/deepseek-harness` 不接受外部 PR，因此这里所有内容都是独立于上游仓库独立演进的。

## 两个入口

DSH 有两条互不相同的扩展通道，这个仓库分别服务它们：

| 通道 | 内容 | 用户怎么用 |
|---|---|---|
| **插件市场索引** | `index/index.json`（format 1） | 客户端「设置 → 插件 → 索引源」加入 URL |
| **技能目录** | `skills/<name>/SKILL.md` | profile 的 `skill-filesystem` 行加 `customSkillDirs` 指向本目录 |

技能不需要打包成插件——DSH 的 `dsh-skill-filesystem` 在任意本地目录扫描 `SKILL.md` 并**监听变更**，改技能无需重启。

## 目录结构

```
vyra-plugins/
├── index/
│   ├── index.json          # 生成物，勿手改（build-index 产出）
│   └── published.json      # 已发布版本的发布时间戳（跨重建保留）
├── plugins/                # 每个插件一个 npm 包（独立可发布）
├── skills/                 # SKILL.md 目录，直接给 customSkillDirs 用
├── scripts/
│   ├── market-manifest.ts  # 市场清单的唯一事实来源
│   ├── build-index.ts      # manifest → index.json
│   ├── verify-index.ts     # 用 DSH 自己的解析器校验
│   └── print-skill-config.ts
└── docs/
```

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

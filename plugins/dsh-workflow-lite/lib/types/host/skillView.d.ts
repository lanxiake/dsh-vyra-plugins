/**
 * dsh-workflow-lite — 以会话里那个 agent 的眼光看 skill。
 *
 * web 版 DSH 把本地 skill 的发现（项目的 `.dsh/skills` `.agents/skills`、`~/.dsh/skills`、
 * `~/.agents/skills`）挂在 **agent 预设**底下：每个预设自己的 `skill-filesystem` 注册进它那一层。
 * 不带作用域读 `ctx.skills` 只剩全局那一层（内置的、插件注册的）——只看得到两三个。
 *
 * 和 DSH 自己的 skill 目录（`/` 命令的那份清单）同一套取法：
 * - 会话的 agent 正在跑：用它预设里的 skill 服务，以它为作用域；
 * - 没在跑（或没给会话）：借默认预设的作用域读一次，读完还回去。
 *
 * `agentPresets` 不在本项目的依赖里，按形状收窄，不对就退回全局那一层。
 *
 * @module @xiaoso/dsh-workflow-lite/host/skillView
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SkillLister, SkillViewer } from './hostFs.ts';
/**
 * @param ctx - 插件的上下文（找 `agents`、`agentPresets`）。
 * @param global - 全局的 `ctx.skills`；skill 服务不在时为 `undefined`。
 */
export declare function createSkillViewer(ctx: Context, global: () => SkillLister | undefined): SkillViewer;

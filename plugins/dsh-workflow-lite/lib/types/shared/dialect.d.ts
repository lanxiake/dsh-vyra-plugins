/**
 * dsh-workflow-lite — 编译口径：计划里**跟执行环境有关**的那些话，各写两套。
 *
 * - **DSH 口径**（{@link DSH_DIALECT}）：插件里执行。可以点名 DSH 的工具和插件的动作——`subagent`、
 *   Agent Team 的 `spawn_teammate` / `send_message` / `wait_agent`、`create_goal` / `update_goal`、
 *   skill 工具、`workflow_lite` 的 `state` / `resume`。运行状态由插件建好、经 `state` 动作改。
 * - **通用口径**（{@link PORTABLE_DIALECT}）：导出成 skill，在哪个 agent 里跑都行。不点名任何工具和方法，
 *   只说要做成什么（"用你的环境里派子代理的方式"）；运行状态是工作区里的一份 YAML，由模型自己建、自己改。
 *
 * 编译器（`shared/compile.ts`）只管和环境无关的部分（图、流程、资源、交接），凡是要点名工具、方法、
 * 插件行为的句子都从这里取。加一条工作流设置或改一句措辞时，两套一起改；`tests/shared/dialect.spec.ts`
 * 把所有设置都打开、用通用口径编译，扫一遍计划和任务描述里有没有 {@link DSH_ONLY_TERMS}。
 *
 * 纯数据与纯函数，不碰磁盘、不 import DSH 包。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/dialect
 */
import { type DisplayBrief } from './display.ts';
import type { ExecutionMode, ReusePolicy } from './types.ts';
/** 「运行状态」段要的东西。 */
export interface RunStateFacts {
    /** 实例 id（DSH：建好的实例；预览与通用口径是 `{instance}`）。 */
    instance: string;
    /** 工作流名。 */
    workflow: string;
    /** 步骤 id，按执行顺序。 */
    steps: readonly string[];
    /** 串行：你本人逐个做、不派给别人，就不提子代理、队员。 */
    solo?: boolean;
}
export interface Dialect {
    id: 'dsh' | 'portable';
    /** 「怎么执行」的执行方式。 */
    mode: Record<ExecutionMode, string>;
    /** 「怎么执行」的复用执行者（`auto` 不写）。 */
    reuse: Record<Exclude<ReusePolicy, 'auto'>, string>;
    /** 「开始之前」：把这次执行设成要完成的目标（设置里「设定目标」开着时）。 */
    goalStep: (workflow: string) => string;
    /** 「约定」：资源怎么用（包里没有带 skill 时）。 */
    resourceRule: string;
    /** 资源里没打包的 Skill 后面那句括注。 */
    loadSkill: string;
    /** 「开始之前」：要在本机装好的 skill（导出成 skill 才有）。 */
    needsStep: (names: string) => string;
    /** 「开始之前」：这次要记运行状态。 */
    runStateStep: string;
    /** 「运行状态」段，整段。 */
    runState: (facts: RunStateFacts) => string[];
    /**
     * 任务描述里写它的资源开了画布展示时，交代产出要适配卡片（DSH 才有画布；通用口径是 `null`）。
     * 编译器把它接在资源内容后面；资源里不止一项时 `target` 是展示的那个文件（已写成行内代码）。
     */
    display: (brief: DisplayBrief, target?: string) => string | null;
}
/**
 * 「运行状态」段（DSH）：用 `state` 动作记进度、谁记、什么时候记、怎么接着跑。
 * 字段全表与例子在 skill `workflow-run-state`，这里只放执行时离不开的规矩。
 */
export declare function dshRunStateLines(facts: Pick<RunStateFacts, 'instance' | 'solo'>): string[];
export declare function dshDisplayLine(brief: DisplayBrief, target?: string): string;
export declare const DSH_DIALECT: Dialect;
/** 通用口径的状态文件（相对工作区）：和默认的产出根目录 `.workflow-lite/runs/{instance}/out` 放在一起。 */
export declare const PORTABLE_STATE_FILE = ".workflow-lite/runs/{instance}/state.yaml";
/**
 * 「运行状态」段（通用）：没有插件替你记，状态就是工作区里的一份 YAML，由你自己建、自己改。
 * 初始内容按图写好（每个步骤一项），字段、时机、接着跑的办法都在这一段里说完。
 */
export declare function portableRunStateLines(facts: RunStateFacts): string[];
export declare const PORTABLE_DIALECT: Dialect;
/**
 * 只该出现在 DSH 口径里的词：工具名、插件动作、插件里的 skill 名、插件的数据目录。
 * 通用口径的计划与任务描述里一个都不能有（`tests/shared/dialect.spec.ts` 守着）。
 */
export declare const DSH_ONLY_TERMS: readonly ["workflow_lite", "workflow-run-state", "workflow-board", "--board-", "data-board", "create_goal", "update_goal", "`subagent`", "spawn_teammate", "send_message", "wait_agent", "`state`", "`resume`", "resume`", "skill 工具", "workflow 工具", "dataDir", "插件", "画布"];

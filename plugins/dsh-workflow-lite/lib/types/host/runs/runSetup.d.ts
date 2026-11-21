/**
 * dsh-workflow-lite — 工作流实例的建立、归属与恢复：建实例、编译出计划、画布上的「执行」、转会话、删实例、接着跑。
 *
 * @module @xiaoso/dsh-workflow-lite/host/runs/runSetup
 */
import { type InstanceRecord, type InstanceSummary } from '../../shared/runState.ts';
import type { InputAnswer, ValidationProblem, WorkflowDocument } from '../../shared/types.ts';
import { type CompileBundle } from '../plan.ts';
import type { Outcome } from '../store/repoResult.ts';
import { type RunCore, type SessionRef } from './runCore.ts';
/** `compile` / `resume` 回给模型的东西。 */
export type InstancePlan = CompileBundle & {
    instance: string;
    progress: Record<string, unknown>;
};
type SetupCore = Pick<RunCore, 'store' | 'deps' | 'answersOf' | 'readState' | 'planOf' | 'snapshot' | 'summarize' | 'appendLog'>;
/** 建实例、画布上的「执行」、归属与删除、恢复。 */
export declare class RunSetup {
    private readonly core;
    constructor(core: SetupCore);
    /**
     * 编译成功之后建实例（`compile` 的 `prepareRun`）：
     * 本会话当前实例是同一张图、同一个 `planId`、而且还没开始过时直接复用（模型重复编译不会留下一堆空实例）。
     *
     * 快照里的产出根目录定死：没配就是默认的 `.workflow-lite/runs/<实例 id>/out`，`{instance}` 换成实例 id。
     * 实例的 `planId` 按快照算（`resume` 从快照重编，两边对得上）。
     */
    prepare(input: {
        workflow: string;
        document: WorkflowDocument;
        session: SessionRef;
        goal?: string;
        /** 用户对输入节点的回答（已核对、补上默认值）；没有输入节点就是空的。 */
        answers?: Readonly<Record<string, InputAnswer>>;
        /** 建状态文件（缺省按图的「记录运行状态」开关）。 */
        track?: boolean;
        /** 复用本会话还没开始过的同一份实例（缺省复用；画布上点「执行」每次都是新的一次）。 */
        reuse?: boolean;
    }): Promise<Outcome<InstanceRecord>>;
    /**
     * 工具的 `compile`：图编译得出计划就建一个实例（开了「记录运行状态」才有状态；本会话还没开始过的
     * 同一份会复用），回给模型的和 `resume` 一样。编译级问题照常回 `problems`、不建实例。
     */
    compile(input: {
        workflow: string;
        document: WorkflowDocument;
        problems: readonly ValidationProblem[];
        session: SessionRef;
        goal?: string;
        /** 用户对输入节点的回答（输入 id → 回答）；没回答的用默认值。 */
        answers?: unknown;
    }): Promise<Outcome<InstancePlan | CompileBundle>>;
    /**
     * 画布上的「执行」：用模板现在的样子建一个新实例（图的快照 + 归属 `session`，开了「记录运行状态」
     * 再建状态文件），设成这个会话的当前实例，回一句发进会话的话——模型据此用 `resume` 拿计划。
     * 图有编译级问题时不建（计划都出不来）。
     */
    start(input: {
        workflow: string;
        document: WorkflowDocument;
        problems: readonly ValidationProblem[];
        session: SessionRef & {
            id: string;
        };
        /** 用户在「执行」前填的回答（输入 id → 回答）。 */
        answers?: unknown;
    }): Promise<Outcome<{
        instance: InstanceSummary;
        prompt: string;
    }>>;
    /**
     * 设 `session` 的当前实例。实例原本属于别的会话时把它**转过来**（一个实例只属于一个会话）：
     * 原会话的当前实例若是它就清掉，状态文件的 `log` 记一条 `transfer`。
     */
    bind(id: string, session: string): Promise<Outcome<{
        transferred: boolean;
    }>>;
    /** 删实例记录与快照；`withState` 为真时连工作区里的状态文件一起删。 */
    remove(id: string, withState: boolean): Promise<Outcome<{
        removed: true;
    }>>;
    /**
     * 接着跑一个实例：从快照重建计划（任务描述不在就重新写），带上运行状态段，
     * 再给一份摘要。实例属于别的会话时先转过来。
     */
    resume(id: string | undefined, session: SessionRef): Promise<Outcome<InstancePlan>>;
}
export {};

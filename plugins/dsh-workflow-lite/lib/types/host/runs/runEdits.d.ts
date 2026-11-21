/**
 * dsh-workflow-lite — 用户的改动：保存画布上改的状态与图、把改动告诉模型、取走没送到的通知。
 *
 * @module @xiaoso/dsh-workflow-lite/host/runs/runEdits
 */
import { type EditValue, type StateEdit } from '../../shared/runState.ts';
import type { WorkflowDocument } from '../../shared/types.ts';
import type { Outcome } from '../store/repoResult.ts';
import { type RunCore } from './runCore.ts';
/** 保存用户改动的结果。 */
export interface SaveResult {
    /** 通知送到模型了没有；没送到时存进索引，模型下次调用工具时附上。 */
    notified: boolean;
    mtime: number;
    /** 改了图时：新图的 planId。 */
    planId?: string;
    /** 没有通知模型：只改了不进计划的东西（挪卡片、描述），或者用户选了不通知。 */
    quiet?: true;
}
/** 用户在实例视图里改的图：改之前那版的 planId（核对有没有被别处改过）+ 改完的整张图。 */
export interface GraphEdit {
    base: string;
    document: WorkflowDocument;
}
/** 保存时字段对不上（用户开始改之后，模型改了同一个字段）。 */
export interface EditConflict {
    path: string[];
    /** 用户以为的旧值。 */
    from: EditValue;
    /** 文件里现在的值。 */
    disk: EditValue;
}
type EditsCore = Pick<RunCore, 'store' | 'deps' | 'serial' | 'problemsOf' | 'answersOf' | 'planOf' | 'snapshot' | 'keepHistory'>;
/** 用户在画布上的改动：保存、通知模型、取走没送到的通知。 */
export declare class RunEdits {
    private readonly core;
    constructor(core: EditsCore);
    /**
     * 保存用户在画布上攒的改动：逐条核对"改前"还是文件里的值（对不上整次拒绝、回冲突清单），
     * 只改这几处、追加一条 `edit` 流水、更新 `updatedAt`，校验通过才原子写；然后通知模型
     * （`notify: false` 时不通知、也不暂存通知：模型下次读状态文件或 `resume` 时自己看到）。
     */
    save(id: string, session: string | undefined, edits: readonly StateEdit[], note: string | undefined, graph?: GraphEdit, options?: {
        notify?: boolean;
    }): Promise<Outcome<SaveResult>>;
    private saveNow;
    /** 逐条核对"改前"还是文件里的值，都对上才把改动落到 YAML 上（就地改）。 */
    private applyUserEdits;
    /**
     * 用户的改动记进流水：图改了记一条（不挂步骤），每个改过的步骤一条，整体的排在后面，指定下一步单记一条 `next`
     * 排在最后；用户的说明跟在最后一条上。
     */
    private appendUserLog;
    /**
     * 保存用户在实例视图里改的图（连同状态的改动）：图快照换成新的，状态跟着对齐（新步骤补上、删掉的去掉、
     * 身份字段 plan 换新，见 `shared/runSync.ts`），任务描述重写，再通知模型去 `resume` 拿新计划。
     *
     * - 图在用户开始改之后被别处改过（`base` 不是现在的 planId）→ `conflict`；
     * - 新图有保存级 / 编译级问题、删了执行过的步骤、改完的状态不合法 → 整次拒绝，什么都不写；
     * - 工作流设置与视口不在实例里改：沿用原快照的；
     * - 只挪了卡片、改了描述这类不进计划的东西：照样保存，不打扰模型。
     */
    private saveGraph;
    /**
     * 把用户的改动告诉模型：会话在跑就排进下一步、空闲就开一轮；送不到（会话的 agent 不在）就暂存进索引，
     * 模型下次调用工具时附上。送到了回 `true`。
     */
    private tell;
    /** 取走这个会话名下所有没送到的通知（模型调用工具时附在返回值里）。 */
    takeNotices(session: string | undefined): Promise<string[]>;
}
export {};

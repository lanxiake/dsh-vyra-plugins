/**
 * dsh-workflow-lite — 工作流实例的两只钩子：
 * - {@link useRuns}：本会话（或全部）的实例列表与当前实例；
 * - {@link useRun}：正在看的那一个实例——轮询状态文件、攒草稿、冲突、保存并通知模型。
 *
 * 只有实例视图轮询（每 2 秒带上次的 mtime 问一次，没变就只回"没变"）；模板编辑照旧不轮询。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/useRuns
 */
import { type InstanceSummary, type InstanceView, type NodeStatus, type RunState, type RunStatus, type StateEdit } from '../../shared/runState.ts';
import type { WorkflowDocument } from '../../shared/types.ts';
import type { RunSaveResponse } from '../../shared/wire/run.ts';
import type { T } from '../i18n.ts';
import { type DraftConflict } from '../model/runDraft.ts';
import type { SideHistory } from '../model/runHistory.ts';
import { type WorkflowLiteRpc } from '../rpc.ts';
/** 实例视图轮询的间隔。 */
export declare const RUN_POLL_MS = 5000;
/** 实例已经结束（完成、失败、取消）时问得慢一些：多半不会再变，接着跑时最多晚这么久看到。 */
export declare const RUN_IDLE_POLL_MS = 15000;
/** 按这个实例的状态定轮询间隔；没有状态文件（不记进度）的当作还在跑。 */
export declare function runPollMs(view: InstanceView | null): number;
export interface Runs {
    /** 本会话的实例（新的在前）。 */
    list: InstanceSummary[];
    /** 本会话的当前实例。 */
    current: string | undefined;
    /** 第一次拉完没有。 */
    loaded: boolean;
    refresh(): Promise<void>;
    /** 设本会话的当前实例（别的会话的实例会被转过来）。 */
    bind(id: string): Promise<boolean>;
    remove(id: string, withState: boolean): Promise<boolean>;
    /** 列全部会话的实例（工作流中心用）。 */
    all(): Promise<InstanceSummary[]>;
    /**
     * 直接改一个实例的整体状态（工作流中心用，不经草稿）。`from` 是列表上看到的状态：
     * 文件里已经不是它了就是冲突，抛错（`errorCode` = `conflict`）。
     */
    setStatus(id: string, from: RunStatus | undefined, to: RunStatus, options: {
        notify: boolean;
        note?: string;
    }): Promise<RunSaveResponse>;
}
export declare function useRuns(rpc: WorkflowLiteRpc, session: string | undefined): Runs;
export interface RunToast {
    id: number;
    tone: 'ok' | 'error';
    text: string;
}
export interface Run {
    /** 最近一次读到的实例（含快照与校验结论）；第一次读回来之前是 `null`。 */
    view: InstanceView | null;
    /** 上一次合法的状态（文件写坏时画布保留它）。 */
    lastGood: RunState | null;
    /** 叠上草稿之后的状态：画布与面板显示的就是它。 */
    shown: RunState | null;
    draft: StateEdit[];
    conflicts: DraftConflict[];
    /** 保存后又被模型改回去的字段（提示"你的修改可能被模型覆盖了"）。 */
    overwritten: string[][];
    note: string;
    setNote(note: string): void;
    /** 保存时通知模型没有（默认通知；关掉就只保存）。 */
    notify: boolean;
    setNotify(notify: boolean): void;
    saving: boolean;
    error: string | null;
    toast: RunToast | null;
    /** 在实例视图底部弹一句话。 */
    flash(tone: RunToast['tone'], text: string): void;
    setField(path: string[], to: StateEdit['to']): void;
    setStatus(id: string, status: NodeStatus): void;
    /** 一次改几个步骤的状态。 */
    setStatuses(ids: readonly string[], status: NodeStatus): void;
    rerun(ids: readonly string[]): void;
    undoEdit(path: readonly string[]): void;
    resolve(conflict: DraftConflict, keep: 'mine' | 'theirs'): void;
    /** 状态草稿的撤销栈（图的在 useRunGraph；两边由 useRunHistory 排成一条）。 */
    draftHistory: SideHistory;
    undoDraft(): void;
    redoDraft(): void;
    /** 丢掉重做栈（图那边有了新的一步）。 */
    dropDraftRedo(): void;
    discard(): void;
    /**
     * 保存草稿并通知模型。改了图就把改完的整张图一起交上去（草稿里删掉了的步骤的状态改动不交）；
     * 存好了回 host 的回执，没存成回 `null`。
     */
    save(graph?: {
        base: string;
        document: WorkflowDocument;
    }): Promise<RunSaveResponse | null>;
    reload(): Promise<void>;
}
export declare function useRun(rpc: WorkflowLiteRpc, id: string, session: string | undefined, t: T, onSaved?: () => void): Run;

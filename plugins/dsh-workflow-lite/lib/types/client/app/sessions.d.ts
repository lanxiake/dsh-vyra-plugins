/**
 * dsh-workflow-lite — 会话桥：画布上的「执行」要列出同一工作区的会话、在同一工作区新建会话、
 * 往选中的会话里发一句话，发完跳过去。
 *
 * 都借宿主现成的东西，不自己造：
 * - 会话列表与新建：Session Controller 的 `sessions.list` / `sessions.create`（和侧栏同一份数据）；
 *   新建时按 Workspace Controller 找到本会话所在的工作区，新会话归在同一组里；
 * - 发消息：会话输入框的标准发送流程（`conversation.input.for(会话 ctx)` 的 `setDraft` + `submit`），
 *   和用户自己敲回车一模一样——会话正忙时按用户的设置排队或插话；
 * - 跳过去：`uiWorkspace.openSession`（和点侧栏一样）。
 *
 * 这些服务都是**可选**的：入口用 `ctx.inject` 的子上下文接上，缺了只是对应的能力用不了，视图照常。
 * 宿主的类型包不在依赖里，这里只声明用到的那几个成员。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/sessions
 */
/** 列表里的一个会话（侧栏那份数据的子集）。 */
export interface SessionRow {
    id: string;
    title: string;
    cwd?: string;
    running: boolean;
    updatedAt: number;
    /** 还没说过话的新会话。 */
    blank: boolean;
    /** 子代理会话（不在侧栏里列，也不给选）。 */
    subagent: boolean;
}
interface Observable<T> {
    getSnapshot(): T;
    subscribe(fn: () => void): () => void;
}
interface InputSnapshot {
    draft: string;
    phase: 'plain' | 'adjudicating' | 'claimed' | 'submitting';
}
interface SessionInput {
    setDraft(text: string): void;
    submit(): void;
    readonly state: Observable<InputSnapshot>;
}
/** `ctx.conversation` 用到的部分。 */
export interface ConversationService {
    input: {
        for(ctx: unknown): SessionInput;
    };
}
interface SessionSummary {
    id: string;
    title?: string;
    displayTitle?: string;
    cwd?: string;
    origin?: string;
    running?: boolean;
    blank?: boolean;
    updatedAt?: number;
}
/** `ctx.sessions` 用到的部分。 */
export interface SessionsService {
    list: Observable<{
        ids: readonly string[];
        byId: Readonly<Record<string, SessionSummary>>;
    }>;
    create(opts?: {
        workspaceId?: string;
        cwd?: string;
    }): Promise<string>;
    using<T>(target: string, options: {
        source: string;
    }, operation: (reference: {
        binding: {
            ctx: unknown;
        };
    }) => T | Promise<T>): Promise<T>;
}
/** `ctx.workspaces` 用到的部分。 */
export interface WorkspacesService {
    list: Observable<{
        items: readonly {
            workspaceId: string;
            path: string;
            sessionIds: readonly string[];
        }[];
    }>;
}
/** `ctx.uiWorkspace` 用到的部分。 */
export interface UiWorkspaceService {
    openSession(target: string): void;
}
/** 视图拿到的会话桥。 */
export interface SessionBridge {
    /** 服务接上了没有（没接上 = 「执行」不可用）。 */
    available(): boolean;
    rows(): readonly SessionRow[];
    subscribe(fn: () => void): () => void;
    /** 往会话里发一句话；没发出去就抛错（错误信息给人看）。 */
    deliver(session: string, text: string): Promise<void>;
    /** 能不能新建会话。 */
    canCreate(): boolean;
    /** 在 `from` 所在的工作区新建一个会话（拿不到工作区就按 `cwd` 建），回新会话的 id。 */
    create(from: string, cwd: string | undefined): Promise<string>;
    /** 跳到一个会话（宿主没有导航能力时什么也不做，回 `false`）。 */
    open(session: string): boolean;
}
/** 入口里建一个，服务接上 / 断开时调 `attach` / `detach`。 */
export declare function createSessionBridge(): SessionBridge & {
    attach(sessions: SessionsService, conversation: ConversationService): void;
    detach(): void;
    attachWorkspaces(workspaces: WorkspacesService | undefined, ui: UiWorkspaceService | undefined): void;
};
/** 同一个工作区：路径大小写、分隔符不同也算同一个（Windows）。 */
export declare function sameDir(a: string | undefined, b: string | undefined): boolean;
/** 能选的会话：本会话在最前，其余是同一工作区里说过话的主会话，新的在前。 */
export declare function pickable(rows: readonly SessionRow[], session: string | undefined): SessionRow[];
/** 订阅会话列表。 */
export declare function useSessionRows(bridge: SessionBridge | undefined): readonly SessionRow[];
export {};

/**
 * dsh-workflow-lite — 画布的 typed RPC 调用器。
 *
 * 走共享 Connection 的 `/api` 通道（与 host 侧 one-route-per-endpoint 对齐）。
 *
 * 这里定义自己的载体接口而不直接用 `ConnectionHandle`：`dsh-client-connection` 的宿主半与
 * 客户端半各自给 cordis 的 `Context` 声明了 `connection`，两半同进一个 TS 工程时类型冲突。
 * 所以只按**形状**收窄出要用的那一小块（一个 `rpc.call`），运行时校验、不对就响亮报错。
 *
 * @module @xiaoso/dsh-workflow-lite/client/rpc
 */
import type { ConnectionRpcResult } from '@deepseek-ai/dsh-client-connection';
import { type WorkflowLiteEndpoint, type WorkflowLiteRpcMap } from '../shared/wire.ts';
/** 我们真正需要的那一小块 Connection 面。 */
export interface RpcCarrier {
    rpc: {
        call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<ConnectionRpcResult<unknown>>;
    };
}
/** 画布需要的调用面。 */
export interface WorkflowLiteRpc {
    call<K extends WorkflowLiteEndpoint>(endpoint: K, args: WorkflowLiteRpcMap[K]['args']): Promise<WorkflowLiteRpcMap[K]['result']>;
}
/**
 * 按形状收窄出一个 RPC 载体。
 * @param service - `ctx.get('connection')` 拿到的值。
 * @throws 服务缺失或形状不对——宁可注册时就炸，也不要第一次保存时才炸。
 */
export declare function requireRpcCarrier(service: unknown): RpcCarrier;
/** 端点失败——带 host 给的 `code` 与结构化 `details`（`conflict` 的冲突清单就在里面）。 */
export declare class WorkflowLiteRpcError extends Error {
    /** host 的失败码（`not_found` / `invalid_args` / `blocked` / `conflict` / `io_error`）。 */
    readonly code: string;
    readonly details: ReadonlyMap<string, unknown>;
    constructor(code: string, message: string, details: unknown);
}
/** 错误的失败码；不是端点失败就给 `undefined`。 */
export declare function errorCode(error: unknown): string | undefined;
/** 错误的人话说明。 */
export declare function errorMessage(error: unknown): string;
/** 建一个调用器。 */
export declare function createWorkflowLiteRpc(carrier: RpcCarrier): WorkflowLiteRpc;

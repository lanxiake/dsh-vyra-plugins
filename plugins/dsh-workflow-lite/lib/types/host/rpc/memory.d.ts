/**
 * dsh-workflow-lite — `memory/*`：记忆库的增删改查、文件浏览与版本。
 *
 * @module @xiaoso/dsh-workflow-lite/host/rpc/memory
 */
import type { WorkflowLiteEndpoint } from '../../shared/wire.ts';
import { type RpcDeps, type RpcResult } from './shared.ts';
export declare function dispatchMemory(deps: RpcDeps, endpoint: Extract<WorkflowLiteEndpoint, `memory/${string}`>, payload: unknown): Promise<RpcResult<unknown>>;

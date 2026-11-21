/**
 * dsh-workflow-lite — `run/*`：工作流实例的列表、读写、启动，以及实例里文件、图片、目录的浏览。
 *
 * @module @xiaoso/dsh-workflow-lite/host/rpc/run
 */
import type { WorkflowLiteEndpoint } from '../../shared/wire.ts';
import { type RpcDeps, type RpcResult } from './shared.ts';
export declare function dispatchRun(deps: RpcDeps, endpoint: Extract<WorkflowLiteEndpoint, `run/${string}`>, payload: unknown): Promise<RpcResult<unknown>>;

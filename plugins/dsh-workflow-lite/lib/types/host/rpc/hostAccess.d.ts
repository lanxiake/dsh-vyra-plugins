/**
 * dsh-workflow-lite — `host/*`：看宿主机上的目录与 DSH 的 skill。
 *
 * @module @xiaoso/dsh-workflow-lite/host/rpc/hostAccess
 */
import type { WorkflowLiteEndpoint } from '../../shared/wire.ts';
import { type RpcDeps, type RpcResult } from './shared.ts';
export declare function dispatchHost(deps: RpcDeps, endpoint: Extract<WorkflowLiteEndpoint, `host/${string}`>, payload: unknown): Promise<RpcResult<unknown>>;

/**
 * dsh-workflow-lite — `pack/*`：导入导出工作流包、导出成 skill，以及预览时浏览整个包。
 *
 * @module @xiaoso/dsh-workflow-lite/host/rpc/pack
 */
import type { WorkflowLiteEndpoint } from '../../shared/wire.ts';
import { type RpcDeps, type RpcResult } from './shared.ts';
export declare function dispatchPack(deps: RpcDeps, endpoint: Extract<WorkflowLiteEndpoint, `pack/${string}`>, payload: unknown): Promise<RpcResult<unknown>>;

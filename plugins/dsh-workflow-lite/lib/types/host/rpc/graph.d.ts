/**
 * dsh-workflow-lite — `graph/*`：工作流图与节点模板的增删改查、版本。
 *
 * @module @xiaoso/dsh-workflow-lite/host/rpc/graph
 */
import type { WorkflowLiteEndpoint } from '../../shared/wire.ts';
import { type RpcDeps, type RpcResult } from './shared.ts';
export declare function dispatchGraph(deps: RpcDeps, endpoint: Extract<WorkflowLiteEndpoint, `graph/${string}`>, payload: unknown): Promise<RpcResult<unknown>>;

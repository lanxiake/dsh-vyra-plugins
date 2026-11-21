/**
 * dsh-workflow-lite — `plan/build`：把工作流编译成计划文本。
 *
 * @module @xiaoso/dsh-workflow-lite/host/rpc/plan
 */
import type { WorkflowLiteEndpoint } from '../../shared/wire.ts';
import { type RpcDeps, type RpcResult } from './shared.ts';
export declare function dispatchPlan(deps: RpcDeps, endpoint: Extract<WorkflowLiteEndpoint, `plan/${string}`>, payload: unknown): Promise<RpcResult<unknown>>;

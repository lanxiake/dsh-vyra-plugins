/**
 * dsh-workflow-lite — `config/*`：「设置」页读写插件配置。
 *
 * @module @xiaoso/dsh-workflow-lite/host/rpc/config
 */
import type { WorkflowLiteEndpoint } from '../../shared/wire.ts';
import { type RpcDeps, type RpcResult } from './shared.ts';
export declare function dispatchConfig(deps: RpcDeps, endpoint: Extract<WorkflowLiteEndpoint, `config/${string}`>, payload: unknown): Promise<RpcResult<unknown>>;

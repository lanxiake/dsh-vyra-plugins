/**
 * dsh-workflow-lite — `write_resource` 带 `memory` 时加记忆卡：引用记忆库里已有的一条，或新建一条再挂上。
 * @module @xiaoso/dsh-workflow-lite/host/tool/memoryCard
 */
import type { ChangedEntry, MemoryType, ToolWarning } from '../../shared/types.ts';
import type { Outcome } from '../store/repoResult.ts';
import type { MemoryArgs } from './args.ts';
import type { ToolDeps } from './tool.ts';
type MemoryCardOutcome = Outcome<{
    changed: ChangedEntry[];
    warnings: ToolWarning[];
    memory: {
        id: string;
        type: MemoryType;
        created: boolean;
        note?: string;
    };
}>;
/**
 * `write_resource` 带 `memory`：引用库里已有的一条（给了 `id` 且库里有），或新建一条（没给 `id` 时按画布的规则起名，
 * 撞了加序号），再加一张记忆卡。先查图，查过了才建库里的那条；卡没加上就把刚建的删掉，不留没人用的空记忆。
 */
export declare function writeMemoryCard(deps: ToolDeps, workflow: string, input: MemoryArgs): Promise<MemoryCardOutcome>;
export {};

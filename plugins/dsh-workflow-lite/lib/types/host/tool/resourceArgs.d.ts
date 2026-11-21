/**
 * dsh-workflow-lite — `write_resource` / `write_node` 里资源与画布展示（`display`）参数的转换。
 *
 * 只收形状与类型对得上的字段；取值范围由仓储里的 `applyDisplay` / `readView` 再把关。
 * @module @xiaoso/dsh-workflow-lite/host/tool/resourceArgs
 */
import { type DisplaySpec } from '../../shared/display.ts';
import type { ResourceUpsert } from '../store/repoNodes.ts';
import type { ResourceArgs } from './args.ts';
/** write_resource 的 resource 参数 → 仓储的入参。形状不对就回一句给模型看的错。 */
export declare function resourceUpsertOf(node: string | undefined, input: ResourceArgs): ResourceUpsert | string;
/** `display` 参数 → 展示设置的改动。形状不对就回一句给模型看的错（取值范围由 `applyDisplay` 再把关）。 */
export declare function displaySpecOf(raw: unknown, where: string): DisplaySpec | string;

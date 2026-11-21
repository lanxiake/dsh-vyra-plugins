/**
 * dsh-workflow-lite — 记忆库里一条记忆的样子：元数据、列表里的一行、一个版本。
 *
 * 一条记忆 = `memories/<id>.json`（元数据，插件写）+ `memories/<id>/`（一份 skill 文件夹，执行时的模型写）。
 * 元数据不放进文件夹里：文件夹要原样当 skill 用。版本在 `memory-versions/<id>/` 下，见 `host/store/memoryVersions.ts`。
 *
 * 纯函数，不碰磁盘、不 import DSH 包。
 * @module @xiaoso/dsh-workflow-lite/shared/memoryLib
 */
import { type MemoryType } from './types.ts';
/** 元数据（`memories/<id>.json`）。 */
export interface MemoryMeta {
    /** 也是文件夹名；规则同工作流名。 */
    id: string;
    type: MemoryType;
    /** 给人看的名称；空串就显示 id。 */
    name: string;
    description: string;
    createdAt: number;
}
/** 列表里的一行：元数据加上现在的样子。 */
export interface MemoryEntry extends MemoryMeta {
    /** 当前存的那份引用了它的工作流（不扫历史版本），按名字排。 */
    usedBy: string[];
    files: number;
    bytes: number;
    /** 文件夹里最近一次改动（毫秒时间戳；还是空的就是建的时候）。 */
    updatedAt: number;
    versions: number;
    /** 元数据读不出来（只能删）。 */
    invalid?: true;
}
/** 一个版本。 */
export interface MemoryVersionEntry {
    n: number;
    createdAt: number;
    note: string;
    /** 恢复到别的版本之前自动存的那份：恢复到的是哪个版本。 */
    autoBefore?: number;
    files: number;
    bytes: number;
    /** 内容和现在的文件夹一样。 */
    current: boolean;
    /** 元信息坏了读不出来（只能删）。 */
    invalid?: true;
}
/** 名称、描述合不合规矩：不能换行（描述可以），不超长。合规回 `null`。 */
export declare function memoryTextProblem(field: 'name' | 'description', value: string): string | null;
/** 元数据的写法。 */
export declare function memoryMetaText(meta: MemoryMeta): string;
/** 读元数据；读不出来、类型不认识回 `null`。id 以文件名为准（`id`）。 */
export declare function parseMemoryMeta(text: string, id: string): MemoryMeta | null;
/** 给人看的名称：没起名就是 id。 */
export declare function memoryTitle(meta: Pick<MemoryMeta, 'id' | 'name'>): string;

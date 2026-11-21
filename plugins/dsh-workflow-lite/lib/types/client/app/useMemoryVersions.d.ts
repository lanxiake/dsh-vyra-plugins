/**
 * dsh-workflow-lite — 一条记忆的版本：列、存、切、改说明、删（底子和工作流的版本同一套，见 {@link useVersionCore}）。
 *
 * 编辑页「版本」框的「记忆」一栏与工作流中心「记忆」页共用。版本是整个文件夹的拷贝；
 * 内容和某一版一样时存不了（按钮按住），切换前主机先把现在的内容自动存一份（内容一样就不存）。
 * 记忆会被执行中的模型改，所以开着的时候隔几秒、窗口重新获得焦点时悄悄重读一遍，「当前」跟着磁盘走。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/useMemoryVersions
 */
import type { MemoryVersionEntry } from '../../shared/memoryLib.ts';
import type { T } from '../i18n.ts';
import { type WorkflowLiteRpc } from '../rpc.ts';
import { type VersionActions } from './useVersions.ts';
export interface MemoryVersions extends VersionActions<MemoryVersionEntry> {
    save(note: string): Promise<boolean>;
}
export declare function useMemoryVersions(options: {
    t: T;
    rpc: WorkflowLiteRpc;
    id: string;
    /** 版本数、内容变了（记忆库那一行的「N 个版本」、大小跟上）。 */
    onChanged?: () => void;
}): MemoryVersions;

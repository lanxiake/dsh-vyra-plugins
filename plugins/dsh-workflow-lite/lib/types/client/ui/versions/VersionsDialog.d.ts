/**
 * dsh-workflow-lite — 编辑页的「版本」对话框：上面分「工作流 / 记忆」两栏。
 *
 * - 工作流：正开着这张的版本（{@link VersionList}）；动手之前先把还没写下去的改动存掉（版本存的是磁盘上那份），
 *   切换写回之后按磁盘重新加载画布。这张引用了记忆时，存的那一栏能勾「连同记忆一起存」。
 * - 记忆：左边列这张引用的记忆（库里有的：名称、类型、几个版本），选一条，右边是它的版本（{@link MemoryVersionList}）；
 *   记忆的版本线各管各的，切记忆的版本不动工作流。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/versions/VersionsDialog
 */
import type { WorkflowDocument } from '../../../shared/types.ts';
import type { Desktop } from '../../app/desktop.ts';
import { type MemoryStore } from '../../app/memories.ts';
import type { T } from '../../i18n.ts';
import type { WorkflowLiteRpc } from '../../rpc.ts';
export declare function VersionsDialog(props: {
    t: T;
    rpc: WorkflowLiteRpc;
    name: string;
    /** 正开着的这张（找它引用的记忆）。 */
    doc: WorkflowDocument | null;
    memories: MemoryStore;
    desktop: Desktop | undefined;
    flush(): Promise<boolean>;
    onRestored(): void;
    onChanged(): void;
    onClose(): void;
}): React.JSX.Element;

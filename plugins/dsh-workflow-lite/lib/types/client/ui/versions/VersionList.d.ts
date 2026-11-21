/**
 * dsh-workflow-lite — 一列版本：上面「说明 + 存为版本」，下面版本列表（新的在前）。
 *
 * 工作流的版本（{@link VersionList}）与记忆的版本（{@link MemoryVersionList}）同一个样子（{@link VersionShell}）。
 * 编辑页的「版本」对话框与工作流中心共用。存的、比的都是磁盘上那份
 * （编辑页正开着这张时先把改动写下去，见 {@link useVersions}）。
 * 现在的内容和某个版本一样时，存的按钮按住，旁边说「现在的内容就是 v3」。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/versions/VersionList
 */
import type { Desktop } from '../../app/desktop.ts';
import type { MemoryStore } from '../../app/memories.ts';
import type { T } from '../../i18n.ts';
import type { WorkflowLiteRpc } from '../../rpc.ts';
/** 工作流的版本。`memories` 给了（这张引用的记忆条数）就在存的那一栏挂「连同记忆一起存」。 */
export declare function VersionList(props: {
    t: T;
    rpc: WorkflowLiteRpc;
    name: string;
    before?: () => Promise<boolean>;
    onRestored?: () => void;
    onChanged?: () => void;
    /** 这张引用了几条（库里有的）记忆；0 或不给就不挂勾选。 */
    memories?: number;
    onMemoriesSaved?: () => void;
}): React.JSX.Element;
/** 一条记忆的版本：点一行看那一版的文件。 */
export declare function MemoryVersionList(props: {
    t: T;
    rpc: WorkflowLiteRpc;
    store: MemoryStore;
    id: string;
    desktop: Desktop | undefined;
}): React.JSX.Element;

/**
 * dsh-workflow-lite — 工作流中心「记忆」页：左边记忆库里的每一条，右边选中那条的名称、描述、在用的工作流和版本。
 *
 * 和「工作流」页同一个两栏样子。记忆在编辑页里加（给步骤开记忆、加工作流记忆时选已有的或新建），
 * 这一页管已有的：改名称和描述、看文件、存版本 / 切版本、删掉。
 * 删除的确认卡挂在那一行的删除按钮上，说清有几个工作流在用、几个版本一起删。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/hub/HubMemories
 */
import type { Desktop } from '../../app/desktop.ts';
import { type MemoryStore } from '../../app/memories.ts';
import type { T } from '../../i18n.ts';
import { type WorkflowLiteRpc } from '../../rpc.ts';
export declare function HubMemories(props: {
    t: T;
    rpc: WorkflowLiteRpc;
    store: MemoryStore;
    desktop: Desktop | undefined;
    /** 点「在用的工作流」里的一张：打开它（对话框跟着关）。 */
    onOpen(name: string): void;
    onNotice(text: string, tone?: 'info' | 'error'): void;
}): React.JSX.Element;

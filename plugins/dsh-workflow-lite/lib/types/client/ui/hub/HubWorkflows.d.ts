/**
 * dsh-workflow-lite — 工作流中心「工作流」页：左边全部工作流，右边选中那张的版本（{@link VersionList}）。
 *
 * 哪张都能直接看、存、切版本，改名、删除也在左边那一行上（{@link HubWorkflowList}），
 * 不用先在编辑页打开它；要编辑就点「打开」。
 * 正在编辑的那张：动手前先把编辑页的改动写下去，切换之后编辑页按磁盘重新加载。
 *
 * 导入导出也在这一页：右栏换成导出（{@link HubExport}，标题栏「导出」）或导入（{@link HubImport}，
 * 左栏顶上「导入」，也可以直接把包拖到这一页上）。做完回到版本，顶上一句结果。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/hub/HubWorkflows
 */
import type { T } from '../../i18n.ts';
import { type WorkflowLiteRpc } from '../../rpc.ts';
import { type PackScope } from './HubExport.tsx';
export declare function HubWorkflows(props: {
    t: T;
    rpc: WorkflowLiteRpc;
    /** 编辑页正开着的那张。 */
    current: string | null;
    /** 看 skill 时站在哪个会话、哪个工作区（导入导出盘点 skill 用）。 */
    scope: PackScope;
    flush(): Promise<boolean>;
    /** 一进来就是导出 `current` 那张（画布顶栏的「导出」），不是版本。 */
    startExport?: boolean;
    /** 正开着的那张切了版本：编辑页按磁盘重新加载。 */
    onReload(): void;
    onOpen(name: string): void;
    /** 改名、删除：走编辑页同一套（正开着的那张跟着变）。回 `false` = 没成，已经提示过。 */
    rename(from: string, to: string): Promise<boolean>;
    remove(name: string): Promise<boolean>;
    /** 版本数变了：外面的工作流目录跟上。 */
    onChanged(): void;
}): React.JSX.Element;

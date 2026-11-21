/**
 * dsh-workflow-lite — 实例视图右栏：选中一张资源卡。
 *
 * 右栏只放缩略信息，细节都在点开之后的详情框里：
 * - 描述（最多三行）；
 * - **内容**：每项一行——图标、名字，下面一行是它此刻的样子（文件：生成没有 · 大小 · 修改时间；
 *   文件夹：在不在 · 修改时间；网址：路径；Skill：一句话说明；自定义：字数）；有说明的挂一个「说明」小签
 *   （和模板里一样，全文在悬停提示与查看框里）。行尾是「查看」和
 *   「打开」（文件 / 文件夹交给系统程序，网址在浏览器里开）；点这一行也是查看。
 *   查看按种类不同：文件读正文（{@link FileViewer}），文件夹列里面有什么，网址、自定义文字显示全文，
 *   Skill 读 SKILL.md；每种都把这一项的说明放在正文前。
 * - **用到它的步骤**：谁产出、谁更新、谁读，带各自的运行状态，点一下跳过去。
 * - **画布展示**：和模板里同一块设置，改的只是这个实例（进草稿栏，存的时候不通知模型）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/RunResource
 */
import type { RunState } from '../../../shared/runState.ts';
import type { ResourceNode, ResourceView, WorkflowDocument } from '../../../shared/types.ts';
import type { Desktop } from '../../app/desktop.ts';
import type { HostAccess } from '../../app/host.ts';
import { type FileTarget } from '../../app/useRunFile.ts';
import type { T } from '../../i18n.ts';
import type { WorkflowLiteRpc } from '../../rpc.ts';
export declare function RunResourceDetail(props: {
    t: T;
    rpc: WorkflowLiteRpc;
    instance: string;
    host: HostAccess;
    snapshot: WorkflowDocument;
    resource: ResourceNode;
    /** 每一项在不在（不是路径的项为 `null`）。 */
    made: readonly (boolean | null)[];
    state: RunState | null;
    /** 状态文件的修改时间：变了就重读文件信息（模型写完文件通常也会更新状态）。 */
    version: number;
    desktop: Desktop | undefined;
    onSelectStep(id: string): void;
    onFocusFile(id: string | null): void;
    onView(target: FileTarget, title: string, note: string | undefined): void;
    onDisplay(view: ResourceView | undefined): void;
    onError(text: string): void;
}): React.JSX.Element;

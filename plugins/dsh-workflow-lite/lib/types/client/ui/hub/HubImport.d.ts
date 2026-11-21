/**
 * dsh-workflow-lite — 工作流中心「工作流」页右栏：导入一个工作流包。
 *
 * 选文件（或拖进来）→ 一块块传到主机暂存 → 主机解开、校验，回一份预览 → 用户看清单、做决定 → 确认卡 → 落盘。
 *
 * 预览把每样东西**落到哪**都写明：资料文件放进 `<dataDir>/assets/<名>/`，skill 装进 `~/.agents/skills/<名>/`；
 * 包里没带的引用逐条说本机有没有。要往 `~/.agents/skills` 里写东西时，得先勾「我确认」才能导入
 * （skill 里的脚本会被 agent 执行）。名字撞了：另存为新名字（缺省），或并入已有的那张——
 * 并入**不自动存**本机现在的内容，没存成版本就提醒一句。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/hub/HubImport
 */
import type { T } from '../../i18n.ts';
import { type WorkflowLiteRpc } from '../../rpc.ts';
import type { PackScope } from './HubExport.tsx';
export declare function HubImport(props: {
    t: T;
    rpc: WorkflowLiteRpc;
    scope: PackScope;
    /** 拖到页面上的那个文件：一进来就开始传。 */
    file: File | null;
    /** 有文件正拖在这一页上（高亮拖放区）。 */
    over: boolean;
    /** 已有的工作流名（小写，判断新名字撞没撞）。 */
    taken: ReadonlySet<string>;
    /** 编辑页正开着的那张（并入它之前先把改动写下去）。 */
    current: string | null;
    flush(): Promise<boolean>;
    onBack(): void;
    /** 导入完了：选中它、回版本页，带一句结果；`reload` = 编辑页正开着它，要按磁盘重新加载。 */
    onDone(name: string, text: string, reload: boolean): void;
}): React.JSX.Element;

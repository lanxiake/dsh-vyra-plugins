/**
 * dsh-workflow-lite — 工作流中心「工作流」页右栏：导出一个工作流。
 *
 * 两步：① 选版本（只导出存成了版本的内容；现在的内容没存成版本就提醒一句，不自动存）；
 * ② 资源清单：按资源种类分类（Skill、文件、文件夹、网址、自定义、资料目录）。能打包的几类在分类标题右端
 * 各有一个开关，开着才列出逐项的勾选（能打包的缺省勾上）和其余各项不打包的原因；资料目录总是整个带上。
 * 点「导出」主机打好 zip，前端一块块取回来交给浏览器下载。
 *
 * 顶上可以换成「导出成 Skill」（见 `shared/skillPack.ts`）：版本只能选一个，资源清单照旧勾，
 * 多一步「Skill 信息」（{@link HubSkillInfo}）填 SKILL.md 头部，再下载 zip 或直接装到本机。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/hub/HubExport
 */
import type { T } from '../../i18n.ts';
import { type WorkflowLiteRpc } from '../../rpc.ts';
export interface PackScope {
    cwd?: string;
    session?: string;
}
export declare function HubExport(props: {
    t: T;
    rpc: WorkflowLiteRpc;
    name: string;
    scope: PackScope;
    onBack(): void;
    /** 导出完了：回版本页，带一句结果。 */
    onDone(text: string): void;
}): React.JSX.Element;

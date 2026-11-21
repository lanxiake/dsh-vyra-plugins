/**
 * dsh-workflow-lite — 导出成 skill 的第三步「Skill 信息」：SKILL.md 头部（名称、描述、使用时机）、
 * 要提醒的事、整个包的预览（左边文件树、右边预览，同实例里看文件夹），底下「装到本机」「下载 zip」。
 *
 * 进来先让主机按选好的版本和打包项编一遍（`pack/skillPreview`）：有编译级问题就只列问题、导不出来；
 * 正文和头部分开，头部按填的字现拼，改名字不用再编。同名 skill 已经在 `~/.agents/skills` 里时，
 * 「装到本机」先浮出确认卡问覆不覆盖。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/hub/HubSkillInfo
 */
import { type SkillMeta } from '../../../shared/skillPack.ts';
import type { T } from '../../i18n.ts';
import { type WorkflowLiteRpc } from '../../rpc.ts';
import type { PackScope } from './HubExport.tsx';
/** 头部填的字（上一步、下一步来回切时留着）。 */
export interface SkillDraft {
    meta: SkillMeta;
    /** 描述用户动过：不再拿预填的那句盖掉。 */
    touched: boolean;
}
export declare function HubSkillInfo(props: {
    t: T;
    rpc: WorkflowLiteRpc;
    /** 工作流名。 */
    name: string;
    version: number;
    pack: readonly string[];
    scope: PackScope;
    draft: SkillDraft;
    onDraft(next: SkillDraft): void;
    /** 打包 / 安装中的那句进度；`null` = 忙完了（出错时由这里报）。 */
    onBusy(text: string | null): void;
    onError(text: string | null): void;
    onPrev(): void;
    onDone(text: string): void;
}): React.JSX.Element;

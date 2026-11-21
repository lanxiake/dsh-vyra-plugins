/**
 * dsh-workflow-lite — 看一个 skill 的 SKILL.md。
 *
 * 框子是 {@link DocViewer}：正文默认排版、可切源码；标题行能复制路径、用其他程序打开
 * SKILL.md 或在文件管理器里显示它所在的文件夹（插件运行时注册的 skill 没有文件，这两样不出现）。
 * 正文前是它的一句话说明和「什么时候用」。从选择框里点开时，底部带一个「选上 / 用这个」。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/resources/SkillPreview
 */
import type { HostAccess } from '../../app/host.ts';
import type { T } from '../../i18n.ts';
import { type IconName } from '../kit/Icon.tsx';
/** 底部的那个按钮（不给就没有底部）。 */
export interface SkillPreviewAction {
    label: string;
    icon: IconName;
    primary: boolean;
    disabled?: boolean;
    onClick(): void;
}
export declare function SkillPreview(props: {
    t: T;
    host: HostAccess;
    name: string;
    action?: SkillPreviewAction;
    onClose(): void;
}): React.JSX.Element;

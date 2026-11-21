/**
 * dsh-workflow-lite — 「选择 Skill」：从会话里的 agent 能用的 skill 里挑。
 *
 * 一行一个 skill：左边是勾选区（勾选框、名字、一句话说明），点它选上 / 取消；右边是来源小签和
 * 一只「眼睛」，点它看 SKILL.md（{@link SkillPreview}，那里也能直接选上）。可以勾好几个一起加，
 * 已经在这个资源里的标成「已添加」。列不出来（没接上 skill 服务、一个都没有）时给一个「手写名字」
 * 的出口（`onManual`），平时不占地方。
 * `single`：编辑一项时换它的 skill——点一行就选定、直接关掉。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/resources/SkillPicker
 */
import type { HostAccess } from '../../app/host.ts';
import type { T } from '../../i18n.ts';
export declare function SkillPicker(props: {
    t: T;
    host: HostAccess;
    /** 资源里已经有的 skill。 */
    existing: readonly string[];
    /** 只选一个：点一行就交出去。 */
    single?: boolean;
    /** 列不出来时「手写一个名字」；不给就没有这个出口。 */
    onManual?: () => void;
    onPick(names: string[]): void;
    onClose(): void;
}): React.JSX.Element;

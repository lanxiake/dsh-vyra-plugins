/**
 * dsh-workflow-lite — 编辑（或新加）资源里的一项：模态框。
 *
 * 面板里的清单一行只放名字和位置；值、说明、「浏览」「从清单选」这些交互都在这里，有地方好好写。
 * - 文件 / 文件夹：路径 +「浏览」（主机上选）；下面写出实际位置（相对路径看有没有步骤写它）。
 * - 网址：一行网址，旁边能直接打开看一眼。
 * - Skill：skill 名 +「从清单选」；DSH 认得这个名字就把它的一句话说明带出来，还能点开看 SKILL.md。
 * - 自定义：一大块文字，就是一段原样交给执行者的提示词（它本身就是正文，没有说明）。
 * 预设里的项（记忆目录）带着自己的名字和默认说明（{@link ItemNote}）：说明框里先放着默认的那份，
 * 标出「默认 / 已改」，改过的能恢复默认；删空或改回默认的，存的时候就不留说明（之后默认措辞改进了也跟着变）。
 * 「完成」时才一次交出去（一次改动 = 一条撤销步），交出去的永远是写法合法、不重复的一项。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/resources/ResourceItemDialog
 */
import type { ResourceItem, ResourceKind } from '../../../shared/types.ts';
import type { HostAccess } from '../../app/host.ts';
import type { T } from '../../i18n.ts';
import type { ItemNote } from './ResourceItems.tsx';
export declare function ResourceItemDialog(props: {
    t: T;
    kind: ResourceKind;
    /** `null` = 新加一项。 */
    initial: ResourceItem | null;
    /** 属于哪个资源（副标题）。 */
    owner: string;
    host: HostAccess;
    /** 有步骤写这个资源（相对路径落在产出根目录下）。 */
    written: boolean;
    /** 产出根目录（还没换实例 id；写在工作区根时为 `undefined`）。 */
    root: string | undefined;
    /** 同一资源里的其它项（查重）。 */
    others: readonly ResourceItem[];
    onSave(item: ResourceItem): void;
    onRemove?: (() => void) | undefined;
    /** 预设里这一项的名字与默认说明；普通资源不给。 */
    note?: ItemNote | undefined;
    onClose(): void;
}): React.JSX.Element;

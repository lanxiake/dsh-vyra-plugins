/**
 * dsh-workflow-lite — 资源里的内容：面板里的紧凑清单 + 「添加」菜单。
 *
 * 一项一行，只放「一眼看清」的东西：种类图标、名字、位置（路径 / 网址 / 种类），有说明的在行尾挂个小标。
 * 要看、要改就点这一行，在模态框里编辑（{@link ResourceItemDialog}）；悬停时行尾浮出「移除」。
 *
 * 预设（比如记忆）可以给一份 {@link ItemsRule}：内容固定（不能加、不能删），每一项有自己的名字和默认说明——
 * 行尾的小标一直挂着（没改过的写「默认说明」），点开在同一个编辑框里改说明。
 *
 * 添加：点「添加内容」弹出一个小菜单——
 * - 文件、文件夹：直接打开主机上的选择框，可以一次选好几个；
 * - Skill：打开会话里的 agent 能用的 skill 清单，可以一次勾好几个、点眼睛看 SKILL.md；
 * - 网址、自定义、手填路径（还不存在的文件，比如产出）：打开编辑框，写好了才加进来。
 * 和已有的重复的不再加。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/resources/ResourceItems
 */
import type { ResourceItem } from '../../../shared/types.ts';
import type { HostAccess } from '../../app/host.ts';
import type { T } from '../../i18n.ts';
/** 预设里一项的名字与默认说明（编辑框里用）。 */
export interface ItemNote {
    /** 编辑框的标题（「记忆目录」）。 */
    title: string;
    /** 说明这一栏叫什么（「记忆说明」）。 */
    label: string;
    /** 默认说明：这一项没写说明时用它；改回它或删空就回到默认。 */
    fallback: string;
    /** 说明下面的提示。 */
    hint: string;
    placeholder: string;
}
/** 预设给内容清单的规矩；普通资源不给。 */
export interface ItemsRule {
    /** 内容固定：不能加、不能删，只能点开改。 */
    fixed: boolean;
    /** 第几项的名字与默认说明；不给的那项按普通资源。 */
    note(index: number): ItemNote | undefined;
}
export declare function ResourceItems(props: {
    t: T;
    items: readonly ResourceItem[];
    host: HostAccess;
    /** 资源的显示名（编辑框的副标题）。 */
    owner: string;
    /** 有步骤写这个资源（相对路径落在产出根目录下）。 */
    written: boolean;
    /** 产出根目录（还没换实例 id；写在工作区根时为 `undefined`）。 */
    root: string | undefined;
    /** 改内容：整份换掉。一次改动 = 一条撤销步。 */
    onChange(items: ResourceItem[]): void;
    /** 预设的规矩（内容固定、每项的默认说明）；普通资源不给。 */
    rule?: ItemsRule | undefined;
}): React.JSX.Element;

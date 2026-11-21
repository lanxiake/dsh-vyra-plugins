/**
 * dsh-workflow-lite — 资源在界面上的样子：每种内容的图标与名字、一项内容的简短写法、起名与查重。
 *
 * 画布的资源卡、属性面板、实例视图都从这里取，同一种内容到哪儿都是同一个图标、同一种写法。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/resourceUi
 */
import type { ResourceItem, ResourceKind, WorkflowNode } from '../../../shared/types.ts';
import type { HostSkillEntry } from '../../../shared/wire/host.ts';
import type { LocaleKey } from '../../i18n.ts';
import type { IconName } from './Icon.tsx';
export declare const KIND_ICON: Record<ResourceKind, IconName>;
export declare const KIND_LABEL: Record<ResourceKind, LocaleKey>;
/**
 * 卡片上一项的写法：文件与文件夹取最后一段，网址去掉协议，自定义取第一行
 * （自定义文字常是 Markdown：去掉行首的标题 `#`、列表 `-`、引用 `>` 记号）。
 */
export declare function itemText(item: ResourceItem): string;
/** 面板清单里一项的名字：网址只取主机名（整条网址放在下面一行），其余同 {@link itemText}。 */
export declare function itemName(item: ResourceItem): string;
/**
 * 面板清单里一项的位置（名字下面那一行）：文件与文件夹是路径（相对路径有步骤写它时换成产出根目录下的
 * 实际位置），网址是整条网址；Skill 与自定义没有位置（空串，界面上写种类）。
 */
export declare function itemLocation(item: ResourceItem, root: string | undefined, written: boolean): {
    text: string;
    mono: boolean;
};
/** 往资源里加几项：空值照加（等着填），和已有的重复的跳过，满了就停。 */
export declare function addItems(items: readonly ResourceItem[], fresh: readonly ResourceItem[], max: number): ResourceItem[];
/**
 * SKILL.md 头部的键值里，值得给人看的那些：DSH 自己会往解析结果里附加管理用的键
 * （技能管理器的 `dshSkillsManager` 之类，不在文件里），以 `dsh` 开头的一律不当成文件内容展示。
 */
export declare function fileMetadata(metadata: Readonly<Record<string, unknown>> | undefined): [string, unknown][];
/** 筛选 skill：名字或说明里有这几个字（不分大小写）。 */
export declare function filterSkills(skills: readonly HostSkillEntry[], filter: string): readonly HostSkillEntry[];
/** skill 从哪来，给人看的两种说法（清单里的小签、预览里的全称）；不认识的来源原样给。 */
export declare function skillSource(source: string, t: (key: LocaleKey) => string): {
    short: string;
    full: string;
};
/** 节点的显示名：步骤取名称，资源取名字（没有就第一项），输入取问题。 */
export declare function stepName(node: WorkflowNode | undefined, fallback: string): string;
/** 同一个资源里两项是不是重复（种类相同、值规范化后相同）。 */
export declare function sameItem(a: ResourceItem, b: ResourceItem): boolean;

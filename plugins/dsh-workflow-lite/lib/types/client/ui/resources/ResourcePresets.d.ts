/**
 * dsh-workflow-lite — 资源卡的类型标记（预设）：标题栏图标块上的「类型」选择，和每种预设自带的快捷配置。
 *
 * 和步骤的「图标与颜色」同一块浮层（`LookPicker`）：点面板标题左边的图标块（右下角挂调色盘），
 * 上面选卡片的颜色，下面一格一种类型（悬停看名字和说明）。选了就换，内容不合换不了的置灰、悬停说原因。
 *
 * 规矩（打上、摘掉时内容和连线怎么变）在 `shared/presets.ts` 的 `PRESET_SPECS`；这里只管名字、图标、颜色和配置块。
 * 加新预设：在 {@link PRESET_UI} 加一行（名字、默认颜色、图标），配置块按需填 `head`（内容上面）/ `tail`（内容下面），
 * 内容清单有自己的规矩（固定几项、每项的默认说明）就填 `items`——清单和编辑框照普通资源的样子画，不另起一块。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/resources/ResourcePresets
 */
import { type StepColor } from '../../../shared/appearance.ts';
import { type MemoryType, type ResourceData, type ResourceNode, type ResourcePresetKind, type WorkflowDocument } from '../../../shared/types.ts';
import type { HostAccess } from '../../app/host.ts';
import type { MemoryPickTarget } from '../../app/useMemoryPick.ts';
import type { LocaleKey, T } from '../../i18n.ts';
import type { Edit } from '../../model/editor.ts';
import { type IconName } from '../kit/Icon.tsx';
import type { ItemsRule } from './ResourceItems.tsx';
/** 换一条记忆、把资源卡换成记忆：弹「选已有的 / 新建」（贴着 `anchor`，没给就贴着最后按下的位置）。 */
export type PickMemory = (target: MemoryPickTarget, anchor?: Element | null) => void;
/** 预设配置块拿到的东西。 */
export interface PresetBlockProps {
    t: T;
    node: ResourceNode;
    /** 没连线（交给整个工作流）。 */
    shared: boolean;
    /** 工作流名；没有（实例视图）就不能换引用的记忆。 */
    workflow: string | null;
    host: HostAccess;
    onPickMemory?: PickMemory | undefined;
    patch(next: Partial<ResourceData>, field?: string): void;
    onSeal(): void;
}
/** 资源的类型：普通资源（`none`）或一种预设。 */
export type ResourceType = ResourcePresetKind | 'none';
interface TypeUi {
    label: LocaleKey;
    /** 没选颜色时卡片的颜色。 */
    color: StepColor;
    /** 类型清单里名字下面那句：这种类型是什么。 */
    desc: LocaleKey;
    icon: IconName;
}
interface PresetUi extends TypeUi {
    /** 内容上面的快捷配置。 */
    head?(props: PresetBlockProps): React.JSX.Element;
    /** 内容下面的快捷配置。 */
    tail?(props: PresetBlockProps): React.JSX.Element;
    /** 内容清单的规矩（固定几项、每项的名字与默认说明）。 */
    items?(props: PresetBlockProps): ItemsRule;
}
export declare const PRESET_UI: Record<ResourcePresetKind, PresetUi>;
/** 资源卡的颜色：自己选了就用它，没选按类型的颜色。 */
export declare function resourceColor(data: ResourceData): StepColor;
/**
 * 画布上卡片要不要染色：选了颜色、或者是预设（记忆是琥珀色）才染；普通资源没选颜色保持资源卡本来的灰。
 */
export declare function resourceTint(data: ResourceData): StepColor | null;
/** 资源卡的图标块：卡片的颜色 + 类型的图标（和步骤的图标块一个样子）。 */
export declare function ResourceMark(props: {
    data: ResourceData;
    size?: number;
}): React.JSX.Element;
/**
 * 标题栏左边的图标块：点开是「颜色与类型」——上面选颜色，下面一格一种类型（悬停看名字），
 * 和步骤的「图标与颜色」同一块浮层。没有工作流名（实例视图）时只是个图标块，换不了。
 */
export declare function ResourceTypePicker(props: {
    t: T;
    doc: WorkflowDocument;
    node: ResourceNode;
    workflow: string | null;
    onEdit(edit: Edit): void;
    onPickMemory?: PickMemory | undefined;
}): React.JSX.Element;
/** 当前预设给内容清单的规矩；普通资源（或预设没写）不给。 */
export declare function presetItems(props: PresetBlockProps): ItemsRule | undefined;
/** 当前预设的配置块（`slot` 指内容的上面还是下面）；普通资源没有。 */
export declare function PresetBlock(props: PresetBlockProps & {
    slot: 'head' | 'tail';
}): React.ReactNode;
/** 记忆类型的名字（工作流记忆 / 步骤记忆）。 */
export declare function memoryTypeText(t: T, type: MemoryType): string;
export {};

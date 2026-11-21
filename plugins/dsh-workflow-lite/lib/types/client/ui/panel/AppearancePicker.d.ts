/**
 * dsh-workflow-lite — 选图标与颜色：点面板标题左边的图标块，弹出色板与图标库。
 *
 * {@link LookPicker} 是那块浮层本身：上面一排颜色，下面一格格图标（悬停看名字）。
 * - 步骤（{@link AppearancePicker}）：图标库里随便挑，画布上的步骤（属性面板）与「我的步骤」（步骤库详情）共用；
 * - 资源卡（`ResourcePresets.tsx`）：下面一格是一种类型（资源、记忆……），点了就换类型，换不了的置灰、悬停说原因。
 *
 * 选了就改，不用确认；「恢复默认」只清颜色和图标这类外观（步骤回到按 id 猜的样子，资源回到类型的颜色）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/panel/AppearancePicker
 */
import { type Appearance, type StepColor, type StepIcon } from '../../../shared/appearance.ts';
import type { T } from '../../i18n.ts';
import { type IconName } from '../kit/Icon.tsx';
/** 下面一格：一个值、画哪个图标；`tip` 是悬停的字，`disabled` 是点不了（`tip` 里写原因）。 */
export interface LookIcon<V extends string> {
    value: V;
    icon: IconName;
    tip?: string;
    disabled?: boolean;
}
export declare function LookPicker<V extends string>(props: {
    t: T;
    /** 浮层标题、图标那一组的小标题、触发块悬停的字。 */
    title: string;
    iconTitle: string;
    change: string;
    /** 触发块里画的东西（步骤 / 资源的图标块）。 */
    mark: React.ReactNode;
    color: StepColor;
    icon: V;
    icons: readonly LookIcon<V>[];
    /** 存了外观（不是默认的）：才有「恢复默认」。 */
    custom: boolean;
    /** 触发块的 testid；颜色 `${testId}-color-<色>`、图标 `${testId}-icon-<值>`、恢复默认 `${testId}-reset`。 */
    testId: string;
    onColor(color: StepColor): void;
    onIcon(icon: V): void;
    onReset(): void;
}): React.JSX.Element;
/** `undefined` = 清掉这一项（回到按 id 猜）。 */
export interface AppearancePatch {
    icon?: StepIcon | undefined;
    color?: StepColor | undefined;
}
/** 步骤的图标与颜色。 */
export declare function AppearancePicker(props: {
    t: T;
    look: Appearance;
    /** 存了样子（不是猜的）：才有「恢复默认」。 */
    custom: boolean;
    size?: number;
    onChange(patch: AppearancePatch): void;
}): React.JSX.Element;

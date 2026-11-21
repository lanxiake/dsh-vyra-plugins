/**
 * dsh-workflow-lite — 「内容」一组各种设置共用的小件：位置三选一、开关一行、分段一行、组标题。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/options/optionParts
 */
import type { ViewFrom } from '../../../../shared/types.ts';
import type { T } from '../../../i18n.ts';
/** 「位置」三选一：自动 / 末尾 / 开头。 */
export declare function FromPicker(props: {
    t: T;
    value: ViewFrom | undefined;
    tip: string;
    onChange(from: ViewFrom | undefined): void;
}): React.JSX.Element;
/** 一个开关一行（和「隐藏标题」一个样子）。 */
export declare function OptSwitch(props: {
    on: boolean;
    label: string;
    tip?: string;
    testId: string;
    onToggle(): void;
}): React.JSX.Element;
/** 一行「标签 + 分段选择」。 */
export declare function SegLine<V extends string>(props: {
    label: string;
    tip?: string;
    value: V;
    options: readonly {
        value: V;
        label: string;
    }[];
    testId: string;
    onChange(value: V): void;
}): React.JSX.Element;
/**
 * 一组的标题：粗一档的字，前面可带一个小记号（内容那组是文件类型），后面可带淡色的补充（文件名）和一枚「i」，悬停看说明。
 * 组和组之间一道细线（见 `.options > .optGroup`）。
 */
export declare function GroupHead(props: {
    label: string;
    tip?: string | undefined;
    lead?: React.ReactNode;
    sub?: string | undefined;
}): React.JSX.Element;

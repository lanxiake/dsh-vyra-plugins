/**
 * dsh-workflow-lite — 分段选择（单选）。
 *
 * 选中格下面那块滑块滑到新的一格（见 motion/thumb.tsx 的 PickThumb），字色灰 → 深是两层字交叉淡过去（FadeText），
 * 不是瞬间变色；选项前的小色点（`color`）只在选中、悬停时亮起；`count` 是字后面一个小数字标；`tip` 是悬停说明。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/Segmented
 */
export declare function Segmented<V extends string>(props: {
    label: string;
    value: V;
    /** `color`：选项前的小色点（比如条件的四种线色），和画布上对应的东西同色。 */
    /** `tip`：悬停说明（字是符号时也当读屏的名字）。 */
    options: readonly {
        value: V;
        label: string;
        color?: string;
        count?: number;
        tip?: string;
    }[];
    onChange: (value: V) => void;
    disabled?: boolean;
    /** 每格的 `data-testid` 是 `${testId}-${value}`。 */
    testId?: string;
}): React.JSX.Element;

/**
 * dsh-workflow-lite — 展示设置里能直接改的数字：宽高框里的 {@link RollInput}，缩放、上下文那种「− 数 +」的 {@link Stepper}。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/NumberStep
 */
/**
 * 能直接改的数字（宽、高、缩放、上下文）：输入时只是草稿，回车、失焦才交给 `onCommit`（夹进范围、取整由调用方定）；
 * 上下键按 `step` 走一下，当场生效。
 * 没在改的时候，数字画在上面一层的 SwapText 里：点三档、按 − / + 时旧数字让开、新数字滚进来（变大往上、变小往下），
 * 不是一下跳过去；点进去改时那一层藏起来，露出输入框里的字。
 */
export declare function RollInput(props: {
    label: string;
    value: number;
    onCommit(value: number): void;
    step(up: boolean, big: boolean): number;
    testId: string;
    className: string;
    disabled?: boolean;
}): React.JSX.Element;
/**
 * 「− 数 +」：两头的按钮按 `next` 走一档，中间的数能直接填（上下键一次 1、按住 Shift 一次 10），后面跟单位。
 * `disabled` 时整块灰着，`tip` 说为什么。
 */
export declare function Stepper(props: {
    label: string;
    value: number;
    min: number;
    max: number;
    unit: string;
    /** 按 − / + 走到哪（缩放按常用档位走，别的一次 1）；不给就是 ±1。 */
    next?: (value: number, dir: 1 | -1) => number;
    onChange(value: number): void;
    testId: string;
    lessLabel: string;
    moreLabel: string;
    disabled?: boolean;
    tip?: string | undefined;
}): React.JSX.Element;

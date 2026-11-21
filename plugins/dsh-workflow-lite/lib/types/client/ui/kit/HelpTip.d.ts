/**
 * dsh-workflow-lite — 「?」说明：平时只占一个小图标，悬停 / 聚焦 / 点击时浮出一段说明。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/HelpTip
 */
/**
 * 「?」说明：平时只占一个小图标，悬停 / 聚焦 / 点击时浮出一段说明（浮层行为见 {@link useFloat}）。
 * 点「?」钉住（触屏也能用），点别处或按 Esc 收起。
 */
export declare function HelpTip(props: {
    label: string;
    children: React.ReactNode;
    testId?: string;
}): React.JSX.Element;

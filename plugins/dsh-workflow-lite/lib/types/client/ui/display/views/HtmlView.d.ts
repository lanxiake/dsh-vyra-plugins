/**
 * dsh-workflow-lite — 展示区里的网页：沙箱 iframe，按「大小」排版、按缩放整张等比缩放。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/views/HtmlView
 */
import type { Display } from '../../../model/display.ts';
/** 网页：按「大小」排版，再按缩放整张等比缩放（像图片一样，排版不变）。页面是看板的卡片版（`data-board="card"`），带画布主题。 */
export declare function HtmlView(props: {
    name: string;
    text: string;
    display: Display;
    interactive: boolean;
}): React.JSX.Element;

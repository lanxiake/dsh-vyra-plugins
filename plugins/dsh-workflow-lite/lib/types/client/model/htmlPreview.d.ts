/**
 * dsh-workflow-lite — 在查看框里渲染 HTML 之前，给页面补细滚动条，颜色跟着页面自己的底色走。
 *
 * 框里的页面是独立的源，外面的样式进不去，只能在交给 `srcdoc` 的文字里补。
 *
 * 滚动条画在页面上，该看的是**页面的**底色，不是画布的主题：没写背景的页面在框里是白底（画布暗色时也是），
 * 暗色看板在亮色画布里照样是暗底。所以补一小段脚本，页面加载后读 `<body>` / `<html>` 的背景色，
 * 深底用浅色滑块、浅底用深色滑块；脚本跑起来之前先用一个两种底色上都看得见的中灰。
 *
 * 样式用 `:where()` 把优先级压到零——页面自己写了滚动条样式就用页面的。插在 `<head>` 后
 * （没有就在 `<html>` / doctype 后），不能插到 doctype 前面，否则页面会掉进怪异模式。
 *
 * 看板（画布展示的网页）再多补一段：标出卡片 / 查看框模式、写上画布主题的 `--board-*` 变量，换主题时就地改（约定见 shared/board.ts）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/htmlPreview
 */
import { type BoardMode, type BoardTheme } from '../../shared/board.ts';
/** 深底上的滑块、浅底上的滑块、还不知道底色时的滑块。 */
export declare const THUMB: {
    readonly onDark: "rgba(255,255,255,.28)";
    readonly onLight: "rgba(0,0,0,.28)";
    readonly unknown: "rgba(128,128,128,.45)";
};
/** 框里的页面告诉外面「有几张图没加载出来」时发的消息类型。 */
export declare const BROKEN_IMAGES = "wl-preview:broken-images";
/** 补进页面的那一段。 */
export declare const PREVIEW_STYLE: string;
/** 认框里发来的消息：是「加载失败的图片数」就返回个数，别的（别人的消息、形状不对）返回 `null`。 */
export declare function brokenImagesOf(data: unknown): number | null;
/**
 * 看板那一段：一上来就标模式、写变量（写在 `<html>` 的内联样式上，比页面 `:root` 的后备值优先），
 * 之后只认父窗口发来的主题消息，只收 `--board-` 开头的字符串值，改完派发事件让页面重画图表。
 * 消息里 `clear` 为真时标上镂空、`--board-bg` 换成画布底色；`still` 为真时标上静止；都随时能开关，不用重载页面。
 */
export declare function boardScript(mode: BoardMode, theme: BoardTheme): string;
/** 把 {@link PREVIEW_STYLE}（看板再加 {@link boardScript}）插进页面。 */
export declare function withPreviewStyle(html: string, board?: {
    mode: BoardMode;
    theme: BoardTheme;
}): string;

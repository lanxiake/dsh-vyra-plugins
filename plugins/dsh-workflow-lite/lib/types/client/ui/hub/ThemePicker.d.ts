/**
 * dsh-workflow-lite — 工作流中心「设置」页的「外观」：亮色、暗色各挑一套配色主题。
 *
 * 点一下马上换，不进下面的保存条（只是看起来的样子，记在浏览器里，见 app/theme.ts）。
 * 每张小卡是那套主题的缩略：画布底、一条侧栏、两张卡和连着它们的线、选中的那张描强调色。
 * 亮、暗两行里，此刻正用着的那一行标「正在用」。
 * 最下面一行是画布上的展示卡默认长什么样（卡片、柔边镂空、纯镂空、毛玻璃，见 app/displayLook.ts），同样即点即生效。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/hub/ThemePicker
 */
import type { T } from '../../i18n.ts';
export declare function ThemePicker(props: {
    t: T;
}): React.JSX.Element;

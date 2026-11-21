/**
 * dsh-workflow-lite — 展示卡还没有内容时的草图：按内容种类画一张淡淡的线框，底下一枚说明签。
 *
 * - 网页：一张看板的样子（标题行、一排指标卡、一块折线图）；
 * - 图片：一座山和太阳，标出展示框的比例和建议的出图尺寸；
 * - Markdown：标题、几行正文、一张小表；
 * - 纯文本 / 代码：行号和长短不一的几行；
 * - 文件夹（图墙）：和真的一样排的格子，最新那张的大格里一座山。
 *
 * 线框只是「这里会出现什么」的示意，颜色压得很低，一眼就看得出不是真内容；尺寸跟着展示区走
 * （窄、矮的卡片上收掉放不下的部分，见 `displaySketch.module.css` 的容器查询）。全是静态的，不读文件、不动；
 * 写它的步骤正在跑时，上面扫一道光。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/DisplaySketch
 */
import type { Display } from '../../model/display.ts';
import { type IconName } from '../kit/Icon.tsx';
export declare function DisplaySketch(props: {
    display: Display;
    icon: IconName;
    title: string;
    /** 说明签上跟在标题后面的文件名。 */
    sub?: string;
    /** 写它的步骤正在跑。 */
    busy?: boolean;
}): React.JSX.Element;

/**
 * dsh-workflow-lite — 展示区里按行读的日志、纯文本：只排读回来的那几百行，筛选命中的字垫强调色。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/views/LogView
 */
import type { LineFilter } from '../../../../shared/types.ts';
import type { T } from '../../../i18n.ts';
import type { Display } from '../../../model/display.ts';
import { type LineWindow } from '../../../model/logLines.ts';
/** 展示卡按行读时要多少行：一屏看得到几十行，留些余量（筛的时候是匹配的行数）。 */
export declare const CARD_LINES = 200;
/**
 * 日志、纯文本按行看（`run/lines` 读回来的窗口）：只排读回来的那几百行。
 * 停在末尾时上边淡出、最上面写前面还有多少；从头看时写后面还有多少。筛的时候只有匹配的行（带上下文时
 * 不挨着的两段之间一道「跳过 N 行」），命中的字垫一层强调色。新追加的行亮一下再淡。
 * 进了交互、停在末尾的：往上翻着看时新内容不拽人回去，底下浮出「回到最新」（来了几行新的也写上）。
 */
export declare function LogFlow(props: {
    t: T;
    win: LineWindow;
    display: Display;
    interactive: boolean;
    /** 停在末尾（跟着往下走）。 */
    tail: boolean;
    wrap: boolean;
    filter: LineFilter | undefined;
}): React.JSX.Element;
/** 筛着看时卡片左上角那句：「23 行匹配」「200+ 行匹配」「最近 64 MB 里 3 行匹配」；反选时是「显示 N 行」。 */
export declare function matchSummary(t: T, win: LineWindow, filter: LineFilter, from: 'end' | 'start'): string;

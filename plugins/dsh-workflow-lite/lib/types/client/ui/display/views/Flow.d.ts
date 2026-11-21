/**
 * dsh-workflow-lite — 展示区里的 Markdown / 纯文本：按 `zoom` 缩放字号，超出的一边淡出，新加的行亮一下。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/views/Flow
 */
import type { T } from '../../../i18n.ts';
import type { Display } from '../../../model/display.ts';
import { type ImageSource } from '../../files/Markdown.tsx';
/**
 * 逗号后面可以断行（`<wbr>`，复制出来不多字）：没有空格的一长行（JSON 记录）折在字段之间，
 * 不会在日期、字段名中间断开。
 */
export declare function softBreaks(line: string): React.ReactNode;
/**
 * Markdown / 纯文本：按 `zoom` 放大缩小字号。
 * 外面一层（`flowClip`）和展示区一样大、负责裁：内容真的超出了才在那一边淡出——超出底边在底边、
 * 不折行的长行超出右边在右边。进了交互不裁，展示区自己滚。
 * Markdown 里相对路径的图按文档所在目录去实例里读（`image`；自定义文字没有目录，不给）。
 * 纯文本去掉终端颜色码，压成一行的 JSON 展开缩进；一行一块（行多时只排 {@link WRAP_LINES} 行），
 * 折行时续行悬挂缩进，看得出每一条从哪开始。文件更新了，新的几行亮一下再淡下去。
 * 日志（`follow`）停在末尾：排最后几行、超出的是上边、上边淡出，前面还有多少写在最上面。
 */
export declare function Flow(props: {
    t: T;
    text: string;
    path?: string;
    display: Display;
    image?: ImageSource | undefined;
    wrap?: boolean | undefined;
    follow?: boolean;
    /** 只读了末尾：前面没读的字节数。 */
    cut?: number;
    interactive?: boolean;
}): React.JSX.Element;

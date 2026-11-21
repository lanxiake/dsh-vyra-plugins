/**
 * dsh-workflow-lite — 展示设置浮层里的「内容」一组：按展示的东西不同给不同的几项（见 {@link DisplayOptions}）。
 *
 * - 日志、纯文本：位置（自动 / 末尾 / 开头）、只看（筛选：普通文字或正则、区分大小写、反选、前后带几行、
 *   两个现成的筛选）、错误警告着色。
 * - CSV / TSV：位置、列（点一下隐藏）、排序、数字列画条。
 * - 文件夹（图墙）：排法、张数（自动或固定几列几行）、顺序、最新一张放大。
 *
 * 改什么卡片当场跟着变；筛选框打字时停一下才生效（每敲一个字就去主机找一遍不值当）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/DisplayContent
 */
import type { ResourceView } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
import type { Display } from '../../model/display.ts';
/** 这一项有没有「内容」一组。 */
export declare function contentKind(display: Display, path: string): 'lines' | 'table' | 'gallery' | null;
/**
 * 内容那一组（这一项没有可调的就不出现）：标题写明是什么（日志 / 文本 / 表格 / 文件夹）和是哪一份，
 * 下面是这一种自己的几项。
 */
export declare function ContentOptions(props: {
    t: T;
    display: Display;
    view: ResourceView;
    /** 展示的那一项的路径（按扩展名定是日志、表格还是别的）。 */
    path: string;
    headKey: string;
    set(patch: Partial<ResourceView>): void;
}): React.JSX.Element | null;

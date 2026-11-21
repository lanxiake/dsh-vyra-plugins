/**
 * dsh-workflow-lite — 「内容」一组里日志、纯文本的那几项。
 * 位置（自动 / 末尾 / 开头）、只看（筛选：普通文字或正则、区分大小写、反选、前后带几行、
 * 两个现成的筛选）、错误警告着色。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/options/LinesOptions
 */
import type { LineView } from '../../../../shared/types.ts';
import type { T } from '../../../i18n.ts';
/** 日志、纯文本的那几项。 */
export declare function LinesOptions(props: {
    t: T;
    value: LineView;
    onChange(lines: LineView | undefined): void;
}): React.JSX.Element;

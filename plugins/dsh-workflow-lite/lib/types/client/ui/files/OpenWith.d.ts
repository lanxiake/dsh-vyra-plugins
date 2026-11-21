/**
 * dsh-workflow-lite — 「用其他程序打开」按钮。
 *
 * 点开列出系统里能打开这类文件的程序（默认的那个排第一并标出来），最后一项是在文件管理器里显示——
 * 和 DSH 文档预览右上角那个按钮一样。宿主没有桌面能力（远程访问、没接上服务）或文件还不在时不出现。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/OpenWith
 */
import type { Desktop } from '../../app/desktop.ts';
import type { T } from '../../i18n.ts';
export interface OpenWithProps {
    t: T;
    desktop: Desktop | undefined;
    /** 文件的绝对路径；文件还不在时为 `null`（系统程序那一半不出现）。 */
    path: string | null;
    /** 只留图标（文件面板的标题行里用）；缺省是「图标 + 字 + 箭头」。 */
    compact?: boolean;
    /** 打开失败时告诉调用方（给人看的一句话）。 */
    onError?: (text: string) => void;
}
export declare function OpenWith(props: OpenWithProps): React.JSX.Element | null;

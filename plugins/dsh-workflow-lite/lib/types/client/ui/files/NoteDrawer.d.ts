/**
 * dsh-workflow-lite — 查看框里的「说明」：标题行一个开关，点开从右边滑出一栏，盖在正文上面。
 *
 * 说明（产出文件的生成要求、步骤的描述）常常很长，放在正文上面会一直占着一大块，HTML 页面还会被挤出
 * 两层滚动条；收在开关里，要看时再拉出来，正文不跟着重排。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/NoteDrawer
 */
import type { T } from '../../i18n.ts';
/** 标题行里的开关。 */
export declare function NoteToggle(props: {
    t: T;
    open: boolean;
    onToggle(): void;
}): React.JSX.Element;
/** 滑出来的那一栏；Esc 先收起它，再按一次才关查看框。 */
export declare function NoteDrawer(props: {
    t: T;
    text: string;
    onClose(): void;
}): React.JSX.Element;

/**
 * dsh-workflow-lite — 「选择文件 / 选择文件夹」：在主机上点着选，不用手敲路径。
 *
 * 模态框：上面是面包屑路径（每一级都能点，旁边的笔切成输入框直接敲路径）和几个常用位置
 * （工作区、主目录、各个盘符），中间是当前目录里的东西，下面是已选几项。
 * - 列表第一行永远是「上一级」（就在手边，不用回到顶上找按钮）；筛选框空着时按 Backspace、
 *   任何时候按 Alt+↑ 也是上一级；
 * - 一行：线条图标（文件夹琥珀色、文件灰色，不带底色）、名字，右边是进入箭头（文件夹）和圆形勾选
 *   （能选的才有；悬停或选上时才显出来）；
 * - 选文件：点文件这一行就选上 / 取消，双击直接添加；文件夹点了进去；
 * - 选文件夹：只列文件夹；点右边的圆圈选上，点这一行进去；一个都没勾时右下角的主按钮是「选当前文件夹」，勾了就变成「添加」；
 * - 筛选框只筛当前目录；隐藏项（`.` 开头）默认不列。
 * 动效（只动 transform / opacity）：进下一级、回上一级时整块目录横着换（往里走旧的往左退、新的从右进，往回走反过来，见 {@link useStage}）；
 * 面包屑长出一级时新的一级从前一级背后展开，缩短时收回去（见 {@link useTrail}）；
 * 筛选与「隐藏项」开关让行增减时，留下的行滑到新位置、新行淡入、去掉的行原地淡出（见 {@link useResizeFlip}）。
 * 选中的是绝对路径（分隔符 `/`），原样进资源。
 * `single`：编辑一项时换它的路径——只能选一个，选另一个就换过去。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/resources/HostPicker
 */
import type { HostAccess } from '../../app/host.ts';
import type { T } from '../../i18n.ts';
export type PickMode = 'file' | 'folder';
export declare function HostPicker(props: {
    t: T;
    host: HostAccess;
    mode: PickMode;
    /** 从哪儿开始看（缺省 = 工作区）。 */
    start?: string;
    /** 只选一个。 */
    single?: boolean;
    onPick(paths: string[]): void;
    onClose(): void;
}): React.JSX.Element;

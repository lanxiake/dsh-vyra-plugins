/**
 * dsh-workflow-lite — 「内容」一组里文件夹的那几项。
 * 排法、张数（自动或固定几列几行）、顺序、最新一张放大。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/options/FolderOptions
 */
import { type GalleryView, type ViewFit } from '../../../../shared/types.ts';
import type { T } from '../../../i18n.ts';
import type { Display } from '../../../model/display.ts';
/**
 * 文件夹的那几项。先挑「展示」：自动（有图片就排成图片墙，没有就列文件；下面一句说现在是哪种）、图片墙、文件列表；
 * 下面只出这一种用得上的：
 * - 图片墙：排法（图墙 / 大图 + 胶片 / 最新一张）、图墙的张数（自动或固定几列几行）、每格怎么摆、第一张放大；
 * - 文件列表：一行一项还是格子、带不带修改时间。
 * 两种都有的：只看（按名字筛）、顺序（最新 / 名字 / 大小）。
 * 张数从「自动」换到「固定」时，先定在现在自动排出来的那个格子上（看到的不跳）。
 */
export declare function FolderOptions(props: {
    t: T;
    display: Display;
    value: GalleryView;
    headKey: string;
    onChange(gallery: GalleryView | undefined): void;
    onFit(fit: ViewFit | undefined): void;
}): React.JSX.Element;

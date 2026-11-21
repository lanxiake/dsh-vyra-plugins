/**
 * dsh-workflow-lite — 展示区里文件夹的图片墙：最新一张占大格，图少时按张数重排，没有图时列出文件。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/views/GalleryView
 */
import type { T } from '../../../i18n.ts';
import type { Display } from '../../../model/display.ts';
import type { DisplayEnv } from '../displayEnv.ts';
/**
 * 文件夹排成图墙：里面的图从新到旧，最新的一张占左上角的大格（格子够多时），露不下的写在最后一格「+N」里。
 * 图少时按张数重排，最后一行摊开占满、不留空格（见 `galleryLayout`）。每格按「摆放方式」铺满或完整放进去；进了交互点一格打开文件夹、
 * 直接看那一张。新加、改过的那几张描一圈亮边再淡下去。文件夹里没有图时列出里面的文件。
 */
export declare function GalleryView(props: {
    t: T;
    run: NonNullable<DisplayEnv['run']>;
    node: string;
    display: Display;
    interactive: boolean;
    /** 文件夹变了（修改时间）就重列。 */
    signal: number;
    /** 点一格：打开文件夹看这一张。 */
    onOpen?: ((sub: string) => void) | undefined;
}): React.JSX.Element;

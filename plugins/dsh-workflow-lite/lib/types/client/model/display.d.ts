/**
 * dsh-workflow-lite — 画布上的展示卡：卡片因展示多大、拖出来的尺寸怎么取整、缩放怎么走档。
 *
 * 哪些能展示、展示哪一项、缺省多大在 `shared/display.ts`（编译计划、工具也要用），这里转出去给界面用。
 * 卡片尺寸 = 标题行 + 展示区，布局与连线都按它算。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/display
 */
import { type Display } from '../../shared/display.ts';
export { DEFAULT_ZOOM, type Display, type DisplayKind, defaultView, displayableItems, displayFootprint, displayKindOf, displayOf, firstDisplayable, VIEW_SIZES, } from '../../shared/display.ts';
/** 展示卡的标题行高（CSS 里写死同样的数）；展示区贴着标题行，四周不留白。 */
export declare const DISPLAY_HEAD = 38;
/** 展示卡整张的尺寸：标题行 + 展示区在画布上占的大小（网页要乘缩放）。 */
export declare function displayCardSize(display: Pick<Display, 'kind' | 'width' | 'height' | 'zoom'>): {
    w: number;
    h: number;
};
/** 拖出来的展示区尺寸：夹进范围、按 8 像素取整。 */
export declare function snapView(width: number, height: number): {
    width: number;
    height: number;
};
/** 内容缩放可选的几档（百分比）。 */
export declare const ZOOM_STEPS: readonly [25, 33, 50, 67, 75, 90, 100, 110, 125, 150, 200];
/**
 * 按住 Ctrl 拖右下角＝缩放：拖到的那个角投到卡片对角线上，看是原来的几倍，缩放跟着乘上去。
 * 只看对角线方向：横着拖、竖着拖、斜着拖都按「卡片变大了多少」算，不会因为手抖往一边偏就跳。
 * 结果取整、夹进 25–400；离某一档（100%、125%……）不到 3 个百分点就吸到那一档。
 * `from` 是开始拖时卡片在画布上的大小，`to` 是此刻拖到的大小（画布像素）。
 */
export declare function dragZoom(zoom: number, from: {
    width: number;
    height: number;
}, to: {
    width: number;
    height: number;
}): number;
/** 往大 / 往小走一档。 */
export declare function stepZoom(zoom: number, dir: 1 | -1): number;

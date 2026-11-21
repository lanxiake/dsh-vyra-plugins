/**
 * dsh-workflow-lite — 放大看图的几何（{@link ImageZoom} 用）：适应窗口、缩放、平移、旋转。纯函数，不碰 DOM，好单测。
 *
 * 坐标以**舞台中心**为原点：`x`、`y` 是图心偏了多少（屏幕像素）；`scale` 是相对原图像素的倍数；
 * `rot` 是顺时针的角度，只取 90 的倍数。`rot` 不折回 0–360，转的圈数照实累计，CSS 过渡才会沿着按钮的方向转。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/imageView
 */
export interface Size {
    w: number;
    h: number;
}
export interface Point {
    x: number;
    y: number;
}
export interface ImageView extends Point {
    scale: number;
    rot: number;
}
/** 缩放的上下界：再小就看不见了，再大就只是一片色块。 */
export declare const ZOOM_MIN = 0.02;
export declare const ZOOM_MAX = 8;
/** 按钮与 + / - 键每次乘或除的倍数。 */
export declare const ZOOM_STEP = 1.25;
/** 适应窗口最多放到原图的两倍：小图（聊天里的截图之类）放大看，但不糊成一片。 */
export declare const FIT_MAX = 2;
/** 适应窗口时四周留的边（像素）。 */
export declare const FIT_PAD = 32;
export declare const ORIGIN: Point;
/** 转过 90 或 270 度：宽高对调。 */
export declare function isTurned(rot: number): boolean;
/** 原图转过之后的宽高（还没乘缩放）。 */
export declare function turnedSize(natural: Size, rot: number): Size;
/** 画在屏幕上的外框（旋转之后的包围盒）。 */
export declare function boxOf(natural: Size, view: Pick<ImageView, 'scale' | 'rot'>): Size;
export declare function clampScale(scale: number): number;
/**
 * 整张装进舞台（四周留 `FIT_PAD`），小图放大到 `FIT_MAX` 为止。
 * 舞台还没量出来时宽高是 0，算出来的是 `ZOOM_MIN`；等 ResizeObserver 量好了由 {@link relayout} 重算。
 */
export declare function fitScale(frame: Size, natural: Size, rot: number): number;
/** 适应窗口：居中，缩放取 {@link fitScale}，转的角度保留。 */
export declare function fitView(frame: Size, natural: Size, rot: number): ImageView;
/**
 * 平移限在范围里：图比舞台大的方向，只能拖到图的边缘与舞台边缘对齐；比舞台小的方向居中。
 * 缩放、旋转、拖动之后都过一遍这里。
 */
export declare function clampView(view: ImageView, frame: Size, natural: Size): ImageView;
/** 某个方向上图比舞台大，就能拖。 */
export declare function isPannable(view: ImageView, frame: Size, natural: Size): boolean;
/**
 * 以 `anchor` 为中心缩放到 `next`：锚点下面那一点缩放前后在同一处。
 * 图心相对锚点的向量按倍数伸缩，所以新图心是 `anchor - k·(anchor - 图心)`，k 是倍数之比。旋转不影响这个式子。
 */
export declare function zoomView(view: ImageView, next: number, anchor: Point, frame: Size, natural: Size): ImageView;
/** 平移 `dx`、`dy` 个像素，再限在范围里。 */
export declare function panView(view: ImageView, dx: number, dy: number, frame: Size, natural: Size): ImageView;
/**
 * 舞台变了，或刚读到图：适应窗口的重新算；否则保持缩放，只把平移限回范围里。
 */
export declare function relayout(view: ImageView, frame: Size, natural: Size, fitting: boolean): ImageView;
/**
 * 滚轮一下的缩放倍数：`deltaY` 为负（往上）放大，为正缩小。两个方向对称，来回滚不跑偏。
 */
export declare function wheelFactor(deltaY: number): number;

/**
 * dsh-workflow-lite — 刻度盘的动：把 `model/dial.ts` 算出来的位置、放大区逐帧写到刻度上。
 *
 * 只写 transform / opacity 和一两个 data 属性，不经过 React 重渲染，也不插拔元素（宿主页面有条 `:has` 规则，
 * 插拔一次就整页重算样式）。刻度元素由组件渲染，这里按 `[data-mark]` 找出来，每道记着上一回写的值，没变就不写：
 * 离正中远的刻度很快收敛到同一个样子，之后每帧只动正中附近那十几道。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/display/useDialMotion
 */
import { type RefCallback } from 'react';
export interface DialMotion {
    /** 挂在刻度尺上（刻度是它的子元素，带 `data-mark` 和 `data-x`）。 */
    ruler: RefCallback<HTMLElement>;
    /** 现在停在哪（第几版的连续值）。 */
    at(): number;
    /** 立刻到这里（拖动时跟手）；正在走的弹簧停下。 */
    jump(pos: number): void;
    /** 按弹簧走到这一版；「减少动态效果」时直接到。 */
    glide(to: number): void;
}
/**
 * @param count - 共几版（刻度变了要重新找一遍刻度元素）。
 * @param onIndex - 正中对着的那一版变了（拖动时用来预览）。
 */
export declare function useDialMotion(count: number, onIndex: (index: number) => void): DialMotion;

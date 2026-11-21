/**
 * dsh-workflow-lite — 整块换样子的交叉淡：新旧两张快照用 View Transitions 交叉过去（{@link crossfade} / {@link useCrossfade}）。
 *
 * 同一帧里要换的几处合成一次过渡；待换的登记（{@link crossfade} 的队列）整个应用只此一份。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/motion/crossfade
 */
import { type RefObject } from 'react';
/**
 * 让一块东西换样子（`apply` 里改状态）时新旧两张快照交叉淡，而不是一下换掉：画布上的展示卡换外观用。
 * 卡片的边框、卡面、垫底都画在卡片自己身上，没法拆成几层各自淡；交给浏览器拍新旧两张快照，
 * 动的只是两张快照的透明度（合成器上跑），页面其余部分照常、不跟着淡。
 *
 * 这是「只动 transform / opacity」之外登记的一处例外：用的是 View Transitions，只在换外观那一下、约 220ms，
 * 同一帧里好几张卡一起换（改了全局外观）合成一次过渡。开了「减少动态效果」、浏览器不支持、目标不在页面上时直接换。
 */
export declare function crossfade(target: HTMLElement | null, apply: () => void): void;
/**
 * 跟着 `value` 走，但换的那一下走 {@link crossfade}：返回此刻该画的值（换之前还是旧的，拍完旧快照才换成新的）。
 */
export declare function useCrossfade<V>(value: V, target: RefObject<HTMLElement | null>): V;

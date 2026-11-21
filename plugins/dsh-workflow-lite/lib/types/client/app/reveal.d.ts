/**
 * dsh-workflow-lite — 把被属性面板盖住的节点挪出来：模板编辑与实例视图共用。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/reveal
 */
import type { ReactFlowInstance } from '@xyflow/react';
export interface RevealOptions {
    flow: Pick<ReactFlowInstance, 'getViewport' | 'setViewport'>;
    /** 画布所在的视图根（量边界用）。 */
    root: Element | null;
    /** 要露出来的节点。 */
    id: string;
    /** 窄视图：属性面板是底部抽屉，往上挪；否则面板在右边，往左挪。 */
    narrow: boolean;
    /** 右侧属性面板的宽度。 */
    panelW: number;
    /** 左边浮层（步骤库）占掉的宽度：不能把节点推到它底下去。 */
    leftInset: number;
    gap: number;
}
/**
 * 等这一帧画出来再起步（隔两帧），返回取消函数。给点卡片之后的视口动画用：那一帧要换选中、开右栏，
 * 主线程很忙，而视口动画的时钟从调用那一刻就开始走——在那一帧里起步，第一帧就跳掉一大截，
 * 看着是卡了一下才滑。
 */
export declare function afterPaint(run: () => void): () => void;
/**
 * 节点被属性面板盖住了，就把画布往旁边挪一点，让它露出来。
 * 只挪"刚好够"的距离，也不会把它推到左边的步骤库底下去。要在节点渲染并量完尺寸之后调用。
 */
export declare function revealNode(options: RevealOptions): void;

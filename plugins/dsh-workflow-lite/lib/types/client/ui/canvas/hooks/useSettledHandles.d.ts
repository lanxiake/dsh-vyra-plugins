/**
 * dsh-workflow-lite — 卡片的动画停下后重量一次连接点，线头才落在点上。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/hooks/useSettledHandles
 */
export interface SettledHandlesInput {
    wrapRef: React.RefObject<HTMLDivElement>;
}
/**
 * React Flow 在卡片挂上的第一帧量连接点（位置取 `getBoundingClientRect`，含 transform），之后只在卡片尺寸变了才重量。
 * 那一帧卡片还在入场动画里（`cardIn` 从 0.9 倍放大），量到的点都往卡片中心缩了几像素到十几像素，
 * 线头跟着偏：流程线扎进卡里、写线的箭头指不到点上。所以卡片自己的动画一停，就请 React Flow 重量这张卡。
 * 只认卡片本身（`.react-flow__node` 的直接子元素）的动画，伪元素上的（选中环、执行中的呼吸光）不算；
 * 同一帧里停下的几张合成一次。
 */
export declare function useSettledHandles({ wrapRef }: SettledHandlesInput): void;

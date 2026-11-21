/**
 * dsh-workflow-lite — 每张图上次看到哪（视口）记在浏览器里，不写进图文件。
 *
 * 视口是看图的人自己的状态：拖动、缩放只是浏览，不该让图变成「待保存」，
 * 更不该因为一次平移就整图写盘、和模型正在做的改动撞车。图文件里的 `viewport` 只读不写，
 * 浏览器里没记过（第一次打开、换了浏览器）时拿它兜底。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/viewport
 */
import type { Viewport } from '../../shared/types.ts';
/** 这张图上次的视口；没记过、记坏了或存储不可用就是 `null`。 */
export declare function recallViewport(workflow: string): Viewport | null;
/** 记下这张图的视口（尽力而为）。 */
export declare function rememberViewport(workflow: string, viewport: Viewport): void;

/**
 * dsh-workflow-lite — 动效工具里不止一个文件要用的几样：「减少动态效果」查询、两条缓动曲线、
 * 删掉的项留下的影子的登记、「看得见吗」的判断、退场的位移 / 透明度动画。
 *
 * 只放被多个动效文件共用的东西；只有一个文件用的留在那个文件里。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/motion/shared
 */
/** 「减少动态效果」：查询对象只建一次，读它的实时值。 */
export declare const REDUCED: MediaQueryList;
export declare const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
/** 视口坐标里 `top` 起、`height` 高的一块，和 `band` 有交集吗。 */
export declare function seen(band: [number, number], top: number, height: number): boolean;
/** 删掉的项留下的影子：列表再量各项时跳过它们。 */
export declare const leaving: WeakSet<Element>;
/**
 * 退场：位移、缩放缓出，透明度匀速——透明度也缓出的话一开始就掉光，看着像一下没了。
 * 返回透明度那段（放完就看不见了，拿它当删影子的时机）。
 */
export declare function fadeAway(target: Element, from: {
    opacity: number;
    transform: string;
}, to: string, ms: number): Animation;
/** 「平滑减速」：一开始就走得快，尾巴轻轻落定。 */
export declare const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

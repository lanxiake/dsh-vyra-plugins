/**
 * dsh-workflow-lite — 整块内容换成另一块的动效：按步骤横向交接（{@link Staged}）、同一处换一版内容（{@link SlideSwap}）、
 * 叠在同一格里轮流出现的几段话（{@link FadeStack}）。只动 `transform` / `opacity`。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/motion/stage
 */
import { type ReactNode, type RefObject } from 'react';
/** 往里走（进了下一级）、往回走（回了上一级）、平级跳转（只淡）。 */
export type StageDir = -1 | 0 | 1;
/**
 * 一整块内容换成另一块（文件选择框里进下一级、回上一级）：
 * 往里走时旧的往左退、淡出，新的从右边进来；往回走反过来；平级跳转只淡入淡出、竖向挪一点。
 *
 * 用法：`wrap` 挂在内容外面那层（要 `position: relative; overflow: hidden`），`body` 挂在内容本身；
 * 数据到了、换进新内容的那一刻先 `leave(dir)`（给旧内容留个影子往外走），内容换上之后 `enter(dir)`
 * （新内容从该来的一侧进来）。只放 Web Animation 的 transform / opacity。
 */
export declare function useStage(options?: {
    /** 旧内容淡出用多久（默认 150ms）。 */
    outMs?: number;
    /** 新内容等多久再进来（默认 40ms；平级跳转不等）。行密、字多的列表把它设得接近 `outMs`，两层文字就不会叠在一起。 */
    delayMs?: number;
}): {
    wrap: RefObject<HTMLDivElement>;
    body: {
        current: HTMLElement | null;
    };
    leave(dir: StageDir): void;
    enter(dir: StageDir): void;
};
/**
 * 一块内容按步骤换（导出：选版本 → 资源清单 → Skill 信息；读完了换上结果）：`at` 变了，旧的留个影子往外退，
 * 新的从该来的一侧进来（{@link useStage}）。`order` 是第几步：往后走新的从右边进，往回走从左边进，同一步里换只淡。
 * 外层定位、裁切（影子摆在里面），里层是内容本身；两层都是纵向 flex、撑满父元素，间距沿用父元素的。
 */
export declare function Staged(props: {
    at: string;
    order: number;
    className?: string;
    children: ReactNode;
}): React.JSX.Element;
/**
 * 同一处换一版内容（展示卡回看各轮）：新的一层先垫在底下读（看不见），读好了——没有读取中的块、网页载完、
 * 图片解完（最多等 {@link SLIDE_WAIT_MS}）——再从行进方向滑进来，旧的一层同时往另一边滑走、淡掉。
 * 新的没读好时旧的一直在（不闪空）；连着换时还没轮上的那层直接丢掉。旧的一层是真的 DOM（不是影子），网页不会变白。
 * `dir`：`up` = 往后的版（配 {@link useTrend}）。`children(id)` 画某一版。
 */
export declare function SlideSwap(props: {
    id: string;
    dir: 'up' | 'down';
    children(id: string): ReactNode;
}): React.JSX.Element;
/**
 * 几段话轮流摆在同一处（导出页的说明：工作流包、Skill 各一句）：全叠在同一格里，高度按最高的那段占住，
 * 换的时候旧的原地淡掉、新的从下面浮上来——换字不推动下面的东西。只有 `at` 那段读得到（其余 aria-hidden）。
 */
export declare function FadeStack(props: {
    at: string;
    items: readonly {
        key: string;
        node: ReactNode;
    }[];
    className?: string;
}): React.JSX.Element;
/**
 * 按位置认的列表（项没有自己的 id，可以重名、可以为空）配一串稳定的键：
 * 删中间一项前先 `drop(index)`，删掉的就是那一行的元素（不是最后一行），其余行滑上去。
 * 项数从外面变了（撤销、加了一项）只在末尾补齐 / 截掉。
 */
export declare function useRowKeys(count: number): {
    keys: readonly string[];
    drop(index: number): void;
};

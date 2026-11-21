/**
 * dsh-workflow-lite — 两份文档在某一方面是否一定一样：结构（{@link sameStructure}）、走线（{@link sameRouting}）。
 *
 * 打字改提示词、标题、描述时文档每个字都换一份，但图的结构和卡片位置没变：
 * 由结构、走线算出来的东西（图分析、执行批次、全图走线）可以原样沿用上一份，不用每个字都算一遍。
 * 这里的判断必须**精确**——判成「一样」的两份，算出来的结果一定相同（`tests/client/docShape.spec.ts` 对照着算）。
 * 给这些计算加了新的输入，要同步补进对应的判断。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/docShape
 */
import type { WorkflowDocument } from '../../shared/types.ts';
/**
 * 结构一样：节点 id、种类逐个相同，连线逐条是同一个对象（连线改了任何一处——条件、交接——都算变了）。
 * `analyzeGraph`（执行次序、回边、批次）、`graphFacts`（步骤与判定词）只看这些。
 */
export declare function sameStructure(a: WorkflowDocument, b: WorkflowDocument): boolean;
/**
 * 走线一样：`buildRoutes`（canvas/flow）只看卡片的 id、种类、位置、估算尺寸，和 {@link sameEdgeRoute} 里那几样。
 * 大图上全图走线一次要几十毫秒，改文字时不用重算。
 */
export declare function sameRouting(a: WorkflowDocument, b: WorkflowDocument): boolean;

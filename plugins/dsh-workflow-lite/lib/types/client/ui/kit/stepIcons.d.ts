/**
 * dsh-workflow-lite — 步骤卡的图标库：每个图标的笔画（24 栅格、描边，和 `Icon.tsx` 同一套画法）。
 *
 * 名字清单在 `shared/appearance.ts`（host 也要用它校验、给新步骤挑样子）；这里用
 * `Record<StepIcon, string>` 对齐，清单里加了名字却忘了画，类型检查就过不去。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/stepIcons
 */
import type { StepIcon } from '../../../shared/appearance.ts';
export declare const STEP_ICON_PATHS: Record<StepIcon, string>;

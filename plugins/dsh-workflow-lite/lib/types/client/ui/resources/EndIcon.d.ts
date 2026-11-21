/**
 * dsh-workflow-lite — 连线两端的小图标：步骤用它的图标，输入用提问气泡，资源用资源图标。
 *
 * 模板的属性面板（连线的两端）、实例右栏的连线与位置都用它。
 * 放在资源这边，是因为资源的小图标（{@link ResourceIcon}）在 `Resources.tsx`，属性面板的通用零件（`panel/`）不能依赖它。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/resources/EndIcon
 */
import type { WorkflowNode } from '../../../shared/types.ts';
/** 连线两端的小图标：步骤用它的图标，资源用资源图标。 */
export declare function EndIcon(props: {
    node: WorkflowNode | undefined;
    id: string;
}): React.JSX.Element;

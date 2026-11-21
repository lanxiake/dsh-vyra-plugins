/**
 * dsh-workflow-lite — 第一次加载的遮罩：画布摆好视角、量完卡片之前先不显示，慢了再亮出加载中的样子。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/workflowView/useBooting
 */
import type { Runs } from '../../../app/useRuns.ts';
import type { Workflow } from '../../../app/useWorkflow.ts';
export interface BootingInput {
    state: Workflow['state'];
    runs: Runs;
}
export declare function useBooting({ state, runs }: BootingInput): {
    booting: boolean;
    setBooting: React.Dispatch<React.SetStateAction<boolean>>;
    setTemplateSettled: React.Dispatch<React.SetStateAction<boolean>>;
};

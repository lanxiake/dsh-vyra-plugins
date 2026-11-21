/**
 * dsh-workflow-lite — 本会话刚出现的新实例：提示条的状态、打开 tab 时直接看当前实例、定时刷新实例列表。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/workflowView/useFreshRun
 */
import type { Runs } from '../../../app/useRuns.ts';
export interface FreshRunInput {
    runs: Runs;
    runId: string | null;
    setRunId: React.Dispatch<React.SetStateAction<string | null>>;
}
export declare function useFreshRun({ runs, runId, setRunId }: FreshRunInput): {
    freshRun: string | null;
    setFreshRun: React.Dispatch<React.SetStateAction<string | null>>;
    seenCurrent: React.MutableRefObject<string | undefined | null>;
};

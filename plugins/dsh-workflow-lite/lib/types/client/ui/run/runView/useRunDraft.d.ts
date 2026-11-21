/**
 * dsh-workflow-lite — 实例视图的草稿：图的改动清单、「已改 x 处」的数、保存被拦住的原因，以及保存。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/runView/useRunDraft
 */
import { type graphFacts, type RunState } from '../../../../shared/runState.ts';
import type { WorkflowDocument } from '../../../../shared/types.ts';
import type { RunGraph } from '../../../app/useRunGraph.ts';
import type { Run } from '../../../app/useRuns.ts';
import type { T } from '../../../i18n.ts';
import type { DraftLine } from '../RunDraftBar.tsx';
export interface RunDraftInput {
    t: T;
    current: Run;
    graph: RunGraph;
    doc: WorkflowDocument | null;
    shown: RunState | null;
    facts: ReturnType<typeof graphFacts> | null;
}
export declare function useRunDraft({ t, current, graph, doc, shown, facts }: RunDraftInput): {
    graphLines: DraftLine[];
    count: number;
    blocked: string | null;
    save(): void;
};

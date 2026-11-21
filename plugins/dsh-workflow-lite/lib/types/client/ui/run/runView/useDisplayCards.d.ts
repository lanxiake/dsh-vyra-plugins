/**
 * dsh-workflow-lite — 实例画布上的展示卡：点开文件、文字、文件夹时用的三份「正在看什么」，
 * 以及交给画布的 `display`（展示卡读文件状态、各轮的步骤名、点开的入口都在里面）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/run/runView/useDisplayCards
 */
import type { LineFilter, ResourceItem, WorkflowDocument } from '../../../../shared/types.ts';
import type { FileTarget } from '../../../app/useRunFile.ts';
import { type Run } from '../../../app/useRuns.ts';
import type { WorkflowLiteRpc } from '../../../rpc.ts';
/** 查看框里打开着的文件。 */
export interface RunViewer {
    target: FileTarget;
    title: string;
    note?: string | undefined;
    /** 从展示卡打开：卡片上「只看」的筛选。 */
    filter?: LineFilter | undefined;
}
/** 展示卡上打开的文件夹（图墙里点了一张就先看那一张）。 */
export interface RunFolderView {
    node: string;
    item: number;
    entry: ResourceItem;
    initial?: string | undefined;
}
export interface DisplayCardsInput {
    rpc: WorkflowLiteRpc;
    id: string;
    doc: WorkflowDocument | null;
    current: Run;
}
export declare function useDisplayCards({ rpc, id, doc, current }: DisplayCardsInput): {
    viewer: RunViewer | null;
    setViewer: import("react").Dispatch<import("react").SetStateAction<RunViewer | null>>;
    textView: ResourceItem | null;
    setTextView: import("react").Dispatch<import("react").SetStateAction<ResourceItem | null>>;
    folderView: RunFolderView | null;
    setFolderView: import("react").Dispatch<import("react").SetStateAction<RunFolderView | null>>;
    stepNames: {
        [k: string]: string;
    };
    display: {
        run: {
            rpc: WorkflowLiteRpc;
            instance: string;
            stats: Readonly<Record<string, import("../../../app/useDisplayStats.ts").DisplayStat>>;
            names: {
                [k: string]: string;
            };
        };
        open: (node: string, item: number, sub?: string) => void;
    };
};

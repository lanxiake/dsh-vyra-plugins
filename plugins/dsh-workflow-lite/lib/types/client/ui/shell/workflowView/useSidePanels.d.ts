/**
 * dsh-workflow-lite — 两侧面板：步骤库开合、右侧面板看步骤库里的哪一项、窄视图抽屉互斥、浮层占掉的边距。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/workflowView/useSidePanels
 */
import type { Workflow } from '../../../app/useWorkflow.ts';
import type { LibraryFocus } from '../../../model/library.ts';
export interface SidePanelsInput {
    state: Workflow['state'];
    narrow: boolean;
    libraryPref: boolean;
    setLibraryPref: React.Dispatch<React.SetStateAction<boolean>>;
    setLibraryDrawer: React.Dispatch<React.SetStateAction<boolean>>;
    libraryOpen: boolean;
    inspectorW: number;
}
export declare function useSidePanels({ state, narrow, libraryPref, setLibraryPref, setLibraryDrawer, libraryOpen, inspectorW, }: SidePanelsInput): {
    toggleLibrary(): void;
    focus: LibraryFocus | null;
    setFocus: React.Dispatch<React.SetStateAction<LibraryFocus | null>>;
    insets: {
        left: number;
        right: number;
    };
    insetsRef: React.MutableRefObject<{
        left: number;
        right: number;
    }>;
};

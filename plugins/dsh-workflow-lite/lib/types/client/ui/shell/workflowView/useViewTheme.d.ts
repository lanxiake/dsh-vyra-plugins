/**
 * dsh-workflow-lite — 视图的配色：主题选择、根节点上的变量、「形」（瑞士等）、画布上网页看板用的主题。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/shell/workflowView/useViewTheme
 */
export interface ViewThemeInput {
    /** 视图根（取它算出来的字体）。 */
    rootRef: React.RefObject<HTMLDivElement>;
}
export declare function useViewTheme({ rootRef }: ViewThemeInput): {
    theme: import("../../../app/theme.ts").ThemeChoice;
    themeVars: import("react").CSSProperties;
    look: "swiss" | undefined;
    board: import("../../../../shared/board.ts").BoardTheme;
};

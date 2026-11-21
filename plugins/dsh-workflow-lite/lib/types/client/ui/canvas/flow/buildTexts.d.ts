/**
 * dsh-workflow-lite — 画布卡片、连线上用到的全部文案（一次翻好，节点与连线的构建函数共用）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/flow/buildTexts
 */
import type { T } from '../../../i18n.ts';
export declare function buildTexts(t: T): {
    noPromptText: string;
    addText: string;
    fileText: string;
    readText: string;
    askText: string;
    emptyQuestion: string;
    required: string;
    inputKinds: {
        text: string;
        textarea: string;
        choice: string;
        multi: string;
    };
    optionsCount: string;
    otherTag: string;
    resEmpty: string;
    resEmptySub: string;
    resShared: string;
    resCount: string;
    resMore: string;
    kinds: {
        file: string;
        folder: string;
        url: string;
        skill: string;
        text: string;
    };
    pass: string;
    fail: string;
    generated: string;
    memOn: string;
    memOff: string;
    memTypes: {
        workflow: string;
        step: string;
    };
    memShared: string;
    produce: string;
    update: string;
    read: string;
    ask: string;
    displayOpen: string;
    displayInteract: string;
    displayLeave: string;
    displayResize: string;
    displayZoomTag: string;
};
export type CanvasTexts = ReturnType<typeof buildTexts>;

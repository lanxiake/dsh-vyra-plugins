/**
 * dsh-workflow-lite — 网页框带上看板的主题：卡片里、查看框里的 HTML 都由这里拼 `srcdoc`。
 *
 * `srcdoc` 只跟着页面内容和模式变：换主题时不重载页面（重载会闪一下、丢掉页面里的状态），
 * 而是经 `postMessage` 把新的变量发进去；框加载完再补发一次，接住拼好之后到加载完之间换的主题。
 * 主题由视图根（WorkflowView）放进 {@link BoardThemeContext}；没有时只补滚动条，不标模式。
 * 镂空（`clear`）、卡片静止时不画滚动条（`still`）也跟着主题消息走：开关时同样不重载。返回的 `scheme` 要写到框元素的 `color-scheme` 上，
 * 和页面一致框后面才不垫底。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/files/boardFrame
 */
import { type RefObject } from 'react';
import { type BoardMode, type BoardTheme } from '../../../shared/board.ts';
export declare const BoardThemeContext: import("react").Context<BoardTheme | null>;
export declare function useBoardFrame(frame: RefObject<HTMLIFrameElement | null>, text: string, mode: BoardMode, clear?: boolean, still?: boolean): {
    srcDoc: string;
    onLoad: () => void;
    scheme: BoardTheme['scheme'] | undefined;
};

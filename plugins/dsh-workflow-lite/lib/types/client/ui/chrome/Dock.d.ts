/**
 * dsh-workflow-lite — 左下角的缩放条：缩放、看全图、快捷键说明，加上线条图例
 * （放不下时收成一个「图例」按钮）。模板编辑与实例视图共用。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/chrome/Dock
 */
import type { T } from '../../i18n.ts';
export declare function ZoomDock(props: {
    t: T;
    keysOpen: boolean;
    setKeysOpen: (open: boolean) => void;
    onFit: () => void;
}): React.JSX.Element;

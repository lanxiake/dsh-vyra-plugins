/**
 * dsh-workflow-lite — 画布上的看板默认长什么样：展示卡，还是镂空贴在画布上。记在浏览器里。
 *
 * 和配色主题一样只是看起来的样子（见 `app/theme.ts`）：「设置 → 外观」里换，卡片自己的「外观」没选时跟着它。
 * 缺省镂空：看板透明、直接贴在画布上，后面垫一层四边渐隐的画布底色，画布的点在内容下面淡出去。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/displayLook
 */
import { type ViewLook } from '../../shared/types.ts';
import type { LocaleKey } from '../i18n.ts';
export declare const DEFAULT_DISPLAY_LOOK: ViewLook;
/** 每种样子在界面上叫什么（设置页、卡片的「外观」共用）。 */
export declare const LOOK_NAME: Record<ViewLook, LocaleKey>;
/** 读记下的选择；没记过、记坏了、存储不可用都按默认。 */
export declare function readDisplayLook(): ViewLook;
export declare function getDisplayLook(): ViewLook;
/** 换一种；换回默认时把记录删掉。 */
export declare function setDisplayLook(next: ViewLook): void;
export declare function useDisplayLook(): ViewLook;
/** 测试用：丢掉缓存，下次从存储重新读。 */
export declare function resetDisplayLookCache(): void;

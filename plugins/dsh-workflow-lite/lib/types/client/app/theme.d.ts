/**
 * dsh-workflow-lite — 选了哪套配色主题：亮色一套、暗色一套，记在浏览器里。
 *
 * 只是看起来的样子，不改工作流、也不用存进 profile：和视口、步骤库开关一样记在 localStorage。
 * 同一个页面里几处一起订阅（视图根节点、设置页），换了马上都跟着变；别的标签页改了也跟着变。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/theme
 */
import { type DarkThemeId, type LightThemeId, type ThemeMode } from '../model/themes.ts';
export interface ThemeChoice {
    light: LightThemeId;
    dark: DarkThemeId;
}
/** 读记下的选择；没记过、记坏了、存储不可用都按默认（坏掉的那一半单独按默认）。 */
export declare function readThemeChoice(): ThemeChoice;
export declare function getThemeChoice(): ThemeChoice;
/** 换一套（只换给出的那一半）。两套都是默认时把记录删掉。 */
export declare function setThemeChoice(next: Partial<ThemeChoice>): void;
export declare function useThemeChoice(): ThemeChoice;
/** 测试用：丢掉缓存，下次从存储重新读。 */
export declare function resetThemeCache(): void;
/**
 * 此刻是亮还是暗：宿主把 `color-scheme` 写在 `<html>` 上；写的是 `light dark`（跟系统）时看系统设置。
 * 只用来在设置页标「正在用」，配色本身由 CSS 的 `light-dark()` 自己挑。
 */
export declare function currentScheme(): ThemeMode;
export declare function useColorScheme(): ThemeMode;

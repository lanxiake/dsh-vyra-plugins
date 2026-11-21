/**
 * dsh-workflow-lite — 画布主题 → 看板的 `--board-*` 变量（约定见 shared/board.ts）。
 *
 * 框里的页面是独立的源，`light-dark()` 拼出来的 `--wl-*` 进不去，所以按此刻的亮暗挑出那一套主题，写成实值。
 * 字体从视图根读（宿主的字体、瑞士的 Helvetica 系），读不到用系统字体。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/boardTheme
 */
import { type BoardTheme } from '../../shared/board.ts';
import { type ThemeId, type ThemeLook, type ThemeMode } from './themes.ts';
export declare const BOARD_FONT = "system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";
export declare const BOARD_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
export declare function boardTheme(mode: ThemeMode, id: ThemeId, options?: {
    look?: ThemeLook | undefined;
    font?: string | undefined;
}): BoardTheme;

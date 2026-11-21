/**
 * dsh-workflow-lite — 画布的配色主题：亮色、暗色各四套。
 *
 * 亮 / 暗跟着宿主设在 `<html>` 上的 `color-scheme` 走；人只挑「亮的时候用哪套、暗的时候用哪套」
 * （工作流中心「设置」页）。每套主题给出一份完整的基础色，视图根节点按选中的两套写成
 * `--wl-l-*`、`--wl-d-*` 两组变量，shell.module.css 再用 `light-dark()` 拼成界面用的 `--wl-*`。
 * 浅色的「淡」档（选中底、标签底）由基础色按固定比例调出来，这里不重复写。
 *
 * 主题不只是换底色：线色（也是光带、图例、线上牌子的颜色）、强调色、步骤图标色、状态色都是一整套。
 * 除了两套默认，每套照着一份成熟的配色方案来配：雾蓝 = Nord、林间 = Everforest、墨黑 = Geist 式高对比、
 * 深海 = Tokyo Night、暖夜 = Gruvbox；保留它们的色相和饱和，只按面板把亮度调到读得清。
 * 主干线（「总是」）就用强调色，选中框、按钮、主干线、上面跑的光带是同一个颜色，整套主题一个基调。
 *
 * 每套都要过同一套检查（tests/client/themes.spec.ts）：三级文字、强调色文字、语义色、
 * 七种线色、步骤图标色在面板上过 4.5:1，线色在画布上过 3:1，七种线两两的 OKLab 色差不小于 8。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/themes
 */
export type ThemeMode = 'light' | 'dark';
export declare const LIGHT_THEME_IDS: readonly ["white", "swiss", "mist", "sage"];
export declare const DARK_THEME_IDS: readonly ["slate", "ink", "ocean", "umber"];
export type LightThemeId = (typeof LIGHT_THEME_IDS)[number];
export type DarkThemeId = (typeof DARK_THEME_IDS)[number];
export type ThemeId = LightThemeId | DarkThemeId;
export declare const DEFAULT_LIGHT: LightThemeId;
export declare const DEFAULT_DARK: DarkThemeId;
export interface ThemeTokens {
    /** 面：画布、浮在上面的面板与卡片、输入框底、更深一档的底。 */
    canvas: string;
    panel: string;
    fill: string;
    fillStrong: string;
    /** 网格点、悬停底、描边用的墨色（`R G B`），各自配一档透明度（百分数）。 */
    ink: string;
    dotAlpha: number;
    hoverAlpha: number;
    lineAlpha: number;
    lineStrongAlpha: number;
    /** 阴影的颜色（`R G B`）；透明度按亮 / 暗写在 CSS 里。 */
    shade: string;
    scrim: string;
    text: string;
    text2: string;
    text3: string;
    accent: string;
    accentStrong: string;
    accentOn: string;
    accentText: string;
    danger: string;
    warn: string;
    ok: string;
    /** 七种线：流程线按条件，读写线按读写（见 ui/kit/lineColors.ts）。 */
    always: string;
    pass: string;
    fail: string;
    custom: string;
    produce: string;
    update: string;
    read: string;
    /** 资源卡。 */
    file: string;
    fileSurface: string;
    fileBorder: string;
    fileTab: string;
    fileBack: string;
    /** 步骤图标的色板（shared/appearance.ts 的 STEP_COLORS）。 */
    cBlue: string;
    cGreen: string;
    cAmber: string;
    cCoral: string;
    cTeal: string;
    cPink: string;
    cOlive: string;
    cViolet: string;
    cSlate: string;
    /** 输入节点（交回答的线）的中性墨色。 */
    ask: string;
    tip: string;
    tipOn: string;
}
export declare const THEMES: Record<ThemeId, ThemeTokens>;
export declare function isLightTheme(id: unknown): id is LightThemeId;
export declare function isDarkTheme(id: unknown): id is DarkThemeId;
/** 一套主题写成一组 CSS 变量：亮色档写 `--wl-l-*`，暗色档写 `--wl-d-*`。 */
export declare function themeVars(mode: ThemeMode, id: ThemeId): Record<string, string>;
/** 视图根节点的内联样式：亮、暗各一套。 */
export declare function themeStyle(light: LightThemeId, dark: DarkThemeId): Record<string, string>;
/**
 * 主题除了颜色还带不带一套「形」：目前只有瑞士，亮色档选了它、此刻又是亮色时，
 * 视图根节点写 `data-look="swiss"`，shell.module.css 在这个开关下换直角、去阴影、换字体。
 */
export type ThemeLook = 'swiss';
export declare function themeLook(mode: ThemeMode, light: LightThemeId): ThemeLook | undefined;

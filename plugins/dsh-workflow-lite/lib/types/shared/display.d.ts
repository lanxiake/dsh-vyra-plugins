/**
 * dsh-workflow-lite — 资源卡在画布上展示一项内容：哪些能展示、展示哪一项、缺省多大；
 * 编译计划时告诉写它的步骤「卡片里看得到多少」；工具建资源时怎么把 `display` 参数落成 `view`。
 *
 * 能展示的五类：图片、网页（HTML）、Markdown（含自定义文字）、纯文本（日志、代码、数据）、
 * 文件夹（图墙：里面的图按新旧排开，没有图时列出文件）。网址、Skill 不展示。展示设置存在资源的 `view` 里（见 `types.ts` 的 `ResourceView`）。
 * 卡片怎么画（标题行、留白、拖动取整）在 `client/model/display.ts`。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/display
 */
import { type BoardCardRoom } from './board.ts';
import { type FolderShow, type GalleryLayoutKind, type GalleryView, type LineView, type ResourceData, type ResourceItem, type ResourceView, type TableView, type ViewFit, type ViewFrom, type ViewLook } from './types.ts';
export type DisplayKind = 'image' | 'html' | 'markdown' | 'text' | 'gallery';
/** 一项能怎么展示；不能展示是 `null`。 */
export declare function displayKindOf(item: ResourceItem): DisplayKind | null;
/**
 * 纯文本在卡片里折不折行：一行一条记录的（`.txt`、`.log`、`.jsonl`）折行——要看的多半在行尾（日志的消息、记录的后几个字段），
 * 截掉就看不到了；代码、配置、表格不折——缩进、列就是结构，折了反而看不清。
 */
export declare function textWraps(path: string): boolean;
/**
 * 这一项在「内容」一组里能调什么：日志、纯文本按行（`lines`），CSV / TSV 排成表（`table`），文件夹（`gallery`）；
 * 代码、配置、Markdown、图片、网页没有这一组。
 */
export declare function contentKindOf(kind: DisplayKind, path: string): 'lines' | 'table' | 'gallery' | null;
/** 第一个能展示的项；没有就是 `null`。 */
export declare function firstDisplayable(items: readonly ResourceItem[]): number | null;
/** 资源里能展示的项（下标）。 */
export declare function displayableItems(items: readonly ResourceItem[]): number[];
export declare const VIEW_SIZE_KEYS: readonly ["s", "m", "l"];
export type ViewSize = (typeof VIEW_SIZE_KEYS)[number];
/**
 * 展示区的三档预设尺寸，按内容种类各一套（宽 × 高，画布像素）。宽度约是步骤卡（216）的一个、一个半、两个；
 * 都是 8 的倍数（拖动按 8 取整）。图片约 3:2；网页的高按看板卡片版（字号和步骤卡片一样）一个问题正好排满来定，
 * 比 16:10 矮一些，高了底下会空一截。
 */
export declare const VIEW_SIZES: Record<DisplayKind, Record<ViewSize, [number, number]>>;
/** 内容缩放的缺省值：都按原大（网页按卡片宽度排版）。缩得小了卡片里的字就看不清。 */
export declare const DEFAULT_ZOOM: Record<DisplayKind, number>;
/** 刚打开展示时的设置：中档尺寸，其余缺省。 */
export declare function defaultView(kind: DisplayKind, item?: number): ResourceView;
/** 这张卡此刻展示什么：哪一项、什么种类、设置（缺省已补上）。没开展示或没有能展示的项是 `null`。 */
export interface Display {
    item: number;
    kind: DisplayKind;
    width: number;
    height: number;
    zoom: number;
    fit: ViewFit;
    /** 写它的步骤要不要按展示做适配。 */
    adapt: boolean;
    /** 看板贴在画布上的样子：文档里写的（不写 = 跟着外观设置）；画布按设置定下之后也写在这里往下传。 */
    look?: ViewLook;
    /** 不选中、不悬停时藏起标题行。 */
    hideTitle: boolean;
    /** 日志、纯文本、表格、图墙各自的设置（没写是空的）。 */
    lines: LineView;
    table: TableView;
    gallery: GalleryView;
}
export declare function displayOf(data: ResourceData): Display | null;
/** 按两倍分辨率出图时，图里的字、线至少多大（图片像素）：缩到卡片里约 10 px 字、1.5 px 线。 */
export declare const IMAGE_MIN_FONT = 20;
export declare const IMAGE_MIN_STROKE = 3;
/** 宽高比的说法：`3:2`，不靠近常见比例时 `1.55:1`（竖图 `1:1.55`）。 */
export declare function ratioText(width: number, height: number): string;
/** 编译计划时写进任务描述的展示事实（按种类）；数字都是页面 / 图片自己的像素。 */
export type DisplayBrief = {
    kind: 'html';
    /** 页面按多宽排版。 */
    layoutWidth: number;
    /** 不滚动时露出页面最上面多高。 */
    firstScreen: number;
    /** 卡片版放得下多少（按排版尺寸估；缩放只把整张等比缩放，不改排版）。 */
    room: BoardCardRoom;
} | {
    kind: 'image';
    /** 展示区的宽高比。 */
    ratio: string;
    fit: ViewFit;
    /** 展示区（画布像素）。 */
    width: number;
    height: number;
    /** 原大时看得到图片中间多大一块（图片像素）；其余摆放方式没有。 */
    visible?: {
        width: number;
        height: number;
    };
} | {
    kind: 'markdown' | 'text';
    /** 卡片里露出开头大约几行。 */
    lines: number;
} | {
    /** 日志、一行一条的纯文本（卡片里折行）。 */
    kind: 'log';
    /** 卡片里露出大约几行。 */
    lines: number;
    /** 卡片看哪一段：`auto` = 写它的步骤在跑、`.log`、文件很大时停在末尾，别的从头。 */
    from: ViewFrom | 'auto';
    /** 卡片只显示匹配的行（要找的字）。 */
    filter?: string;
} | {
    kind: 'table';
    /** 展示区宽（画布像素）。 */
    width: number;
    from: ViewFrom | 'auto';
} | {
    kind: 'gallery';
    /** 卡片里一次露出几张（最新的在前）。 */
    tiles: number;
    /** 最新那张占的大格（画布像素）；格子少时没有大格。 */
    hero?: {
        width: number;
        height: number;
    };
    fit: ViewFit;
    /** 只显示名字对得上的。 */
    match?: string;
} | {
    /** 文件夹列出文件（不排图墙）。 */
    kind: 'files';
    match?: string;
};
/**
 * 展示区在画布上占多大。网页按「大小」排版，再按缩放整张等比缩放（像图片一样，排版不变），占「大小 × 缩放」；
 * 其余种类就是「大小」（Markdown、文本的缩放只改字号，图片的缩放只在原大时用）。
 */
export declare function displayFootprint(display: Pick<Display, 'kind' | 'width' | 'height' | 'zoom'>): {
    width: number;
    height: number;
};
/** `path` 是展示的那一项（日志、表格按它认）。 */
export declare function displayBrief(display: Display, path?: string): DisplayBrief;
export declare const GALLERY_GAP = 3;
/**
 * 图墙怎么排：几列几行；`hero` 时第一张（最新的）占一个大格（`heroSpan` 列 × 行）。`slots` 是一次露出几张（大格算一张）。
 * 「大图 + 胶片」是两行：上面一整行大图，下面一排 `strip` 高的小格。
 */
export interface GalleryGrid {
    columns: number;
    rows: number;
    hero: boolean;
    heroSpan: {
        columns: number;
        rows: number;
    };
    slots: number;
    /** 胶片那排多高（画布像素）；只有「大图 + 胶片」有。 */
    strip?: number;
}
/**
 * 按设置排：
 * - 图墙（缺省）：写了 `grid` 就是那几列几行（卡片拖大格子跟着大、张数不变），没写按卡片大小大约 88 宽一格；
 *   至少三列两行时最新的占左上角两列两行（`hero: false` 不放大）。
 * - 大图 + 胶片：最新一张占上面一整行，下面一排小格（高是展示区的两成多，36–72）。
 * - 最新一张：整块就一张。
 */
export declare function galleryGrid(width: number, height: number, view?: GalleryView): GalleryGrid;
/** 排成 CSS 网格的两条轨道。 */
export declare function galleryTracks(grid: GalleryGrid): {
    columns: string;
    rows: string;
};
/**
 * 这一回真要排几格：图够多就是 {@link galleryGrid}（最新的占大格，最后一格写「+N」）；
 * 图少了按张数重排——小格尽量接近 4:3，五张起尽量让最新的占大格；最后一行不满时那几张摊开占满
 * （`spans`：最后几张各占几列，没有就是都占一列）。固定了几列几行的不重排（空着的格子就空着）；
 * 胶片不够一排时小格少几个，只有一张时就是一张。
 */
export declare function galleryLayout(width: number, height: number, count: number, view?: GalleryView): GalleryGrid & {
    spans: number[];
};
/** 工具 `write_resource` 的 `display`（与参数声明同构）：给了的字段才改。 */
export interface DisplaySpec {
    /** `false` = 关掉展示（其余字段不看）。 */
    show?: boolean;
    /** 预设尺寸；和 `width` / `height` 同时给时以宽高为准。 */
    size?: ViewSize;
    width?: number;
    height?: number;
    zoom?: number;
    fit?: ViewFit;
    /** 展示第几项（从 0 数）。 */
    item?: number;
    /** 写它的步骤要不要按展示做适配；缺省 = 要。 */
    adapt?: boolean;
    /** 卡片外观；`auto` = 跟着「设置 → 外观」（清掉单张卡的选择）。 */
    look?: ViewLook | 'auto';
    /** 不选中、不悬停时藏起标题行。 */
    hideTitle?: boolean;
    /** 日志、纯文本：看哪一段、只看哪些行。 */
    lines?: DisplayLinesSpec;
    /** CSV / TSV：看哪一段、藏哪几列、按哪列排、数字列画浅条。 */
    table?: DisplayTableSpec;
    /** 文件夹：展示什么、怎么排、按什么排、只看哪些名字。 */
    folder?: DisplayFolderSpec;
}
export interface DisplayLinesSpec {
    from?: ViewFrom;
    /** 只看含这段字的行；空串 = 不筛。 */
    filter?: string;
    regex?: boolean;
    /** 每处匹配前后各带几行。 */
    context?: number;
}
export interface DisplayTableSpec {
    from?: ViewFrom;
    /** 卡片里不显示的列（表头的字）；空数组 = 都显示。 */
    hide?: string[];
    /** 按哪一列排（表头的字）；空串 = 不排。 */
    sort?: string;
    desc?: boolean;
    bars?: boolean;
}
/** 卡片外观的可选值：`auto` 跟着设置。 */
export declare const LOOK_CHOICES: readonly ["card", "clear", "bare", "glass", "auto"];
/** 文件夹的顺序：`newest` 最新在前（缺省）。 */
export declare const FOLDER_ORDER_CHOICES: readonly ["newest", "name", "size"];
export interface DisplayFolderSpec {
    show?: FolderShow;
    layout?: GalleryLayoutKind;
    order?: (typeof FOLDER_ORDER_CHOICES)[number];
    /** 只看名字对得上的（`*.png, report-*`）；空串 = 都看。 */
    match?: string;
}
/**
 * 把 `display` 落到资源上：没开过的按展示项的种类从中档起，开过的在原设置上改。
 * 换了种类（比如展示项从图片换成网页）而没给尺寸，尺寸回到新种类的中档。
 * @returns 新的 `view`（`undefined` = 关掉）；参数不对是一句给模型看的错。
 */
export declare function applyDisplay(data: ResourceData, spec: DisplaySpec): {
    view: ResourceView | undefined;
} | {
    error: string;
};

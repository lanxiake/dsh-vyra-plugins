/**
 * dsh-workflow-lite — 文件的类型：粗分几类在 `shared/fileKind.ts`（编译计划也要用），这里是只管界面的细分类。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/fileKind
 */
export { extensionOf, type FileKind, fileBaseName, fileDirName, fileKindOf, } from '../../shared/fileKind.ts';
/**
 * 比 {@link FileKind} 细的分类，只管图标和颜色（文件夹浏览、选择框里每个文件前面那一枚）：
 * 常见的文档、表格、幻灯片、压缩包、音视频、字体、数据库、脚本、网页、配置、锁文件、可执行文件各有各的。
 */
export type FileGroup = 'markdown' | 'text' | 'doc' | 'pdf' | 'sheet' | 'slides' | 'data' | 'config' | 'code' | 'web' | 'shell' | 'database' | 'image' | 'audio' | 'video' | 'archive' | 'font' | 'lock' | 'binary' | 'other';
export declare function fileGroupOf(path: string): FileGroup;
/** 字节数写成人看的样子：`812 B`、`3.4 KB`、`1.2 MB`。 */
export declare function formatBytes(bytes: number): string;
export declare function stripAnsi(text: string): string;

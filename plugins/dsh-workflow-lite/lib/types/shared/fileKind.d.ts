/**
 * dsh-workflow-lite — 文件的类型：按扩展名粗分几类，给类型签配色、决定能不能在查看框里看、能不能在画布上展示。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/fileKind
 */
export type FileKind = 'markdown' | 'text' | 'code' | 'data' | 'image' | 'other';
/** 路径的最后一段。 */
export declare function fileBaseName(path: string): string;
/** 路径去掉最后一段剩下的目录（没有就是空串）。 */
export declare function fileDirName(path: string): string;
/** 扩展名，小写、不带点；没有就是空串。 */
export declare function extensionOf(path: string): string;
/** 按扩展名能不能排成表：`.csv` 认逗号（或分号），`.tsv` / `.tab` 认制表符。 */
export declare function tableFormat(path: string): 'csv' | 'tsv' | null;
export declare function fileKindOf(path: string): FileKind;

/**
 * dsh-workflow-lite — 打包时看一棵目录：有哪些文件、多大、内容哈希。
 *
 * 跳过 `.git`、`node_modules` 与树里面的符号链接（链出去的东西不该被悄悄打进包）；超过上限就停下报 `over`，
 * 不读完一整棵大树。路径一律用 `/` 分隔、相对树根。
 *
 * @module @xiaoso/dsh-workflow-lite/host/pack/tree
 */
import { type PackFile } from '../../shared/pack.ts';
export interface TreeFile {
    /** 相对树根（单个文件时是它的文件名）。 */
    rel: string;
    full: string;
    bytes: number;
}
export interface Tree {
    /** 树根是目录（不是单个文件）。 */
    dir: boolean;
    files: TreeFile[];
    bytes: number;
    /** 跳过了几项（`.git`、`node_modules`、符号链接、读不了的）。 */
    skipped: number;
    /** 超了上限，没看完。 */
    over: boolean;
}
export interface TreeLimits {
    maxFiles?: number;
    maxBytes?: number;
}
/**
 * 看一个文件或一棵目录。不存在回 `null`。
 * @param root - 文件或目录的绝对路径。
 */
export declare function walkTree(root: string, limits?: TreeLimits): Promise<Tree | null>;
export declare function sha256(data: Uint8Array): string;
/** 读出一棵树的全部文件，连同清单（相对路径前面加 `prefix`）。 */
export declare function readTree(tree: Tree, prefix?: string): Promise<{
    files: PackFile[];
    data: Map<string, Uint8Array>;
}>;
/** 一棵树的内容指纹（文件清单 + 每个文件的哈希）：比两份 skill 一不一样用。 */
export declare function fingerprint(files: readonly {
    path: string;
    sha256: string;
}[]): string;

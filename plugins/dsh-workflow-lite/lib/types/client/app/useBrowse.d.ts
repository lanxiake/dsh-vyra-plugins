/**
 * dsh-workflow-lite — 文件夹浏览（{@link FolderBrowser}）从哪读：实例里的文件夹资源、记忆库里的一条（`app/memories.ts`），或导出成 skill 前暂存的整个包。
 *
 * 两边长得一样：列一层、读一份、读一张图，路径都是相对根的 `sub`（`/` 分隔）。浏览框只认 {@link BrowseSource}，
 * 不管背后是哪条 RPC。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/useBrowse
 */
import type { SkillFileResponse, SkillMeta } from '../../shared/skillPack.ts';
import type { RunDirResponse, RunImageResponse } from '../../shared/wire/run.ts';
import { type WorkflowLiteRpc } from '../rpc.ts';
import type { RunDir, RunImage } from './useRunFile.ts';
/** 一份文件读回来的样子（同 `run/file`；Markdown 带 YAML 头部时另有解析好的头部与正文）。 */
export type BrowseFile = SkillFileResponse;
export interface BrowseSource {
    /** 身份：换了就重读。 */
    key: string;
    dir(sub: string): Promise<RunDirResponse>;
    file(sub: string): Promise<BrowseFile>;
    /** `src` 不给：`sub` 自己就是那张图；给了：`sub` 这份文档里引用的相对路径图片。 */
    image(sub: string, src?: string): Promise<RunImageResponse>;
}
/** 实例里一个文件夹资源（快照里 `node` 的第 `item` 项）。 */
export declare function runFolderSource(rpc: WorkflowLiteRpc, instance: string, node: string, item: number): BrowseSource;
/** 导出成 skill 前暂存的包（`pack/skillPreview` 回的 `browse`）；SKILL.md 的头部按 `meta` 现拼。 */
export declare function skillPackSource(rpc: WorkflowLiteRpc, token: string, meta: SkillMeta): BrowseSource;
/** 一个读取目标的身份串：哪个来源的哪一份。 */
export declare function browseKey(source: BrowseSource, sub: string): string;
/** 列 `sub` 这一层（换层时读回来之前 `dir` 还是上一层的，免得闪一下空）。 */
export declare function useBrowseDir(source: BrowseSource, sub: string): RunDir;
export interface BrowsedFile {
    file: BrowseFile | null;
    error: string | null;
    /** 最近读完（成功或失败）的是哪一份（{@link browseKey}）：和现在要看的对得上，`file` / `error` 才是它的。 */
    settled: string;
}
/** 读 `sub` 这一份。 */
export declare function useBrowseFile(source: BrowseSource, sub: string): BrowsedFile;
/** 把 `sub` 自己当图读；换目标时先清成"读取中"，不让上一张闪一下。 */
export declare function useBrowseImage(source: BrowseSource, sub: string): RunImage;
/** `sub` 这份文档里相对路径的图片怎么读（交给 Markdown）；同一份文档里同一张图只读一次。 */
export declare function useBrowseImages(source: BrowseSource, sub: string): (src: string) => Promise<string>;

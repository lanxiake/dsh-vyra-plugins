/**
 * dsh-workflow-lite — 导出成 skill 前浏览整个包：预览时把编好的包摆进暂存区，前端像看文件夹一样看它。
 *
 * 暂存目录 `<dataDir>/.pack/<token>/` 里：`skill/` 是包本身（和装到本机的那份一样），`body.md` 是 SKILL.md 的正文。
 * SKILL.md 的头部是前端现填的：看它之前带上 `meta`，按它重写 `skill/SKILL.md`。
 * 读文件、列目录、读图都走实例文件夹浏览的那几样（`runs/files.ts`），同样只许往下走、软链指出去的不认。
 * 用完前端 `pack/discard`；没删的跟着暂存区一天后清掉。
 *
 * @module @xiaoso/dsh-workflow-lite/host/pack/skillBrowse
 */
import { type SkillBrowseRequest, type SkillFileResponse, type SkillImageRequest } from '../../shared/skillPack.ts';
import type { RunDirResponse, RunImageResponse } from '../../shared/wire/run.ts';
import type { Outcome } from '../store/repoResult.ts';
/** 把编好的包摆进一个新的暂存目录，回暂存编号。SKILL.md 先按工作流名拼一个头部，看的时候再按填的重写。 */
export declare function stageSkill(dataDir: string, name: string, body: string, files: ReadonlyMap<string, Uint8Array>): Promise<string>;
/** 列包里的一层。 */
export declare function skillDir(dataDir: string, request: SkillBrowseRequest): Promise<Outcome<RunDirResponse>>;
/** YAML 头部：`---` 开头、下一个单独一行的 `---` 结束；解析不了、不是键值就当没有。 */
export declare function splitHead(text: string): {
    head: Record<string, unknown>;
    content: string;
} | null;
/** 读包里的一份；Markdown 带头部的另回解析好的头部与去掉头部的正文。 */
export declare function skillFile(dataDir: string, request: SkillBrowseRequest): Promise<Outcome<SkillFileResponse>>;
/** 读包里的一张图：`src` 按文档所在目录解析，只许落在包里。 */
export declare function skillImage(dataDir: string, request: SkillImageRequest): Promise<Outcome<RunImageResponse>>;

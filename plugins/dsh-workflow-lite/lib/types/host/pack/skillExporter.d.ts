/**
 * dsh-workflow-lite — 把工作流的一个版本导出成 skill（布局见 `shared/skillPack.ts`）。
 *
 * 和导出工作流包共用盘点（{@link scanState}）与"打包哪些"的勾选：打包的文件、文件夹、资料目录进
 * `assets/`，打包的 skill 进 `skills/<名>/`，引用的记忆（勾了带内容的）进 `memory/<id>/`。不同的是图不进包——包里是编译好的提示词：
 * SKILL.md 是 skill 口径的派发计划，`steps/<id>.md` 是各步骤的任务描述，路径里包内的写成 `{skill}/…`，
 * 产出根目录原样保留（`{instance}` 由执行者开始时取一个编号）。
 *
 * 出口两个：打成 zip 走暂存区给浏览器下载，或直接装进 `~/.agents/skills/<名>`。
 *
 * @module @xiaoso/dsh-workflow-lite/host/pack/skillExporter
 */
import { type SkillBuildRequest, type SkillExportRequest, type SkillExportResponse, type SkillPreviewResponse } from '../../shared/skillPack.ts';
import { type Outcome } from '../store/repoResult.ts';
import { type PackDeps } from './exporter.ts';
/**
 * 预览：SKILL.md 正文、要提醒的事、本机已有的 skill；能导出时整个包另摆进暂存区（`browse`），
 * 前端像看文件夹一样看它（见 `skillBrowse.ts`）。
 */
export declare function previewSkill(deps: PackDeps, request: SkillBuildRequest): Promise<Outcome<SkillPreviewResponse>>;
/** 导出：打成 zip（`<名>/…`）放进暂存区，或直接装进 `~/.agents/skills/<名>`。 */
export declare function exportSkill(deps: PackDeps, request: SkillExportRequest): Promise<Outcome<SkillExportResponse>>;

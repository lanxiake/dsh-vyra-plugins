/**
 * dsh-workflow-lite — 主机上的东西：资源节点「选文件 / 选文件夹 / 选 Skill」时列给画布看。
 *
 * - {@link listHostDir}：列一个目录里有什么（只给名字和是不是目录，**不读内容**），外加几个可以跳去的根；
 * - {@link listSkills}：会话里的 agent 能用的 skill（只列模型能用的）；{@link readSkill}：读一个的全文。
 *
 * 只读。画布那头是本机用户自己在选路径，选中的路径原样进图，执行时由模型自己去读。
 *
 * @module @xiaoso/dsh-workflow-lite/host/hostFs
 */
import type { HostListResponse, HostSkillResponse, HostSkillsResponse } from '../shared/wire/host.ts';
import type { Outcome } from './store/repoResult.ts';
/**
 * 列一个目录。`path` 缺省 = `cwd`（会话的工作区），再缺省 = 用户主目录；相对路径按 `cwd` 解析。
 */
export declare function listHostDir(request: {
    path?: string;
    cwd?: string;
}): Promise<Outcome<HostListResponse>>;
/** 一条 skill 的摘要（`ctx.skills.list()` 给的那几样）。 */
interface SkillSummaryLike {
    name: string;
    description: string;
    source: string;
    /** SKILL.md 的绝对路径；插件运行时注册的 skill 没有。 */
    path?: string;
    whenToUse?: string;
    /** SKILL.md 头部解析出的键值（`get` 才有）。 */
    metadata?: Readonly<Record<string, unknown>>;
    invocation: {
        modelInvocable: boolean;
    };
}
/** 读 skill 时的作用域与工作区（`scope` 是 DSH 的不透明作用域键）。 */
interface SkillLookup {
    cwd?: string;
    scope?: object;
}
/** `ctx.skills` 用到的那一点（只借形状，不 import 运行时）。 */
export interface SkillLister {
    list(options: SkillLookup): Promise<readonly SkillSummaryLike[]>;
    get(name: string, options: SkillLookup): Promise<(SkillSummaryLike & {
        content: string;
    }) | undefined>;
}
/**
 * 以谁的眼光看 skill：DSH 的本地 skill（项目的 `.dsh/skills`、`~/.agents/skills`…）是挂在
 * **agent 预设**底下的，只有带上那个预设的作用域才读得到；不带作用域只剩全局那一层（内置的、
 * 插件注册的）。读完调 `release` 还回作用域。
 */
export interface SkillView {
    skills: SkillLister;
    scope?: object;
    release?: () => Promise<void>;
}
/** 给一个会话（可以不给）找出看 skill 的视角；没装 skill 服务回 `undefined`。 */
export type SkillViewer = (session: string | undefined) => Promise<SkillView | undefined>;
/**
 * 会话里的 agent 能用的 skill（只列模型能用的，执行时是模型去加载它们）；没装 skill 服务就是空的。
 */
export declare function listSkills(viewer: SkillViewer | undefined, request: {
    cwd?: string;
    session?: string;
}): Promise<HostSkillsResponse>;
/** 读一个 skill 的全文（SKILL.md 去掉头部元数据后的正文），给画布预览。 */
export declare function readSkill(viewer: SkillViewer | undefined, request: {
    name: string;
    cwd?: string;
    session?: string;
}): Promise<Outcome<HostSkillResponse>>;
export {};

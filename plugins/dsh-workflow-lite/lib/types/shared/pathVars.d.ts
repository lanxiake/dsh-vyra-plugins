/**
 * dsh-workflow-lite — 路径变量：路径里 `{…}` 的写法。
 *
 * | 变量 | 写在哪 | 换成什么 |
 * |---|---|---|
 * | `{workflow}` | 资源里文件、文件夹路径的开头 | 工作流自己的目录（`<dataDir>/assets/<图名>/`）；导出成 skill 时换成 `{skill}/assets` |
 * | `{memory}` | 记忆卡那一项的开头（`{memory}/<记忆 id>`，插件写，用户不改） | 插件的记忆库（`<dataDir>/memories/`）；导出成 skill 时换成 `{skill}/memory` |
 * | `{instance}` | 产出根目录、状态文件路径里任意位置 | 实例 id：插件建实例时换；通用口径（skill）由执行者自己取 |
 * | `{skill}` | 导出成 skill 时计划里包内路径的开头 | 加载 skill 时宿主给出的目录：执行者自己换，插件不换 |
 *
 * 认、拼、取相对部分、换成实际值都**只在这里做**，旧写法（`{assets}` → `{workflow}`）的兼容也在这里。
 * 别处不写变量的字面量、不切字符串、不 split / join；讲给模型或用户的句子里要提变量，也用这里的常量拼。
 *
 * 纯函数，不碰磁盘、不 import DSH 包。
 * @module @xiaoso/dsh-workflow-lite/shared/pathVars
 */
/** 工作流目录的变量。 */
export declare const WORKFLOW_VAR = "{workflow}";
/** 这个路径是不是写在工作流目录里（`{workflow}` 本身或 `{workflow}/…`；旧写法也算）。 */
export declare function isWorkflowPath(path: string): boolean;
/** 工作流目录里的路径去掉变量之后的那一截（`{workflow}/a//b.md` → `a/b.md`；`{workflow}` → 空串）。 */
export declare function workflowRelative(path: string): string;
/** 工作流目录里的一个路径（`a/b.md` → `{workflow}/a/b.md`；空串 → `{workflow}`）。 */
export declare function workflowPath(relative: string): string;
/** 旧写法 `{assets}/…` 换成 `{workflow}/…`（只换开头的变量，后面原样）；别的路径原样返回。 */
export declare function upgradeWorkflowPath(path: string): string;
/** 把 `{workflow}/…` 换成 `dir` 下的路径（`dir` 是绝对路径，或导出成 skill 时的 `{skill}/assets`）；别的路径原样返回。 */
export declare function bindWorkflowPath(path: string, dir: string): string;
/** 记忆库的变量。 */
export declare const MEMORY_VAR = "{memory}";
/** 这个路径是不是写在记忆库里（`{memory}` 本身或 `{memory}/…`）。 */
export declare function isMemoryPath(path: string): boolean;
/** 记忆库里一条记忆的文件夹（`code-review` → `{memory}/code-review`）。 */
export declare function memoryPath(id: string): string;
/** 把 `{memory}/…` 换成 `dir` 下的路径（`dir` 是绝对路径，或导出成 skill 时的 `{skill}/memory`）；别的路径原样返回。 */
export declare function bindMemoryPath(path: string, dir: string): string;
/** 实例 id 的变量：可以出现在路径里任意位置（`.workflow-lite/runs/{instance}/out`）。 */
export declare const INSTANCE_VAR = "{instance}";
/** 这段文字里有没有用到 {@link INSTANCE_VAR}。 */
export declare function hasInstanceVar(text: string): boolean;
/** 把文字里所有的 {@link INSTANCE_VAR} 换成实例 id；不做别的规范化。 */
export declare function bindInstance(text: string, id: string): string;
/** skill 目录的变量：加载 skill 时宿主给出的那个目录。 */
export declare const SKILL_VAR = "{skill}";
/** 这个路径是不是写在 skill 目录里（`{skill}` 本身或 `{skill}/…`）。 */
export declare function isSkillPath(path: string): boolean;
/** skill 目录里的一个路径（`steps/a.md` → `{skill}/steps/a.md`；空串 → `{skill}`）。 */
export declare function skillPath(relative: string): string;

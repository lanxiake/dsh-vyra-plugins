/**
 * dsh-workflow-lite — 工作流包（导入导出）的格式与线格式。
 *
 * 一个包 = 一个 zip（`<图名>.wflite.zip`），里面一层同名目录：
 *
 * ```
 * <图名>/
 * ├─ manifest.json        包格式版本、导出时的插件版本、清单（见 {@link PackManifest}）
 * ├─ versions/<n>.json    选中的版本，和 `versions/<图名>/<n>.json` 同一个格式
 * ├─ assets/…             工作流资料目录（图里写成 `{workflow}/…` 的文件），导入时解压到 `<dataDir>/assets/<图名>/`
 * ├─ skills/<名>/…        打进来的 skill 整个目录，导入时装到 `~/.agents/skills/<名>/`
 * └─ memories/<id>/…      引用的记忆里勾了带内容的那几条（元数据都在清单里），导入时放进记忆库
 * ```
 *
 * 只导出**存成了版本的**内容：版本有编号、有说明，导入之后照样认得出是哪一版。
 * 清单不记打包文件原来的绝对路径（会带出本机用户名和目录结构）。
 *
 * 纯类型与纯函数，不碰磁盘、不 import DSH 包。
 *
 * @module @xiaoso/dsh-workflow-lite/shared/pack
 */
import { type MemoryType, type ResourceKind } from './types.ts';
/** 包格式的版本号（和插件版本分开算）。读到比它新的直接拒绝，叫用户先升级插件。 */
export declare const PACK_FORMAT = 1;
export declare const PACK_KIND = "dsh-workflow-lite.workflow";
/** 包文件的后缀。 */
export declare const PACK_SUFFIX = ".wflite.zip";
/** 一个包里所有文件解压后的总大小上限。 */
export declare const PACK_MAX_BYTES: number;
/** 一个包里最多几个文件。 */
export declare const PACK_MAX_FILES = 5000;
/** 前后端之间一块传多少（base64 之前）：不赌宿主对单条消息的上限。 */
export declare const PACK_CHUNK_BYTES: number;
/** 打包文件夹时跳过的目录名（再加上符号链接）。 */
export declare const PACK_SKIP_DIRS: readonly string[];
/** 包里的一个文件：相对它那一块（`assets/`、`skills/<名>/`）的路径。 */
export interface PackFile {
    path: string;
    bytes: number;
    sha256: string;
}
export interface PackVersionMeta {
    n: number;
    createdAt: number;
    note: string;
    nodeCount: number;
}
/** 图里引用的一条记忆：元数据总是带上；内容（`files`）勾了才有，没勾是空的。 */
export interface PackMemory {
    id: string;
    type: MemoryType;
    name: string;
    description: string;
    files: PackFile[];
}
export interface PackSkill {
    name: string;
    /** 导出时它在哪一层（DSH 的 `source`：user / project / …）。 */
    source: string;
    files: PackFile[];
}
/**
 * 没打进包、原样留在图里的引用：
 * - `not-packed` 用户没勾；`missing` 导出时本机就找不到；`builtin` 内置或插件注册的 skill（没有目录）；
 * - `relative` 相对工作区的路径（换台机器照样按工作区找）；`root` 绝对路径的产出根目录。
 */
export type PackExternalWhy = 'not-packed' | 'missing' | 'builtin' | 'relative' | 'root';
export interface PackExternal {
    kind: 'file' | 'folder' | 'skill' | 'root';
    value: string;
    why: PackExternalWhy;
}
export interface PackManifest {
    format: number;
    kind: typeof PACK_KIND;
    /** 导出时的插件版本。 */
    plugin: string;
    /** ISO 时间。 */
    exportedAt: string;
    workflow: {
        name: string;
    };
    /** 导入后工作流的内容取哪个版本（导出时和磁盘一样的那个，没有就是最新的那个）。 */
    current: number;
    /** 按编号从小到大。 */
    versions: PackVersionMeta[];
    assets: PackFile[];
    skills: PackSkill[];
    /** 早先的包没有（当成空的）。 */
    memories: PackMemory[];
    external: PackExternal[];
}
export type ManifestRead = {
    ok: true;
    manifest: PackManifest;
} | {
    ok: false;
    message: string;
    newer?: number;
};
/** 读 `manifest.json`：格式不对就说哪里不对；包格式比本插件新就带上 `newer`。 */
export declare function readManifest(raw: unknown): ManifestRead;
/**
 * 包里的相对路径能不能信：不能是绝对路径、不能有盘符、不能有 `..` / `.` 段、不能有反斜杠与控制字符。
 * 解压时每个条目都过这一道（防 zip-slip）。
 */
export declare function isSafeRelative(path: string): boolean;
/** skill 名能不能直接当目录名：字母数字开头，只含字母数字、`-`、`_`、`.`，不超过 64 个字。 */
export declare function isSkillName(name: string): boolean;
/**
 * 撞名时换一个：`name` → `name-2`、`name-3`…；文件名带扩展名时加在扩展名前面（`a.md` → `a-2.md`）。
 * @param taken - 判断一个名字有没有被占（大小写不敏感由调用方决定）。
 */
export declare function freeName(name: string, taken: (candidate: string) => boolean, ext?: boolean): string;
/** 包里的 zip 路径（都在顶层同名目录下）。 */
export declare const PACK_PATHS: {
    readonly manifest: "manifest.json";
    readonly version: (n: number) => string;
    readonly asset: (path: string) => string;
    readonly skill: (name: string, path: string) => string;
    readonly memory: (id: string, path: string) => string;
};
/** 导出时清单里的一项怎么处理。 */
export type PackItemState = 
/** 打得进去（绝对路径、本机找得到；有目录的 skill）：缺省勾上。 */
'pack'
/** 本机找不到，打不了。 */
 | 'missing'
/** 太大或文件太多，打不了。 */
 | 'tooLarge'
/** 内置或插件注册的 skill：没有目录，只能原样引用。 */
 | 'builtin'
/** 相对工作区的路径：原样引用。 */
 | 'relative'
/** 步骤会写的产出：不用打包。 */
 | 'output'
/** 已经在工作流目录里（`{workflow}/…`）：随资料目录一起打包。 */
 | 'assets'
/** 记忆库里的一条（`{memory}/<id>`）：元数据总是带上，内容勾了才带（缺省勾上）。 */
 | 'memory';
export interface PackScanItem {
    /** 选中时回传的键。 */
    key: string;
    kind: ResourceKind;
    /** 图里的写法。 */
    value: string;
    state: PackItemState;
    /** 本机上的绝对路径（文件、文件夹、skill 目录）。 */
    location?: string;
    bytes?: number;
    files?: number;
    /** 文件夹里跳过了几项（`.git`、`node_modules`、符号链接）。 */
    skipped?: number;
    /** skill 的来源层。 */
    source?: string;
    /** 打包之后图里的写法（`{workflow}/…`）。 */
    as?: string;
    /** 记忆（`state` 是 `memory`，或记忆太大 `tooLarge`）：库里那条叫什么、什么类型。 */
    memory?: {
        id: string;
        name: string;
        type: MemoryType;
    };
    /** 出现在哪几个版本里。 */
    versions: number[];
}
export interface PackScanRequest {
    name: string;
    versions: number[];
    cwd?: string;
    session?: string;
}
export interface PackScanResponse {
    name: string;
    items: PackScanItem[];
    /** 资料目录（有才给）：总是整个打包。 */
    assets: {
        location: string;
        files: number;
        bytes: number;
    } | null;
    /** 绝对路径的产出根目录（换台机器不一定有）。 */
    roots: string[];
    /** 总大小上限。 */
    limit: number;
}
export interface PackExportRequest extends PackScanRequest {
    /** 要打包的项（`PackScanItem.key`）。 */
    pack: string[];
}
export interface PackExportResponse {
    token: string;
    /** zip 的字节数。 */
    bytes: number;
    fileName: string;
}
export interface PackReadRequest {
    token: string;
    offset: number;
}
export interface PackReadResponse {
    /** 这一块的 base64。 */
    data: string;
    /** 下一块从哪读；读完了是 `null`。 */
    next: number | null;
}
export interface PackUploadRequest {
    /** 第一块不给，主机发一个。 */
    token?: string;
    offset: number;
    data: string;
}
export interface PackUploadResponse {
    token: string;
    received: number;
}
export interface PackTokenRequest {
    token: string;
    cwd?: string;
    session?: string;
}
/** 本机上已有的同名 skill 和包里的比：`new` 没有、`same` 内容一样、`different` 不一样。 */
export type PackSkillState = 'new' | 'same' | 'different';
export interface PackSkillPreview {
    name: string;
    source: string;
    files: {
        path: string;
        bytes: number;
    }[];
    bytes: number;
    state: PackSkillState;
    /** 装到哪（绝对路径）。 */
    target: string;
    /** 本机已有的那份在哪（`same` / `different` 时给）。 */
    existing?: string;
    /** 能不能覆盖：已有的那份在 `~/.agents/skills` 里才行（别处的不动）。 */
    overwritable: boolean;
    /** 换名安装时用的名字。 */
    rename: string;
}
export interface PackImportPreview {
    token: string;
    format: number;
    plugin: string;
    exportedAt: string;
    /** 包里的工作流名。 */
    name: string;
    current: number;
    versions: PackVersionMeta[];
    /** 同名工作流已经在了。 */
    exists: boolean;
    /** 已有的那张现在的内容没存成版本（并入会替换掉它）。 */
    unsaved: boolean;
    /** 一个空着的名字（另存为新名字时预填）。 */
    suggested: string;
    /** `<dataDir>/assets`：资料目录的根（前端按选的名字拼出目标路径给人看）。 */
    assetsRoot: string;
    assets: {
        path: string;
        bytes: number;
    }[];
    /** 并入时资料目录里同一路径内容不同的文件。 */
    clashes: string[];
    /** `~/.agents/skills`。 */
    skillsRoot: string;
    skills: PackSkillPreview[];
    memories: PackMemoryPreview[];
    /** 包里没带的引用，本机有没有（`null` = 相对路径，查不了）。 */
    external: (PackExternal & {
        found: boolean | null;
    })[];
}
/** 包里的一条记忆，和本机记忆库比。 */
export interface PackMemoryPreview {
    id: string;
    type: MemoryType;
    name: string;
    /** 带了几个文件（没带内容是 0：导入后是一条空记忆）。 */
    files: number;
    bytes: number;
    /** 本机记忆库里已经有这个 id。 */
    exists: boolean;
    /** 本机那条的名称（`exists` 时给）。 */
    existingName?: string;
    /** 「另存一份」时用的新 id。 */
    rename: string;
}
/** 包里的记忆已经有同 id 的：`use` 用本机已有的（包里那份不进），`copy` 换个新 id 另存一份。 */
export type PackMemoryAction = 'use' | 'copy';
export type PackSkillAction = 'install' | 'skip' | 'overwrite' | 'rename';
export interface PackApplyRequest {
    token: string;
    mode: 'new' | 'merge';
    /** 新名字（`new`）或并入的那张（`merge`）。 */
    name: string;
    /** 并入时资料目录撞了：用包里的还是保留本机的。缺省保留本机的。 */
    assets?: 'package' | 'local';
    /** 每个 skill 怎么办；没给的：新的装，其余跳过。 */
    skills?: Record<string, PackSkillAction>;
    /** 已有同 id 的记忆怎么办；没给的用本机已有的。 */
    memories?: Record<string, PackMemoryAction>;
    cwd?: string;
    session?: string;
}
export interface PackApplyResponse {
    name: string;
    /** 写下的版本号（并入时是重新编过的号）。 */
    versions: number[];
    /** 和已有版本内容一样、没再存的包里版本。 */
    duplicates: number[];
    /** 写进资料目录的文件数。 */
    assets: number;
    skills: {
        name: string;
        as: string;
        action: PackSkillAction;
    }[];
    /** `create` 本机没有、照包里的建了。 */
    memories: {
        id: string;
        as: string;
        action: PackMemoryAction | 'create';
    }[];
}

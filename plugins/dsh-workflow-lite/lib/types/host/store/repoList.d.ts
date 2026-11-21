/**
 * dsh-workflow-lite — 仓储的列举部分：`list` 扫描 `workflows/` 与 `templates/nodes/`，给出每一项的概况与告警。
 *
 * 只读，不进锁：列举每次都看盘上的文件。每份图文件读出来的结论（几步、能不能用）按文件身份
 * （文件号 + 大小 + 修改时间）记着：身份没变就不再读、不再解析和校验——几百张图时这三样是列表的大头。
 * 原子写入换的是新文件，外部编辑会改修改时间，所以身份一变就重读；记着的结论只取决于文件内容和图名
 * （保存级校验不看别的，见 `DocumentValidator`）。
 * @module @xiaoso/dsh-workflow-lite/host/store/repoList
 */
import type { ListResult } from '../../shared/types.ts';
import type { RepoCore } from './repoCore.ts';
/** 列举部分用到的核心能力。 */
type ListCore = Pick<RepoCore, 'dataDir' | 'validate'>;
export declare class WorkflowLister {
    private readonly core;
    /** 图名 → 上次读到的文件身份与结论。 */
    private readonly facts;
    constructor(core: ListCore);
    list(): Promise<ListResult>;
    private detectLegacy;
    private reportIgnored;
    private describeWorkflow;
    /** 这份图文件的结论：文件身份和上次一样就用上次的，否则读、解析、校验一遍；读不到是 `null`。 */
    private factsOf;
    private describeTemplates;
}
export {};

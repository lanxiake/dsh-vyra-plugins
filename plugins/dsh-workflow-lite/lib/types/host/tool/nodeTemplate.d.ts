/**
 * dsh-workflow-lite — `save_as_template`：把一个步骤存成节点模板（画布步骤库的「我的步骤」）。
 * @module @xiaoso/dsh-workflow-lite/host/tool/nodeTemplate
 */
import type { ChangedEntry } from '../../shared/types.ts';
import type { Outcome } from '../store/repoResult.ts';
import type { Repository } from '../store/repository.ts';
import type { ToolDeps } from './tool.ts';
/** 把节点存成节点模板（`templates/nodes/<名>.json`）——撞名加序号，绝不静默覆盖。 */
export declare function saveNodeAsTemplate(deps: ToolDeps, repository: Repository, workflow: string, nodeId: string, to: string | undefined): Promise<Outcome<ChangedEntry[]>>;

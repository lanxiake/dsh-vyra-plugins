/**
 * dsh-workflow-lite — 「工作流中心 · 存储」：数据目录的统计与清理。
 *
 * 统计数据目录里的几样东西：工作流、我的步骤、记忆库（连同记忆的版本）、实例记录（`runs/` 下的图快照与回答）、
 * 旧版本遗留的任务描述（`.dispatch/`：早先编译时写在这里，现在任务描述放在各实例目录的 `tasks/` 里，
 * 不再有人写它、也不再有人读它）。
 *
 * 三样能清的东西：旧版遗留文件（随时可删）、已结束的实例记录（完成 / 已取消；只删索引条目与快照，
 * 工作区里的状态文件不动）、各实例存下的产出旧版（`runs/<实例>/history/`，现在的文件不动）。
 *
 * @module @xiaoso/dsh-workflow-lite/host/runs/storage
 */
import type { StorageStats } from '../../shared/wire/run.ts';
import type { RunService } from './service.ts';
export type StorageAction = 'stats' | 'clearDispatch' | 'clearFinished' | 'clearHistory';
export declare function storageAction(runs: RunService, dataDir: string, action: StorageAction): Promise<StorageStats>;

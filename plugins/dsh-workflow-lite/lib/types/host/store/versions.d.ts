/**
 * dsh-workflow-lite — 工作流版本的文件形状：`versions/<图名>/<序号>.json`。
 *
 * 一个版本一个文件，文件里是元信息加整张图：
 *
 * ```json
 * { "format": 1, "n": 3, "createdAt": 1759650000000, "note": "跑通了审查环", "document": { … } }
 * ```
 *
 * 切换到别的版本之前自动存的那份多一个 `autoBefore`（切到的版本号）。
 * 本模块只管读、写、比内容；锁、和磁盘上现在那份比对、切换时写回工作流，都在仓储里。
 *
 * @module @xiaoso/dsh-workflow-lite/host/store/versions
 */
import type { WorkflowDocument } from '../../shared/types.ts';
/** 读出来的一个版本；文件坏了 `document` 是 `null`。 */
export interface StoredVersion {
    n: number;
    createdAt: number;
    note: string;
    autoBefore?: number;
    document: WorkflowDocument | null;
}
/** 版本文件的规范写法。 */
export declare function versionText(version: StoredVersion & {
    document: WorkflowDocument;
}): string;
/** 解析一个版本文件；读不出来的字段给缺省，图读不出来就是 `null`。 */
export declare function parseVersion(text: string, n: number): StoredVersion;
/** 这个工作流存下的全部版本，新的在前。目录不在 = 没有版本。 */
export declare function readVersions(dataDir: string, name: string): Promise<StoredVersion[]>;
/** 只数个数（列工作流时用，不读内容）。 */
export declare function countVersions(dataDir: string, name: string): Promise<number>;
/**
 * 比内容用的键：规范写法，但不算视口——平移缩放画布不算改了工作流。
 * 卡片位置算（挪了卡片就是另一个样子，切换时会看到「布局」那一行）。
 */
export declare function contentKey(document: WorkflowDocument): string;

/**
 * dsh-workflow-lite — 步骤的图标块：卡片、面板、步骤库、连接清单里认一个步骤的那个小色块。
 *
 * 样子取自步骤自己的 `data.icon` / `data.color`，没存的按 id 猜（`shared/appearance.ts`）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/StepMark
 */
import { type Appearance } from '../../../shared/appearance.ts';
import type { NodeData } from '../../../shared/types.ts';
/** 一个步骤的样子。 */
export declare function lookOf(id: string, data: Pick<NodeData, 'icon' | 'color'> | undefined): Appearance;
export declare function StepMark(props: {
    look: Appearance;
    size?: number;
    className?: string;
}): React.JSX.Element;

/**
 * dsh-workflow-lite — 输入卡：执行前问用户的一个问题，右边的点拖到步骤上就是把回答交给它。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/canvas/cards/InputCard
 */
import { type NodeProps } from '@xyflow/react';
import type { InputFlowNode } from '../types.ts';
/**
 * 输入卡：执行前问用户的一个问题。左边一条墨色的签印着交互方式，右边的点拖到步骤上 = 把回答交给它。
 * 没有入口——输入不从任何地方来，是用户填的。
 */
export declare const InputCard: import("react").NamedExoticComponent<NodeProps<InputFlowNode>>;

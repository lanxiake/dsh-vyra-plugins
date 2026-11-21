/**
 * dsh-workflow-lite — 图的一处改动写成一行字：「<b>审查</b> · 改了提示词、名称」。
 *
 * 实例视图底部的草稿栏（`run/RunDraftBar`）的改动清单、版本框里每个版本的改动清单（`versions/VersionRow`）都用它，
 * 单独成文件，让版本框不必回头 import 实例视图的草稿栏。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/kit/graphLine
 */
import type { GraphChange } from '../../../shared/graphDiff.ts';
import type { WorkflowDocument } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
/** 图的一处改动写成清单里的一行：「<b>审查</b> · 改了提示词、名称」。 */
export declare function graphLine(t: T, change: GraphChange, base: WorkflowDocument, doc: WorkflowDocument): React.ReactNode;

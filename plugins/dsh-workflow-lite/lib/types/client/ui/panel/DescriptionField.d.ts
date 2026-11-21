/**
 * dsh-workflow-lite — 一句话描述的输入框（步骤、资源卡、步骤库条目共用）。
 *
 * 属性面板（`Inspector`）、步骤面板（`StepPanel`）、资源面板（`resources/ResourcePanel`）都要放它，
 * 单独成文件，让资源面板不必回头 import 属性面板。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/panel/DescriptionField
 */
import type { T } from '../../i18n.ts';
/** 一句话描述（给人看：步骤库条目、画布卡片），不进计划。 */
export declare function DescriptionField(props: {
    t: T;
    value: string;
    /** 缺省是步骤、资源卡那句占位。 */
    placeholder?: string;
    onChange(value: string): void;
    onBlur?: () => void;
}): React.JSX.Element;

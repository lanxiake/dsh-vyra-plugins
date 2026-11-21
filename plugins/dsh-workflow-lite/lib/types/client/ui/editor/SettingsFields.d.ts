/**
 * dsh-workflow-lite — 「工作流设置」对话框里的三块：执行方式（四张卡 + 复用执行者）、
 * 执行时（设定目标、记录运行状态两个开关）、产出根目录。状态都在对话框里，这里只画。
 *
 * @module @xiaoso/dsh-workflow-lite/client/ui/editor/SettingsFields
 */
import { checkOutputRoot } from '../../../shared/outputPaths.ts';
import { type ExecutionMode, type ReusePolicy } from '../../../shared/types.ts';
import type { T } from '../../i18n.ts';
export declare function ModeGroup(props: {
    t: T;
    mode: ExecutionMode;
    reuse: ReusePolicy;
    onMode(mode: ExecutionMode): void;
    onReuse(reuse: ReusePolicy): void;
}): React.JSX.Element;
export declare function DuringGroup(props: {
    t: T;
    setGoal: boolean;
    runState: boolean;
    onSetGoal(on: boolean): void;
    onRunState(on: boolean): void;
}): React.JSX.Element;
/** 根目录现在的样子：问题、标准化后的写法、是不是默认值（保存时据此决定写不写）。 */
export declare function rootStatus(root: string): {
    problem: ReturnType<typeof checkOutputRoot>;
    normalized: string | undefined;
    isDefault: boolean;
};
export declare function RootGroup(props: {
    t: T;
    root: string;
    /** 说明里拼接示例用的产出（图里第一个产出文件；没有就是 `plan.md`）。 */
    sample: string;
    inputRef: React.RefObject<HTMLInputElement>;
    onChange(root: string): void;
}): React.JSX.Element;

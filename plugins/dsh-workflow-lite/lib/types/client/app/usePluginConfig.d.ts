/**
 * dsh-workflow-lite — 工作流中心「设置」页的状态：读插件设置、在草稿上改、一次保存。
 *
 * - 输入框里的数字先按文字存（打字途中可以是空的），保存时才换成数；「读取上限」给人看 KB，存的是字节。
 * - 保存时只送改了的几项：改回默认值的发「恢复」（删掉 profile 里那一项），其余发「设成」。
 * - 别处先改过（修订号对不上）：重新读一遍，草稿留着，告诉人再保存一次。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/usePluginConfig
 */
import { type PluginConfigKey, type PluginConfigValues, type PluginConfigView } from '../../shared/wire/config.ts';
import type { T } from '../i18n.ts';
import { type WorkflowLiteRpc } from '../rpc.ts';
/** 草稿：文字框里的原样。 */
export interface ConfigDraft {
    dataDir: string;
    maxNodes: string;
    saveDebounceMs: string;
    /** 以 KB 计。 */
    maxResultBytes: string;
    installSkill: boolean;
}
export type ConfigErrors = Partial<Record<PluginConfigKey, string>>;
export interface PluginConfigState {
    view: PluginConfigView | null;
    draft: ConfigDraft | null;
    /** 读不出来时的原因。 */
    loadError: string | null;
    errors: ConfigErrors;
    /** 和已保存的值不一样的几项。 */
    dirty: PluginConfigKey[];
    busy: boolean;
    notice: {
        tone: 'ok' | 'error';
        text: string;
    } | null;
    edit<K extends keyof ConfigDraft>(key: K, value: ConfigDraft[K]): void;
    /** 草稿里这一项换回默认值（保存后生效）。 */
    toDefault(key: PluginConfigKey): void;
    discard(): void;
    save(): Promise<void>;
}
export declare function toDraft(values: PluginConfigValues): ConfigDraft;
/**
 * 草稿 → 值。`saved` 用来认「读取上限没动过」：KB 四舍五入回去和原来的字节数对不上时，原值照留。
 * @returns 有错的项给出原因；没错的项给出值。
 */
export declare function fromDraft(draft: ConfigDraft, saved: PluginConfigValues, t: T): {
    values: PluginConfigValues;
    errors: ConfigErrors;
};
export declare function usePluginConfig(rpc: WorkflowLiteRpc, t: T, onSaved: () => void): PluginConfigState;
/** 各项的名字（提示里拼「数据目录、给模型的使用指南要重启」用）。 */
export declare const LABEL: {
    readonly dataDir: "cfg.dataDir";
    readonly maxNodes: "cfg.maxNodes";
    readonly saveDebounceMs: "cfg.saveDebounce";
    readonly maxResultBytes: "cfg.maxResult";
    readonly installSkill: "cfg.skill";
};

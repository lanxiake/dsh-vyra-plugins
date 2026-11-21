/**
 * dsh-workflow-lite — 工作流中心「设置」页的后端：经 DSH 的设置服务（`ctx.settings`）读写本插件自己那一行配置。
 *
 * - 只露 {@link PLUGIN_CONFIG_KEYS} 那几项；`routePrefix` 这类接线细节不给人改。
 * - 写入走设置服务的路径编辑（`mutate`）：它按完整 Config 校验、落进当前 profile 的 patch、
 *   就地更新运行中的活配置；带修订号，别人先改过就拒绝，不悄悄覆盖。
 * - 设置服务不在（精简的 profile）时只读：页面照样显示现值，告诉人这里改不了。
 *
 * 本插件在 profile 里那一行的 id 通常就是 `workflow-lite`（`cordis.patch.yml` 里写的）；
 * 有人手动换了 id 时，退回去找「字段正好是这几项」的那一行。
 *
 * @module @xiaoso/dsh-workflow-lite/host/pluginConfig
 */
import { type PluginConfigValues, type PluginConfigView } from '../shared/wire/config.ts';
/** 用到的那一小截设置服务（`@deepseek-ai/dsh-settings` 的 `SettingsForms`）。 */
export interface SettingsPort {
    readonly writable: boolean;
    describe(options?: {
        redactSecrets?: boolean;
    }): readonly SettingsRow[];
    mutate(ns: string, ops: readonly ({
        op: 'set';
        path: readonly string[];
        value: unknown;
    } | {
        op: 'unset';
        path: readonly string[];
    })[], expectedRevision?: number): Promise<void>;
}
export interface SettingsRow {
    ns: string;
    revision: number;
    value: unknown;
    base?: unknown;
    user?: unknown;
}
type Outcome<T> = {
    ok: true;
    result: T;
} | {
    ok: false;
    error: {
        code: string;
        message: string;
    };
};
/** 设置服务不在时页面要的现值（从活配置读）。 */
export type LiveValues = () => PluginConfigValues;
export declare function readPluginConfig(port: SettingsPort | undefined, live: LiveValues): PluginConfigView;
export declare function writePluginConfig(port: SettingsPort | undefined, live: LiveValues, 
/** 线上来的原样（键名、值都还没核对过）。 */
write: {
    revision: number;
    set?: Record<string, unknown>;
    reset?: readonly string[];
}): Promise<Outcome<PluginConfigView>>;
export {};

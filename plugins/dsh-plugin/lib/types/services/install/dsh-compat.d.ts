/** 从安装目标里取 npm 包名：`@scope/pkg@1.2.3` → `@scope/pkg`。
 *  git / URL / 本地路径等非 npm 目标返回 null。 */
export declare function npmNameOf(target: string): string | null;
/** `0.2.1-rc.1` / `^0.2.1` / `>=0.2.0 <0.3.0` → [0,2,1]；解析不出返回 null。
 *  只取版本三段：DSH 的 prerelease 序号（rc.1）不参与「太低」判断，避免比较误差。 */
export declare function versionTriple(raw: string): [number, number, number] | null;
/** 插件声明的最低 DSH 版本：engines.dsh 与 peerDependencies 里 @deepseek-ai/dsh-* 的下限取最大。
 *  返回原始声明文本（如 `^0.2.1-rc.1`）供提示直接展示；没有声明返回 null。 */
export declare function dshFloorOf(manifest: unknown): string | null;
/**
 * 产出「插件要求更高的 DSH」标记行；没有声明、读不到元数据、宿主版本未知或已满足时返回 null。
 * 用版本级 manifest（`/<pkg>/latest`）：packument 的精简形态不带 peerDependencies。
 */
export declare function dshTooOldMarker(target: string, opts?: {
    currentVersion?: string | null;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    registry?: string;
}): Promise<string | null>;

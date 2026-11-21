/** 从失败输出里提取「registry 上不存在的包名」（含 scope，如 `@scope/name`）：读 404 行的请求路径。
 *  提取不到返回 null。 */
export declare function missingPackageOf(output: string): string | null;
/** 读 profile 自己声明的依赖名（profile 目录下 package.json 的 dependencies 键）。读不到返回空数组。 */
export declare function profileDependencyNames(profileDir: string): string[];
/**
 * 产出「包不存在」失败的责任方标记行；判不了返回 null（前端维持既有提示）。
 * - `[registry-missing]`     缺的包在官方源上也不存在 → 作者侧问题（前端引导投作者）
 * - `[registry-mirror-lag]`  官方源上有 → 本机镜像源未同步（前端提示换源，不投任何一方）
 */
export declare function registryMissingMarker(output: string, opts: {
    profileDir: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
}): Promise<string | null>;

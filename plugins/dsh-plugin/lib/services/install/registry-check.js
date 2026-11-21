/**
 * DSH Plugin Hub — the community plugin marketplace for DeepSeek Harness.
 * Website: https://dsh-plugin.org
 * GitHub: https://github.com/dshplugin/dsh-plugin-hub
 *
 * 官方 registry 存在性复核：用官方源（绕开本机镜像）复查 404 的包，产出标记行区分
 * 「profile 残留依赖」「插件依赖在官方源也不存在（作者侧）」「本机镜像未同步」三种情形；
 * 标记由 task-queue 追加到任务输出，前端按标记归类。fetch 与 profile 目录可注入，便于单测。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
/** pnpm 输出里 scope 包是 URL 编码形态（`@scope%2Fname`）：比较依赖名、拼查询 URL 前先还原成
 *  `@scope/name`。 */
function decodePackageName(raw) {
    return raw.replace(/%40/gi, '@').replace(/%2f/gi, '/');
}
/** 从失败输出里提取「registry 上不存在的包名」（含 scope，如 `@scope/name`）：读 404 行的请求路径。
 *  提取不到返回 null。 */
export function missingPackageOf(output) {
    for (const line of output.split(/\r?\n/)) {
        if (!/ERR_PNPM_FETCH_404|404/.test(line))
            continue;
        const m = line.match(/GET\s+https?:\/\/[^\s/]+\/((?:@[^/\s:]+\/)?[^/\s:]+)/);
        if (m)
            return decodePackageName(m[1]);
    }
    return null;
}
/** 读 profile 自己声明的依赖名（profile 目录下 package.json 的 dependencies 键）。读不到返回空数组。 */
export function profileDependencyNames(profileDir) {
    try {
        const raw = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8'));
        return Object.keys(raw.dependencies ?? {});
    }
    catch {
        return [];
    }
}
/** 官方 registry 上是否存在该包：明确 404 → false（不存在），2xx → true，其余（限流/网络异常）→ null
 *  —— 判不了就不判，绝不妄下结论。 */
async function existsOnOfficialRegistry(name, fetchImpl, timeoutMs) {
    // scope 包的路径要编码：`@scope/name` → `%40scope%2Fname`
    const url = `https://registry.npmjs.org/${name.replace('@', '%40').replace('/', '%2F')}`;
    try {
        const res = await fetchImpl(url, {
            headers: { accept: 'application/vnd.npm.install-v1+json' },
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (res.status === 404)
            return false;
        return res.ok ? true : null;
    }
    catch {
        return null;
    }
}
/**
 * 产出「包不存在」失败的责任方标记行；判不了返回 null（前端维持既有提示）。
 * - `[registry-missing]`     缺的包在官方源上也不存在 → 作者侧问题（前端引导投作者）
 * - `[registry-mirror-lag]`  官方源上有 → 本机镜像源未同步（前端提示换源，不投任何一方）
 */
export async function registryMissingMarker(output, opts) {
    const name = missingPackageOf(output);
    if (name === null)
        return null;
    // 该包是 profile 自己声明的依赖（用户环境里留下的条目）→ 用户环境问题，交给既有的 pnpmMissingDep
    // 提示处理（那条提示就是教用户删掉它），不产出标记、不改归属
    if (profileDependencyNames(opts.profileDir).some((dep) => dep.toLowerCase() === name.toLowerCase()))
        return null;
    const exists = await existsOnOfficialRegistry(name, opts.fetchImpl ?? fetch, opts.timeoutMs ?? 8000);
    if (exists === false) {
        return `[registry-missing] ${name} is not published on the official npm registry (registry.npmjs.org) — a dependency of this plugin is missing or was removed; author-side issue`;
    }
    if (exists === true) {
        return `[registry-mirror-lag] ${name} exists on the official npm registry — the configured registry or mirror has not synced it; local environment issue`;
    }
    return null;
}

/**
 * dsh-workflow-lite — 读回来的内容按「目标 + 信号」留一份（最近用过的优先留，按条数和大小封顶）。
 *
 * 大图只挂视口附近的卡片（见 `model/cull.ts`）：展示卡平移出去被摘下、再挪回来时重新挂上，
 * 组件里的状态都没了。各个读取钩子挂上时先查这里：目标和信号（修改时间、变化次数）都对得上就直接用，
 * 不再发请求、不闪「读取中」。信号对不上（文件变了）照常重读。
 *
 * @module @xiaoso/dsh-workflow-lite/client/app/readCache
 */
/** 什么时候算「还是那一份」：现在的文件拿修改时间，存下的旧版不会再变，给个常量。 */
export type ReadSignal = string | number;
export interface ReadCache<V> {
    /** 目标 `key` 在信号 `signal` 下读回来的那一份；没有、或信号对不上是 `undefined`。 */
    get(key: string, signal: ReadSignal): V | undefined;
    put(key: string, signal: ReadSignal, value: V): void;
}
export interface ReadCacheOptions<V> {
    /** 最多留几份。 */
    entries: number;
    /** 一共最多多大（按 `weigh` 算，比如字符数）；不给就只按条数封顶。 */
    budget?: number;
    weigh?: (value: V) => number;
}
export declare function readCache<V>(options: ReadCacheOptions<V>): ReadCache<V>;

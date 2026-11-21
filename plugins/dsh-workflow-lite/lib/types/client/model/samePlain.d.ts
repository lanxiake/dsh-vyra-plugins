/**
 * dsh-workflow-lite — 两份普通数据（对象、数组、字符串、数字……）内容是否相同，可以跳过某些键。
 *
 * 画布每帧都要判断「这张卡、这条线的对象和上一帧比变了没有」。以前是两边各 `JSON.stringify` 一遍再比字符串，
 * 每次都整份序列化、生成一串新字符串；这里逐项比，遇到第一处不同就停，同一个对象直接算相同。
 * 口径和 JSON 一致：值为 `undefined` 的键等于没有这个键；函数只认同一个（要忽略的回调放进 `skip`）。
 *
 * @module @xiaoso/dsh-workflow-lite/client/model/samePlain
 */
/** `a`、`b` 内容相同吗：`skip` 里的键在任何一层都不比。 */
export declare function samePlain(a: unknown, b: unknown, skip?: ReadonlySet<string>): boolean;
/**
 * 结构共享：交回 `next` 的内容，但其中和 `prev` 相同的部分（任何一层）换成 `prev` 里的那个对象；
 * 整份都相同就交回 `prev` 本身。轮询读回来的数据每次都是新对象，这样按对象身份记的下游（`useMemo`、
 * 画布的卡片缓存）只在真变了的那一支上重算。只用于 JSON 读回来的普通数据。
 */
export declare function shareSame<V>(prev: unknown, next: V): V;

/**
 * dsh-workflow-lite — 编译时把任务描述写进实例目录（`tasks/` 的规矩）。
 *
 * 路径 = `<实例目录>/tasks/<步骤 id>.md`。三条硬规矩：
 * 1. **一次成功编译先清空 `tasks/`、再写**——不做增量、不做局部改写；
 * 2. 写出的文件与 `data.prompt` **字节相同**：不补尾换行、不改 EOL、无 BOM；
 * 3. 失败（不可写 / 磁盘满）**抛错**，由上层转成 `io_error`——**绝不返回一份路径不存在的计划**。
 *
 * 实例的快照建立后不变，所以同一个实例反复 `resume` 写出的内容也不变。
 * @module @xiaoso/dsh-workflow-lite/host/store/materialize
 */
/**
 * 把每个步骤的 `data.prompt` 原样写进 `dir`。
 *
 * @param dir 目标目录（会先整个清空）。
 * @param payloads 步骤 id → 正文。**没有条目的步骤不落盘**（上层已按编译级规则拦过）。
 * @throws 任何 IO 失败、非法步骤 id——上层统一翻成 `io_error`。
 */
export declare function materialize(dir: string, payloads: ReadonlyMap<string, string>): Promise<void>;

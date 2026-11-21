/**
 * dsh-workflow-lite — 单文件原子写与文本读入；存储层唯一的写入原语。
 *
 * 协议（单文件原子写）：同目录临时文件 `open(..., 'wx')` → 写入 → `fsync` →
 * `rename` 覆盖目标 → `fsync` 父目录。失败一律**清掉临时文件**再抛。
 * 单文件写入天然原子：读者看到的要么是旧全文、要么是新全文，没有中间态。
 *
 * `writeFileAtomic` **抛错**而不是返回错误码——把 errno 翻译成 `invalid_args` / `io_error`
 * 是仓储层的事（见 `repoResult.ts` 的 `mapWriteFailure`）。
 * @module @xiaoso/dsh-workflow-lite/host/store/atomic
 */
/**
 * 原子写：临时文件 → fsync → rename 覆盖 → fsync 父目录。
 * 目标父目录**必须已存在**（由仓储的 `ensureLayout` 负责）。
 */
export declare function writeFileAtomic(target: string, content: string): Promise<void>;
/**
 * 读文本。**不存在 → `null`**（`ENOENT` / 中间路径是文件的 `ENOTDIR` / 目标是目录的 `EISDIR`）。
 * 其余失败照抛——那是真 IO 故障，不该被伪装成"文件不存在"。
 */
export declare function readFileText(target: string): Promise<string | null>;
/** 写前冲突比对用的整图哈希（sha-256，十六进制）。同一份文本 ⇒ 同一个值。 */
export declare function hashOf(text: string): Promise<string>;
/** 删一个文件；**不存在 = 成功**（幂等）。 */
export declare function unlinkFile(target: string): Promise<void>;
/** 递归删一棵树；**不存在 = 成功**。用于 `.dispatch/<图名>` 的连带清理。 */
export declare function removeTree(target: string): Promise<void>;
/** 确保一个目录存在（递归）。父路径被文件占位时抛 `ENOTDIR` / `ENOENT`，交给上层翻译。 */
export declare function ensureDir(target: string): Promise<boolean>;
/**
 * 同卷 `rename`，失败时清场。
 * 单独列出来是为了让"只改大小写"的两步改名（Windows）与普通改名共用同一套错误翻译。
 */
export declare function renamePath(from: string, to: string): Promise<void>;
/**
 * 改目录的名字：Windows 上目录里有文件被别的进程短暂打开时改名会失败（`EPERM` / `EBUSY` / `EACCES`），
 * 按 50、100、…毫秒退避重试几次；其余错误、或一直不行，照抛。
 */
export declare function renameDir(from: string, to: string): Promise<void>;

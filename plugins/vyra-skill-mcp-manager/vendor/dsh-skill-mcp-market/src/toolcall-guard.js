// 空 / 残缺 tool-call 写入前哨（需求 A）
//
// 缺陷本体在宿主 @deepseek-ai/dsh-llm 的 BlockAssembler：
//   case 'tool-call-delta': partial.toolCallId = chunk.id   // provider 发 id:"" 时这里被写成空串
//   assemble(): id: partial.toolCallId ?? `call-${index}`      // "" 不是 nullish，?? 救不回来
//               name: partial.toolCallName ?? ''             // 同上，name 变空串
// 于是流里的一枚空 tool-call 会带着 id="" / name="" 写进会话日志，此后该会话无法再追加。
//
// 插件跑在宿主主进程内，通过 app.asar 内的 package.json 解析 @deepseek-ai/dsh-llm
// 拿到的就是宿主正在用的同一个模块实例，因此包装原型方法对整个宿主生效。
// 这里做两件事：push 不再让空 id 覆盖已有 id；assembled() 在交回结果前丢弃 id 或 name 为空的 tool-call。
import { createRequire } from "node:module";
import { join } from "node:path";

const PATCHED = Symbol.for("dsh-market.toolcall-guard");

/**
 * Install the guard against the host's own BlockAssembler.
 * @param {{ resourcesPath?: string, log?: Function }} options
 * @returns {{ ok: boolean, reason?: string, dropped: number }}
 */
export function installToolCallGuard({ resourcesPath, log } = {}) {
  const warn = typeof log === "function" ? log : () => {};
  const root = String(resourcesPath || process.resourcesPath || "");
  if (!root) return { ok: false, reason: "找不到 resourcesPath，跳过写入前哨", dropped: 0 };
  let mod;
  try {
    const req = createRequire(join(root, "app.asar", "dsh", "package.json"));
    mod = req("@deepseek-ai/dsh-llm");
  } catch (error) {
    return { ok: false, reason: `无法解析 @deepseek-ai/dsh-llm：${String(error && error.message) || error}`, dropped: 0 };
  }
  const Assembler = mod && mod.BlockAssembler;
  if (typeof Assembler !== "function") return { ok: false, reason: "@deepseek-ai/dsh-llm 未导出 BlockAssembler", dropped: 0 };
  const proto = Assembler.prototype;
  if (proto[PATCHED]) return { ok: true, reason: "已安装（重复调用被忽略）", dropped: 0 };

  const state = { dropped: 0 };
  const originalPush = proto.push;
  const originalAssembled = proto.assembled;

  if (typeof originalPush === "function") {
    proto.push = function guardedPush(chunk) {
      // provider 常常先发一条 id 为空的 tool-call-delta；不要让它把已有 id 抹成空串
      if (chunk && chunk.type === "tool-call-delta" && !chunk.id && !chunk.name) {
        const partial = this.partials && this.partials.get(chunk.index);
        if (partial && partial.toolCallId) {
          return originalPush.call(this, { ...chunk, id: partial.toolCallId, name: chunk.name || partial.toolCallName });
        }
      }
      return originalPush.call(this, chunk);
    };
  }

  if (typeof originalAssembled === "function") {
    proto.assembled = function guardedAssembled() {
      const result = originalAssembled.call(this);
      if (!result || !Array.isArray(result.blocks)) return result;
      const kept = [];
      let droppedHere = 0;
      for (const block of result.blocks) {
        if (block && block.type === "tool-call" && (!block.id || !block.name)) {
          droppedHere += 1;
          continue;
        }
        kept.push(block);
      }
      if (droppedHere === 0) return result;
      state.dropped += droppedHere;
      warn("warn", `dsh-market: 拦下 ${droppedHere} 枚 id/name 为空的 tool-call，未写入会话日志`);
      return { ...result, blocks: kept };
    };
  }

  Object.defineProperty(proto, PATCHED, { value: true, enumerable: false });
  // 统计读取口，供面板显示
  Assembler.__dshMarketGuardState = state;
  return { ok: true, dropped: 0 };
}

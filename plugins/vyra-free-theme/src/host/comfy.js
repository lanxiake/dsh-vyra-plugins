/**
 * Minimal ComfyUI HTTP client (Host side, used by the CLI).
 *
 * Only the four endpoints a wallpaper run needs: submit, poll, fetch history,
 * download. Everything is injected (`fetchImpl`, `sleep`) so the whole flow is
 * testable without a GPU or a running ComfyUI.
 */
const DEFAULT_BASE = "http://127.0.0.1:8188";

function authHeader(auth) {
  if (typeof auth !== "string" || auth.length === 0) return null;
  if (auth.startsWith("Basic ")) return { authorization: auth };
  if (auth.startsWith("Bearer ")) return { authorization: auth };
  // "user:password" → basic
  return { authorization: `Basic ${Buffer.from(auth, "utf8").toString("base64")}` };
}

export function comfyConfigFromEnv(env = process.env) {
  const baseUrl = env.COMFYUI_URL?.trim() || DEFAULT_BASE;
  const auth = env.COMFYUI_AUTH?.trim() || env.COMFYUI_BASIC_AUTH?.trim() || "";
  return { baseUrl: baseUrl.replace(/\/+$/, ""), auth };
}

export function createComfyClient(options = {}) {
  const config = { ...comfyConfigFromEnv(options.env), ...options };
  const baseUrl = String(config.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  const sleep = config.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const headers = { "content-type": "application/json", ...(authHeader(config.auth) ?? {}) };

  async function call(path, init = {}) {
    const response = await fetchImpl(`${baseUrl}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`ComfyUI ${path} → HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
    }
    return response;
  }

  return {
    baseUrl,

    /** Queue one API-format workflow; returns its prompt id. */
    async submit(workflow, { clientId = "vyra-free-theme" } = {}) {
      const response = await call("/prompt", { method: "POST", body: JSON.stringify({ prompt: workflow, client_id: clientId }) });
      const body = await response.json();
      if (body?.error !== undefined) throw new Error(`ComfyUI rejected the workflow: ${JSON.stringify(body.error).slice(0, 300)}`);
      const promptId = body?.prompt_id;
      if (typeof promptId !== "string") throw new Error("ComfyUI did not return a prompt_id");
      return promptId;
    },

    /** Poll until the prompt appears in history; returns its output images. */
    async wait(promptId, { timeoutMs = 600_000, intervalMs = 2_000, onTick } = {}) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const response = await call(`/history/${encodeURIComponent(promptId)}`);
        const history = await response.json();
        const entry = history?.[promptId];
        if (entry !== undefined) {
          const status = entry.status ?? {};
          if (status.status_str === "error") {
            const message = status.messages?.find((pair) => pair?.[0] === "execution_error")?.[1]?.exception_message ?? "execution error";
            throw new Error(`ComfyUI execution failed: ${message}`);
          }
          const images = [];
          for (const output of Object.values(entry.outputs ?? {})) {
            for (const image of output?.images ?? []) images.push(image);
          }
          if (images.length > 0) return { images, entry };
        }
        onTick?.({ promptId, waitedMs: timeoutMs - Math.max(0, deadline - Date.now()) });
        await sleep(intervalMs);
      }
      throw new Error(`ComfyUI 在 ${Math.round(timeoutMs / 1000)} 秒内没有完成 prompt ${promptId}`);
    },

    /** Download one output image as bytes. */
    async download(image) {
      const query = new URLSearchParams({
        filename: image.filename,
        subfolder: image.subfolder ?? "",
        type: image.type ?? "output",
      });
      const response = await call(`/view?${query.toString()}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer;
    },

    /** Cheap reachability probe used for a clear error instead of a hang. */
    async ping() {
      try {
        const response = await fetchImpl(`${baseUrl}/system_stats`, { headers });
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}
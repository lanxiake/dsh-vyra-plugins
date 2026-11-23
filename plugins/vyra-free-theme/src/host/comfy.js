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
  // Explicit `undefined` must not win over the environment: callers routinely
  // pass every flag through (`{ baseUrl: flags.url, auth: flags.auth }`), and
  // spreading those over the env config silently dropped COMFYUI_AUTH, which
  // showed up as a 401 from a server that was configured correctly.
  const defined = Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined));
  const config = { ...comfyConfigFromEnv(options.env), ...defined };
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

    /** Poll until the prompt appears in history; returns its output files. */
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
          // Core SaveVideo registers under `images`; video helper nodes use
          // `videos` / `gifs`. Collect all three so a clip is never mistaken for
          // "the run produced nothing".
          const files = [];
          for (const output of Object.values(entry.outputs ?? {})) {
            for (const key of ["images", "videos", "gifs"]) {
              for (const file of output?.[key] ?? []) files.push(file);
            }
          }
          if (files.length > 0) {
            const images = files.filter((file) => /\.(png|jpe?g|webp)$/i.test(file.filename ?? ""));
            return { files, images, entry };
          }
        }
        onTick?.({ promptId, waitedMs: timeoutMs - Math.max(0, deadline - Date.now()) });
        await sleep(intervalMs);
      }
      throw new Error(`ComfyUI 在 ${Math.round(timeoutMs / 1000)} 秒内没有完成 prompt ${promptId}`);
    },

    /**
     * Upload one local image so a LoadImage node can reference it.
     * Returns the filename to put in the node (ComfyUI may rename on conflict).
     */
    async uploadImage(buffer, filename, { overwrite = true } = {}) {
      const type = /\.jpe?g$/i.test(filename) ? "image/jpeg" : /\.webp$/i.test(filename) ? "image/webp" : "image/png";
      const form = new FormData();
      // ComfyUI rejects a part without a content type (HTTP 400), so the MIME
      // type has to be set explicitly rather than left to the default.
      form.append("image", new Blob([buffer], { type }), filename);
      form.append("overwrite", overwrite ? "true" : "false");
      // Not through call(): its default content-type is application/json, and a
      // multipart body declared as JSON is an automatic 400. fetch fills in the
      // multipart boundary itself as long as we do not set content-type.
      const response = await fetchImpl(`${baseUrl}/upload/image`, {
        method: "POST",
        headers: { ...(authHeader(config.auth) ?? {}) },
        body: form,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`ComfyUI /upload/image → HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
      }
      const body = await response.json();
      const stored = body?.name ?? filename;
      return body?.subfolder ? `${body.subfolder}/${stored}` : stored;
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

    /**
     * Reachability probe with the HTTP status kept, so "down" and "needs auth"
     * give different advice instead of one useless message. A 401 here is a
     * configuration fact, not a crash: ComfyUI is running and wants COMFYUI_AUTH.
     */
    async probe() {
      try {
        const response = await fetchImpl(`${baseUrl}/system_stats`, { headers });
        return { reachable: true, ok: response.ok, status: response.status };
      } catch (error) {
        return { reachable: false, ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
      }
    },

    /** Cheap reachability probe used for a clear error instead of a hang. */
    async ping() {
      const probe = await this.probe();
      return probe.ok;
    },
  };
}
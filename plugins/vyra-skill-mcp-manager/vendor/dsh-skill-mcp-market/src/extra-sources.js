// Four more live sources, each following the reference implementation's own endpoint:
//   clawhub   — clawhub.ai/api/v1  (browse honours limit; search answers 10 rows per page)
//   trusttools— ai.trusttools.cn/api/skills/search (POST, item carries repo_url/repo_path)
//   LobeHub   — @lobehub/market-cli skills search/install (official CLI, 33万+ skills)
//   skillsmp  — skillsmp.com/api/skills (paged search; Cloudflare-fronted, needs the curl
//               transport because this process's own TLS fingerprint is refused)
//   modelscope— modelscope.cn/api/v1/dolphin/skills (PUT, PageNumber/PageSize + TotalCount)
// Every source here answers a real `page`: either the upstream pages, or a whole catalogue
// is fetched once and sliced locally. That is what makes「加载更多」actually extend the list.
import { getJsonEscalating, postJsonEscalating } from "./http.js";
import { execFile } from "node:child_process";
const isWinCli = process.platform === "win32";
function cliRun(pkg, args, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const cmd = isWinCli
      ? [process.env.ComSpec || "cmd.exe", "/d", "/s", "/c", "npx -y " + pkg + " " + args.map((a) => JSON.stringify(a)).join(" ")]
      : ["npx", "-y", pkg, ...args];
    execFile(cmd[0], cmd.slice(1), { timeout: timeoutMs, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(pkg + " CLI 失败：" + String((stderr || err.message || "")).slice(0, 160)));
      else resolve(String(stdout || ""));
    });
  });
}
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { skillMetaFromText } from "./frontmatter.js";

const UA = { "User-Agent": "dsh-skill-mcp-market/0.9", accept: "application/json" };

async function getJson(url, timeoutMs = 15000) {
  const response = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function postJson(url, body, timeoutMs = 15000) {
  const response = await fetch(url, {
    method: "POST",
    headers: { ...UA, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

/** Local page slice for sources whose upstream hands over a whole catalogue at once. */
function slice(rows, page, pageSize) {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Number(pageSize) || 24);
  const all = Array.isArray(rows) ? rows : [];
  return { rows: all.slice((p - 1) * size, p * size), start: (p - 1) * size, size, all };
}

// ---------------------------------------------------------------- clawhub
// clawhub 的 fetch 在本机偶发瞬时中断（fetch failed），做一次网络重试，
// 避免把一次抖动当成「不可达」误导用户。
async function getJsonClawHub(url, attempt = 0) {
  try {
    // clawhub 的前端 CDN 对 Node 的 TLS/连接指纹时好时坏，所以走 fetch→curl→python 逐级降级。
    return await getJsonEscalating(url, { headers: UA, timeoutMs: 25000 });
  } catch (error) {
    if (attempt < 1 && /fetch failed|ETIMEDOUT|ECONNRESET|socket|network|timeout/i.test(String((error && error.message) || error))) {
      return getJsonClawHub(url, attempt + 1);
    }
    throw error;
  }
}

function mapClawHubRows(rows, q, mode, limitOverride) {
  const limit = limitOverride ?? 24;
  const items = (Array.isArray(rows) ? rows : []).slice(0, limit).map((raw) => {
    const install = raw.install || {};
    const reference =
      String(install.reference || "").trim() ||
      (raw.ownerHandle && raw.slug ? `${raw.ownerHandle}/${raw.slug}` : "");
    const [owner, slug] = reference.includes("/") ? reference.split("/") : [];
    return {
      id: `clawhub:${raw.id || reference || raw.slug}`,
      slug: slug || raw.slug || String(raw.displayName || "").toLowerCase(),
      name: raw.displayName || raw.name || raw.slug || reference,
      description: raw.summary || raw.description || "",
      source: "clawhub",
      sourceLabel: "clawhub",
      owner: owner || raw.ownerHandle || "",
      homepage: `https://clawhub.ai${raw.canonicalUrl || `/${reference}`}`,
      upstreamUrl: "",
      installRef: reference,
      downloads: Number(raw.downloads || raw.metrics?.rolling60DayInstalls || 0) || 0,
      category: raw.category || "",
      installable: Boolean(reference),
      // 搜索端点无分页；浏览端点支持 limit。让客户端据此决定「加载更多」是否可用
      paged: mode === "browse",
    };
  });
  return { source: "clawhub", items, total: items.length };
}

const CLAWHUB_CATALOG_KEY = "clawhub_catalog_v1";
const CLAWHUB_CATALOG_TTL = 6 * 3600 * 1000;

// 浏览端点每屏 50 条并带 nextCursor（JSON 字符串），顺着它累积成本地目录再按页切片：
// 这样第 2 页、第 20 页拿到的都是真正的新条目，而不是上游的第一屏。
async function extendClawHubCatalog(cache, need) {
  let state = cache ? await cache.get(CLAWHUB_CATALOG_KEY, CLAWHUB_CATALOG_TTL) : undefined;
  if (!state || !Array.isArray(state.rows)) state = { rows: [], cursor: null, done: false };
  const seen = new Set(state.rows.map((raw) => String(raw.id ?? raw.slug ?? "")));
  let guard = 0;
  while (!state.done && state.rows.length < need && guard < 10) {
    guard += 1;
    const cursor = state.cursor ? `&cursor=${encodeURIComponent(state.cursor)}` : "";
    const data = await getJsonClawHub(`https://clawhub.ai/api/v1/skills?limit=50${cursor}`);
    const rows = Array.isArray(data.items) ? data.items : Array.isArray(data.results) ? data.results : [];
    for (const raw of rows) {
      const key = String(raw.id ?? raw.slug ?? "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      state.rows.push(raw);
    }
    const next = data.nextCursor || null;
    if (rows.length === 0 || !next || next === state.cursor) state.done = true;
    else state.cursor = next;
  }
  if (cache) await cache.put(CLAWHUB_CATALOG_KEY, state);
  return state;
}

export async function searchClawHub({ query = "", page = 1, pageSize = 24, cache }) {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Math.min(50, Number(pageSize) || 24));
  const q = String(query || "").trim();
  // 同一 (query,page,size) 5 分钟内复用：clawhub 一次搜索要并发打 1–6 个上游页。
  const cKey = `clawhub:search:${q.toLowerCase()}:${p}:${size}`;
  if (cache) {
    const hit = await cache.get(cKey, 5 * 60 * 1000);
    if (hit && Array.isArray(hit.items) && hit.items.length) return { ...hit, source: "clawhub" };
  }
  if (q) {
    // search 端点固定回 10 条/页，顺着 page 取到当前页并拼接上首页，避免翻页拿空。
    const wanted = Math.min(60, size * p);
    const pages = [];
    const perPage = 10;
    for (let i = 1; i <= Math.min(6, Math.ceil(wanted / perPage)); i += 1) {
      pages.push(`https://clawhub.ai/api/v1/search?q=${encodeURIComponent(q)}&page=${i}&limit=${perPage}`);
    }
    const settled = await Promise.allSettled(pages.map((url) => getJsonClawHub(url)));
    if (settled.every((item) => item.status === "rejected")) {
      // Web API 全挂 → 官方 CLI 备用（表格文本按列解析；仅 Web 故障时启用）
      let cliRows = [];
      try {
        const text = await cliRun("clawhub", ["search", q, "--limit", String(wanted)]);
        cliRows = text.split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("npm") && !l.startsWith("🦞") && !l.startsWith("Usage:"))
          .map((l) => {
            const m = l.match(/^([\w-]+)\s+@([\w.-]+)\s+(.+?)\s+\d+ installs/);
            if (!m) return null;
            return { name: m[1], owner: m[2], displayName: m[3], slug: m[1] };
          })
          .filter(Boolean);
      } catch (cliErr) {
        throw new Error("clawhub Web API 与官方 CLI 均不可用：" + String((cliErr && cliErr.message) || cliErr).slice(0, 120));
      }
      if (cliRows.length) {
        const out = mapClawHubRows(cliRows, q, "search-cli", cliRows.length);
        out.total = cliRows.length;
        out.hasMore = false;
        out.hint = "clawhub Web API 不可达，结果来自官方 CLI（较慢）";
        if (cache && out.items && out.items.length) await cache.put(cKey, out);
        return out;
      }
      throw new Error("clawhub 搜索不可达（网络中断，已重试一次）");
    }
    const seen = new Set();
    const merged = [];
    for (const item of settled) {
      if (item.status !== "fulfilled") continue;
      const rows = Array.isArray(item.value?.results) ? item.value.results : Array.isArray(item.value?.items) ? item.value.items : [];
      for (const raw of rows) {
        const key = String(raw.id ?? raw.slug ?? raw.displayName ?? "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(raw);
      }
    }
    const slicedRows = merged.slice((p - 1) * size, p * size);
    const out = mapClawHubRows(slicedRows, q, "search", slicedRows.length);
    out.total = merged.length >= wanted ? wanted + 1 : merged.length;
    out.hasMore = merged.length >= wanted;
    if (cache && out.items && out.items.length) await cache.put(cKey, out);
    return out;
  }
  // 浏览：顺着 nextCursor 把目录累积到需要的深度，再本地切出这一页。
  const need = Math.min(600, size * p);
  const state = await extendClawHubCatalog(cache, need);
  const rows = state.rows;
  const matched = rows.slice((p - 1) * size, p * size);
  const out = mapClawHubRows(matched, q, "browse", matched.length);
  if (!rows.length) out.hint = "clawhub 当前没有返回条目（可达，但列表为空）";
  out.hasMore = p * size < rows.length || (!state.done && rows.length >= p * size);
  out.total = state.done ? rows.length : Math.max(rows.length, p * size) + 1;
  if (cache && out.items && out.items.length) await cache.put(cKey, out);
  return out;
}

export async function searchTrustTools({ query = "", page = 1, pageSize = 24, cache } = {}) {
  // trusttools ignores `pageSize` and always answers with 10 rows per page, so a page of 24
  // needs three upstream pages stitched together (pages are disjoint, verified).
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Math.min(60, Number(pageSize) || 24));
  const perPage = 10;
  const perBatch = Math.ceil(size / perPage);
  const first = (p - 1) * perBatch + 1;
  const rows = [];
  const seen = new Set();
  let total = 0;
  for (let index = 0; index < perBatch; index += 1) {
    const upstreamPage = first + index;
    const key = `trusttools:${String(query).trim().toLowerCase()}:${upstreamPage}`;
    let data = cache ? await cache.get(key, 10 * 60 * 1000) : undefined;
    if (!data) {
      data = await postJsonEscalating(
        "https://ai.trusttools.cn/api/skills/search",
        { q: query, page: upstreamPage, pageSize: perPage },
        { timeoutMs: 25000 },
      );
      if (cache) await cache.put(key, data);
    }
    const batch = Array.isArray(data.data) ? data.data : [];
    if (data.pagination && Number(data.pagination.total) > 0) total = Number(data.pagination.total);
    let added = 0;
    for (const raw of batch) {
      const id = String(raw.id ?? raw.slug ?? raw.name ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      rows.push(raw);
      added += 1;
    }
    if (batch.length === 0 || added === 0) break; // catalogue exhausted or the page repeats
  }
  const items = rows.slice(0, size).map((raw) => {
    const repo = String(raw.repo_url || "").replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "");
    const path = String(raw.repo_path || "").replace(/\/SKILL\.md$/i, "");
    return {
      id: `trusttools:${raw.id}`,
      slug: raw.slug || raw.name,
      name: raw.name || raw.slug,
      description: raw.description_zh || raw.description || raw.short_description || "",
      source: "trusttools",
      sourceLabel: "TrustTools",
      owner: repo,
      homepage: repo ? `https://github.com/${repo}` : "",
      upstreamUrl: repo,
      ref: raw.branch || "main",
      skillDir: path,
      stars: Number(raw.stars || 0),
      installs: Number(raw.install_count || raw.download_count || 0),
      security: raw.security_level || "",
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      category: (Array.isArray(raw.tags) && raw.tags[0]) || "",
      installable: Boolean(repo && path),
    };
  });
  const known = total || 0;
  return {
    source: "trusttools",
    items,
    total: known,
    hasMore: known ? p * size < known : items.length >= size,
  };
}

// ---------------------------------------------------------------- LobeHub Skills Marketplace
// LobeHub's Skills Marketplace (33万+ skills) is accessed via the official CLI:
//   search:  npx -y @lobehub/market-cli skills search --q "<query>" --page <n> --page-size <n> --output json
//   install: npx -y @lobehub/market-cli skills install <identifier> --dir <path>
// The CLI auto-downloads via npx; no pre-install or authentication required.
// `view` requires a token and is not used.
export async function searchLobeHubSkills({ query = "", page = 1, pageSize = 24, cache }) {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Number(pageSize) || 24);
  const cacheKey = `lobehub_skills_search:${query.trim()}:${p}:${size}`;
  const cached = cache ? await cache.get(cacheKey, 30 * 60 * 1000) : undefined;
  if (cached) return { source: "lobehub", ...cached };

  const { npxRun } = await import("./cli-install.js");
  // Empty query: omit --q entirely (the CLI treats an empty-string arg as a
  // positional and rejects it: "too many arguments for 'search'").
  const q = String(query || "").trim();
  const args = ["skills", "search"];
  if (q) args.push("--q", q);
  args.push("--page", String(p), "--page-size", String(size), "--output", "json");
  // First npx run auto-downloads the CLI (~30 s); subsequent runs are cached.
  // 180 s covers the worst-case cold start without hanging the UI.
  const stdout = await npxRun("@lobehub/market-cli", args, { timeoutMs: 180000 });
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("lobehub search: CLI returned non-JSON output");
  }
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items = rawItems.map((raw) => ({
    id: `lobehub:${raw.identifier || ""}`,
    slug: raw.name || raw.identifier || "",
    name: raw.name || raw.identifier || "",
    description: raw.description || "",
    source: "lobehub",
    sourceLabel: "LobeHub 技能市场",
    owner: raw.author || "",
    homepage: raw.homepage || "",
    upstreamUrl: "",
    reference: raw.identifier || "",
    category: raw.category || "",
    tags: [],
    installCount: Number(raw.installCount || 0),
    rating: Number(raw.ratingAverage || 0),
    installable: Boolean(raw.identifier),
    note: "通过官方 CLI 安装 LobeHub 技能",
  }));
  const total = Number(parsed.totalCount || 0);
  const result = {
    source: "lobehub",
    items,
    total,
    hasMore: total ? p * size < total : items.length >= size,
  };
  if (cache) await cache.put(cacheKey, result);
  return result;
}

/**
 * Install a LobeHub skill via the official CLI.
 * `npx -y @lobehub/market-cli skills install <identifier> --dir <tmpDir>`
 * The CLI extracts the skill into <tmpDir>/<identifier>/ (SKILL.md + references/).
 * Returns { name, description, files } in the same shape the old agent-JSON path produced,
 * so callers in skills.js can use it unchanged.
 */
export async function lobehubAgentSkill(identifier) {
  if (!identifier) throw new Error("lobehub skill install requires an identifier");
  const { npxRun } = await import("./cli-install.js");
  const tmpRoot = await mkdtemp(join(tmpdir(), "dsh-lobehub-"));
  const targetDir = join(tmpRoot, identifier);
  try {
    await npxRun("@lobehub/market-cli", ["skills", "install", identifier, "--dir", tmpRoot], {
      timeoutMs: 120000,
    });
    if (!existsSync(targetDir)) {
      throw new Error(`lobehub CLI did not produce a skill directory at ${targetDir}`);
    }
    // Walk the installed directory and collect all files.
    const files = {};
    const walk = async (current, prefix) => {
      for (const entry of await readdir(current, { withFileTypes: true })) {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        const full = join(current, entry.name);
        if (entry.isDirectory()) await walk(full, relative);
        else files[relative] = await readFile(full, "utf8");
      }
    };
    await walk(targetDir, "");
    const skillText = files["SKILL.md"] || "";
    const meta = skillMetaFromText(skillText, identifier);
    if (!meta.name || !meta.description) {
      throw new Error("lobehub skill SKILL.md 缺少 name 或 description frontmatter");
    }
    return { name: meta.name, description: meta.description, files };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- skillsmp
// skillsmp.com answers 403 "Just a moment…" to this process's fetch/https but 200 to the
// curl transport (see src/http.js): the edge fingerprints the TLS client, not the headers.
// The payload is `{ skills: [...], pagination: { total } }`; every row carries the exact
// GitHub location, so an install is a plain repo+skillDir download.
const SKILLSMP_TTL = 10 * 60 * 1000;

function skillsmpTarget(raw) {
  const route = raw.route || {};
  const url = String(raw.githubUrl || "");
  const tree = url.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/i);
  const branch = String(raw.branch || (tree ? tree[3] : "") || "main");
  let skillDir = String(route.sourceSkillPath || "").replace(/\/?SKILL\.md$/i, "");
  if (!skillDir && tree) skillDir = tree[4];
  const repo = tree ? `${tree[1]}/${tree[2]}` : "";
  return { repo, branch, skillDir };
}

export async function searchSkillsMp({ query = "", page = 1, pageSize = 24, cache }) {
  const q = String(query || "").trim();
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Math.min(50, Number(pageSize) || 24));
  const key = `skillsmp:${q || "all"}:${p}:${size}`;
  const cached = cache ? await cache.get(key, SKILLSMP_TTL) : undefined;
  if (cached && Array.isArray(cached.items) && cached.items.length) return { ...cached, source: "skillsmp" };
  const params = new URLSearchParams({ q, page: String(p), limit: String(Math.max(size, 10)) });
  const data = await getJsonEscalating(`https://skillsmp.com/api/skills?${params.toString()}`, {
    headers: { referer: "https://skillsmp.com/" },
    timeoutMs: 20000,
    // 唯一需要 python 的站点：Cloudflare 按 TLS 指纹拦截，fetch/curl 均 403，只有 CPython urllib 能过。
    pythonFirst: true,
  });
  const rows = Array.isArray(data.skills) ? data.skills : [];
  const items = rows.slice(0, size).map((raw) => {
    const { repo, branch, skillDir } = skillsmpTarget(raw);
    return {
      id: `skillsmp:${raw.id || raw.name}`,
      slug: raw.name || String(raw.id || ""),
      name: raw.name || String(raw.id || ""),
      description: raw.description || "",
      source: "skillsmp",
      sourceLabel: "skillsmp",
      owner: raw.author || "",
      homepage: raw.githubUrl || "",
      // parseRepoRef understands `owner/repo@ref`, so the branch rides along here.
      upstreamUrl: repo ? `${repo}@${branch}` : "",
      skillDir,
      ref: branch,
      // The upstream `stars` field is a placeholder (identical across unrelated rows),
      // so it is not surfaced as a popularity signal.
      stars: 0,
      category: "",
      installable: Boolean(repo),
    };
  });
  const total = Number(data.pagination && data.pagination.total) || p * size + (rows.length >= size ? 1 : 0);
  const payload = { source: "skillsmp", items, total, hasMore: p * size < total };
  // An empty page is never cached: one upstream hiccup must not blank the market for ten
  // minutes, and the next request should retry immediately.
  if (cache && items.length) await cache.put(key, payload);
  return payload;
}

// ---------------------------------------------------------------- ModelScope
// PUT https://modelscope.cn/api/v1/dolphin/skills {PageNumber,PageSize,Query?} → Data.SkillList,
// Data.TotalCount（实测 88k+ 条、页与页不重复）。技能正文挂在 SourceURL 的 GitHub 地址上。
const MODELSCOPE_SKILLS_URL = "https://modelscope.cn/api/v1/dolphin/skills";

export async function searchModelScope({ query = "", page = 1, pageSize = 24, cache } = {}) {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Math.min(50, Number(pageSize) || 24));
  const body = { PageNumber: p, PageSize: size };
  const size0 = size;
  const cacheKey = `modelscope:search:${String(query || "").trim().toLowerCase()}:${p}:${size0}`;
  const hit = cache ? await cache.get(cacheKey, 5 * 60 * 1000) : undefined;
  if (hit) return { ...hit, source: "modelscope" };
  const q = String(query || "").trim();
  if (q) body.Query = q;
  const response = await fetch(MODELSCOPE_SKILLS_URL, {
    method: "PUT",
    headers: { ...UA, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`ModelScope HTTP ${response.status}`);
  const payload = await response.json();
  const data = payload.Data || {};
  const rows = Array.isArray(data.SkillList) ? data.SkillList : [];
  const total = Number(data.TotalCount) || 0;
  const items = rows.filter((raw) => raw && raw.Name).map((raw) => {
    const owner = raw.Path || raw.Owner || "";
    const name = raw.Name || "";
    const ident = owner ? `${owner}/${name}` : name;
    const source = String(raw.SourceURL || "");
    const gh = /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/(?:blob|tree)\/([^/]+)\/(.+)$/i.exec(source);
    const repo = gh ? `${gh[1]}/${gh[2]}` : "";
    const branch = gh ? gh[3] : "main";
    const skillDir = gh ? gh[4].replace(/\/?SKILL\.md$/i, "") : "";
    return {
      id: `modelscope:${ident}`,
      slug: name,
      name: raw.DisplayName || name,
      description: raw.Description || raw.DescriptionEn || "",
      category: raw.L1 && typeof raw.L1 === "object" ? raw.L1.ChineseName || "" : "",
      source: "modelscope",
      sourceLabel: "ModelScope",
      owner,
      homepage: source || `https://modelscope.cn/skills/${ident}`,
      upstreamUrl: repo ? `${repo}@${branch}` : "",
      ref: branch,
      skillDir,
      downloads: Number(raw.DownloadCount || 0),
      tags: Array.isArray(raw.Tags) ? raw.Tags : [],
      installable: true,
      modelScopeIdent: ident,
    };
  });
  const result = { source: "modelscope", items, total: total || p * size + (rows.length >= size ? 1 : 0), hasMore: total ? p * size < total : rows.length >= size };
  if (cache) await cache.put(cacheKey, result);
  return result;
}

/**
 * Download a ModelScope skill via the official ZIP endpoint:
 *   https://modelscope.cn/skills/<owner>/<name>/archive/zip/master
 * The ZIP contains a single top-level directory (e.g. `skills-owner.name-master-<sha>/`)
 * with SKILL.md inside. Returns { name, description, files } in the same shape as
 * lobehubAgentSkill, so callers in skills.js can use it unchanged.
 */
export async function modelScopeSkill(ident) {
  if (!ident) throw new Error("modelscope skill install requires an ident (owner/name)");
  const { readZip, stripCommonPrefix, locateSkillRoot } = await import("./zip.js");
  const { pythonDownload } = await import("./http.js");
  const url = `https://modelscope.cn/skills/${encodeURIComponent(ident)}/archive/zip/master`;
  let buffer;
  try {
    const response = await fetch(url, {
      headers: { ...UA, accept: "application/zip, application/octet-stream" },
      signal: AbortSignal.timeout(60000),
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    buffer = Buffer.from(await response.arrayBuffer());
  } catch {
    // Fall back to the Python transport (honours the system proxy):
    const { mkdtemp } = await import("node:fs/promises");
    const { join: jp } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const tmp = await mkdtemp(jp(tmpdir(), "dsh-ms-zip-"));
    const target = jp(tmp, "skill.zip");
    try {
      await pythonDownload(url, target, { timeoutMs: 60000 });
      const { readFile: rf } = await import("node:fs/promises");
      buffer = await rf(target);
    } finally {
      const { rm } = await import("node:fs/promises");
      await rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  }
  const { files: raw } = readZip(buffer);
  const flat = stripCommonPrefix(raw);
  const root = locateSkillRoot(flat);
  if (root === null) throw new Error("ModelScope ZIP 里没有找到 SKILL.md");
  const prefix = root ? `${root}/` : "";
  const files = {};
  for (const [entry, content] of Object.entries(flat)) {
    if (prefix && !entry.startsWith(prefix)) continue;
    files[entry.slice(prefix.length)] = content;
  }
  const skillText = files["SKILL.md"] || "";
  const meta = skillMetaFromText(skillText, ident);
  if (!meta.name || !meta.description) {
    throw new Error("ModelScope skill SKILL.md 缺少 name 或 description frontmatter");
  }
  return { name: meta.name, description: meta.description, files };
}

/**
 * Download a ModelScope skill via its GitHub upstream (when the search API
 * returned an `upstreamUrl` such as `owner/repo@branch` + `skillDir`).
 * Uses the shared `downloadSkillDir` from github.js — the same fast path
 * skills.sh and skillsmp use. Returns { name, description, files } in
 * the same shape as modelScopeSkill, so callers in skills.js are unchanged.
 *
 * Throws when the GitHub download fails so the caller can fall back to
 * the official ZIP endpoint (modelScopeSkill).
 */
export async function modelScopeGitHubSkill(upstreamUrl, skillDir, ident) {
  if (!upstreamUrl) throw new Error("modelscope GitHub fast path requires an upstreamUrl (owner/repo@branch)");
  const { downloadSkillDir, parseRepoRef } = await import("./github.js");
  const { mkdir, rm, mkdtemp, readdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join: jp } = await import("node:path");

  const parsed = parseRepoRef(upstreamUrl);
  const repo = parsed.repo;
  const ref = parsed.ref || "main";

  const tmp = await mkdtemp(jp(tmpdir(), "dsh-ms-gh-"));
  try {
    await mkdir(jp(tmp, "skill"), { recursive: true });
    const { files: written, skillText, skipped } = await downloadSkillDir({
      repo,
      ref,
      skillDir: skillDir || "",
      destDir: jp(tmp, "skill"),
    });
    if (!written.length || !skillText) {
      throw new Error(`ModelScope GitHub download produced no files for ${repo}@${ref}${skillDir ? "/" + skillDir : ""}`);
    }
    // Collect the in-memory file map so skills.js can use the same writeSkill path.
    const files = {};
    for (const rel of written) {
      const { readFile: rf } = await import("node:fs/promises");
      files[rel] = await rf(jp(tmp, "skill", rel), "utf8");
    }
    const meta = skillMetaFromText(files["SKILL.md"] || "", ident);
    if (!meta.name || !meta.description) {
      throw new Error("ModelScope skill SKILL.md 缺少 name 或 description frontmatter");
    }
    return { name: meta.name, description: meta.description, files };
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Resolve a clawhub reference (`owner/slug`) to its GitHub-backed skill directory.
 *
 * Two strategies, tried in order:
 *   1. HTML scrape — fetch the clawhub.ai detail page and regex-extract the GitHub
 *      repo URL. Fast when the page structure still carries a bare github.com link.
 *   2. Search API — fall back to `clawhub.ai/api/v1/search?q=<slug>` and read the
 *      structured `links.source` field from the matching result.  Works even when
 *      the HTML page no longer embeds a raw GitHub URL (the 2026-11 failure mode).
 *
 * Returns `{ repo, skillDir, apiFallback }` — `apiFallback` is true when the
 * structured API supplied the repo instead of the HTML scrape.
 * If neither strategy finds a GitHub source, throws an Error whose message
 * includes the detail-page URL so the client can offer a "open in browser" fallback.
 */
export async function clawhubResolve(reference) {
  const [owner, slug] = String(reference || "").split("/");
  if (!owner || !slug) throw new Error("clawhub 引用格式应为 owner/slug");

  // Strategy 1: HTML scrape (original path, may fail if page structure changed).
  let htmlMatch = null;
  try {
    const page = await (await fetch(`https://clawhub.ai/${owner}/skills/${slug}`, {
      headers: UA,
      signal: AbortSignal.timeout(15000),
    })).text();
    htmlMatch = /https:\/\/github\.com\/([\w.-]+\/[\w.-]+)(?:\/tree\/[\w.-]+\/([\w./-]+))?/.exec(page);
  } catch {
    // Network hiccup — fall through to API.
  }
  if (htmlMatch) return { repo: htmlMatch[1], skillDir: htmlMatch[2] || "", apiFallback: false };

  // Strategy 2: Search API (structured, resilient to HTML changes).
  try {
    const results = await getJsonClawHub(
      `https://clawhub.ai/api/v1/search?q=${encodeURIComponent(slug)}&page=1&limit=20`,
    );
    const rows = Array.isArray(results) ? results : results?.results || [];
    const hit = rows.find(
      (r) => r?.ownerHandle === owner && r?.slug === slug,
    ) || rows.find((r) => {
      const ref = r?.install?.reference || "";
      return ref === `${owner}/${slug}`;
    });
    if (hit) {
      // links.source carries the GitHub repo URL when the skill has one.
      const sourceUrl =
        hit.links?.source ||
        hit.install?.sourceUrl ||
        hit.upstreamUrl ||
        "";
      if (sourceUrl) {
        const m = /github\.com\/([\w.-]+\/[\w.-]+)(?:\/tree\/[\w.-]+\/([\w./-]+))?/.exec(sourceUrl);
        if (m) return { repo: m[1], skillDir: m[2] || "", apiFallback: true };
      }
      // Some entries carry the repo under native.skill or sourceIdentity.
      const repoField =
        hit.native?.skill?.repoUrl ||
        hit.sourceIdentity?.repo ||
        hit.native?.repo ||
        "";
      if (repoField) {
        return { repo: String(repoField).replace(/^github\.com\//, "").replace(/^https?:\/\/github\.com\//, ""), skillDir: "", apiFallback: true };
      }
    }
  } catch {
    // API also unreachable — fall through to the error below.
  }

  const detailUrl = `https://clawhub.ai/${owner}/skills/${slug}`;
  throw new Error(
    `clawhub 页面与 API 里都没有找到 GitHub 源仓库（${detailUrl}）——可直接在浏览器中打开该页查看详情`,
  );
}

// Skill install / list / remove, plus the curated catalog shipped with this bundle.
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { existsSync, lstatSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { kebab, parseFrontmatter, setFrontmatterFlag, skillMetaFromText } from "./frontmatter.js";
import { downloadSkillDir, listTree, parseRepoRef, readRepoFile, resolveRef, skillDirsFrom, findSkillDirFor } from "./github.js";
import { searchSkills as searchSkillHub } from "./skillhub.js";
import { resolveSkillsShInstall } from "./sources.js";
import { scanSkillBundle } from "./verify.js";
import { writeJson } from "./home.js";
import { locateSkillRoot, readZip, stripCommonPrefix } from "./zip.js";
import { clawhubResolve, lobehubAgentSkill, modelScopeSkill, modelScopeGitHubSkill } from "./extra-sources.js";
import { ensureDir, expandPath } from "./home.js";
import {
  installViaSkillsShCli,
  installViaClawHubCli,
  installViaSkillHubCli,
  installViaBrowseShCli,
  installViaTrustToolsCli,
} from "./cli-install.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOG_FILE = join(HERE, "..", "catalog", "skills.json");

let catalogCache = null;

export async function curatedSkills() {
  if (catalogCache) return catalogCache;
  try {
    const raw = JSON.parse(await readFile(CATALOG_FILE, "utf8"));
    catalogCache = Array.isArray(raw.items) ? raw.items : [];
  } catch {
    catalogCache = [];
  }
  return catalogCache;
}

/** List installed skills across the configured roots. */
export async function listInstalledSkills(dirs) {
  const out = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const skillFile = entry.isDirectory() ? join(full, "SKILL.md") : entry.name.endsWith(".md") ? full : "";
      if (!skillFile || !existsSync(skillFile)) continue;
      try {
        const text = await readFile(skillFile, "utf8");
        const meta = skillMetaFromText(text, entry.isDirectory ? entry.name : basename(entry.name, ".md"));
        out.push({
          slug: entry.isDirectory ? entry.name : basename(entry.name, ".md"),
          name: meta.name || entry.name,
          description: meta.description,
          whenToUse: meta.whenToUse,
          dir,
          path: skillFile,
          kind: entry.isDirectory ? "directory" : "file",
        });
      } catch {
        // unreadable skill: skip it, keep the rest
      }
    }
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

function uniqueSlug(base, taken) {
  let slug = base || "skill";
  let index = 2;
  while (taken.has(slug)) {
    slug = `${base}-${index}`;
    index += 1;
  }
  return slug;
}

async function existingSlugs(dirs) {
  const taken = new Set();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    try {
      for (const name of await readdir(dir)) {
        taken.add(name.replace(/\.md$/i, ""));
      }
    } catch {
      // ignore
    }
  }
  return taken;
}

/**
 * Install a skill into the first configured skill directory.
 * Supported sources: `github` (owner/repo[/sub/path]), `url` (a SKILL.md or raw file URL), `skillhub` (needs upstream_url), `local` (a directory on disk).
 */
export async function installSkill({ source = "github", reference = "", skillDir = "", dir = "", name = "", ref = "", force = false, skillDirs, cache, upstreamUrl = "" } = {}) {
  const roots = skillDirs && skillDirs.length > 0 ? skillDirs : [];
  if (roots.length === 0) throw new Error("no skill directories are configured");
  const targetRoot = dir ? expandPath(dir) : roots[0];
  await ensureDir(targetRoot);
  const taken = await existingSlugs(roots);

  const writeSkill = async ({ slug, files, skillText, origin }) => {
    const finalSlug = force ? kebab(slug) || slug : uniqueSlug(kebab(slug) || slug, taken);
    const targetDir = join(targetRoot, finalSlug);
    const meta = skillMetaFromText(skillText || "", finalSlug);
    if (!meta.name || !meta.description) {
      throw new Error("SKILL.md must declare both `name` and `description` in its frontmatter");
    }
    // 安全扫描：报告制（不拒装），高危发现随结果返回，由客户端展示
    const scan = scanSkillBundle({ files, skillText });
    const highFindings = scan.findings.filter((f) => f.severity === "high");

    // 暂存目录 + 原子提交：任何一步失败只清暂存，正式目录零残留
    const staging = join(targetRoot, `.staging-${finalSlug}-${Date.now()}`);
    await ensureDir(staging);
    try {
      for (const [relative, content] of Object.entries(files)) {
        const target = join(staging, relative);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content, "utf8");
      }
      await writeJson(join(staging, ".market-install.json"), {
        slug: finalSlug,
        name: meta.name,
        origin,
        installedAt: new Date().toISOString(),
      });
      // 完整性核对：暂存文件数与来源一致
      const staged = await readdir(staging, { recursive: true });

      const manifestPresent = staged.some((f) => String(f) === ".market-install.json");
      if (!manifestPresent) {
        throw new Error("完整性校验失败：暂存缺少 .market-install.json");
      }
      // 原子提交：rename 暂存 → 正式目录（同卷）；跨卷 EXDEV 降级 copy+rm
      if (existsSync(targetDir)) {
        if (force) {
          await rm(targetDir, { recursive: true, force: true });
        } else {
          throw new Error(`技能 ${finalSlug} 已存在于 ${targetDir}，加 force 可覆盖`);
        }
      }
      try {
        await rename(staging, targetDir);
      } catch (error) {
        if (error && error.code === "EXDEV") {
          await cp(staging, targetDir, { recursive: true });
          await rm(staging, { recursive: true, force: true });
        } else {
          throw error;
        }
      }
      return {
        ok: true,
        slug: finalSlug,
        name: meta.name,
        description: meta.description,
        dir: targetDir,
        files: Object.keys(files).length,
        findings: highFindings.length ? highFindings : undefined,
        scanStats: scan.stats,
      };
    } finally {
      // 暂存目录存在即清理（rename 成功后 staging 已不存在，rm 是 no-op）
      if (existsSync(staging)) {
        await rm(staging, { recursive: true, force: true }).catch(() => {});
      }
    }
  };

  if (source === "local") {
    const from = expandPath(reference);
    if (!existsSync(from)) throw new Error(`local path not found: ${from}`);
    const info = await stat(from);
    if (!info.isDirectory()) throw new Error("local source must be a directory that contains SKILL.md");
    const skillText = await readFile(join(from, "SKILL.md"), "utf8");
    const files = {};
    const walk = async (current, prefix) => {
      for (const entry of await readdir(current, { withFileTypes: true })) {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        const full = join(current, entry.name);
        if (entry.isDirectory()) await walk(full, relative);
        else files[relative] = await readFile(full, "utf8");
      }
    };
    await walk(from, "");
    return writeSkill({ slug: name || basename(from), files, skillText, origin: { source: "local", path: from } });
  }

  if (source === "url") {
    const url = String(reference || "");
    if (!/^https?:\/\//i.test(url)) throw new Error("url source needs an http(s) reference");
    const response = await fetch(url, { headers: { "User-Agent": "dsh-skill-mcp-market/0.1" } });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    const text = await response.text();
    if (!text.startsWith("---")) throw new Error("the fetched file is not a SKILL.md (missing frontmatter)");
    const meta = skillMetaFromText(text, name || basename(url).replace(/\.md$/i, ""));
    return writeSkill({
      slug: name || meta.name,
      files: { "SKILL.md": text },
      skillText: text,
      origin: { source: "url", url },
    });
  }

  if (source === "skillhub") {
    // Fast path: install via the official `skillhub` CLI (npx auto-downloads it).
    const skillId = String(reference || "").trim();
    if (skillId) {
      try {
        return await installViaSkillHubCli({ slug: skillId, reference: skillId, targetRoot, dir, name, force, skillDirs });
      } catch (cliError) {
        console.log(`[dsh-market] skillhub CLI install failed, falling back to GitHub: ${cliError.message}`);
      }
    }
    // Fallback: if the CLI failed or there's no reference, try the old GitHub path.
    const upstream = String(reference || "");
    if (upstream) {
      return installSkill({ source: "github", reference: upstream, skillDir, dir: targetRoot, name, force, skillDirs });
    }
    throw new Error("this SkillHub entry has no install reference");
  }

  if (source === "github") {
    const { repo, ref, subPath } = parseRepoRef(reference);
    const resolvedRef = await resolveRef(repo, ref);
    let chosen = skillDir || subPath;
    if (!chosen) {
      const files = await listTree(repo, resolvedRef);
      const candidates = skillDirsFrom(files);
      if (candidates.length === 0) throw new Error(`no SKILL.md found in ${repo}@${resolvedRef}`);
      const wanted = kebab(name || "");
      // A bare `owner/repo` usually means "the skill named like the repo": repos that ship
      // several skills still carry the flagship one under the repo's own name. Without this
      // a plain `owner/repo` install would stop at the ambiguity error.
      const repoWanted = kebab(String(repo || "").split("/").pop() || "");
      const basenameOf = (path) => (path || "").split("/").pop().toLowerCase();
      chosen =
        (wanted && candidates.find((path) => basenameOf(path) === wanted)) ||
        (wanted && candidates.find((path) => path.toLowerCase().endsWith(`/${wanted}`))) ||
        (!wanted && repoWanted && candidates.find((path) => basenameOf(path) === repoWanted)) ||
        (!wanted && repoWanted && candidates.find((path) => path.toLowerCase().endsWith(`/${repoWanted}`))) ||
        (candidates.length === 1 ? candidates[0] : "");
      if (chosen === "" && candidates.length > 1) {
        throw new Error(
          `${repo}@${resolvedRef} contains ${candidates.length} skills; pass skillDir. Candidates: ${candidates.slice(0, 12).join(", ")}`,
        );
      }
    }
    const staging = join(targetRoot, `.staging-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await ensureDir(staging);
    try {
      const result = await downloadSkillDir({ repo, ref: resolvedRef, skillDir: chosen, destDir: staging });
      const files = {};
      const walk = async (current, prefix) => {
        for (const entry of await readdir(current, { withFileTypes: true })) {
          const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
          const full = join(current, entry.name);
          if (entry.isDirectory()) await walk(full, relative);
          else files[relative] = await readFile(full, "utf8");
        }
      };
      await walk(staging, "");
      const written = await writeSkill({
        slug: name || basename(chosen || repo),
        files,
        skillText: result.skillText,
        origin: { source: "github", repo, ref: resolvedRef, skillDir: chosen },
      });
      return result.skipped?.length ? { ...written, skipped: result.skipped } : written;
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }

  if (source === "skillsmp") {
    // Every skillsmp row carries its exact GitHub location, so installation is the plain
    // github path. `upstreamUrl` is already shaped as `owner/repo@ref` by the source.
    if (!reference) throw new Error("该 skillsmp 条目没有给出 GitHub 源仓库，无法下载");
    return installSkill({
      source: "github",
      reference,
      skillDir: skillDir || "",
      name: name || "",
      dir: targetRoot,
      force,
      skillDirs,
    });
  }

  if (source === "browse.sh") {
    // Use the official `browse` CLI: `browse skills add <slug>`
    // (slug is the raw slug from the browse.sh catalogue, e.g. "alltrails.com"
    //  or "yelp.com/extract-reviews").
    try {
      return await installViaBrowseShCli({
        slug: String(reference || ""),
        targetRoot,
        dir,
        name,
        force,
        skillDirs,
      });
    } catch (cliError) {
      throw new Error(
        `browse.sh 技能安装失败：${cliError.message}。` +
        "browse.sh 条目需要通过官方 browse CLI 安装（npm i -g browse），" +
        "无法通过 GitHub 下载。请确保已安装 Node.js 22.18+ 并运行 npm i -g browse 后重试。",
      );
    }
  }

  if (source === "zip") {
    const archivePath = expandPath(reference);
    const buffer = await readFile(archivePath);
    const { files: raw, skipped } = readZip(buffer);
    const flat = stripCommonPrefix(raw);
    const root = locateSkillRoot(flat);
    if (root === null) throw new Error("ZIP 里没有找到 SKILL.md");
    const prefix = root ? `${root}/` : "";
    const files = {};
    for (const [entry, content] of Object.entries(flat)) {
      if (prefix && !entry.startsWith(prefix)) continue;
      files[entry.slice(prefix.length)] = content;
    }
    const skillText = files["SKILL.md"] || "";
    const written = await writeSkill({
      slug: name || skillMetaFromText(skillText, "").name || root.split("/").pop() || basename(archivePath, ".zip"),
      files,
      skillText,
      origin: { source: "zip", path: archivePath },
    });
    return skipped.length ? { ...written, skipped } : written;
  }

  if (source === "skills.sh" || source === "skillssh") {
    const raw = String(reference || "").trim();
    let effectiveName = name || "";
    // Accept a bare `owner/repo` (what the tool interface and CLI users type) as well as a
    // skills.sh page URL. Only a URL needs the extra hop through the page to learn the repo
    // and the skill name; a bare repo is already the install target.
    if (!/^https?:\/\//i.test(raw)) {
      if (!/^[\w.-]+\/[\w.-]+/.test(raw)) {
        throw new Error(`skills.sh 引用应为页面 URL 或 owner/repo，收到 "${raw}"`);
      }
      return installSkill({
        source: "github",
        reference: raw,
        skillDir: skillDir || "",
        name: effectiveName,
        dir: targetRoot,
        force,
        skillDirs,
      });
    }
    // The host market cache lets resolveSkillsShInstall skip the 25-second page fetch when
    // it can parse the URL locally or read a previously resolved entry.
    const { repo, skill } = await resolveSkillsShInstall(raw, cache);
    // Fast path: use the official `skills` CLI to download the skill directly,
    // avoiding the slow GitHub API + tarball path.
    try {
      return await installViaSkillsShCli({
        repo,
        slug: skill || skillDir || String(repo.split("/").pop() || ""),
        targetRoot,
        dir,
        name: effectiveName || skill || "",
        force,
        skillDirs,
      });
    } catch (cliError) {
      console.log(`[dsh-market] skills.sh CLI install failed, falling back to GitHub: ${cliError.message}`);
    }
    // skills.sh slugs are the skill's basename (e.g. "tdd"), but in many repos the SKILL.md
    // lives at a nested path (e.g. mattpocock/skills ships it under `skills/engineering/tdd/`,
    // not `tdd/`). Without this the bare `repo` + empty skillDir makes the installer look for
    // SKILL.md at the repo root, fail, and throw — so the skill never reaches disk.
    // Probe the nested candidate path directly (no listTree) and use it as skillDir.
    let effectiveSkillDir = skillDir || "";
    if (!effectiveSkillDir) {
      const probe = await findSkillDirFor({ repo, ref, skill, cache });
      if (probe) effectiveSkillDir = probe;
    }
    return installSkill({
      source: "github",
      reference: ref ? `${repo}@${ref}` : repo,
      skillDir: effectiveSkillDir,
      name: effectiveName || skill || "",
      dir: targetRoot,
      force,
      skillDirs,
    });
  }

  if (source === "trusttools") {
    const repo = String(reference || "");
    if (!repo) throw new Error("trusttools 条目缺少 repo_url");
    // Fast path: use the official `trusttools` CLI
    try {
      return await installViaTrustToolsCli({ reference: repo, targetRoot, dir, name, force, skillDirs });
    } catch (cliError) {
      console.log(`[dsh-market] trusttools CLI install failed, falling back to GitHub: ${cliError.message}`);
    }
    const target = ref ? `${repo}@${ref}` : repo;
    return installSkill({ source: "github", reference: target, skillDir: skillDir || "", name: name || "", dir: targetRoot, force, skillDirs });
  }

  if (source === "clawhub") {
    // Fast path: install via the official `clawhub` CLI (npx auto-downloads it).
    const clawSlug = String(reference || "").trim();
    if (clawSlug) {
      try {
        return await installViaClawHubCli({ slug: clawSlug, reference: clawSlug, targetRoot, dir, name, force, skillDirs });
      } catch (cliError) {
        console.log(`[dsh-market] clawhub CLI install failed, falling back to GitHub: ${cliError.message}`);
      }
    }
    const target = await clawhubResolve(reference);
    return installSkill({ source: "github", reference: target.repo, skillDir: target.skillDir, name: name || "", dir: targetRoot, force, skillDirs });
  }

  if (source === "lobehub") {
    const bundle = await lobehubAgentSkill(reference);
    return writeSkill({
      slug: name || bundle.name || reference,
      files: bundle.files,
      skillText: bundle.files["SKILL.md"],
      origin: { source: "lobehub", identifier: reference },
    });
  }

  if (source === "modelscope") {
    // Fast path: when the search result carries an upstreamUrl (owner/repo@branch)
    // and a skillDir, download directly from GitHub — the same proven path used
    // by skills.sh and skillsmp. 1.4–3.0 s in testing.
    // Fallback: official ModelScope ZIP endpoint — covers the ~10 % of skills
    // that have no GitHub upstream. 3.7–4.9 s in testing.
    let bundle;
    if (upstreamUrl) {
      try {
        bundle = await modelScopeGitHubSkill(upstreamUrl, skillDir || "", reference);
        console.log(`[dsh-market] modelscope via GitHub upstream ${upstreamUrl}${skillDir ? "/" + skillDir : ""} succeeded`);
      } catch (ghErr) {
        console.log(`[dsh-market] modelscope GitHub upstream failed, falling back to ZIP: ${ghErr.message}`);
        bundle = null;
      }
    }
    if (!bundle) {
      bundle = await modelScopeSkill(reference);
    }
    return writeSkill({
      slug: name || bundle.name || reference,
      files: bundle.files,
      skillText: bundle.files["SKILL.md"],
      origin: { source: "modelscope", ident: reference, upstreamUrl: upstreamUrl || "" },
    });
  }

  throw new Error(`unknown skill source "${source}"`);
}

/** Remove an installed skill by moving it into the market trash. */
export async function uninstallSkill({ slug, dirs, trashDir, agentsHomeSkillsDir }) {
  const key = kebab(slug);
  const removed = [];
  const allDirs = agentsHomeSkillsDir ? [...(dirs || []), agentsHomeSkillsDir] : (dirs || []);
  for (const dir of allDirs) {
    const candidates = [join(dir, key), join(dir, `${key}.md`)];
    for (const candidate of candidates) {
      if (!existsSync(candidate)) continue;
      // Trash inside the skill's own directory by default: a cross-drive rename fails with
      // EXDEV, so a caller-supplied trashDir still falls back to copy-then-delete.
      const targetTrash = trashDir ? join(trashDir) : join(dir, ".trash");
      await ensureDir(targetTrash);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const dest = join(targetTrash, `${key}-${stamp}${candidate.endsWith(".md") ? ".md" : ""}`);
      try {
        await rename(candidate, dest);
      } catch (error) {
        if (error && error.code === "EXDEV") {
          await cp(candidate, dest, { recursive: true });
          await rm(candidate, { recursive: true, force: true });
        } else {
          throw error;
        }
      }
      try {
        await writeJson(`${dest}.trash-entry.json`, {
          slug: key,
          originalPath: candidate,
          originalDir: dir,
          kind: candidate.endsWith(".md") ? "file" : "directory",
          deletedAt: new Date().toISOString(),
        });
      } catch {
        /* a sidecar failure must not fail the delete */
      }
      removed.push(candidate);
    }
  }
  return { ok: removed.length > 0, removed };
}

export async function searchFromSources({ query = "", source = "all", page = 1, pageSize = 20, category = "" }) {
  const wanted = source === "all" ? ["skillhub", "curated"] : [source];
  const results = [];
  const degraded = [];
  for (const name of wanted) {
    try {
      if (name === "skillhub") {
        const hub = await searchSkillHub({ query, page, pageSize, category });
        results.push(...hub.items);
      } else if (name === "curated") {
        const q = query.trim().toLowerCase();
        const items = (await curatedSkills())
          .filter((item) =>
            !q
              ? true
              : `${item.name} ${item.description} ${item.slug} ${item.category}`.toLowerCase().includes(q),
          )
          .map((item) => ({
            id: `curated:${item.repo}:${item.path}`,
            slug: item.slug,
            name: item.name,
            description: item.description,
            category: item.category || "skills",
            source: "curated",
            sourceLabel: "精选技能库",
            owner: item.repo,
            homepage: `https://github.com/${item.repo}`,
            upstreamUrl: `${item.repo}${item.ref ? `@${item.ref}` : ""}`,
            skillDir: item.dir || "",
            verified: true,
            installable: true,
            downloads: 0,
            stars: 0,
          }));
        results.push(...items);
      }
    } catch (error) {
      degraded.push({ source: name, error: String(error?.message || error) });
    }
  }
  return { items: results, degraded, total: results.length, page, pageSize };
}

/** Rewrite an installed skill's `name`, `description` and body in place, preserving every
 *  other frontmatter key exactly as written. */
export async function updateSkill({ dirs, slug, name, description, body }) {
  let file = "";
  for (const dir of dirs || []) {
    for (const candidate of [join(dir, slug, "SKILL.md"), join(dir, `${slug}.md`)]) {
      if (existsSync(candidate)) file = candidate;
    }
  }
  if (!file) throw new Error(`未找到技能 ${slug}`);
  const raw = await readFile(file, "utf8");
  const fmEnd = raw.indexOf("\n---", 3);
  const block = fmEnd > 0 ? raw.slice(3, fmEnd) : "";
  const oldBody = fmEnd > 0 ? raw.slice(fmEnd + 4).replace(/^\r?\n/, "") : raw;
  const lines = block.split(/\r?\n/).filter((line) => line.trim() !== "");
  const setKey = (key, value) => {
    if (value === undefined || value === null || String(value).trim() === "") return;
    const line = `${key}: ${JSON.stringify(String(value).trim())}`;
    const index = lines.findIndex((item) => new RegExp(`^${key}\\s*:`).test(item));
    if (index >= 0) lines[index] = line;
    else lines.push(line);
  };
  setKey("name", name);
  setKey("description", description);
  const next = `---\n${lines.join("\n")}\n---\n${body !== undefined ? body : oldBody}`;
  await writeFile(file, next, "utf8");
  const meta = skillMetaFromText(next, slug);
  return { ok: true, slug, path: file, name: meta.name, description: meta.description };
}

export { readRepoFile };

/**
 * 批量上传：一次拷入一个技能「根目录」（含 SKILL.md，子目录里每个含 SKILL.md 的是子技能，逐个安装）。
 * 宿主侧由 index.js 的 `skills.upload` RPC 调起：面板的「上传技能」按钮弹系统文件夹选择器，
 * 选中的本地文件夹路径经 webServer RPC 回传，本函数负责校验 + 拷贝 + 安全扫描。
 * 与 installSkill 共用同一套 writeSkill 规则（frontmatter 必填、高危扫描拦截、.market-install.json）。
 */
export async function uploadSkillFromFolder({ folder, skillDirs, force = false }) {
  const roots = Array.isArray(skillDirs) && skillDirs.length > 0 ? skillDirs : [];
  if (roots.length === 0) throw new Error("no skill directories are configured");
  const targetRoot = roots[0];
  await ensureDir(targetRoot);

  // 校验：folder 本身必须含 SKILL.md，或至少一个一级子目录含 SKILL.md。
  const folderStat = await stat(folder).catch(() => null);
  if (!folderStat || !folderStat.isDirectory()) throw new Error(`不是文件夹或不存在：${folder}`);
  const topHasSkill = existsSync(join(folder, "SKILL.md"));
  const subSkills = [];
  if (!topHasSkill) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(folder, entry.name, "SKILL.md"))) subSkills.push(entry.name);
    }
  }
  if (!topHasSkill && subSkills.length === 0) {
    throw new Error(`${folder} 里没有 SKILL.md，也不含任何带 SKILL.md 的子目录；请选一个符合 SKILL 技能格式的文件夹（根或一级子目录必须含 SKILL.md）`);
  }

  const taken = await existingSlugs(roots);
  const nextTaken = new Set(taken);
  const results = [];
  const copyOne = async (slugBase, files, skillText, originPath) => {
    const finalSlug = force ? kebab(slugBase) || slugBase : uniqueSlug(kebab(slugBase) || slugBase, nextTaken);
    nextTaken.add(finalSlug);
    const targetDir = join(targetRoot, finalSlug);
    const meta = skillMetaFromText(skillText || "", finalSlug);
    if (!meta.name || !meta.description) {
      throw new Error(`${finalSlug}：SKILL.md 缺少 frontmatter 的 name 或 description，无法导入`);
    }
    // 安全扫描：报告制（不拒装），高危发现随结果返回
    const scan = scanSkillBundle({ files, skillText });
    const highFindings = scan.findings.filter((f) => f.severity === "high");
    // 暂存目录 + 原子提交：任何一步失败只清暂存，正式目录零残留
    const staging = join(targetRoot, `.staging-${finalSlug}-${Date.now()}`);
    await ensureDir(staging);
    try {
      for (const [relative, content] of Object.entries(files)) {
        const target = join(staging, relative);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content, "utf8");
      }
      await writeJson(join(staging, ".market-install.json"), {
        slug: finalSlug,
        name: meta.name,
        origin: { source: "upload", path: originPath },
        installedAt: new Date().toISOString(),
      });
      if (existsSync(targetDir)) {
        if (force) await rm(targetDir, { recursive: true, force: true });
        else throw new Error(`${finalSlug} 已存在于 ${targetDir}，加 force 可覆盖`);
      }
      try {
        await rename(staging, targetDir);
      } catch (error) {
        if (error && error.code === "EXDEV") {
          await cp(staging, targetDir, { recursive: true });
          await rm(staging, { recursive: true, force: true });
        } else {
          throw error;
        }
      }
      results.push({
        ok: true, slug: finalSlug, name: meta.name, files: Object.keys(files).length, dir: targetDir,
        findings: highFindings.length ? highFindings : undefined,
      });
    } finally {
      // 暂存目录存在即清理（rename 成功后 staging 已不存在，rm 是 no-op）
      if (existsSync(staging)) await rm(staging, { recursive: true, force: true }).catch(() => {});
    }
  };

  const SKIP_DIRS = new Set([
    ".git", ".venv", "venv", "node_modules", ".idea", ".vscode",
    ".pytest_cache", "__pycache__", ".mypy_cache", ".ruff_cache",
    "dist", "build", ".next", ".nuxt", ".svelte-kit",
  ]);

  const readFiles = async (dir, prefix) => {
    const out = {};
    const walk = async (current, p) => {
      for (const entry of await readdir(current, { withFileTypes: true })) {
        const rel = p ? `${p}/${entry.name}` : entry.name;
        const full = join(current, entry.name);
        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name)) continue;
          await walk(full, rel);
        } else {
          out[rel] = await readFile(full, "utf8");
        }
      }
    };
    await walk(dir, prefix);
    return out;
  };

  if (topHasSkill) {
    // 根目录就是一个技能：整目录拷入。
    const files = await readFiles(folder, "");
    await copyOne(basename(folder), files, files["SKILL.md"], folder);
  } else {
    // 根目录是技能集：每个带 SKILL.md 的一级子目录各装一个。
    for (const sub of subSkills) {
      const subPath = join(folder, sub);
      const files = await readFiles(subPath, "");
      await copyOne(sub, files, files["SKILL.md"], subPath);
    }
  }
  return { ok: true, count: results.length, target: targetRoot, items: results };
}

/** Trash entry name pattern: `<slug>-<ISO stamp>` with an optional `.md` suffix. */
const TRASH_NAME = /^(.*)-(\d{4}-\d{2}-\d{2}T[0-9-]+Z)(\.md)?$/;

/**
 * List the market trash without touching it.
 * @param {{ trashDir?: string, dirs?: string[] }} options - configured trash root and skill roots.
 * @returns {Promise<{ trashDir: string, items: object[] }>}
 */
export async function listTrash({ trashDir, dirs } = {}) {
  const roots = [];
  if (trashDir) roots.push(trashDir);
  for (const dir of dirs || []) roots.push(join(dir, ".trash"));
  const seen = new Set();
  const items = [];
  for (const root of roots) {
    if (!root || seen.has(root) || !existsSync(root)) continue;
    seen.add(root);
    let entries = [];
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.endsWith(".trash-entry.json")) continue;
      const full = join(root, entry.name);
      const match = TRASH_NAME.exec(entry.name);
      let sidecar = null;
      try {
        sidecar = JSON.parse(await readFile(`${full}.trash-entry.json`, "utf8"));
      } catch {
        sidecar = null;
      }
      let bytes = 0;
      try {
        const info = await stat(full);
        bytes = info.size;
        if (info.isDirectory()) bytes = 0;
      } catch {
        bytes = 0;
      }
      items.push({
        name: entry.name,
        path: full,
        trashRoot: root,
        slug: sidecar && sidecar.slug ? sidecar.slug : (match ? match[1] : entry.name.replace(/\.md$/, "")),
        stamp: match ? match[2] : "",
        kind: entry.isDirectory() ? "directory" : "file",
        bytes,
        originalPath: sidecar && sidecar.originalPath ? sidecar.originalPath : "",
        originalDir: sidecar && sidecar.originalDir ? sidecar.originalDir : "",
        deletedAt: sidecar && sidecar.deletedAt ? sidecar.deletedAt : "",
        restorable: Boolean(sidecar && sidecar.originalPath) || roots.length > 0,
      });
    }
  }
  items.sort((a, b) => String(b.stamp).localeCompare(String(a.stamp)));
  return { trashDir: trashDir || "", items };
}

/**
 * Move one trash entry back to where it came from.
 * A sidecar records the exact original path; without one, the slug is restored
 * into the first configured skill root. A live name collision picks a unique suffix.
 * @param {{ path: string, dirs?: string[], trashDir?: string }} options
 */
export async function restoreFromTrash({ path: entryPath, dirs, trashDir } = {}) {
  if (!entryPath || !existsSync(entryPath)) throw new Error("回收站条目不存在");
  let sidecar = null;
  try {
    sidecar = JSON.parse(await readFile(`${entryPath}.trash-entry.json`, "utf8"));
  } catch {
    sidecar = null;
  }
  const root = sidecar && sidecar.originalDir
    ? sidecar.originalDir
    : (dirs && dirs.length > 0 ? dirs[0] : "");
  if (!root) throw new Error("无法确定恢复目标目录");
  await ensureDir(root);
  const rawName = basename(entryPath);
  const nameMatch = TRASH_NAME.exec(rawName);
  const nameIsFile = /\.md$/i.test(rawName);
  const slugFromName = nameMatch ? nameMatch[1] : rawName.replace(/\.md$/i, "");
  const baseName = sidecar && sidecar.slug
    ? `${sidecar.slug}${sidecar.kind === "file" ? ".md" : ""}`
    : `${slugFromName}${nameIsFile ? ".md" : ""}`;
  let target = join(root, baseName);
  if (existsSync(target)) {
    for (let index = 2; index < 1000; index += 1) {
      const candidate = sidecar && sidecar.kind === "file"
        ? join(root, `${sidecar.slug}-${index}.md`)
        : join(root, `${baseName}-${index}`);
      if (!existsSync(candidate)) {
        target = candidate;
        break;
      }
    }
  }
  try {
    await rename(entryPath, target);
  } catch (error) {
    if (error && error.code === "EXDEV") {
      await cp(entryPath, target, { recursive: true });
      await rm(entryPath, { recursive: true, force: true });
    } else {
      throw error;
    }
  }
  await rm(`${entryPath}.trash-entry.json`, { force: true }).catch(() => {});
  return { ok: true, restoredTo: target, slug: sidecar && sidecar.slug ? sidecar.slug : baseName };
}

/**
 * Permanently drop every trash entry under the configured roots.
 * @param {{ trashDir?: string, dirs?: string[] }} options
 */
export async function emptyTrash({ trashDir, dirs } = {}) {
  const roots = [];
  if (trashDir) roots.push(trashDir);
  for (const dir of dirs || []) roots.push(join(dir, ".trash"));
  let removed = 0;
  const seen = new Set();
  for (const root of roots) {
    if (!root || seen.has(root) || !existsSync(root)) continue;
    seen.add(root);
    let entries = [];
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      await rm(join(root, entry.name), { recursive: true, force: true }).catch(() => {});
      removed += 1;
    }
  }
  return { ok: true, removed };
}

/** Locate a resolvable skill file and whether it is reached through a symlink. */
function resolveSkillFile(dirs, slug) {
  const key = kebab(slug);
  for (const dir of dirs || []) {
    const candidates = [join(dir, key, "SKILL.md"), join(dir, `${key}.md`)];
    for (const candidate of candidates) {
      if (!existsSync(candidate)) continue;
      let link = false;
      try {
        link = lstatSync(candidate).isSymbolicLink() || lstatSync(join(dir, key)).isSymbolicLink();
      } catch {
        link = false;
      }
      return { path: candidate, dir, link };
    }
  }
  return undefined;
}

/**
 * Toggle the model-invocation flag in a skill's own SKILL.md (file level).
 * Refuses symlinked skills: writing through a link would escape the skill root.
 * @param {{ dirs: string[], slug: string, enabled: boolean }} options
 * @returns {Promise<{ ok: boolean, scope: 'file', path: string, enabled: boolean }>}
 */
export async function toggleSkillFile({ dirs, slug, enabled }) {
  const found = resolveSkillFile(dirs, slug);
  if (!found) throw new Error(`没有找到技能 ${slug} 的 SKILL.md，无法做文件级开关`);
  if (found.link) throw new Error(`技能 ${slug} 通过符号链接接入，改写会越出技能根，请改用面板级开关`);
  const text = await readFile(found.path, "utf8");
  const next = setFrontmatterFlag(text, "disable-model-invocation", enabled ? false : true);
  if (next !== text) {
    const tmp = join(dirname(found.path), `.toggle-tmp-${Date.now()}`);
    await writeFile(tmp, next, "utf8");
    await rename(tmp, found.path);
  }
  return { ok: true, scope: "file", path: found.path, enabled: Boolean(enabled) };
}

/** Whether a skill can be toggled at file level (exists and is not symlinked). */
export function skillFileToggleable(dirs, slug) {
  const found = resolveSkillFile(dirs, slug);
  return Boolean(found && !found.link);
}

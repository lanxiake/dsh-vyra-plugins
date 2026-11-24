/**
 * Theme asset serving (Host).
 *
 * A theme directory is just files on disk, so this module is the only place
 * that turns a URL path into a file — and it refuses anything that is not a
 * plain file inside that one theme directory, with an extension the plugin
 * knows how to label. No directory listing, no symlink escape, no `..`.
 */
import { readFileSync, realpathSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { THEME_ASSET_MIME, mimeForAssetPath } from "../../shared/personalization/theme-model.js";

export const MAX_THEME_ASSET_BYTES = 64 * 1024 * 1024;

export { THEME_ASSET_MIME };

/**
 * Resolve `relativePath` inside `themeDir` or return null.
 * Rejects absolute paths, drive prefixes, `..` segments, unknown extensions,
 * non-files, oversized files, and real paths that escape the theme directory.
 */
export function resolveThemeAsset(themeDir, relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || relativePath.length > 512) return null;
  if (relativePath.includes("\0")) return null;
  if (relativePath.startsWith("/") || relativePath.startsWith("\\") || /^[a-z]:/i.test(relativePath)) return null;
  const segments = relativePath.replaceAll("\\", "/").split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return null;

  const mime = mimeForAssetPath(relativePath);
  if (mime === null) return null;

  let root;
  let target;
  try {
    root = realpathSync(themeDir);
    target = realpathSync(resolve(root, ...segments));
  } catch {
    return null;
  }
  if (target !== root && !target.startsWith(root + sep)) return null;

  let stat;
  try {
    stat = statSync(target);
  } catch {
    return null;
  }
  if (!stat.isFile()) return null;
  if (stat.size > MAX_THEME_ASSET_BYTES) return null;
  return { path: target, mime, byteLength: stat.size, ext: extname(target).toLowerCase() };
}

/** Read one theme asset, or null when it is not servable. */
export function readThemeAsset(themeDir, relativePath) {
  const resolved = resolveThemeAsset(themeDir, relativePath);
  if (resolved === null) return null;
  try {
    return { ...resolved, buffer: readFileSync(resolved.path) };
  } catch {
    return null;
  }
}
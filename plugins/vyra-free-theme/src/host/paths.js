/**
 * Host path resolution for dsh-vyra-free-theme.
 *
 * Two rules decide everything here:
 *
 * 1. The new plugin owns new directory names (`dsh-vyra-free-theme`,
 *    `vyra-free-theme-desktop`). Nothing is ever written back to the
 *    directories used by the plugins this one replaces.
 *
 * 2. Legacy data is adopted EXACTLY ONCE, by copying — never by moving or
 *    modifying the source. A half-finished copy must never be mistaken for a
 *    valid store, so the copy is published with a same-parent directory
 *    rename: the staging directory either becomes the real directory in one
 *    atomic step or disappears.
 *
 * LEGACY_DIRS is the ONLY place in this package allowed to name the replaced
 * plugin's directories (tests/no-legacy-identity.test.mjs enforces that).
 */
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { cpSync, existsSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";

/** New store directory per profile. */
export const DATA_DIRS = {
  web: "dsh-vyra-free-theme",
  desktop: "vyra-free-theme-desktop",
};

/**
 * Read-only migration sources per profile, most specific first.
 * `dsh-skins` is second for Desktop because pre-1.5.4 Desktop stored its data
 * in the Web directory.
 */
export const LEGACY_DIRS = {
  web: ["dsh-skins"],
  desktop: ["dsh-skins-desktop", "dsh-skins"],
};

export function expandHomePath(path) {
  if (path === "~") return homedir();
  if (path.startsWith("~/") || path.startsWith("~\\")) return join(homedir(), path.slice(2));
  return path;
}

export function dshHome() {
  const configured = process.env.DSH_HOME?.trim();
  return resolve(expandHomePath(configured || join(homedir(), ".dsh")));
}

export function hostProfileFor(root, cwd = process.cwd()) {
  // dsh-desktop-host launches the Host with cwd = $DSH_HOME/profiles/desktop;
  // normal Web launchers do not. Never infer the profile from the mere
  // existence of a Desktop installation alongside this Web process.
  const normalized = (path) => (process.platform === "win32" ? resolve(path).toLowerCase() : resolve(path));
  return normalized(cwd) === normalized(join(expandHomePath(root), "profiles", "desktop")) ? "desktop" : "web";
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function migrationSource(home, legacyNames) {
  for (const name of legacyNames) {
    const candidate = join(home, name);
    if (isDirectory(candidate)) return candidate;
  }
  return null;
}

/**
 * Copy one legacy directory into `target` once. Returns `target` in every
 * case: an existing (or concurrently created) target always wins, so this is
 * safe to call on every startup.
 */
function adoptLegacyOnce(home, target, legacyNames) {
  if (existsSync(target)) return target;
  const legacy = migrationSource(home, legacyNames);
  if (legacy === null) return target;

  const stage = mkdtempSync(join(home, `.${basename(target)}-migrate-`));
  try {
    for (const name of readdirSync(legacy)) {
      cpSync(join(legacy, name), join(stage, name), { recursive: true, force: false, errorOnExist: true });
    }
    renameSync(stage, target);
  } catch (error) {
    // Another host process won the race and already published the copy.
    if (!existsSync(target)) throw error;
  } finally {
    if (dirname(resolve(stage)) !== resolve(home)) throw new Error("unsafe migration staging path");
    if (existsSync(stage)) rmSync(stage, { recursive: true, force: true });
  }
  return target;
}

/**
 * The store directory for one profile, adopting legacy data on first use.
 */
export function dataDirForProfile(root, profile = "web") {
  const home = resolve(expandHomePath(root));
  const key = Object.hasOwn(DATA_DIRS, profile) ? profile : "web";
  return adoptLegacyOnce(home, join(home, DATA_DIRS[key]), LEGACY_DIRS[key]);
}

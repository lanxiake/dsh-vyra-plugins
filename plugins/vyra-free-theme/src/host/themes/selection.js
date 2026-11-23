/**
 * Active-theme selection (Host).
 *
 * The selected skin used to live only in the browser's localStorage, which made
 * `vft theme apply` impossible: an agent (or a script, or a second browser) had
 * no way to change it. Selection is host state now — one small file — and the
 * client treats it as authoritative, writing back whenever the user switches.
 *
 * `?skin=` still wins for deep links, and localStorage stays as the pre-host
 * fallback so an older client keeps working.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export const SELECTION_FILE = "selection.json";
export const OFFICIAL_ID = "official";
const ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;

export function isSelectableId(id) {
  return id === OFFICIAL_ID || (typeof id === "string" && ID_PATTERN.test(id));
}

/** Read the stored selection, or null when none/invalid (never throws). */
export function readSelection(dataDir) {
  const file = join(dataDir, SELECTION_FILE);
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (parsed === null || typeof parsed !== "object") return null;
    if (!isSelectableId(parsed.skinId)) return null;
    return { skinId: parsed.skinId, updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null };
  } catch {
    return null;
  }
}

/** Atomically persist the selection. Returns the stored record. */
export function writeSelection(dataDir, skinId, { now = () => new Date().toISOString() } = {}) {
  if (!isSelectableId(skinId)) throw new Error(`invalid skin id "${skinId}"`);
  mkdirSync(dataDir, { recursive: true });
  const record = { skinId, updatedAt: now() };
  const target = join(dataDir, SELECTION_FILE);
  const stage = `${target}.tmp-${process.pid}`;
  writeFileSync(stage, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  renameSync(stage, target);
  return record;
}

export function clearSelection(dataDir) {
  const target = join(dataDir, SELECTION_FILE);
  if (existsSync(target)) unlinkSync(target);
}
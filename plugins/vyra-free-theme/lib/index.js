// src/index.js
import { readFileSync as readFileSync7 } from "node:fs";
import { dirname as dirname4, join as join7 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/host/personalization/store.js
import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync as mkdirSync2,
  openSync,
  readFileSync,
  readdirSync,
  renameSync as renameSync2,
  rmdirSync,
  statfsSync,
  statSync,
  unlinkSync,
  writeFileSync as writeFileSync2
} from "node:fs";
import { join } from "node:path";

// src/host/errors.js
function codedError(code, message, params) {
  const error = message instanceof Error ? message : new Error(message);
  error.code = code;
  if (params !== void 0) error.params = params;
  return error;
}
function publicError(error) {
  const value = {
    error: error instanceof Error ? error.message : String(error)
  };
  if (error !== null && error !== void 0 && error.code !== void 0) value.code = error.code;
  if (error !== null && error !== void 0 && error.params !== void 0) value.params = error.params;
  return value;
}

// src/host/atomic-write.js
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
function atomicWriteText(file, content, fs = { mkdirSync, writeFileSync, renameSync }) {
  fs.mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, content);
  fs.renameSync(temporary, file);
}

// src/host/personalization/image-meta.js
function ascii(buffer, offset, length) {
  return String.fromCharCode(...buffer.subarray(offset, offset + length));
}
function parsePng(buffer) {
  if (buffer.length < 24) return null;
  if (ascii(buffer, 0, 8) !== "PNG\r\n\n") return null;
  if (ascii(buffer, 12, 4) !== "IHDR") return null;
  if (buffer.readUInt32BE(8) !== 13) return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width === 0 || height === 0) return null;
  return { mime: "image/png", width, height, animated: false };
}
function parseGif(buffer) {
  if (buffer.length < 10) return null;
  const signature = ascii(buffer, 0, 6);
  if (signature !== "GIF87a" && signature !== "GIF89a") return null;
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  if (width === 0 || height === 0) return null;
  return { mime: "image/gif", width, height, animated: null };
}
var JPEG_SOF_MARKERS = /* @__PURE__ */ new Set([
  192,
  193,
  194,
  195,
  197,
  198,
  199,
  201,
  202,
  203,
  205,
  206,
  207
]);
function parseJpeg(buffer) {
  if (buffer.length < 4 || buffer[0] !== 255 || buffer[1] !== 216) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 255) return null;
    const marker = buffer[offset + 1];
    if (marker === 216 || marker === 1 || marker >= 208 && marker <= 215) {
      offset += 2;
      continue;
    }
    if (marker === 218 || marker === 217) return null;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if (JPEG_SOF_MARKERS.has(marker)) {
      const width = buffer.readUInt16BE(offset + 7);
      const height = buffer.readUInt16BE(offset + 5);
      if (width === 0 || height === 0) return null;
      return { mime: "image/jpeg", width, height, animated: false };
    }
    offset += 2 + length;
  }
  return null;
}
function parseWebp(buffer) {
  if (buffer.length < 30) return null;
  if (ascii(buffer, 0, 4) !== "RIFF" || ascii(buffer, 8, 4) !== "WEBP") return null;
  if (buffer.readUInt32LE(4) + 8 > buffer.length) return null;
  const chunk = ascii(buffer, 12, 4);
  const chunkSize = buffer.readUInt32LE(16);
  if (20 + chunkSize > buffer.length) return null;
  if (chunk === "VP8X") {
    const flags = buffer[20];
    const width = buffer.readUIntLE(24, 3) + 1;
    const height = buffer.readUIntLE(27, 3) + 1;
    return { mime: "image/webp", width, height, animated: (flags & 2) !== 0 };
  }
  if (chunk === "VP8 ") {
    if (ascii(buffer, 23, 3) !== "*") return null;
    const width = buffer.readUInt16LE(26) & 16383;
    const height = buffer.readUInt16LE(28) & 16383;
    if (width === 0 || height === 0) return null;
    return { mime: "image/webp", width, height, animated: false };
  }
  if (chunk === "VP8L") {
    if (buffer[20] !== 47) return null;
    const bits = buffer.readUInt32LE(21);
    const width = (bits & 16383) + 1;
    const height = (bits >> 14 & 16383) + 1;
    return { mime: "image/webp", width, height, animated: false };
  }
  return null;
}
function detectImageMeta(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 10) return null;
  return parsePng(buffer) ?? parseJpeg(buffer) ?? parseGif(buffer) ?? parseWebp(buffer);
}
function extensionForMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return null;
}

// src/shared/personalization/catalog.js
var CONFIG_VERSION = 1;
var GLOBAL_MAX_BYTES = 20 * 1024 * 1024;
var GLOBAL_MAX_PIXELS = 4e7;
var GIF_MAX_PIXELS = 12e6;
var ASSET_ID_PATTERN = /^u_[0-9a-f]{32}$/;
var ASSET_ID_PREFIX = "u_";
var BUILTIN_REF_PATTERN = /^builtin:([a-z0-9][a-z0-9-]*):([a-z0-9][a-z0-9-]*)$/;
var EXTERNAL_SKINS = /* @__PURE__ */ new Map();
function registerExternalSkin({ id, fields, builtinAssets = {} }) {
  if (typeof id !== "string" || !/^[a-z][a-z0-9-]{1,39}$/.test(id)) {
    throw new Error(`[vyra-free-theme] external skin id "${id}" is malformed`);
  }
  if (Object.hasOwn(SKINS, id)) {
    throw new Error(`[vyra-free-theme] external skin "${id}" collides with a compiled-in skin`);
  }
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error(`[vyra-free-theme] external skin "${id}" needs at least one field`);
  }
  EXTERNAL_SKINS.set(id, { id, fields, builtinAssets });
  return id;
}
function unregisterExternalSkin(id) {
  EXTERNAL_SKINS.delete(id);
}
function skinEntry(skinId) {
  return Object.hasOwn(SKINS, skinId) ? SKINS[skinId] : EXTERNAL_SKINS.get(skinId) ?? null;
}
var USER_IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
var WALLPAPER_FIELD = {
  key: "wallpaper",
  type: "image",
  scope: "single",
  labelKey: "personalization.wallpaper",
  default: null,
  // filled per skin below
  allowedUserMime: USER_IMAGE_MIMES,
  maxBytes: GLOBAL_MAX_BYTES,
  maxWidth: 16384,
  maxHeight: 16384,
  maxPixels: GLOBAL_MAX_PIXELS
};
var SKINS = {
  // ADR-0004 (reversing design §9a): every catalog skin declares the same
  // standard field set. Slogan defaults are single-sourced here (ADR-0014/B14)
  // — the factories carry no static copies. panelOpacity defaults are each
  // skin's 出厂锚 (GLOSSARY; 55/55/35 web, 66 desktop): they anchor the riding
  // rebase and blur hinge inside skins/translucency.js, and the byte-equality
  // at the anchor is pinned by tests/translucency-contract.test.mjs. Legacy
  // wallpaper semantics (scrim never applies to user images, placeholder
  // branch) live in the translucency projection kernel's wallpaper branches.
  // openbmc（出厂皮肤，v1.0.6 起注册顺序第一位，见 client/index.js）
  openbmc: {
    builtinAssets: { art: { mime: "image/webp", labelKey: "personalization.openbmc.art" } },
    fields: [
      { ...WALLPAPER_FIELD, default: "builtin:openbmc:art", builtinChoices: ["art"] },
      {
        key: "slogan",
        type: "text",
        scope: "locale",
        labelKey: "personalization.slogan",
        maxLength: 40,
        default: { zh: "察于未萌 · 治于未乱", en: "Govern before the storm" }
      },
      {
        key: "panelOpacity",
        type: "range",
        scope: "single",
        labelKey: "personalization.panelTranslucency",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        default: 55
      }
    ]
  },
  "uefi-harness": {
    builtinAssets: { art: { mime: "image/webp", labelKey: "personalization.uefi.art" } },
    fields: [
      { ...WALLPAPER_FIELD, default: "builtin:uefi-harness:art", builtinChoices: ["art"] },
      {
        key: "slogan",
        type: "text",
        scope: "locale",
        labelKey: "personalization.slogan",
        maxLength: 40,
        default: { zh: "启于固件 · 行于万象", en: "Boot before everything" }
      },
      {
        key: "panelOpacity",
        type: "range",
        scope: "single",
        labelKey: "personalization.panelTranslucency",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        default: 55
      }
    ]
  },
  // 美人志（v1.0.6 前的出厂皮肤，现注册顺序第三位）：6 张内置精选，出厂默认 yuntai
  // （001合照）领头并对齐已移除 tgcf 皮肤的「出厂默认领先」惯例；panelOpacity 锚定
  // 其二次曲线（projector 数学见 skins/meirenzhi/index.js）。
  meirenzhi: {
    builtinAssets: {
      yuntai: { mime: "image/webp", labelKey: "personalization.meirenzhi.yuntai" },
      mupeiling: { mime: "image/webp", labelKey: "personalization.meirenzhi.mupeiling" },
      ziling: { mime: "image/webp", labelKey: "personalization.meirenzhi.ziling" },
      nangongwan: { mime: "image/webp", labelKey: "personalization.meirenzhi.nangongwan" },
      nangongque: { mime: "image/webp", labelKey: "personalization.meirenzhi.nangongque" },
      yinyue: { mime: "image/webp", labelKey: "personalization.meirenzhi.yinyue" }
    },
    fields: [
      {
        ...WALLPAPER_FIELD,
        default: "builtin:meirenzhi:yuntai",
        builtinChoices: [
          "yuntai",
          "mupeiling",
          "ziling",
          "nangongwan",
          "nangongque",
          "yinyue"
        ]
      },
      {
        key: "slogan",
        type: "text",
        scope: "locale",
        labelKey: "personalization.slogan",
        maxLength: 40,
        default: { zh: "风起凡尘 · 红颜问道", en: "From mortal dust, immortals bloom" }
      },
      {
        key: "panelOpacity",
        type: "range",
        scope: "single",
        labelKey: "personalization.panelTranslucency",
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        default: 35
      }
    ]
  }
};
function getSkinSchema(skinId, profile = "web") {
  if (!Object.hasOwn(SKINS, skinId)) {
    const external = EXTERNAL_SKINS.get(skinId);
    if (external === void 0) return null;
    return { skinId, fields: external.fields, builtinAssets: external.builtinAssets };
  }
  const entry = SKINS[skinId];
  const fields = profile === "desktop" ? entry.fields.map((field) => field.key === "panelOpacity" ? { ...field, default: 66 } : field) : entry.fields;
  return { skinId, fields, builtinAssets: entry.builtinAssets };
}
function getField(skinId, key) {
  return skinEntry(skinId)?.fields.find((field) => field.key === key) ?? null;
}
function listAssetFields(skinId) {
  return skinEntry(skinId)?.fields.filter((field) => field.type === "image") ?? [];
}
function defaultsFor(skinId, profile = "web") {
  const values = {};
  for (const field of getSkinSchema(skinId, profile)?.fields ?? []) values[field.key] = field.default;
  return values;
}
function isSameOverrideValue(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) || Array.isArray(b)) {
    return false;
  }
  const keysA = Object.keys(a);
  return keysA.length === Object.keys(b).length && keysA.every((key) => Object.hasOwn(b, key) && isSameOverrideValue(a[key], b[key]));
}
function resolveImageRef(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  if (value.startsWith("builtin:")) {
    const match = BUILTIN_REF_PATTERN.exec(value);
    return match === null ? null : { kind: "builtin", skinId: match[1], assetKey: match[2] };
  }
  if (ASSET_ID_PATTERN.test(value)) return { kind: "user", id: value };
  return null;
}
var HEX_COLOR = /^#[0-9a-f]{6}$/i;
var CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
function scopeKeys(scope) {
  if (scope === "locale") return ["zh", "en"];
  if (scope === "colorScheme") return ["light", "dark"];
  return null;
}
function validScopeObject(value, scope, checkMember) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = scopeKeys(scope);
  if (Object.keys(value).length !== keys.length) return false;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
    if (!checkMember(value[key])) return false;
  }
  return true;
}
function validateTextMember(value, field) {
  if (typeof value !== "string") return false;
  if (CONTROL_CHARS.test(value)) return false;
  return value.length <= field.maxLength;
}
function validateRangeMember(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (value < field.min || value > field.max) return false;
  if (field.step !== void 0 && field.step > 0) {
    const steps = (value - field.min) / field.step;
    if (Math.abs(steps - Math.round(steps)) > 1e-9) return false;
  }
  return true;
}
function validateScalar(value, field) {
  switch (field.type) {
    case "text":
      return validateTextMember(value, field);
    case "range":
      return validateRangeMember(value, field);
    case "select":
      return typeof value === "string" && field.options.some((option) => option.value === value);
    default:
      return false;
  }
}
function validateImageRef(value, field, skinId, meta) {
  const ref = resolveImageRef(value);
  if (ref === null) return false;
  if (ref.kind === "builtin") {
    if (ref.skinId !== skinId) return false;
    return skinEntry(skinId)?.builtinAssets[ref.assetKey] !== void 0;
  }
  if (meta === void 0 || meta === null) return true;
  return metaSatisfiesField(field, meta);
}
function metaSatisfiesField(field, meta) {
  if (typeof meta.mime !== "string" || !field.allowedUserMime.includes(meta.mime)) return false;
  if (meta.byteLength > field.maxBytes) return false;
  if (meta.width > field.maxWidth || meta.height > field.maxHeight) return false;
  const maxPixels = meta.mime === "image/gif" ? Math.min(field.maxPixels, GIF_MAX_PIXELS) : field.maxPixels;
  return meta.width * meta.height <= maxPixels;
}
function validateOverride(skinId, key, value, metaProvider) {
  const field = getField(skinId, key);
  if (field === null) return { ok: false, code: "UNKNOWN_FIELD" };
  const provider = typeof metaProvider === "function" ? metaProvider : void 0;
  if (field.scope === "single") {
    if (field.type === "image") {
      const ref = resolveImageRef(value);
      if (ref === null) return { ok: false, code: "BAD_SHAPE" };
      if (ref.kind === "builtin") {
        if (!validateImageRef(value, field, skinId, void 0)) return { ok: false, code: "BAD_ASSET" };
        return { ok: true };
      }
      if (provider !== void 0) {
        const meta = provider(ref.id);
        if (meta === null) return { ok: false, code: "MISSING_ASSET" };
        if (!validateImageRef(value, field, skinId, meta)) return { ok: false, code: "BAD_ASSET" };
      }
      return { ok: true };
    }
    if (!validateScalar(value, field)) return { ok: false, code: "BAD_VALUE" };
    return { ok: true };
  }
  if (!validScopeObject(value, field.scope, (member) => {
    if (field.type === "text") return validateTextMember(member, field);
    if (field.type === "range") return validateRangeMember(member, field);
    if (field.type === "color") return typeof member === "string" && HEX_COLOR.test(member);
    return false;
  })) return { ok: false, code: "BAD_SHAPE" };
  return { ok: true };
}

// src/host/personalization/store.js
var STATE_FILE = "state.json";
var ASSETS_DIR = "assets";
var QUARANTINE_DIR = "quarantine";
var DISK_SAFETY_RESERVE = 64 * 1024 * 1024;
var CORRUPT_BACKUP_LIMIT = 3;
var ID_ATTEMPTS = 5;
var AUDIT_FILE = "audit.jsonl";
var AUDIT_MAX_BYTES = 1048576;
function summarizeAuditValue(value) {
  if (value === void 0) return null;
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return resolveImageRef(value) !== null ? value : { string: value.length };
  return { object: Object.keys(value).length };
}
function defaultFs() {
  return {
    appendFileSync,
    existsSync,
    mkdirSync: mkdirSync2,
    readFileSync,
    writeFileSync: writeFileSync2,
    renameSync: renameSync2,
    unlinkSync,
    readdirSync,
    rmdirSync,
    statSync,
    statfsSync,
    copyFileSync,
    openSync,
    closeSync
  };
}
function sha256Hex(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}
function sanitizeDisplayName(name2) {
  if (typeof name2 !== "string") return null;
  const cleaned = name2.replace(/[\u0000-\u001f\u007f]/g, "");
  if (cleaned.trim().length === 0) return null;
  if (Buffer.byteLength(cleaned, "utf8") > 200) return null;
  return cleaned;
}
function isValidStateShape(state) {
  if (state === null || typeof state !== "object" || Array.isArray(state)) return false;
  if (!Number.isInteger(state.configVersion) || state.configVersion < 1) return false;
  if (!Number.isInteger(state.revision) || state.revision < 0) return false;
  if (typeof state.skins !== "object" || state.skins === null || Array.isArray(state.skins)) return false;
  if (typeof state.library !== "object" || state.library === null || Array.isArray(state.library)) return false;
  if (state.recoveryCleanup !== void 0) {
    const pending = state.recoveryCleanup;
    if (pending === null || typeof pending !== "object" || Array.isArray(pending) || !Array.isArray(pending.quarantine) || !pending.quarantine.every((name2) => typeof name2 === "string")) return false;
  }
  return true;
}
var ASSET_EXTENSIONS = /* @__PURE__ */ new Set(["png", "jpg", "webp", "gif"]);
function isValidAssetMeta(meta, id) {
  if (meta === null || typeof meta !== "object" || Array.isArray(meta)) return false;
  if (typeof meta.id !== "string" || meta.id !== id || !ASSET_ID_PATTERN.test(id)) return false;
  if (typeof meta.displayName !== "string") return false;
  if (typeof meta.mime !== "string" || !/^(image\/(png|jpeg|webp|gif))$/.test(meta.mime)) return false;
  if (typeof meta.extension !== "string" || !ASSET_EXTENSIONS.has(meta.extension)) return false;
  if (meta.extension !== extensionForMime(meta.mime)) return false;
  if (!Number.isInteger(meta.byteLength) || meta.byteLength <= 0 || meta.byteLength > GLOBAL_MAX_BYTES) return false;
  if (!Number.isInteger(meta.width) || meta.width <= 0) return false;
  if (!Number.isInteger(meta.height) || meta.height <= 0) return false;
  const pixelCap = meta.mime === "image/gif" ? GIF_MAX_PIXELS : GLOBAL_MAX_PIXELS;
  if (meta.width * meta.height > pixelCap) return false;
  if (typeof meta.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(meta.sha256)) return false;
  return typeof meta.createdAt === "string";
}
function isValidStateDeep(state) {
  if (!isValidStateShape(state)) return false;
  for (const [id, meta] of Object.entries(state.library)) {
    if (!isValidAssetMeta(meta, id)) return false;
  }
  for (const section of Object.values(state.skins)) {
    if (section === null || typeof section !== "object" || Array.isArray(section)) return false;
  }
  return true;
}
function emptyState() {
  return { configVersion: CONFIG_VERSION, revision: 0, skins: {}, library: {} };
}
function createPersonalizationStore(options = {}) {
  const dataDir = options.dataDir;
  if (typeof dataDir !== "string" || dataDir.length === 0) {
    throw new Error("personalization store requires a dataDir");
  }
  const fs = options.fs ?? defaultFs();
  const now = options.now ?? Date.now;
  const profile = options.profile === "desktop" ? "desktop" : "web";
  const stateFile = join(dataDir, STATE_FILE);
  const assetsDir = join(dataDir, ASSETS_DIR);
  const quarantineDir = join(dataDir, QUARANTINE_DIR);
  const auditFile = join(dataDir, AUDIT_FILE);
  const auditMaxBytes = Number.isInteger(options.auditMaxBytes) && options.auditMaxBytes > 0 ? options.auditMaxBytes : AUDIT_MAX_BYTES;
  let state = null;
  let mode = "normal";
  let recovery = null;
  let chain = Promise.resolve();
  let initialized = false;
  function ensureDirs() {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  function readStateFile() {
    if (!fs.existsSync(stateFile)) return { kind: "missing" };
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    } catch {
      return { kind: "corrupt" };
    }
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) && Number.isInteger(parsed.configVersion) && parsed.configVersion > CONFIG_VERSION) {
      return { kind: "future", state: parsed };
    }
    if (!isValidStateShape(parsed)) return { kind: "corrupt" };
    return { kind: "ok", state: parsed };
  }
  function listAssetFiles() {
    if (!fs.existsSync(assetsDir)) return [];
    return fs.readdirSync(assetsDir).filter((name2) => !name2.startsWith("."));
  }
  function blobFileFor(id, extension) {
    return join(assetsDir, `${id}.${extension}`);
  }
  function commitState(next, { source, previous = state, ops } = {}) {
    atomicWriteText(stateFile, `${JSON.stringify(next, null, 2)}
`, fs);
    state = next;
    recordAudit(previous, next, source ?? "unknown", ops);
  }
  function recordAudit(previous, next, source, ops) {
    try {
      const skins = [];
      const skinIds = /* @__PURE__ */ new Set([...Object.keys(previous?.skins ?? {}), ...Object.keys(next.skins ?? {})]);
      for (const skinId of skinIds) {
        const before = previous?.skins?.[skinId] ?? {};
        const after = next.skins?.[skinId] ?? {};
        for (const key of /* @__PURE__ */ new Set([...Object.keys(before), ...Object.keys(after)])) {
          if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
          skins.push({ skin: skinId, key, from: summarizeAuditValue(before[key]), to: summarizeAuditValue(after[key]) });
        }
      }
      const libraryBefore = new Set(Object.keys(previous?.library ?? {}));
      const libraryAfter = new Set(Object.keys(next.library ?? {}));
      const entry = {
        ts: new Date(now()).toISOString(),
        profile,
        source,
        revision: next.revision,
        prevRevision: previous?.revision ?? null,
        ...ops === void 0 ? {} : { ops },
        skins,
        libraryAdded: [...libraryAfter].filter((id) => !libraryBefore.has(id)),
        libraryRemoved: [...libraryBefore].filter((id) => !libraryAfter.has(id))
      };
      rotateAuditIfNeeded();
      fs.appendFileSync(auditFile, `${JSON.stringify(entry)}
`);
    } catch {
    }
  }
  function rotateAuditIfNeeded() {
    try {
      if (fs.statSync(auditFile).size >= auditMaxBytes) fs.renameSync(auditFile, `${auditFile}.1`);
    } catch {
    }
  }
  function enqueue(work) {
    const run = chain.then(work);
    chain = run.then(() => void 0, () => void 0);
    return run;
  }
  function sniffBlobFile(name2) {
    const file = join(assetsDir, name2);
    let buffer;
    try {
      buffer = fs.readFileSync(file);
    } catch {
      return { name: name2, kind: "unreadable" };
    }
    const meta = detectImageMeta(buffer);
    if (meta === null) return { name: name2, kind: "unrecognized" };
    const id = name2.split(".")[0];
    if (!ASSET_ID_PATTERN.test(id)) return { name: name2, kind: "unrecognized" };
    const extension = extensionForMime(meta.mime);
    if (name2 !== `${id}.${extension}`) return { name: name2, kind: "unrecognized" };
    return {
      name: name2,
      kind: "asset",
      meta: {
        id,
        displayName: name2,
        mime: meta.mime,
        extension,
        byteLength: buffer.length,
        width: meta.width,
        height: meta.height,
        sha256: sha256Hex(buffer),
        createdAt: new Date(now()).toISOString()
      }
    };
  }
  function init() {
    if (initialized) return;
    try {
      initOnce();
    } catch (error) {
      initialized = false;
      state = null;
      throw error;
    }
  }
  function initOnce() {
    initialized = true;
    const read = readStateFile();
    if (read.kind === "future" || read.kind === "ok" && read.state.configVersion > CONFIG_VERSION) {
      mode = "unsupported";
      state = read.state;
      return;
    }
    ensureDirs();
    const assetFiles = listAssetFiles();
    if (read.kind === "missing" && assetFiles.length === 0) {
      commitState(emptyState(), { source: "install", previous: null });
      mode = "normal";
      gcNow();
      return;
    }
    if (read.kind === "missing" || read.kind === "corrupt" || !isValidStateDeep(read.state)) {
      const candidateLibrary = {};
      const quarantine = [];
      for (const scanned of assetFiles.map(sniffBlobFile)) {
        if (scanned.kind === "asset") candidateLibrary[scanned.meta.id] = scanned.meta;
        else quarantine.push(scanned.name);
      }
      mode = "recovery";
      recovery = { candidateLibrary, quarantine, configLost: true };
      state = emptyState();
      return;
    }
    mode = "normal";
    state = read.state;
    if (state.recoveryCleanup !== void 0) {
      finishRecoveryCleanup();
    }
    normalizeState();
    gcNow();
  }
  function normalizeState() {
    const previous = structuredClone(state);
    const provider = metaProviderFactory(state.library);
    let removed = false;
    for (const skinId of Object.keys(state.skins)) {
      if (getSkinSchema(skinId) === null) {
        delete state.skins[skinId];
        removed = true;
        continue;
      }
      const section = state.skins[skinId];
      const defaults = defaultsFor(skinId, profile);
      for (const key of Object.keys(section)) {
        if (!validateOverride(skinId, key, section[key], provider).ok) {
          delete section[key];
          removed = true;
          continue;
        }
        if (isSameOverrideValue(section[key], defaults[key])) {
          delete section[key];
          removed = true;
        }
      }
      if (Object.keys(section).length === 0) {
        delete state.skins[skinId];
        removed = true;
      }
    }
    if (removed) {
      state.revision += 1;
      commitState(state, { source: "normalize", previous });
    }
  }
  function gcNow() {
    if (mode !== "normal" || state?.recoveryCleanup !== void 0) return;
    const live = new Set(Object.keys(state.library));
    for (const name2 of listAssetFiles()) {
      const id = name2.split(".")[0];
      if (!live.has(id)) {
        try {
          fs.unlinkSync(join(assetsDir, name2));
        } catch {
        }
      }
    }
  }
  function requireNormal(operation) {
    if (mode === "unsupported") {
      throw codedError("STORE_READONLY", `配置状态为更高版本（configVersion>${CONFIG_VERSION}），${operation}被拒绝`);
    }
    if (mode === "recovery") {
      throw codedError("STORE_RECOVERY_REQUIRED", `配置状态待恢复，${operation}被拒绝`);
    }
  }
  function metaProviderFactory(library) {
    return (id) => library[id] ?? null;
  }
  function referencesFor(skins, library) {
    const references = {};
    for (const id of Object.keys(library)) references[id] = [];
    for (const [skinId, section] of Object.entries(skins)) {
      for (const field of listAssetFields(skinId)) {
        const value = section?.[field.key];
        if (typeof value === "string" && references[value] !== void 0) {
          references[value].push({ skinId, key: field.key });
        }
      }
    }
    return references;
  }
  function snapshot() {
    init();
    const library = state.library ?? {};
    const skins = state.skins ?? {};
    const base = {
      configVersion: state.configVersion,
      revision: state.revision,
      skins,
      library: Object.values(library),
      mode,
      quota: {
        count: Object.keys(library).length,
        totalBytes: Object.values(library).reduce((sum, meta) => sum + (meta?.byteLength ?? 0), 0)
      }
    };
    if (mode === "normal") base.references = referencesFor(skins, library);
    if (mode === "recovery") base.recovery = recovery;
    return base;
  }
  function applyGalleryDelete(draft, id, affectedSkins) {
    const meta = draft.library[id];
    for (const [skinId, section] of Object.entries(draft.skins)) {
      for (const field of listAssetFields(skinId)) {
        if (section?.[field.key] === id) {
          delete section[field.key];
          affectedSkins.push({ skinId, key: field.key });
        }
      }
      if (Object.keys(section).length === 0) delete draft.skins[skinId];
    }
    delete draft.library[id];
    return meta;
  }
  async function applyOperations({ baseRevision, operations }) {
    init();
    requireNormal("配置写入");
    return enqueue(() => {
      if (!Number.isInteger(baseRevision) || baseRevision < 0 || baseRevision !== state.revision) {
        throw codedError("REVISION_CONFLICT", "配置已被其他会话修改（修订号过期），请刷新后重试");
      }
      if (!Array.isArray(operations) || operations.length === 0 || operations.length > 64) {
        throw codedError("INVALID_CONFIG", "operations 必须是 1–64 个元素的数组");
      }
      const issues = [];
      for (let index = 0; index < operations.length; index += 1) {
        const operation = operations[index];
        if (operation === null || typeof operation !== "object") {
          issues.push({ opIndex: index, code: "INVALID_OP" });
          continue;
        }
        const { op, skinId, key } = operation;
        if (op === "set" || op === "delete") {
          if (getField(skinId, key) === null) {
            issues.push({ opIndex: index, skinId, key, code: "UNKNOWN_FIELD" });
          }
        } else if (op === "deleteAsset") {
          const assetId = operation.assetId;
          if (typeof assetId !== "string" || !ASSET_ID_PATTERN.test(assetId)) {
            issues.push({ opIndex: index, assetId, code: "INVALID_ASSET_ID" });
          } else if (state.library[assetId] === void 0) {
            issues.push({ opIndex: index, assetId, code: "ASSET_NOT_FOUND" });
          }
        } else if (op !== "clearLibrary") {
          issues.push({ opIndex: index, code: "INVALID_OP" });
        }
      }
      const draft = structuredClone(state);
      const provider = metaProviderFactory(draft.library);
      for (let index = 0; index < operations.length; index += 1) {
        const operation = operations[index];
        if (operation?.op !== "set") continue;
        const verdict = validateOverride(operation.skinId, operation.key, operation.value, provider);
        if (!verdict.ok) {
          issues.push({ opIndex: index, skinId: operation.skinId, key: operation.key, code: verdict.code });
        }
      }
      if (issues.length > 0) {
        issues.sort((a, b) => a.opIndex - b.opIndex);
        throw codedError("INVALID_CONFIG", `operations 校验失败（${issues[0].code}）`, {
          code: issues[0].code,
          // retained for old readers (ADR-0015 Q&A R1-8)
          issues
        });
      }
      const affectedSkins = [];
      const removedAssets = [];
      let galleryOps = false;
      const hasFieldOps = operations.some((operation) => operation?.op === "set" || operation?.op === "delete");
      for (const operation of operations) {
        const { op, skinId, key } = operation;
        if (op === "set" || op === "delete") {
          draft.skins[skinId] = draft.skins[skinId] ?? {};
          if (op === "set") draft.skins[skinId][key] = operation.value;
          else delete draft.skins[skinId][key];
        } else if (op === "deleteAsset") {
          galleryOps = true;
          const meta = applyGalleryDelete(draft, operation.assetId, affectedSkins);
          if (meta !== void 0) removedAssets.push(meta);
        } else if (op === "clearLibrary") {
          galleryOps = true;
          for (const id of Object.keys(draft.library)) {
            const meta = applyGalleryDelete(draft, id, affectedSkins);
            if (meta !== void 0) removedAssets.push(meta);
          }
        }
      }
      if (galleryOps && !hasFieldOps && removedAssets.length === 0) {
        return { revision: state.revision, affectedSkins };
      }
      if (galleryOps) {
        const finalProvider = metaProviderFactory(draft.library);
        for (const [skinId, section] of Object.entries(draft.skins)) {
          for (const field of listAssetFields(skinId)) {
            const value = section?.[field.key];
            if (value === void 0) continue;
            const verdict = validateOverride(skinId, field.key, value, finalProvider);
            if (!verdict.ok) {
              throw codedError("INVALID_CONFIG", `终态校验失败：${skinId}.${field.key} 引用已删除资产`, {
                code: verdict.code,
                issues: [{ skinId, key: field.key, code: verdict.code }]
              });
            }
          }
        }
      }
      draft.revision += 1;
      commitState(draft, { source: "operations", ops: [...new Set(operations.map((operation) => operation?.op))] });
      for (const meta of removedAssets) {
        try {
          fs.unlinkSync(blobFileFor(meta.id, meta.extension));
        } catch {
        }
      }
      gcNow();
      const result = { revision: draft.revision };
      if (galleryOps) result.affectedSkins = affectedSkins;
      return result;
    });
  }
  function ingestAssetMeta(buffer, { declaredMime } = {}) {
    const meta = detectImageMeta(buffer);
    if (meta === null) throw codedError("UNSUPPORTED_IMAGE", "无法识别的图片格式");
    if (meta.animated === true) throw codedError("ANIMATION_UNSUPPORTED", "动画 WebP 暂不支持");
    if (typeof declaredMime === "string" && declaredMime !== "" && declaredMime !== meta.mime) {
      throw codedError("UNSUPPORTED_IMAGE", `声明的 ${declaredMime} 与实际内容 ${meta.mime} 不符`);
    }
    if (buffer.length > GLOBAL_MAX_BYTES) {
      throw codedError("UPLOAD_TOO_LARGE", "图片超过 20MB 上限");
    }
    const pixelCap = meta.mime === "image/gif" ? GIF_MAX_PIXELS : GLOBAL_MAX_PIXELS;
    if (meta.width * meta.height > pixelCap) {
      throw codedError("UPLOAD_TOO_LARGE", `图片像素超过上限（${meta.mime === "image/gif" ? "12" : "40"}MP）`);
    }
    return meta;
  }
  function checkDiskSpace(incomingBytes) {
    if (typeof fs.statfsSync !== "function") return;
    try {
      const stats = fs.statfsSync(dataDir);
      const required = BigInt(incomingBytes) * 3n + BigInt(DISK_SAFETY_RESERVE);
      if (BigInt(stats.bsize) * BigInt(stats.bavail) < required) {
        throw codedError("DISK_FULL", "磁盘剩余空间不足，拒绝写入");
      }
    } catch (error) {
      if (error?.code === "DISK_FULL") throw error;
    }
  }
  function writeBlobExclusive(buffer, extension) {
    for (let attempt = 0; attempt < ID_ATTEMPTS; attempt += 1) {
      const id = ASSET_ID_PREFIX + randomUUID().replaceAll("-", "");
      const target = blobFileFor(id, extension);
      let descriptor;
      try {
        descriptor = fs.openSync(target, "wx");
      } catch (error) {
        if (error?.code === "EEXIST") continue;
        throw error;
      }
      try {
        fs.writeFileSync(descriptor, buffer);
        return { id, target };
      } finally {
        try {
          fs.closeSync(descriptor);
        } catch {
        }
      }
    }
    throw codedError("STORE_WRITE_FAILED", "无法分配新的资产 id（连续碰撞）");
  }
  async function uploadAsset(buffer, { displayName, declaredMime }) {
    init();
    requireNormal("图片上传");
    const meta = ingestAssetMeta(buffer, { declaredMime });
    const name2 = sanitizeDisplayName(displayName);
    if (name2 === null) throw codedError("FILENAME_INVALID", "文件展示名无效");
    return enqueue(() => {
      checkDiskSpace(buffer.length);
      const extension = extensionForMime(meta.mime);
      const { id, target } = writeBlobExclusive(buffer, extension);
      const asset = {
        id,
        displayName: name2,
        mime: meta.mime,
        extension,
        byteLength: buffer.length,
        width: meta.width,
        height: meta.height,
        sha256: sha256Hex(buffer),
        createdAt: new Date(now()).toISOString()
      };
      const draft = structuredClone(state);
      draft.library[id] = asset;
      draft.revision += 1;
      try {
        commitState(draft, { source: "upload" });
      } catch (error) {
        try {
          fs.unlinkSync(target);
        } catch {
        }
        throw error;
      }
      return { asset, revision: draft.revision };
    });
  }
  async function deleteAsset(id) {
    init();
    requireNormal("图片删除");
    if (typeof id !== "string" || !ASSET_ID_PATTERN.test(id)) {
      throw codedError("INVALID_ASSET_ID", "非法的图片 id");
    }
    return enqueue(() => {
      if (state.library[id] === void 0) throw codedError("ASSET_NOT_FOUND", "图片不存在");
      const draft = structuredClone(state);
      const affectedSkins = [];
      const meta = applyGalleryDelete(draft, id, affectedSkins);
      draft.revision += 1;
      commitState(draft, { source: "delete" });
      try {
        fs.unlinkSync(blobFileFor(meta.id, meta.extension));
      } catch {
      }
      gcNow();
      return { revision: draft.revision, affectedSkins };
    });
  }
  function serveAsset(url) {
    init();
    const path = String(url ?? "").split("?")[0];
    const match = /\/vyra-free-theme\/assets\/([^/]+)$/.exec(path);
    if (match === null) return null;
    const name2 = match[1];
    if (!/^u_[0-9a-f]{32}\.(png|jpe?g|webp|gif)$/.test(name2)) return null;
    const id = name2.split(".")[0];
    const meta = (state.library ?? {})[id];
    if (meta === void 0) return null;
    if (name2 !== `${id}.${meta.extension}`) return null;
    try {
      return { buffer: fs.readFileSync(blobFileFor(id, meta.extension)), meta };
    } catch {
      return null;
    }
  }
  async function confirmRecovery() {
    init();
    if (mode !== "recovery") throw codedError("STORE_NOT_RECOVERING", "当前不在恢复模式");
    return enqueue(() => {
      try {
        if (fs.existsSync(stateFile) && typeof fs.copyFileSync === "function") {
          try {
            fs.copyFileSync(stateFile, `${stateFile}.corrupt.${now()}.json`);
            pruneCorruptBackups();
          } catch {
          }
        }
      } catch {
      }
      const draft = emptyState();
      draft.library = recovery.candidateLibrary;
      draft.revision = 1;
      draft.recoveryCleanup = { quarantine: [...recovery.quarantine] };
      commitState(draft, { source: "recovery-confirm" });
      finishRecoveryCleanup();
      mode = "normal";
      recovery = null;
      gcNow();
      return { revision: draft.revision };
    });
  }
  function finishRecoveryCleanup() {
    const pending = state.recoveryCleanup;
    if (pending === void 0) return;
    fs.mkdirSync(quarantineDir, { recursive: true });
    for (const name2 of pending.quarantine) {
      try {
        fs.renameSync(join(assetsDir, name2), join(quarantineDir, name2));
      } catch {
      }
    }
    const cleaned = structuredClone(state);
    delete cleaned.recoveryCleanup;
    commitState(cleaned, { source: "recovery-cleanup" });
  }
  function pruneCorruptBackups() {
    const dir = join(dataDir);
    if (!fs.existsSync(dir)) return;
    const backups = fs.readdirSync(dir).filter((name2) => name2.startsWith(`${STATE_FILE}.corrupt.`)).sort();
    while (backups.length > CORRUPT_BACKUP_LIMIT) {
      try {
        fs.unlinkSync(join(dir, backups.shift()));
      } catch {
      }
    }
  }
  return {
    init,
    snapshot,
    applyOperations,
    uploadAsset,
    deleteAsset,
    serveAsset,
    confirmRecovery,
    getMode: () => {
      init();
      return mode;
    }
  };
}

// src/host/personalization-routes.js
function parseAuthority(authority) {
  try {
    return new URL(`http://${authority}`);
  } catch {
    return void 0;
  }
}
function canonicalAuthority(entry, parsed) {
  const port = parsed.port !== "" ? parsed.port : new URL(`https://${entry}`).port;
  return port === "" ? parsed.hostname : `${parsed.hostname}:${port}`;
}
function isLoopbackHostname(hostname) {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  const parts = hostname.split(".");
  return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
function isTrustedAuthority(hostUrl, trustedHosts) {
  return trustedHosts.some((entry) => {
    const parsed = parseAuthority(entry);
    if (parsed === void 0) return false;
    return canonicalAuthority(entry, parsed) === parsed.hostname ? parsed.hostname === hostUrl.hostname : parsed.host === hostUrl.host;
  });
}
function isTrustedRequest(request, trustedHosts = []) {
  const host = header(request.headers, "host");
  if (host === void 0) return false;
  const hostUrl = parseAuthority(host);
  if (hostUrl === void 0) return false;
  const socketAddress = request.socket?.remoteAddress ?? request.info?.remoteAddress;
  if (isLoopbackHostname(hostUrl.hostname)) {
    if (typeof socketAddress === "string") {
      const loopbackPeer = socketAddress === "127.0.0.1" || socketAddress === "::1" || socketAddress === "::ffff:127.0.0.1";
      if (!loopbackPeer) return false;
    }
  } else if (!isTrustedAuthority(hostUrl, trustedHosts)) {
    return false;
  }
  if (header(request.headers, "sec-fetch-site") === "cross-site") return false;
  const origin = header(request.headers, "origin");
  if (origin === void 0) return true;
  try {
    return new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}
var CODE_STATUS = {
  INVALID_CONFIG: 400,
  INVALID_ASSET_ID: 400,
  FILENAME_INVALID: 400,
  ASSET_NOT_FOUND: 404,
  UNKNOWN_SKIN: 404,
  UNSUPPORTED_IMAGE: 415,
  ANIMATION_UNSUPPORTED: 415,
  UPLOAD_TOO_LARGE: 413,
  DISK_FULL: 507,
  STORE_READONLY: 409,
  REVISION_CONFLICT: 409,
  STORE_RECOVERY_REQUIRED: 409,
  STORE_NOT_RECOVERING: 409
};
function sendJson(response, status, value, extraHeaders = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders
  });
  response.end(JSON.stringify(value));
}
function sendError(response, error) {
  const status = CODE_STATUS[error?.code] ?? 500;
  sendJson(response, status, publicError(error));
}
function header(headers, name2) {
  const value = headers?.[name2];
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] : void 0;
}
function method(request, response, expected) {
  if (request.method === expected) return true;
  response.writeHead(405, { allow: expected });
  response.end();
  return false;
}
async function readJsonBody(request, limit = 128 * 1024) {
  const type = String(request.headers["content-type"] ?? "").toLowerCase();
  if (!type.startsWith("application/json")) throw codedError("INVALID_CONFIG", "content-type must be application/json");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw codedError("INVALID_CONFIG", "request body too large");
    chunks.push(buffer);
  }
  if (size === 0) return {};
  let value;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw codedError("INVALID_CONFIG", "请求体不是合法 JSON");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw codedError("INVALID_CONFIG", "invalid request body");
  }
  return value;
}
async function readRawBody(request, limit, overflowCode = "UPLOAD_TOO_LARGE") {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw codedError(overflowCode, "request body too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}
function decodeDisplayName(request) {
  const raw = header(request.headers, "x-filename");
  if (raw === void 0 || raw === "") return "wallpaper";
  try {
    return decodeURIComponent(raw);
  } catch {
    throw codedError("FILENAME_INVALID", "x-filename 不是合法的 encodeURIComponent 输出");
  }
}
function createOfficialRejection(ctx) {
  return (request) => {
    let connection, reject;
    try {
      connection = ctx?.get?.("connection");
      reject = connection?.requestRejection;
    } catch {
      return void 0;
    }
    if (typeof reject !== "function") return void 0;
    try {
      return reject.call(connection, { headers: request.headers }) ?? void 0;
    } catch {
      return 403;
    }
  };
}
function mountPersonalizationRoutes(host, options) {
  const { store, assetsBasePath = "/vyra-free-theme/assets", trustedHosts = [], rejection, serveBuiltinAsset, themes, themeAssets, selection } = options;
  const disposers = [];
  const fence = (request, response) => {
    if (rejection !== void 0 && rejection(request) !== void 0) {
      sendJson(response, 403, { error: "trusted DSH Web request required" });
      return false;
    }
    if (isTrustedRequest(request, typeof trustedHosts === "function" ? trustedHosts() : trustedHosts)) return true;
    sendJson(response, 403, { error: "trusted DSH Web request required" });
    return false;
  };
  try {
    const configRoute = host.webServer.register({
      kind: "exact",
      path: "/vyra-free-theme/config",
      handler: async (request, response) => {
        if (!fence(request, response)) return;
        if (request.method === "GET") return sendJson(response, 200, store.snapshot());
        if (!method(request, response, "PATCH")) return;
        try {
          const body = await readJsonBody(request);
          const result = await store.applyOperations(body);
          return sendJson(response, 200, result);
        } catch (error) {
          return sendError(response, error);
        }
      }
    });
    disposers.push(configRoute);
    if (typeof themes === "function") {
      const themesRoute = host.webServer.register({
        kind: "exact",
        path: "/vyra-free-theme/themes",
        handler: async (request, response) => {
          if (!fence(request, response)) return;
          if (!method(request, response, "GET")) return;
          try {
            return sendJson(response, 200, themes());
          } catch (error) {
            return sendError(response, error);
          }
        }
      });
      disposers.push(themesRoute);
    }
    if (typeof themeAssets === "function") {
      const themeAssetRoute = host.webServer.register({
        kind: "prefix",
        path: "/vyra-free-theme/theme",
        handler: async (request, response) => {
          if (!fence(request, response)) return;
          if (!method(request, response, "GET")) return;
          const path = String(request.url ?? "").split("?")[0];
          const match = /^\/vyra-free-theme\/theme\/([a-z][a-z0-9-]{1,39})\/(.+)$/.exec(path);
          if (match === null) {
            return sendJson(response, 400, { error: "invalid theme asset path", code: "INVALID_THEME_ASSET" });
          }
          const [, themeId, relativePath] = match;
          let asset;
          try {
            asset = themeAssets(themeId, decodeURIComponent(relativePath));
          } catch {
            asset = null;
          }
          if (asset === null || asset === void 0) {
            return sendJson(response, 404, { error: "theme asset not found", code: "THEME_ASSET_NOT_FOUND" });
          }
          response.writeHead(200, {
            "content-type": asset.mime,
            "content-length": asset.byteLength,
            "cache-control": "private, max-age=300",
            "x-content-type-options": "nosniff",
            "cross-origin-resource-policy": "same-origin"
          });
          response.end(asset.buffer);
        }
      });
      disposers.push(themeAssetRoute);
    }
    if (typeof selection === "function") {
      const selectionRoute = host.webServer.register({
        kind: "exact",
        path: "/vyra-free-theme/selection",
        handler: async (request, response) => {
          if (!fence(request, response)) return;
          if (method(request, response, "GET")) {
            const record = selection().read();
            return sendJson(response, 200, { skinId: record?.skinId ?? null, updatedAt: record?.updatedAt ?? null });
          }
          if (!method(request, response, "POST")) return;
          let body;
          try {
            body = await readJsonBody(request, 4 * 1024);
          } catch {
            return sendJson(response, 400, { error: "invalid body", code: "INVALID_BODY" });
          }
          const skinId = body?.skinId;
          if (typeof skinId !== "string" || !/^(official|[a-z][a-z0-9-]{1,39})$/.test(skinId)) {
            return sendJson(response, 400, { error: "invalid skin id", code: "INVALID_SKIN_ID" });
          }
          try {
            return sendJson(response, 200, selection().write(skinId));
          } catch (error) {
            return sendError(response, error);
          }
        }
      });
      disposers.push(selectionRoute);
    }
    const recoveryRoute = host.webServer.register({
      kind: "exact",
      path: "/vyra-free-theme/recovery",
      handler: async (request, response) => {
        if (!fence(request, response)) return;
        if (!method(request, response, "POST")) return;
        try {
          return sendJson(response, 200, await store.confirmRecovery());
        } catch (error) {
          return sendError(response, error);
        }
      }
    });
    disposers.push(recoveryRoute);
    const libraryRoute = host.webServer.register({
      kind: "exact",
      path: "/vyra-free-theme/library",
      handler: async (request, response) => {
        if (!fence(request, response)) return;
        if (request.method === "GET") return sendJson(response, 200, store.snapshot());
        if (!method(request, response, "POST")) return;
        try {
          const declaredLength = Number(header(request.headers, "content-length") ?? "0");
          if (declaredLength > GLOBAL_MAX_BYTES) throw codedError("UPLOAD_TOO_LARGE", "图片超过 20MB 上限");
          const buffer = await readRawBody(request, GLOBAL_MAX_BYTES + 1024);
          const displayName = decodeDisplayName(request);
          const declaredMime = header(request.headers, "content-type");
          const result = await store.uploadAsset(buffer, { displayName, declaredMime });
          return sendJson(response, 201, result);
        } catch (error) {
          return sendError(response, error);
        }
      }
    });
    disposers.push(libraryRoute);
    const libraryDeleteRoute = host.webServer.register({
      kind: "prefix",
      path: "/vyra-free-theme/library",
      handler: async (request, response) => {
        if (!fence(request, response)) return;
        if (!method(request, response, "DELETE")) return;
        const path = String(request.url ?? "").split("?")[0];
        const match = /\/vyra-free-theme\/library\/([^/]+)$/.exec(path);
        const suffix = match?.[1] ?? "";
        if (!ASSET_ID_PATTERN.test(suffix)) {
          return sendJson(response, 400, { error: "invalid asset id", code: "INVALID_ASSET_ID" });
        }
        try {
          return sendJson(response, 200, await store.deleteAsset(suffix));
        } catch (error) {
          return sendError(response, error);
        }
      }
    });
    disposers.push(libraryDeleteRoute);
    const assetsRoute = host.webServer.register({
      kind: "prefix",
      path: assetsBasePath,
      handler: async (request, response) => {
        if (!fence(request, response)) return;
        if (!method(request, response, "GET")) return;
        try {
          const requestUrl = String(request.url ?? "");
          const blob = store.serveAsset(requestUrl) ?? serveBuiltinAsset?.(requestUrl) ?? null;
          if (blob === null) {
            return sendJson(response, 404, { error: "asset not found", code: "ASSET_NOT_FOUND" });
          }
          response.writeHead(200, {
            "content-type": blob.meta.mime,
            "content-length": blob.meta.byteLength,
            "cache-control": "private, max-age=31536000, immutable",
            etag: `"${blob.meta.sha256}"`,
            "x-content-type-options": "nosniff",
            "cross-origin-resource-policy": "same-origin"
          });
          response.end(blob.buffer);
        } catch (error) {
          return sendError(response, error);
        }
      }
    });
    disposers.push(assetsRoute);
  } catch (error) {
    for (let index = disposers.length - 1; index >= 0; index -= 1) {
      try {
        disposers[index]();
      } catch {
      }
    }
    throw error;
  }
  return () => {
    for (const dispose of disposers) dispose();
  };
}

// src/host/builtin-assets.js
import { readFileSync as readFileSync2 } from "node:fs";
import { join as join2 } from "node:path";
var BUILTIN_FILE_PATTERN = /^b_([a-z0-9][a-z0-9-]*)_([a-z0-9][a-z0-9-]*)\.webp$/;
var ASSETS_PREFIX_PATTERN = /\/vyra-free-theme\/assets\/([^/]+)$/;
function createBuiltinAssetServer({ assetsDir, manifest }) {
  const byName = /* @__PURE__ */ new Map();
  for (const entry of manifest?.entries ?? []) {
    const name2 = `b_${entry.skinId}_${entry.assetKey}.webp`;
    if (BUILTIN_FILE_PATTERN.test(name2)) byName.set(name2, entry);
  }
  return {
    serveBuiltinAsset(url) {
      if (typeof url !== "string") return null;
      const prefixMatch = ASSETS_PREFIX_PATTERN.exec(url.split("?")[0]);
      if (prefixMatch === null) return null;
      const entry = byName.get(prefixMatch[1]);
      if (entry === void 0) return null;
      if (entry.file.split("/").pop() !== prefixMatch[1]) return null;
      try {
        const buffer = readFileSync2(join2(assetsDir, entry.file));
        return { buffer, meta: { mime: entry.mime, byteLength: buffer.length, sha256: entry.sha256 } };
      } catch {
        return null;
      }
    }
  };
}

// src/host/trusted-hosts.js
function resolveTrustedHosts(ctx) {
  let startup, runtime;
  try {
    startup = ctx?.get?.("webStartup");
  } catch {
  }
  try {
    runtime = ctx?.get?.("webRuntime");
  } catch {
  }
  return startup?.trustedHosts ?? runtime?.trustedHosts ?? [];
}

// src/host/themes/repository.js
import { existsSync as existsSync2, readFileSync as readFileSync3, readdirSync as readdirSync2 } from "node:fs";
import { join as join3 } from "node:path";

// src/shared/personalization/sidebar-presets.js
var SIDEBAR_PACKS = Object.freeze({
  // Same tone as the rest of the theme: only radius/icon/states get touched.
  inherit: { surface: "inherit", blur: 0, density: "cozy", radius: { card: 14, item: 8 } },
  // Translucent panel floating over the wallpaper.
  frost: { surface: "frost", blur: 14, density: "cozy", radius: { card: 16, item: 10 } },
  // Paper-like: transparent fill, hairline separators.
  hairline: { surface: "wallpaper", blur: 0, density: "compact", radius: { card: 0, item: 0 } },
  // Deep solid card with a bright accent.
  obsidian: { surface: "solid", blur: 0, density: "comfortable", radius: { card: 14, item: 10 } },
  // Dark translucent with glowing edges.
  neon: { surface: "frost", blur: 18, density: "cozy", radius: { card: 16, item: 12 } }
});
var SIDEBAR_SURFACES = ["inherit", "solid", "frost", "wallpaper", "custom"];
var SIDEBAR_DENSITIES = ["compact", "cozy", "comfortable"];

// src/shared/personalization/theme-model.js
var THEME_SCHEMA_VERSION = 1;
var TRANSLUCENT_TOKENS = [
  "--dsw-alias-bg-base",
  "--dsw-alias-bg-layer-1",
  "--dsw-alias-bg-layer-2",
  "--dsw-alias-bg-layer-3",
  "--dsw-alias-bg-module-platform",
  "--dsw-specific-sidebar-fill"
];
var COVERAGE_SCOPES = ["sidebar", "topbar", "rightpanel"];
var ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
var TOKEN_PATTERN = /^--[a-z0-9-]+$/;
var HEX_PATTERN = /^#[0-9a-f]{6}$/i;
var CONTROL_CHARS2 = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
var KNOWN_KEYS = /* @__PURE__ */ new Set([
  "schema",
  "id",
  "name",
  "author",
  "version",
  "brand",
  "colors",
  "shape",
  "translucency",
  "wallpaper",
  "coverage",
  "sidebar",
  "decorations"
]);
var TEXT_MAX = 64;
var NAME_MAX = 60;
var SLOGAN_MAX = 40;
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function boundedText(value, max) {
  return typeof value === "string" && value.length > 0 && value.length <= max && !CONTROL_CHARS2.test(value);
}
function validLocalePair(value, max) {
  return isPlainObject(value) && Object.keys(value).length === 2 && boundedText(value.zh, max) && boundedText(value.en, max);
}
function validColorPair(value) {
  return isPlainObject(value) && Object.keys(value).length === 2 && boundedText(value.light, TEXT_MAX) && boundedText(value.dark, TEXT_MAX);
}
function parsePercent(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : null;
}
function normalizeTheme(raw) {
  const issues = [];
  const fail = (code, path, message) => issues.push({ code, path, message });
  if (!isPlainObject(raw)) {
    fail("bad-shape", "", "theme.json 必须是一个对象");
    return { ok: false, issues };
  }
  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) fail("unknown-key", key, `未知字段 "${key}"（schema v1 不接受）`);
  }
  if (raw.schema !== THEME_SCHEMA_VERSION) {
    fail("schema-version", "schema", `schema 必须是 ${THEME_SCHEMA_VERSION}`);
  }
  const id = raw.id;
  if (typeof id !== "string" || !ID_PATTERN.test(id)) {
    fail("bad-id", "id", "id 必须是 2–40 位小写字母/数字/连字符，以字母开头");
  }
  if (!validLocalePair(raw.name, NAME_MAX)) {
    fail("bad-name", "name", "name 必须是 { zh, en } 两个非空字符串（各 ≤60 字）");
  }
  if (!isPlainObject(raw.colors)) {
    fail("bad-colors", "colors", "colors 必须是 { light, dark }");
  } else {
    for (const mode of ["light", "dark"]) {
      const table = raw.colors[mode];
      if (!isPlainObject(table) || Object.keys(table).length === 0) {
        fail("bad-colors", `colors.${mode}`, `${mode} 至少需要一个令牌`);
        continue;
      }
      for (const [token, value] of Object.entries(table)) {
        if (!TOKEN_PATTERN.test(token)) fail("bad-token", `colors.${mode}.${token}`, `非法令牌名 "${token}"`);
        if (!boundedText(value, TEXT_MAX)) {
          fail("bad-token-value", `colors.${mode}.${token}`, "令牌值必须是非空字符串（≤64 字）");
        } else if (TRANSLUCENT_TOKENS.includes(token) && !HEX_PATTERN.test(value)) {
          fail("bad-translucent-color", `colors.${mode}.${token}`, "随动令牌必须是 #RRGGBB，才能按通透度换算 alpha");
        }
      }
    }
    const lightKeys = Object.keys(raw.colors.light ?? {}).sort();
    const darkKeys = Object.keys(raw.colors.dark ?? {}).sort();
    if (lightKeys.join() !== darkKeys.join()) {
      fail("color-token-mismatch", "colors", "light 与 dark 必须声明完全相同的令牌集合");
    }
    if (!isPlainObject(raw.colors.light) || !HEX_PATTERN.test(raw.colors.light["--dsw-alias-bg-base"] ?? "")) {
      fail("missing-bg-base", "colors.light.--dsw-alias-bg-base", "必须声明 #RRGGBB 形式的 --dsw-alias-bg-base");
    }
  }
  if (raw.shape !== void 0) {
    if (!isPlainObject(raw.shape)) fail("bad-shape", "shape", "shape 必须是对象");
    else {
      for (const [token, value] of Object.entries(raw.shape)) {
        if (!TOKEN_PATTERN.test(token)) fail("bad-token", `shape.${token}`, `非法令牌名 "${token}"`);
        if (!boundedText(value, TEXT_MAX)) fail("bad-token-value", `shape.${token}`, "令牌值必须是非空字符串");
      }
    }
  }
  let translucency = { web: 55, desktop: 66, baked: {} };
  if (raw.translucency !== void 0) {
    if (!isPlainObject(raw.translucency)) {
      fail("bad-translucency", "translucency", "translucency 必须是对象");
    } else {
      for (const key of Object.keys(raw.translucency)) {
        if (!["web", "desktop", "baked"].includes(key)) {
          fail("unknown-key", `translucency.${key}`, `未知字段 "${key}"`);
        }
      }
      for (const mode of ["web", "desktop"]) {
        if (raw.translucency[mode] === void 0) continue;
        const value = parsePercent(raw.translucency[mode]);
        if (value === null) fail("bad-translucency", `translucency.${mode}`, "必须是 0–100 的数字");
        else translucency[mode] = value;
      }
      if (raw.translucency.baked !== void 0) {
        if (!isPlainObject(raw.translucency.baked)) {
          fail("bad-translucency", "translucency.baked", "baked 必须是 { 令牌: 0–100 }");
        } else {
          for (const [token, value] of Object.entries(raw.translucency.baked)) {
            if (!TRANSLUCENT_TOKENS.includes(token)) {
              fail("bad-translucency", `translucency.baked.${token}`, "只有随动令牌可以声明 baked");
            }
            const points = parsePercent(value);
            if (points === null) fail("bad-translucency", `translucency.baked.${token}`, "必须是 0–100 的数字");
            else translucency.baked[token] = points;
          }
        }
      }
    }
  }
  let brand = { title: null, mark: null, favicon: null, slogans: { zh: "", en: "" } };
  if (raw.brand !== void 0) {
    if (!isPlainObject(raw.brand)) fail("bad-brand", "brand", "brand 必须是对象");
    else {
      for (const key of Object.keys(raw.brand)) {
        if (!["title", "mark", "favicon", "slogans"].includes(key)) {
          fail("unknown-key", `brand.${key}`, `未知字段 "${key}"`);
        }
      }
      if (raw.brand.title !== void 0) {
        if (!validLocalePair(raw.brand.title, NAME_MAX)) fail("bad-brand", "brand.title", "title 必须是 { zh, en }");
        else brand.title = { zh: raw.brand.title.zh, en: raw.brand.title.en };
      }
      if (raw.brand.mark !== void 0 && raw.brand.mark !== null) {
        if (!boundedText(raw.brand.mark, 256)) fail("bad-brand", "brand.mark", "mark 必须是路径或内联 SVG 字符串");
        else brand.mark = raw.brand.mark;
      }
      if (raw.brand.favicon !== void 0 && raw.brand.favicon !== null) {
        const favicon = raw.brand.favicon;
        if (!isPlainObject(favicon) || !boundedText(favicon.href, 2048) || !boundedText(favicon.mime, 64)) {
          fail("bad-brand", "brand.favicon", "favicon 必须是 { href, mime }");
        } else brand.favicon = { href: favicon.href, mime: favicon.mime };
      }
      if (raw.brand.slogans !== void 0) {
        if (!validLocalePair(raw.brand.slogans, SLOGAN_MAX)) {
          fail("bad-brand", "brand.slogans", "slogans 必须是 { zh, en }（各 ≤40 字）");
        } else brand.slogans = { zh: raw.brand.slogans.zh, en: raw.brand.slogans.en };
      }
    }
  }
  let wallpaper = null;
  if (raw.wallpaper !== void 0 && raw.wallpaper !== null) {
    if (!isPlainObject(raw.wallpaper)) fail("bad-wallpaper", "wallpaper", "wallpaper 必须是对象");
    else if (!["image", "video", "animated", "code"].includes(raw.wallpaper.kind)) {
      fail("unsupported-wallpaper-kind", "wallpaper.kind", "kind 必须是 image / video / animated / code");
    } else if (raw.wallpaper.kind === "code") {
      if (!boundedText(raw.wallpaper.entry, 256) || mimeForAssetPath(raw.wallpaper.entry) !== THEME_ASSET_MIME[".js"]) {
        fail("bad-wallpaper", "wallpaper.entry", "代码壁纸必须声明一个 theme 内的 .js 入口");
      } else {
        wallpaper = { kind: "code", entry: raw.wallpaper.entry };
      }
    } else if (raw.wallpaper.kind === "video") {
      wallpaper = { kind: "video", light: raw.wallpaper.light ?? null, dark: raw.wallpaper.dark ?? null };
      if (wallpaper.light === null && wallpaper.dark === null) {
        fail("bad-wallpaper", "wallpaper", "至少需要 light 或 dark 一侧");
      }
      for (const mode of ["light", "dark"]) {
        const side = wallpaper[mode];
        if (side === null) continue;
        if (!isPlainObject(side) || !boundedText(side.src, 256)) {
          fail("bad-wallpaper", `wallpaper.${mode}`, "每一侧必须是 { src, poster?, overlay?, blur? }");
          continue;
        }
        const mime = mimeForAssetPath(side.src);
        if (mime !== "video/mp4" && mime !== "video/webm") {
          fail("bad-wallpaper", `wallpaper.${mode}.src`, "视频壁纸必须是 .mp4 或 .webm");
        }
        if (side.poster !== void 0 && side.poster !== null) {
          const posterMime = mimeForAssetPath(side.poster);
          if (!boundedText(side.poster, 256) || posterMime === null || !posterMime.startsWith("image/")) {
            fail("bad-wallpaper", `wallpaper.${mode}.poster`, "poster 必须是 theme 内的图片路径");
          }
        }
      }
    } else {
      wallpaper = { kind: raw.wallpaper.kind, light: raw.wallpaper.light ?? null, dark: raw.wallpaper.dark ?? null };
      if (wallpaper.light === null && wallpaper.dark === null) {
        fail("bad-wallpaper", "wallpaper", "至少需要 light 或 dark 一侧");
      }
      for (const mode of ["light", "dark"]) {
        const side = wallpaper[mode];
        if (side === null) continue;
        if (!isPlainObject(side) || !boundedText(side.src, 256)) {
          fail("bad-wallpaper", `wallpaper.${mode}`, "每一侧必须是 { src, poster?, overlay?, blur? }");
          continue;
        }
        const mime = mimeForAssetPath(side.src);
        const allowed = raw.wallpaper.kind === "animated" ? ["image/gif", "image/webp"] : Object.values(THEME_ASSET_MIME).filter((value) => value.startsWith("image/"));
        if (mime === null || !allowed.includes(mime)) {
          fail("bad-wallpaper", `wallpaper.${mode}.src`, raw.wallpaper.kind === "animated" ? "动图壁纸必须是 .gif 或 .webp" : "静态壁纸必须是 .webp / .png / .jpg / .avif");
        }
      }
    }
  }
  let coverage = { shell: false, scopes: ["sidebar"] };
  if (raw.coverage !== void 0) {
    if (!isPlainObject(raw.coverage)) fail("bad-coverage", "coverage", "coverage 必须是对象");
    else {
      if (raw.coverage.shell !== void 0) {
        if (typeof raw.coverage.shell !== "boolean") fail("bad-coverage", "coverage.shell", "shell 必须是布尔值");
        else coverage.shell = raw.coverage.shell;
      }
      if (raw.coverage.scopes !== void 0) {
        if (!Array.isArray(raw.coverage.scopes) || raw.coverage.scopes.some((scope) => !COVERAGE_SCOPES.includes(scope))) {
          fail("bad-coverage", "coverage.scopes", `scopes 只能取 ${COVERAGE_SCOPES.join(" / ")}`);
        } else coverage.scopes = [...raw.coverage.scopes];
      }
    }
  }
  let sidebar = null;
  if (raw.sidebar !== void 0 && raw.sidebar !== null) {
    if (!isPlainObject(raw.sidebar)) {
      fail("bad-sidebar", "sidebar", "sidebar 必须是对象");
    } else {
      const known = ["pack", "surface", "blur", "radius", "density", "icon", "states", "divider", "background"];
      for (const key of Object.keys(raw.sidebar)) {
        if (!known.includes(key)) fail("unknown-key", `sidebar.${key}`, `未知字段 "${key}"`);
      }
      if (raw.sidebar.pack !== void 0 && SIDEBAR_PACKS[raw.sidebar.pack] === void 0) {
        fail("bad-sidebar", "sidebar.pack", `pack 必须是 ${Object.keys(SIDEBAR_PACKS).join(" / ")}`);
      }
      if (raw.sidebar.surface !== void 0 && !SIDEBAR_SURFACES.includes(raw.sidebar.surface)) {
        fail("bad-sidebar", "sidebar.surface", `surface 必须是 ${SIDEBAR_SURFACES.join(" / ")}`);
      }
      if (raw.sidebar.density !== void 0 && !SIDEBAR_DENSITIES.includes(raw.sidebar.density)) {
        fail("bad-sidebar", "sidebar.density", `density 必须是 ${SIDEBAR_DENSITIES.join(" / ")}`);
      }
      if (raw.sidebar.blur !== void 0 && !(Number.isInteger(raw.sidebar.blur) && raw.sidebar.blur >= 0 && raw.sidebar.blur <= 24)) {
        fail("bad-sidebar", "sidebar.blur", "blur 必须是 0–24 的整数");
      }
      if (raw.sidebar.radius !== void 0) {
        if (!isPlainObject(raw.sidebar.radius)) fail("bad-sidebar", "sidebar.radius", "radius 必须是 { card, item }");
        else {
          for (const key of Object.keys(raw.sidebar.radius)) {
            if (!["card", "item"].includes(key)) fail("unknown-key", `sidebar.radius.${key}`, `未知字段 "${key}"`);
            const value = raw.sidebar.radius[key];
            if (!(Number.isInteger(value) && value >= 0 && value <= 32)) {
              fail("bad-sidebar", `sidebar.radius.${key}`, "必须是 0–32 的整数");
            }
          }
        }
      }
      if (raw.sidebar.icon !== void 0) {
        if (!validColorPair(raw.sidebar.icon)) fail("bad-sidebar", "sidebar.icon", "icon 必须是 { light, dark }");
      }
      if (raw.sidebar.states !== void 0) {
        if (!isPlainObject(raw.sidebar.states)) fail("bad-sidebar", "sidebar.states", "states 必须是对象");
        else {
          for (const [state, values] of Object.entries(raw.sidebar.states)) {
            if (!["hover", "active", "selected"].includes(state)) {
              fail("unknown-key", `sidebar.states.${state}`, `未知状态 "${state}"`);
              continue;
            }
            if (!isPlainObject(values)) {
              fail("bad-sidebar", `sidebar.states.${state}`, "状态必须是对象");
              continue;
            }
            for (const [field, value] of Object.entries(values)) {
              if (!["bg", "fg", "darkBg", "darkFg", "indicator", "darkIndicator"].includes(field)) {
                fail("unknown-key", `sidebar.states.${state}.${field}`, `未知字段 "${field}"`);
              } else if (!boundedText(value, TEXT_MAX)) {
                fail("bad-sidebar", `sidebar.states.${state}.${field}`, "必须是颜色字符串");
              }
            }
          }
        }
      }
      if (raw.sidebar.divider !== void 0 && raw.sidebar.divider !== null) {
        const divider = raw.sidebar.divider;
        if (!isPlainObject(divider) || !boundedText(divider.color, TEXT_MAX)) {
          fail("bad-sidebar", "sidebar.divider", "divider 必须是 { color, style? }");
        } else if (divider.style !== void 0 && !["solid", "dashed", "none"].includes(divider.style)) {
          fail("bad-sidebar", "sidebar.divider.style", "style 必须是 solid / dashed / none");
        }
      }
      if (raw.sidebar.background !== void 0 && raw.sidebar.background !== null) {
        const background = raw.sidebar.background;
        if (!isPlainObject(background) || !boundedText(background.light, TEXT_MAX) || background.dark !== void 0 && !boundedText(background.dark, TEXT_MAX)) {
          fail("bad-sidebar", "sidebar.background", "background 必须是 { light, dark? }");
        }
      }
      if (!issues.some((issue) => issue.path.startsWith("sidebar"))) {
        sidebar = { ...raw.sidebar };
      }
    }
  }
  if (raw.decorations !== void 0 && raw.decorations !== null && !Array.isArray(raw.decorations)) {
    fail("bad-decorations", "decorations", "decorations 必须是数组");
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    issues: [],
    theme: {
      schema: THEME_SCHEMA_VERSION,
      id: raw.id,
      name: { zh: raw.name.zh, en: raw.name.en },
      author: typeof raw.author === "string" ? raw.author : null,
      version: typeof raw.version === "string" ? raw.version : null,
      brand,
      colors: { light: { ...raw.colors.light }, dark: { ...raw.colors.dark } },
      shape: raw.shape === void 0 ? {} : { ...raw.shape },
      translucency,
      wallpaper,
      coverage,
      sidebar,
      decorations: raw.decorations ?? null
    }
  };
}
var THEME_ASSET_MIME = Object.freeze({
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".js": "text/plain; charset=utf-8"
});
function mimeForAssetPath(path) {
  if (typeof path !== "string") return null;
  const match = /\.[a-z0-9]+$/i.exec(path);
  return match === null ? null : THEME_ASSET_MIME[match[0].toLowerCase()] ?? null;
}
function wallpaperField(theme) {
  const hasArt = theme.wallpaper !== null && theme.wallpaper.kind === "image";
  return {
    key: "wallpaper",
    type: "image",
    scope: "single",
    labelKey: "personalization.wallpaper",
    default: hasArt ? `builtin:${theme.id}:art` : null,
    allowedUserMime: USER_IMAGE_MIMES,
    maxBytes: GLOBAL_MAX_BYTES,
    maxWidth: 16384,
    maxHeight: 16384,
    maxPixels: GLOBAL_MAX_PIXELS,
    builtinChoices: hasArt ? ["art"] : []
  };
}
function fieldsFromTheme(theme, profile = "web") {
  const opacity = profile === "desktop" ? theme.translucency.desktop : theme.translucency.web;
  return [
    wallpaperField(theme),
    {
      key: "slogan",
      type: "text",
      scope: "locale",
      labelKey: "personalization.slogan",
      maxLength: SLOGAN_MAX,
      default: theme.brand.slogans
    },
    {
      key: "panelOpacity",
      type: "range",
      scope: "single",
      labelKey: "personalization.panelTranslucency",
      min: 0,
      max: 100,
      step: 1,
      unit: "%",
      default: opacity
    }
  ];
}

// src/host/themes/repository.js
var THEME_FILE = "theme.json";
function readTheme(dir) {
  const file = join3(dir, THEME_FILE);
  if (!existsSync2(file)) return null;
  let raw;
  try {
    raw = JSON.parse(readFileSync3(file, "utf8"));
  } catch (error) {
    return { issues: [{ code: "bad-json", path: THEME_FILE, message: String(error.message ?? error) }] };
  }
  const result = normalizeTheme(raw);
  if (!result.ok) return { issues: result.issues };
  return { theme: result.theme };
}
function createThemeRepository({ dirs, profile = "web" }) {
  let registered = [];
  let themeDirs = /* @__PURE__ */ new Map();
  function discover() {
    const themes = [];
    const problems = [];
    const seen = /* @__PURE__ */ new Set();
    for (const { source, dir } of dirs) {
      if (!existsSync2(dir)) continue;
      let entries;
      try {
        entries = readdirSync2(dir, { withFileTypes: true });
      } catch (error) {
        problems.push({ source, id: null, issues: [{ code: "unreadable-dir", path: dir, message: String(error.message ?? error) }] });
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const themeDir = join3(dir, entry.name);
        const parsed = readTheme(themeDir);
        if (parsed === null) continue;
        if (parsed.issues !== void 0) {
          problems.push({ source, id: entry.name, issues: parsed.issues });
          continue;
        }
        if (parsed.theme.id !== entry.name) {
          problems.push({
            source,
            id: entry.name,
            issues: [{ code: "dir-id-mismatch", path: THEME_FILE, message: `目录名与 theme.id "${parsed.theme.id}" 不一致` }]
          });
          continue;
        }
        if (seen.has(parsed.theme.id)) {
          problems.push({
            source,
            id: entry.name,
            issues: [{ code: "shadowed", path: THEME_FILE, message: "同 id 的主题已被内置主题占用，此项未加载" }]
          });
          continue;
        }
        seen.add(parsed.theme.id);
        themes.push({ source, dir: themeDir, theme: parsed.theme });
      }
    }
    return { themes, problems };
  }
  function sync() {
    for (const id of registered) unregisterExternalSkin(id);
    const { themes, problems } = discover();
    registered = [];
    themeDirs = /* @__PURE__ */ new Map();
    for (const { theme, dir } of themes) {
      registerExternalSkin({ id: theme.id, fields: fieldsFromTheme(theme, profile), builtinAssets: {} });
      registered.push(theme.id);
      themeDirs.set(theme.id, dir);
    }
    return {
      themes: themes.map(({ source, theme }) => ({ source, theme })),
      problems
    };
  }
  function assetDirFor(id) {
    return themeDirs.get(id) ?? null;
  }
  return { discover, sync, assetDirFor, registeredIds: () => [...registered] };
}

// src/host/themes/assets.js
import { readFileSync as readFileSync4, realpathSync, statSync as statSync2 } from "node:fs";
import { extname, resolve, sep } from "node:path";
var MAX_THEME_ASSET_BYTES = 64 * 1024 * 1024;
function resolveThemeAsset(themeDir, relativePath) {
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
    stat = statSync2(target);
  } catch {
    return null;
  }
  if (!stat.isFile()) return null;
  if (stat.size > MAX_THEME_ASSET_BYTES) return null;
  return { path: target, mime, byteLength: stat.size, ext: extname(target).toLowerCase() };
}
function readThemeAsset(themeDir, relativePath) {
  const resolved = resolveThemeAsset(themeDir, relativePath);
  if (resolved === null) return null;
  try {
    return { ...resolved, buffer: readFileSync4(resolved.path) };
  } catch {
    return null;
  }
}

// src/host/themes/selection.js
import { existsSync as existsSync3, mkdirSync as mkdirSync3, readFileSync as readFileSync5, renameSync as renameSync3, writeFileSync as writeFileSync3, unlinkSync as unlinkSync2 } from "node:fs";
import { join as join4 } from "node:path";
var SELECTION_FILE = "selection.json";
var OFFICIAL_ID = "official";
var ID_PATTERN2 = /^[a-z][a-z0-9-]{1,39}$/;
function isSelectableId(id) {
  return id === OFFICIAL_ID || typeof id === "string" && ID_PATTERN2.test(id);
}
function readSelection(dataDir) {
  const file = join4(dataDir, SELECTION_FILE);
  if (!existsSync3(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync5(file, "utf8"));
    if (parsed === null || typeof parsed !== "object") return null;
    if (!isSelectableId(parsed.skinId)) return null;
    return { skinId: parsed.skinId, updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null };
  } catch {
    return null;
  }
}
function writeSelection(dataDir, skinId, { now = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  if (!isSelectableId(skinId)) throw new Error(`invalid skin id "${skinId}"`);
  mkdirSync3(dataDir, { recursive: true });
  const record = { skinId, updatedAt: now() };
  const target = join4(dataDir, SELECTION_FILE);
  const stage = `${target}.tmp-${process.pid}`;
  writeFileSync3(stage, `${JSON.stringify(record, null, 2)}
`, "utf8");
  renameSync3(stage, target);
  return record;
}

// src/host/install-skill.js
import { existsSync as existsSync4, mkdirSync as mkdirSync4, readFileSync as readFileSync6, writeFileSync as writeFileSync4 } from "node:fs";
import { dirname as dirname2, join as join5 } from "node:path";
import { fileURLToPath } from "node:url";
var SKILL_NAME = "vyra-free-theme";
function writeIfChanged(file, content) {
  try {
    if (existsSync4(file) && readFileSync6(file, "utf8") === content) return false;
    mkdirSync4(dirname2(file), { recursive: true });
    writeFileSync4(file, content, "utf8");
    return true;
  } catch {
    return false;
  }
}
function shellShim(nodePath, cliPath) {
  return `#!/bin/sh
# vyra-free-theme CLI shim (generated by the plugin; do not edit)
exec ${JSON.stringify(nodePath)} ${JSON.stringify(cliPath)} "$@"
`;
}
function cmdShim(nodePath, cliPath) {
  return `@echo off\r
rem vyra-free-theme CLI shim (generated by the plugin; do not edit)\r
"${nodePath}" "${cliPath}" %*\r
`;
}
function installSkillAndShims({ dshHome: dshHome2, packageRoot, nodePath = process.execPath }) {
  const result = { skill: null, shims: [] };
  const packageSkill = join5(packageRoot, "skill", "SKILL.md");
  const cliPath = join5(packageRoot, "cli", "vft.mjs");
  if (!existsSync4(cliPath)) return result;
  if (existsSync4(packageSkill)) {
    try {
      const content = readFileSync6(packageSkill, "utf8");
      const target = join5(dshHome2, "skills", SKILL_NAME, "SKILL.md");
      if (writeIfChanged(target, content)) result.skill = target;
    } catch {
    }
  }
  const binDir = join5(dshHome2, SKILL_NAME, "bin");
  const sh = join5(binDir, "vft");
  const cmd = join5(binDir, "vft.cmd");
  try {
    if (writeIfChanged(sh, shellShim(nodePath, cliPath))) result.shims.push(sh);
    if (writeIfChanged(cmd, cmdShim(nodePath, cliPath))) result.shims.push(cmd);
  } catch {
  }
  return result;
}
function packageRootFrom(importMetaUrl) {
  return join5(dirname2(fileURLToPath(importMetaUrl)), "..");
}

// src/host/paths.js
import { homedir } from "node:os";
import { basename, dirname as dirname3, join as join6, resolve as resolve2 } from "node:path";
import { cpSync, existsSync as existsSync5, mkdtempSync, readdirSync as readdirSync3, renameSync as renameSync4, rmSync, statSync as statSync3 } from "node:fs";
var DATA_DIRS = {
  web: "vyra-free-theme",
  desktop: "vyra-free-theme-desktop"
};
var LEGACY_DIRS = {
  web: ["dsh-skins"],
  desktop: ["dsh-skins-desktop", "dsh-skins"]
};
function expandHomePath(path) {
  if (path === "~") return homedir();
  if (path.startsWith("~/") || path.startsWith("~\\")) return join6(homedir(), path.slice(2));
  return path;
}
function dshHome() {
  const configured = process.env.DSH_HOME?.trim();
  return resolve2(expandHomePath(configured || join6(homedir(), ".dsh")));
}
function hostProfileFor(root, cwd = process.cwd()) {
  const normalized = (path) => process.platform === "win32" ? resolve2(path).toLowerCase() : resolve2(path);
  return normalized(cwd) === normalized(join6(expandHomePath(root), "profiles", "desktop")) ? "desktop" : "web";
}
function isDirectory(path) {
  try {
    return statSync3(path).isDirectory();
  } catch {
    return false;
  }
}
function migrationSource(home, legacyNames) {
  for (const name2 of legacyNames) {
    const candidate = join6(home, name2);
    if (isDirectory(candidate)) return candidate;
  }
  return null;
}
function adoptLegacyOnce(home, target, legacyNames) {
  if (existsSync5(target)) return target;
  const legacy = migrationSource(home, legacyNames);
  if (legacy === null) return target;
  const stage = mkdtempSync(join6(home, `.${basename(target)}-migrate-`));
  try {
    for (const name2 of readdirSync3(legacy)) {
      cpSync(join6(legacy, name2), join6(stage, name2), { recursive: true, force: false, errorOnExist: true });
    }
    renameSync4(stage, target);
  } catch (error) {
    if (!existsSync5(target)) throw error;
  } finally {
    if (dirname3(resolve2(stage)) !== resolve2(home)) throw new Error("unsafe migration staging path");
    if (existsSync5(stage)) rmSync(stage, { recursive: true, force: true });
  }
  return target;
}
function dataDirForProfile(root, profile = "web") {
  const home = resolve2(expandHomePath(root));
  const key = Object.hasOwn(DATA_DIRS, profile) ? profile : "web";
  return adoptLegacyOnce(home, join6(home, DATA_DIRS[key]), LEGACY_DIRS[key]);
}

// src/index.js
var name = "vyra-free-theme";
function apply(ctx) {
  ctx.inject(["webServer"], (hostContext) => {
    const root = dshHome();
    const profile = hostProfileFor(root);
    const dataDir = dataDirForProfile(root, profile);
    const personalization = createPersonalizationStore({ dataDir, profile });
    const packageRoot = packageRootFrom(import.meta.url);
    const packageThemesDir = join7(packageRoot, "themes");
    const themes = createThemeRepository({
      dirs: [
        { source: "builtin", dir: packageThemesDir },
        { source: "user", dir: join7(dataDir, "themes") }
      ],
      profile
    });
    themes.sync();
    try {
      installSkillAndShims({ dshHome: root, packageRoot });
    } catch {
    }
    hostContext.effect(() => {
      let serveBuiltinAsset;
      try {
        const assetsDir = join7(dirname4(fileURLToPath2(import.meta.url)), "..", "assets");
        const manifest = JSON.parse(readFileSync7(join7(assetsDir, "manifest.json"), "utf8"));
        serveBuiltinAsset = createBuiltinAssetServer({ assetsDir, manifest }).serveBuiltinAsset;
      } catch {
      }
      return mountPersonalizationRoutes(hostContext, {
        store: personalization,
        trustedHosts: () => resolveTrustedHosts(ctx),
        rejection: createOfficialRejection(ctx),
        serveBuiltinAsset,
        themes: () => themes.sync(),
        themeAssets: (id, relativePath) => {
          const dir = themes.assetDirFor(id);
          return dir === null ? null : readThemeAsset(dir, relativePath);
        },
        selection: () => ({
          read: () => readSelection(dataDir),
          write: (skinId) => writeSelection(dataDir, skinId)
        })
      });
    }, "vyra-free-theme: personalization routes");
  });
}
export {
  apply,
  dataDirForProfile,
  hostProfileFor,
  name
};

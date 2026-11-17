window.__ModuleLoader__.load({ id: "vyra-agent-cli-manager", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react27 = require("react");
var import_dsh_client_ui_primitives17 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/add-to-chat.tsx
var import_react = require("react");

// src/client/path-mention.ts
function mentionToken(path) {
  const slashed = path.trim().replace(/\\/gu, "/");
  return /\s/u.test(slashed) ? `@"${slashed}" ` : `@${slashed} `;
}

// src/client/add-to-chat.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var LABEL = "\u6DFB\u52A0\u5230\u5BF9\u8BDD";
var FAILURE_LABEL = "\u6CA1\u80FD\u6DFB\u52A0\u5230\u5BF9\u8BDD\uFF1A\u8F93\u5165\u6846\u6B63\u5728\u53D1\u9001\u6216\u5DF2\u5173\u95ED\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5";
var NO_COMPOSER = "\u8FD9\u4E2A\u4F1A\u8BDD\u7684\u8F93\u5165\u6846\u6CA1\u6709\u6253\u5F00";
var REFUSED = "\u8F93\u5165\u6846\u6682\u65F6\u4E0D\u63A5\u53D7\u8F93\u5165";
var ICON_KEY = "vyra-agent-cli-manager.add-to-chat";
var ICON_SLOT = "contextMenu.icon";
var BRIDGE_SLOT = "conversation.input.left";
var MENU_ORDER = 50;
function composerRegistry() {
  let composers = /* @__PURE__ */ new Map();
  const attach = (sessionId, actions) => {
    composers = new Map(composers).set(sessionId, actions);
    return () => {
      if (composers.get(sessionId) !== actions) return;
      composers = new Map([...composers].filter(([id]) => id !== sessionId));
    };
  };
  const insert = (sessionId, text) => {
    const composer = composers.get(sessionId);
    if (composer === void 0) throw new Error(NO_COMPOSER);
    if (!composer.insertText(text, composer.captureInsertion())) throw new Error(REFUSED);
  };
  return { attach, insert };
}
function ComposerBridge(props) {
  const { sessionId, inputActions, attach } = props;
  (0, import_react.useEffect)(() => attach(sessionId, inputActions), [attach, sessionId, inputActions]);
  return null;
}
function PlusIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 3.5V12.5M3.5 8H12.5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }) });
}
function contribution(kind, insert) {
  return {
    id: `${ICON_KEY}.${kind}`,
    target: kind,
    order: MENU_ORDER,
    resolve: ({ sessionId, path }) => [
      {
        id: "add-to-chat",
        label: LABEL,
        icon: { key: ICON_KEY },
        failureLabel: FAILURE_LABEL,
        run: () => {
          insert(sessionId, mentionToken(path));
        }
      }
    ]
  };
}
function registerAddToChat(ctx) {
  ctx.inject(["contextMenus"], (child) => {
    const { attach, insert } = composerRegistry();
    child.slots.inject(
      BRIDGE_SLOT,
      () => child.slots.register(
        { name: BRIDGE_SLOT, id: "vyra-agent-cli-manager.composer-bridge", inject: () => ({ attach }) },
        ComposerBridge
      )
    );
    child.slots.inject(ICON_SLOT, () => child.slots.register({ name: ICON_SLOT, key: ICON_KEY }, PlusIcon));
    child.effect(
      () => child.contextMenus.register(contribution("file", insert)),
      "vyra-agent-cli-manager: add file to chat"
    );
    child.effect(
      () => child.contextMenus.register(contribution("directory", insert)),
      "vyra-agent-cli-manager: add folder to chat"
    );
  });
}

// src/constants.ts
var CLI_ROUTE_PREFIX = "cli-";
var cliRoute = (id) => `${CLI_ROUTE_PREFIX}${id}`;
var isCliRoute = (provider) => provider?.startsWith(CLI_ROUTE_PREFIX) ?? false;
var MAX_COMPACT_DESCRIPTION = 20;
var PROSE_PUNCTUATION = /[,;:!?，。；：！？]/;
function compactDescription(description) {
  const text = description?.trim() ?? "";
  if (text.length === 0 || text.length > MAX_COMPACT_DESCRIPTION) return void 0;
  return PROSE_PUNCTUATION.test(text) || !/\d/.test(text) ? void 0 : text;
}
var DEFAULT_MODEL_ID = "default";
var GIT_ROUTE_PREFIX = "/vyra-agent-cli-manager/git";
var MODE_ROUTE_PREFIX = "/vyra-agent-cli-manager/modes";

// src/client/choices.ts
var OFFICIAL_PROVIDER_ID = "deepseek-official";
var HARNESS_LABEL = "DeepSeek";
function cliModels({ groups, current }) {
  const group = groups.find((candidate) => candidate.id === current?.provider);
  if (!group?.id.startsWith(CLI_ROUTE_PREFIX)) return void 0;
  const selected = group.models.find((model) => model.id === current?.model);
  return {
    provider: group.id,
    name: group.name,
    rows: group.models,
    currentId: selected?.id,
    currentName: selected?.name,
    listed: group.models.some((model) => model.name !== group.name)
  };
}
var isCli = (id) => id.startsWith(CLI_ROUTE_PREFIX);
function harnessGroup(groups) {
  return groups.find((group) => group.id === OFFICIAL_PROVIDER_ID) ?? groups.find((group) => !isCli(group.id));
}
function cliChoices({ groups, current }) {
  const harness = harnessGroup(groups);
  const harnessItem = harness === void 0 ? void 0 : { id: harness.id, label: HARNESS_LABEL };
  const firstHarness = groups.findIndex((group) => !isCli(group.id));
  const items = groups.flatMap((group, index) => {
    if (isCli(group.id)) return [{ id: group.id, label: group.name }];
    return index === firstHarness && harnessItem !== void 0 ? [harnessItem] : [];
  });
  const selected = groups.find((group) => group.id === current?.provider);
  const shown = selected === void 0 || isCli(selected.id) ? selected && { id: selected.id, label: selected.name } : harnessItem;
  return {
    visible: groups.some((group) => isCli(group.id)),
    items,
    currentId: shown?.id,
    currentLabel: shown?.label
  };
}
function selectionForChoice({ groups, current }, provider) {
  if (current?.provider === provider) return void 0;
  const onHarness = groups.some((group) => group.id === current?.provider && !isCli(group.id));
  if (onHarness && !isCli(provider)) return void 0;
  const first = groups.find((group) => group.id === provider)?.models[0];
  if (first === void 0) return void 0;
  return { provider, model: provider.startsWith(CLI_ROUTE_PREFIX) ? DEFAULT_MODEL_ID : first.id };
}

// src/client/cli-prefs.ts
var CLI_PREFS_STORAGE_KEY = "vyra-agent-cli-manager.cli-prefs";
var isBuiltInChoice = (id) => !id.startsWith(CLI_ROUTE_PREFIX);
var HIDDEN_BY_DEFAULT = /* @__PURE__ */ new Set([cliRoute("codebuddy")]);
var EMPTY = { known: [], order: [], hidden: [] };
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function strings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function choices(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap(
    (item) => isRecord(item) && typeof item.id === "string" && typeof item.label === "string" ? [{ id: item.id, label: item.label }] : []
  );
}
function parseCliPrefs(raw) {
  if (raw === null) return EMPTY;
  let value;
  try {
    value = JSON.parse(raw);
  } catch (_error) {
    return EMPTY;
  }
  if (!isRecord(value)) return EMPTY;
  return {
    known: choices(value.known),
    order: strings(value.order),
    hidden: strings(value.hidden).filter((id) => !isBuiltInChoice(id))
  };
}
function sortByOrder(items, order) {
  const rank = (id) => {
    const index = order.indexOf(id);
    return index === -1 ? order.length : index;
  };
  return [...items].sort((a, b) => rank(a.id) - rank(b.id));
}
function arrangeChoices(items, prefs) {
  return sortByOrder(
    items.filter((item) => isBuiltInChoice(item.id) || !prefs.hidden.includes(item.id)),
    prefs.order
  );
}
function listedEntries(prefs) {
  return sortByOrder(prefs.known, prefs.order).map((choice) => ({
    ...choice,
    enabled: isBuiltInChoice(choice.id) || !prefs.hidden.includes(choice.id)
  }));
}
function rememberChoices(prefs, seen) {
  if (seen.length === 0) return prefs;
  const offered = new Set(seen.map((choice) => choice.id));
  const known = prefs.known.filter((choice) => offered.has(choice.id));
  const renamed = known.map((choice) => seen.find((candidate) => candidate.id === choice.id) ?? choice);
  const added = seen.filter((choice) => !known.some((candidate) => candidate.id === choice.id));
  const dropped = known.length !== prefs.known.length;
  const relabelled = renamed.some((choice, index) => choice.label !== prefs.known[index]?.label);
  if (!dropped && added.length === 0 && !relabelled) return prefs;
  const startHidden = added.filter((choice) => HIDDEN_BY_DEFAULT.has(choice.id)).map((choice) => choice.id);
  const hidden = [...prefs.hidden, ...startHidden.filter((id) => !prefs.hidden.includes(id))];
  return { ...prefs, known: [...renamed, ...added], hidden };
}
function moveChoice(prefs, id, delta) {
  const ids = listedEntries(prefs).map((entry) => entry.id);
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= ids.length) return prefs;
  const other = ids[to] ?? id;
  return { ...prefs, order: ids.map((candidate, index) => index === from ? other : index === to ? id : candidate) };
}
function enableChoice(prefs, id, enabled) {
  if (isBuiltInChoice(id)) return prefs;
  const hidden = prefs.hidden.includes(id);
  if (enabled) return hidden ? { ...prefs, hidden: prefs.hidden.filter((candidate) => candidate !== id) } : prefs;
  return hidden ? prefs : { ...prefs, hidden: [...prefs.hidden, id] };
}
function readPrefs(storage) {
  try {
    return parseCliPrefs(storage.getItem(CLI_PREFS_STORAGE_KEY));
  } catch (_error) {
    return EMPTY;
  }
}
function createCliPrefs(storage) {
  let prefs = readPrefs(storage);
  let listeners = [];
  const update = (next) => {
    if (next === prefs) return;
    prefs = next;
    try {
      storage.setItem(CLI_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch (_error) {
    }
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => prefs,
    subscribe(listener) {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((candidate) => candidate !== listener);
      };
    },
    remember: (seen) => {
      update(rememberChoices(prefs, seen));
    },
    move: (id, delta) => {
      update(moveChoice(prefs, id, delta));
    },
    setEnabled: (id, enabled) => {
      update(enableChoice(prefs, id, enabled));
    }
  };
}

// src/client/marks.tsx
var import_react2 = require("react");

// src/client/provider-marks.ts
var OWN_MARKS = /* @__PURE__ */ new Map([
  [cliRoute("opencode"), "opencode"],
  [cliRoute("omp"), "omp"],
  [cliRoute("codex"), "codex"],
  [cliRoute("pi"), "pi"],
  [cliRoute("claude"), "claude"],
  [cliRoute("codebuddy"), "codebuddy"],
  [cliRoute("kimi"), "kimi"]
]);
function markOf(provider) {
  const own = OWN_MARKS.get(provider);
  if (own !== void 0) return own;
  if (provider.startsWith(CLI_ROUTE_PREFIX)) return "cli";
  return /deepseek/i.test(provider) ? "deepseek" : void 0;
}
function providerIn(selection) {
  const provider = selection?.provider;
  return typeof provider === "string" ? provider : void 0;
}
function providerOfSession(row) {
  const selection = row?.projectionValues?.modelSelection;
  return providerIn(selection?.next) ?? providerIn(selection?.lastUsed);
}

// src/client/marks.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var STEPFUN_PATH = "M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM8.762 19.614H4.376v-4.386h4.386v4.386zm5.423 0H9.798v-4.386h4.387v4.386zm0-5.42H9.798V9.81h4.387v4.386zm0-5.418H9.798V4.39h4.387v4.386zm5.422-.004h-4.386V4.386h4.386v4.386z";
var ZHIPU_PATH = "M11.991 23.503a.24.24 0 00-.244.248.24.24 0 00.244.249.24.24 0 00.245-.249.24.24 0 00-.22-.247l-.025-.001zM9.671 5.365a1.697 1.697 0 011.099 2.132l-.071.172-.016.04-.018.054c-.07.16-.104.32-.104.498-.035.71.47 1.279 1.186 1.314h.366c1.309.053 2.338 1.173 2.286 2.523-.052 1.332-1.152 2.38-2.478 2.327h-.174c-.715.018-1.274.64-1.239 1.368 0 .124.018.23.053.337.209.373.54.658.96.8.75.23 1.517-.125 1.9-.782l.018-.035c.402-.64 1.17-.96 1.92-.711.854.284 1.378 1.226 1.099 2.167a1.661 1.661 0 01-2.077 1.102 1.711 1.711 0 01-.907-.711l-.017-.035c-.2-.323-.463-.58-.851-.711l-.056-.018a1.646 1.646 0 00-1.954.746 1.66 1.66 0 01-1.065.764 1.677 1.677 0 01-1.989-1.279c-.209-.906.332-1.83 1.257-2.043a1.51 1.51 0 01.296-.035h.018c.68-.071 1.151-.622 1.116-1.333a1.307 1.307 0 00-.227-.693 2.515 2.515 0 01-.366-1.403 2.39 2.39 0 01.366-1.208c.14-.195.21-.444.227-.693.018-.71-.506-1.261-1.186-1.332l-.07-.018a1.43 1.43 0 01-.299-.07l-.05-.019a1.7 1.7 0 01-1.047-2.114 1.68 1.68 0 012.094-1.101zm-5.575 10.11c.26-.264.639-.367.994-.27.355.096.633.379.728.74.095.362-.007.748-.267 1.013-.402.41-1.053.41-1.455 0a1.062 1.062 0 010-1.482zm14.845-.294c.359-.09.738.024.992.297.254.274.344.665.237 1.025-.107.36-.396.634-.756.718-.551.128-1.1-.22-1.23-.781a1.05 1.05 0 01.757-1.26zm-.064-4.39c.314.32.49.753.49 1.206 0 .452-.176.886-.49 1.206-.315.32-.74.5-1.185.5-.444 0-.87-.18-1.184-.5a1.727 1.727 0 010-2.412 1.654 1.654 0 012.369 0zm-11.243.163c.364.484.447 1.128.218 1.691a1.665 1.665 0 01-2.188.923c-.855-.36-1.26-1.358-.907-2.228a1.68 1.68 0 011.33-1.038c.593-.08 1.183.169 1.547.652zm11.545-4.221c.368 0 .708.2.892.524.184.324.184.724 0 1.048a1.026 1.026 0 01-.892.524c-.568 0-1.03-.47-1.03-1.048 0-.579.462-1.048 1.03-1.048zm-14.358 0c.368 0 .707.2.891.524.184.324.184.724 0 1.048a1.026 1.026 0 01-.891.524c-.569 0-1.03-.47-1.03-1.048 0-.579.461-1.048 1.03-1.048zm10.031-1.475c.925 0 1.675.764 1.675 1.706s-.75 1.705-1.675 1.705-1.674-.763-1.674-1.705c0-.942.75-1.706 1.674-1.706zm-2.626-.684c.362-.082.653-.356.761-.718a1.062 1.062 0 00-.238-1.028 1.017 1.017 0 00-.996-.294c-.547.14-.881.7-.752 1.257.13.558.675.907 1.225.783zm0 16.876c.359-.087.644-.36.75-.72a1.062 1.062 0 00-.237-1.019 1.018 1.018 0 00-.985-.301 1.037 1.037 0 00-.762.717c-.108.361-.017.754.239 1.028.245.263.606.377.953.305l.043-.01zM17.19 3.5a.631.631 0 00.628-.64c0-.355-.279-.64-.628-.64a.631.631 0 00-.628.64c0 .355.28.64.628.64zm-10.38 0a.631.631 0 00.628-.64c0-.355-.28-.64-.628-.64a.631.631 0 00-.628.64c0 .355.279.64.628.64zm-5.182 7.852a.631.631 0 00-.628.64c0 .354.28.639.628.639a.63.63 0 00.627-.606l.001-.034a.62.62 0 00-.628-.64zm5.182 9.13a.631.631 0 00-.628.64c0 .355.279.64.628.64a.631.631 0 00.628-.64c0-.355-.28-.64-.628-.64zm10.38.018a.631.631 0 00-.628.64c0 .355.28.64.628.64a.631.631 0 00.628-.64c0-.355-.279-.64-.628-.64zm5.182-9.148a.631.631 0 00-.628.64c0 .354.279.639.628.639a.631.631 0 00.628-.64c0-.355-.28-.64-.628-.64zm-.384-4.992a.24.24 0 00.244-.249.24.24 0 00-.244-.249.24.24 0 00-.244.249c0 .142.122.249.244.249zM11.991.497a.24.24 0 00.245-.248A.24.24 0 0011.99 0a.24.24 0 00-.244.249c0 .133.108.236.223.247l.021.001zM2.011 6.36a.24.24 0 00.245-.249.24.24 0 00-.244-.249.24.24 0 00-.244.249.24.24 0 00.244.249zm0 11.263a.24.24 0 00-.243.248.24.24 0 00.244.249.24.24 0 00.244-.249.252.252 0 00-.244-.248zm19.995-.018a.24.24 0 00-.245.248.24.24 0 00.245.25.24.24 0 00.244-.25.252.252 0 00-.244-.248z";
var MINIMAX_PATH = "M16.278 2c1.156 0 2.093.927 2.093 2.07v12.501a.74.74 0 00.744.709.74.74 0 00.743-.709V9.099a2.06 2.06 0 012.071-2.049A2.06 2.06 0 0124 9.1v6.561a.649.649 0 01-.652.645.649.649 0 01-.653-.645V9.1a.762.762 0 00-.766-.758.762.762 0 00-.766.758v7.472a2.037 2.037 0 01-2.048 2.026 2.037 2.037 0 01-2.048-2.026v-12.5a.785.785 0 00-.788-.753.785.785 0 00-.789.752l-.001 15.904A2.037 2.037 0 0113.441 22a2.037 2.037 0 01-2.048-2.026V18.04c0-.356.292-.645.652-.645.36 0 .652.289.652.645v1.934c0 .263.142.506.372.638.23.131.514.131.744 0a.734.734 0 00.372-.638V4.07c0-1.143.937-2.07 2.093-2.07zm-5.674 0c1.156 0 2.093.927 2.093 2.07v11.523a.648.648 0 01-.652.645.648.648 0 01-.652-.645V4.07a.785.785 0 00-.789-.78.785.785 0 00-.789.78v14.013a2.06 2.06 0 01-2.07 2.048 2.06 2.06 0 01-2.071-2.048V9.1a.762.762 0 00-.766-.758.762.762 0 00-.766.758v3.8a2.06 2.06 0 01-2.071 2.049A2.06 2.06 0 010 12.9v-1.378c0-.357.292-.646.652-.646.36 0 .653.29.653.646V12.9c0 .418.343.757.766.757s.766-.339.766-.757V9.099a2.06 2.06 0 012.07-2.048 2.06 2.06 0 012.071 2.048v8.984c0 .419.343.758.767.758.423 0 .766-.339.766-.758V4.07c0-1.143.937-2.07 2.093-2.07z";
var HUNYUAN_DISC = "#0055E9";
var HUNYUAN_SHAPES = [
  {
    d: "M12 0c.518 0 1.028.033 1.528.096A6.188 6.188 0 0112.12 12.28l-.12.001c-2.99 0-5.242 2.179-5.554 5.11-.223 2.086.353 4.412 2.242 6.146C3.672 22.1 0 17.479 0 12 0 5.373 5.373 0 12 0z",
    fill: "#A8DFF5"
  },
  {
    d: "M5.286 5a2.438 2.438 0 01.682 3.38c-3.962 5.966-3.215 10.743 2.648 15.136C3.636 22.056 0 17.452 0 12c0-1.787.39-3.482 1.09-5.006.253-.435.525-.872.817-1.311A2.438 2.438 0 015.286 5z",
    fill: "#0055E9"
  },
  {
    d: "M12.98.04c.272.021.543.053.81.093.583.106 1.117.254 1.538.44 6.638 2.927 8.07 10.052 1.748 15.642a4.125 4.125 0 01-5.822-.358c-1.51-1.706-1.3-4.184.357-5.822.858-.848 3.108-1.223 4.045-2.441 1.257-1.634 2.122-6.009-2.523-7.506L12.98.039z",
    fill: "#00BCFF"
  },
  {
    d: "M13.528.096A6.187 6.187 0 0112 12.281a5.75 5.75 0 00-1.71.255c.147-.905.595-1.784 1.321-2.501.858-.848 3.108-1.223 4.045-2.441 1.27-1.651 2.14-6.104-2.676-7.554.184.014.367.033.548.056z",
    fill: "#ECECEE"
  }
];
var ZHIPU_COLOR = "#3859FF";
var MINIMAX_GRADIENT = ["#E2167E", "#FE603C"];
var MONOCHROME = {
  codex: [
    "M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 0 0-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 0 1 .476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 0 1 4.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 0 1-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 0 0 5.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0 0 10.205 0a5.947 5.947 0 0 0-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 0 0 4.162 1.713z"
  ],
  pi: ["M1 1h16.5v11H12v5.5H6.5V23H1V1zm5.5 5.5V12H12V6.5H6.5z", "M17.5 12H23v11h-5.5V12z"],
  opencode: ["M16 6H8v12h8V6zm4 16H4V2h16v20z"],
  kimi: [
    "M21.846 0a1.923 1.923 0 110 3.846H20.15a.226.226 0 01-.227-.226V1.923C19.923.861 20.784 0 21.846 0z",
    "M11.065 11.199l7.257-7.2c.137-.136.06-.41-.116-.41H14.3a.164.164 0 00-.117.051l-7.82 7.756c-.122.12-.302.013-.302-.179V3.82c0-.127-.083-.23-.185-.23H3.186c-.103 0-.186.103-.186.23V19.77c0 .128.083.23.186.23h2.69c.103 0 .186-.102.186-.23v-3.25c0-.069.025-.135.069-.178l2.424-2.406a.158.158 0 01.205-.023l6.484 4.772a7.677 7.677 0 003.453 1.283c.108.012.2-.095.2-.23v-3.06c0-.117-.07-.212-.164-.227a5.028 5.028 0 01-2.027-.807l-5.613-4.064c-.117-.078-.132-.279-.028-.381z"
  ],
  stepfun: [STEPFUN_PATH]
};
var DEEPSEEK_PATH = "M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z";
var DEEPSEEK_COLOR = "#4D6BFE";
var CLAUDE_PATH = "M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z";
var CLAUDE_COLOR = "#D97757";
var OMP_PATH = "M10 14h44v9H43v33h-9V23h-9v22h-9V23H10z";
var CODEBUDDY_BACKGROUND_PATH = "M18.821 0H5.18A5.179 5.179 0 000 5.179V18.82A5.179 5.179 0 005.179 24H18.82A5.179 5.179 0 0024 18.821V5.18A5.179 5.179 0 0018.821 0z";
var CODEBUDDY_FACE_PATHS = [
  "M18.777 1.647c.28-.02.536.114.972.51 1.018.926 2.437 2.828 3.318 4.452l.34.631.482.24.11.06v3.638a5.206 5.206 0 00-5.32-1.23c-.491.166-1.021.471-2.08 1.082l-6.09 3.516c-1.057.61-1.586.916-1.975 1.259a5.208 5.208 0 00-1.493 5.572c.165.49.471 1.02 1.082 2.08l.315.543h-3.26c-.685 0-1.34-.135-1.939-.377-.169-.956-.009-1.789.469-2.335.158-.18.164-.189.13-.493a11.846 11.846 0 01-.057-1.711l.02-.444-.667-1.18C2.1 15.622 1.445 14.078 1.192 12.9c-.133-.647-.125-.934.04-1.146.1-.128.427-.261.822-.334.994-.175 3.162-.017 5.575.41l.25.043.551-.487c.915-.81 1.522-1.264 2.641-1.962 1.167-.73 2.484-1.331 3.967-1.807l.476-.152.261-.688c.937-2.471 1.896-4.293 2.58-4.9.235-.21.25-.22.422-.23z",
  "M12.139 18.2a1.203 1.203 0 011.642.44l1.296 2.243a1.204 1.204 0 01-2.083 1.203l-1.296-2.243a1.203 1.203 0 01.44-1.644zM18.629 14.452a1.203 1.203 0 011.642.44l1.295 2.244a1.203 1.203 0 11-2.083 1.203l-1.295-2.243a1.203 1.203 0 01.44-1.644z"
];
var COLORED = {
  deepseek: { shapes: [{ d: DEEPSEEK_PATH, fill: DEEPSEEK_COLOR }] },
  claude: { shapes: [{ d: CLAUDE_PATH, fill: CLAUDE_COLOR }] },
  hunyuan: { disc: HUNYUAN_DISC, shapes: HUNYUAN_SHAPES },
  zhipu: { shapes: [{ d: ZHIPU_PATH, fill: ZHIPU_COLOR }] },
  minimax: { gradient: MINIMAX_GRADIENT, shapes: [{ d: MINIMAX_PATH }] }
};
function svgProps({ id, size }, viewBox) {
  return {
    width: size,
    height: size,
    viewBox,
    "aria-hidden": true,
    "data-cli-mark": id,
    style: { flex: "none" }
  };
}
function OmpMark(props) {
  const gradient = (0, import_react2.useId)().replace(/:/g, "");
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { ...svgProps(props, "0 0 64 64"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("linearGradient", { id: gradient, x1: "0", y1: "0", x2: "1", y2: "1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("stop", { offset: "0", stopColor: "oklch(0.7 0.24 340)" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("stop", { offset: ".5", stopColor: "oklch(0.62 0.21 295)" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("stop", { offset: "1", stopColor: "oklch(0.81 0.14 200)" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: `url(#${gradient})`, d: OMP_PATH })
  ] });
}
function CodeBuddyMark(props) {
  const gradient = (0, import_react2.useId)().replace(/:/g, "");
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { ...svgProps(props, "0 0 24 24"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "radialGradient",
      {
        id: gradient,
        cx: "0",
        cy: "0",
        r: "1",
        gradientUnits: "userSpaceOnUse",
        gradientTransform: "matrix(-9.00009 -16 16 -9.00009 21 24.5)",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("stop", { stopColor: "#2EA99D" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("stop", { offset: "1", stopColor: "#6C4DFF" })
        ]
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: `url(#${gradient})`, d: CODEBUDDY_BACKGROUND_PATH }),
    CODEBUDDY_FACE_PATHS.map((path) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { fill: "#fff", d: path }, path))
  ] });
}
function ColoredMark(props) {
  const gradient = (0, import_react2.useId)().replace(/:/g, "");
  const paint = props.mark.gradient === void 0 ? "" : `url(#${gradient})`;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { ...svgProps(props, "0 0 24 24"), children: [
    props.mark.gradient !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("linearGradient", { id: gradient, x1: "0", y1: "0", x2: "1", y2: "1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("stop", { offset: "0", stopColor: props.mark.gradient[0] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("stop", { offset: "1", stopColor: props.mark.gradient[1] })
    ] }) }),
    props.mark.disc !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "12", cy: "12", r: "12", fill: props.mark.disc }),
    props.mark.shapes.map((shape) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: shape.d, fill: paint === "" ? shape.fill ?? "currentColor" : paint }, shape.d))
  ] });
}
function XiaomiMark(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { ...svgProps(props, "0 0 24 24"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "1", y: "1", width: "22", height: "22", rx: "6", fill: "#FF6900" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "path",
      {
        d: "M6 17V7.6l6 6.9 6-6.9V17",
        fill: "none",
        stroke: "#fff",
        strokeWidth: "2.6",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }
    )
  ] });
}
function UnknownMark(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "svg",
    {
      ...svgProps(props, "0 0 24 24"),
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.9",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "12", cy: "12", r: "9" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M9.7 9.3a2.4 2.4 0 1 1 3.1 2.3c-.7.3-1 .9-1 1.6v.4" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M12 17.2h.01" })
      ]
    }
  );
}
function MonochromeMark(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { ...svgProps(props, "0 0 24 24"), fill: "currentColor", fillRule: "evenodd", children: props.paths.map((path) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: path }, path)) });
}
function GenericCliMark(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "svg",
    {
      ...svgProps(props, "0 0 24 24"),
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M4 7l6 5-6 5" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M12 19h8" })
      ]
    }
  );
}
function MarkGlyph({ id, size }) {
  if (id === "omp") return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(OmpMark, { id, size });
  if (id === "codebuddy") return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CodeBuddyMark, { id, size });
  if (id === "unknown") return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(UnknownMark, { id, size });
  if (id === "xiaomi") return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(XiaomiMark, { id, size });
  const colored = COLORED[id];
  if (colored !== void 0) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ColoredMark, { id, size, mark: colored });
  const paths = MONOCHROME[id];
  if (paths !== void 0) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(MonochromeMark, { id, size, paths });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(GenericCliMark, { id, size });
}
function ProviderMark({
  provider,
  size
}) {
  const id = markOf(provider);
  return id === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(MarkGlyph, { id, size });
}

// src/client/menu-models.ts
var ACCOUNT_PROVIDER_ID = "deepseek-account";
var OFFICIAL_PROVIDER_ID2 = "deepseek-official";
var ACCOUNT_PROVIDER_NAME = "DeepSeek \u8D26\u53F7";
var MENU_LABEL = "\u6A21\u578B";
var PROVIDER_DEFAULT_LABEL = "Default";
var PROVIDER_DEFAULT_KEY = "provider-default";
var LOADING_STATUS = "loading";
var VENDOR_SEPARATOR = "/";
var MIN_VENDOR_SECTIONS = 2;
function isRow(row, selection) {
  return row.provider === selection?.provider && row.model === selection.model;
}
function rowCount(sections) {
  return sections.reduce((count, section) => count + section.rows.length, 0);
}
function toSection({ id, name, models }, headed) {
  return {
    id,
    name: id === ACCOUNT_PROVIDER_ID ? ACCOUNT_PROVIDER_NAME : name,
    headed,
    rows: models.map(({ id: model, name: modelName, description, reasoning }) => ({
      provider: id,
      model,
      name: modelName,
      ...description === void 0 ? {} : { description },
      ...reasoning === void 0 ? {} : { reasoning }
    }))
  };
}
var providerRank = (id) => id === ACCOUNT_PROVIDER_ID ? 0 : id === OFFICIAL_PROVIDER_ID2 ? 1 : 2;
function effortLevels(reasoning) {
  if (reasoning === void 0) return [];
  const levels = reasoning.efforts.map(({ id, name }) => ({ key: `effort:${id}`, effort: id, name }));
  if (reasoning.defaultEffort !== void 0) return levels;
  return [{ key: PROVIDER_DEFAULT_KEY, effort: void 0, name: PROVIDER_DEFAULT_LABEL }, ...levels];
}
function vendorOf(row) {
  const at = row.model.indexOf(VENDOR_SEPARATOR);
  return at > 0 ? row.model.slice(0, at) : void 0;
}
function vendorSections(section) {
  const vendors = [...new Set(section.rows.flatMap((row) => vendorOf(row) ?? []))];
  if (vendors.length < MIN_VENDOR_SECTIONS) return [section];
  const loose = section.rows.filter((row) => vendorOf(row) === void 0);
  const lead = loose.length === 0 ? [] : [{ ...section, rows: loose }];
  return [
    ...lead,
    ...vendors.map((vendor) => ({
      id: `${section.id}${VENDOR_SEPARATOR}${vendor}`,
      name: vendor,
      headed: true,
      rows: section.rows.filter((row) => vendorOf(row) === vendor)
    }))
  ];
}
function listing(state) {
  const cli = cliModels(state);
  if (cli !== void 0) {
    const section = toSection({ id: cli.provider, name: cli.name, models: cli.rows }, false);
    return { label: cli.name, sections: vendorSections(section), unlisted: cli.listed ? void 0 : cli.name };
  }
  const sections = state.groups.filter((group) => !group.id.startsWith(CLI_ROUTE_PREFIX)).map((group) => toSection(group, true)).sort((left, right) => providerRank(left.id) - providerRank(right.id));
  return { label: MENU_LABEL, sections, unlisted: void 0 };
}
function menuModels(state) {
  const listed = listing(state);
  const current = listed.sections.flatMap((section) => section.rows).find((row) => isRow(row, state.current));
  const efforts = effortLevels(current?.reasoning);
  const chosen = state.current?.reasoningEffort ?? current?.reasoning?.defaultEffort;
  return {
    ...listed,
    current,
    loading: state.status === LOADING_STATUS,
    efforts,
    effort: efforts.find((level) => level.effort === chosen)
  };
}

// src/client/mode-menu.tsx
var import_react3 = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/model-menu-styles.ts
var ROOT_CLASS = "dsh-cli-model";
var TRIGGER_CLASS = "dsh-cli-model-trigger";
var ICON_CLASS = "dsh-cli-model-icon";
var LABEL_CLASS = "dsh-cli-model-label";
var CHEVRON_CLASS = "dsh-cli-model-chevron";
var MENU_CLASS = "dsh-cli-model-menu";
var SEARCH_CLASS = "dsh-cli-model-search";
var SEARCH_INPUT_CLASS = "dsh-cli-model-search-input";
var ROWS_CLASS = "dsh-cli-model-rows";
var ROW_CLASS = "dsh-cli-model-row";
var ROW_ACTIVE_CLASS = "dsh-cli-model-row-active";
var ROW_MARK_CLASS = "dsh-cli-model-row-mark";
var ROW_NAME_CLASS = "dsh-cli-model-row-name";
var ROW_DESCRIPTION_CLASS = "dsh-cli-model-row-description";
var ROW_CHECK_CLASS = "dsh-cli-model-row-check";
var HINT_CLASS = "dsh-cli-model-hint";
var HEADING_CLASS = "dsh-cli-model-heading";
var GROUP_CLASS = "dsh-cli-model-group";
var EFFORT_CLASS = "dsh-cli-model-effort";
var MODE_CLASS = "dsh-cli-model-mode";
var MODE_SEAT_CLASS = "dsh-cli-mode-seat";
var MODEL_MENU_STYLES = `
[role="menu"][aria-label="\u6A21\u578B"]:not(.${ROWS_CLASS}) section[data-menu-group]:has([data-provider-id^="${CLI_ROUTE_PREFIX}"]) { display: none !important; }
[data-slot="conversation.input.right"]:has(.${ROOT_CLASS}) + [data-slot="conversation.input.model"] { display: none !important; }
.${ROOT_CLASS} { position: relative; min-width: 0; }
.${TRIGGER_CLASS} {
  anchor-name: var(--dsh-cli-model-anchor);
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 360px;
  height: 28px;
  padding: 0 4px 0 8px;
  border: none;
  border-radius: var(--dsw-radius-sm);
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  font-weight: 400;
  cursor: pointer;
}
.${TRIGGER_CLASS}:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.${TRIGGER_CLASS}:focus-visible:not([data-selection-focus]) {
  box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
}
.${TRIGGER_CLASS}:disabled { color: var(--dsw-alias-label-dimmed); cursor: default; }
.${ICON_CLASS} { display: var(--dsh-composer-model-icon-display, none); flex: 0 0 auto; }
.${LABEL_CLASS} {
  display: var(--dsh-composer-model-text-display, block);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.${CHEVRON_CLASS} { flex: 0 0 auto; color: var(--dsw-alias-label-caption); transition: transform 120ms ease; }
.${TRIGGER_CLASS}[aria-expanded="true"] .${CHEVRON_CLASS} { transform: rotate(180deg); }
.${MENU_CLASS} {
  box-sizing: border-box;
  position: fixed;
  position-anchor: var(--dsh-cli-model-anchor);
  top: max(12px, var(--dsh-frame-overlay-top, 12px));
  left: 12px;
  right: anchor(right);
  bottom: calc(anchor(top) + 8px);
  align-self: safe end;
  justify-self: safe end;
  margin: 0;
  z-index: 1100;
  display: flex;
  flex-direction: column;
  width: fit-content;
  height: fit-content;
  min-width: min(240px, calc(100vw - 24px));
  max-width: min(420px, calc(100vw - 24px));
  max-height: min(360px, calc(100dvh - 96px));
  overflow: hidden;
  padding: 4px;
  border: 0;
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  box-shadow: var(--dsw-elevation-prominent);
  color: var(--dsw-alias-label-primary);
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
}
.${SEARCH_CLASS} { flex-shrink: 0; margin: 2px 0 3px; }
.${SEARCH_CLASS} .${SEARCH_INPUT_CLASS} {
  display: flex;
  height: auto;
  padding: 5px 7px;
  border: 0 solid transparent;
  border-radius: var(--dsw-radius-md);
  background: transparent;
}
.${SEARCH_CLASS} .${SEARCH_INPUT_CLASS}:focus-within { border-color: transparent; }
.${SEARCH_CLASS} .${SEARCH_INPUT_CLASS} input { padding: 0; font-size: 12px; line-height: normal; }
.${SEARCH_CLASS} .${SEARCH_INPUT_CLASS} input::placeholder { color: var(--dsw-alias-label-caption); }
@media (pointer: coarse) {
  .${SEARCH_CLASS} .${SEARCH_INPUT_CLASS} input { font-size: 16px; }
}
.${ROWS_CLASS} { min-height: 0; overflow-x: hidden; overflow-y: auto; }
.${ROW_CLASS} {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 34px;
  padding: 5px 7px;
  border: none;
  border-radius: var(--dsw-radius-md);
  outline: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.${ROW_ACTIVE_CLASS}:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.${ROW_CLASS}:disabled { color: var(--dsw-alias-label-dimmed); cursor: default; pointer-events: none; }
.${ROW_MARK_CLASS} { display: grid; place-items: center; flex: 0 0 14px; }
.${ROW_NAME_CLASS} {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.${ROW_DESCRIPTION_CLASS} {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 45%;
  overflow: hidden;
  color: var(--dsw-alias-label-caption);
  font-size: 11px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.${ROW_CHECK_CLASS} { display: grid; place-items: center; flex: 0 0 14px; color: var(--dsw-alias-label-primary); }
.${ROW_CHECK_CLASS} svg { width: 14px; height: 14px; }
.${HEADING_CLASS} {
  padding: 6px 7px 2px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}
.${GROUP_CLASS} { display: flex; align-items: center; min-width: 0; }
/* Where the composer is too narrow for the model's name, the level gives way as well. */
.${EFFORT_CLASS} { display: var(--dsh-composer-model-text-display, block); flex: 0 0 auto; }
.${EFFORT_CLASS} .${TRIGGER_CLASS} { padding: 0 4px; color: var(--dsw-alias-label-caption); }
/* The CLI's own mode sits beside the level, read the same way so neither outranks the name. */
.${MODE_CLASS} { display: var(--dsh-composer-model-text-display, block); flex: 0 0 auto; }
.${MODE_CLASS} .${TRIGGER_CLASS} { padding: 0 4px; color: var(--dsw-alias-label-caption); }
/* The permission seat holds one control: on a CLI session that is the CLI's own mode, so
   the harness's access control steps aside. It keys on the mode control itself, not its seat:
   a CLI that reports no modes leaves the seat empty, and the access control must then stay. */
.${MODE_SEAT_CLASS} { display: inline-flex; min-width: 0; }
.${MODE_SEAT_CLASS} .${TRIGGER_CLASS} { padding: 0 4px 0 8px; color: var(--dsw-alias-label-secondary); }
[data-composer-card]:has(.${MODE_CLASS}) [aria-label^="\u8BBF\u95EE\u6A21\u5F0F"] { display: none !important; }
.${HINT_CLASS} { padding: 8px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
`;

// src/client/mode-menu.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var UNKNOWN_ERROR_LABEL = "\u672A\u77E5\u9519\u8BEF";
var PENDING_HINT = "\uFF0C\u4E0B\u4E00\u6761\u6D88\u606F\u53D1\u9001\u65F6\u751F\u6548";
var MODE_POLL_MS = 1500;
var MODE_POLL_TRIES = 40;
var textOf = (reason) => reason instanceof Error ? reason.message : String(reason);
function useModeReading(api, provider, started) {
  const [reply, setReply] = (0, import_react3.useState)();
  (0, import_react3.useEffect)(() => {
    if (api === void 0 || provider === void 0) {
      setReply(void 0);
      return void 0;
    }
    let current = true;
    api.read(provider).then(
      (next) => {
        if (current) setReply(next);
      },
      () => {
        if (current) setReply(void 0);
      }
    );
    return () => {
      current = false;
    };
  }, [api, provider]);
  const refresh = (0, import_react3.useCallback)(() => {
    if (api === void 0 || provider === void 0) return;
    api.read(provider).then(setReply, () => {
    });
  }, [api, provider]);
  const pending = reply?.pending;
  (0, import_react3.useEffect)(() => {
    if (pending === void 0 || !started) return void 0;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (tries > MODE_POLL_TRIES) {
        clearInterval(timer);
        return;
      }
      refresh();
    }, MODE_POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [pending, started, refresh]);
  return { reply, refresh, accept: setReply };
}
function useChooseMode({ api, provider, modes, pending, close, accept }) {
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const [failure, setFailure] = (0, import_react3.useState)();
  const choose = (value) => {
    close();
    if (value === pending || pending === void 0 && value === modes.current) return;
    setBusy(true);
    api.write(provider, value).then(
      (next) => {
        setBusy(false);
        accept(next);
      },
      (reason) => {
        setBusy(false);
        setFailure((previous) => ({ seq: (previous?.seq ?? 0) + 1, text: textOf(reason) }));
      }
    );
  };
  return {
    busy,
    failure,
    choose,
    clearFailure: () => {
      setFailure(void 0);
    }
  };
}
function ModeTrigger({ label, title, open, busy, locked, onToggle }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "button",
    {
      type: "button",
      className: TRIGGER_CLASS,
      "aria-label": `CLI \u6A21\u5F0F\uFF0C\u5F53\u524D ${label}`,
      "aria-haspopup": "menu",
      "aria-expanded": open,
      title,
      disabled: locked || busy,
      onClick: onToggle,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: LABEL_CLASS, children: label }),
        busy ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives.StateDot, { state: "ongoing" }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { className: CHEVRON_CLASS, size: 14 })
      ]
    }
  );
}
function FailureToast({ failure, root, clear }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    import_dsh_client_ui_primitives.Toast,
    {
      text: `\u5207\u6362 CLI \u6A21\u5F0F\u5931\u8D25\uFF1A${failure.text || UNKNOWN_ERROR_LABEL}`,
      icon: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives.IconWarningOutlineRegular, {}),
      anchor: root,
      onDone: clear
    },
    failure.seq
  );
}
function headlineOf(modes, pending) {
  const shown = modes.options.find((option) => option.value === (pending ?? modes.current));
  const label = shown?.name ?? modes.current;
  return { label, title: `CLI \u6A21\u5F0F\uFF1A${label}${pending === void 0 ? "" : PENDING_HINT}` };
}
function ModePicker(props) {
  const { modes, pending, open, onSelect, onClose } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    import_dsh_client_ui_primitives.Menu,
    {
      open: open && !props.locked,
      items: modes.options.map((option) => ({ id: option.value, label: option.name })),
      selectedId: pending ?? modes.current,
      onSelect,
      onClose,
      side: "top",
      portal: true,
      anchor: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        ModeTrigger,
        {
          label: props.label,
          title: props.title,
          open,
          busy: props.busy,
          locked: props.locked,
          onToggle: props.onToggle
        }
      )
    }
  );
}
function ModeControl({ api, provider, reply, modes, locked, refresh, accept }) {
  const [open, setOpen] = (0, import_react3.useState)(false);
  const rootRef = (0, import_react3.useRef)(null);
  const { pending } = reply;
  const close = () => {
    setOpen(false);
  };
  const { busy, failure, choose, clearFailure } = useChooseMode({ api, provider, modes, pending, close, accept });
  const { label, title } = headlineOf(modes, pending);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { ref: rootRef, className: MODE_CLASS, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      ModePicker,
      {
        modes,
        pending,
        open,
        busy,
        locked,
        label,
        title,
        onSelect: choose,
        onClose: close,
        onToggle: () => {
          const next = !open;
          setOpen(next);
          if (next) refresh();
        }
      }
    ),
    failure !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      FailureToast,
      {
        failure,
        root: rootRef.current?.closest("[data-composer-card]") ?? null,
        clear: clearFailure
      }
    )
  ] });
}
function ModeMenu({ provider, api, locked, started }) {
  const { reply, refresh, accept } = useModeReading(api, provider, started);
  if (api === void 0 || provider === void 0 || reply?.modes === void 0) return null;
  const { modes } = reply;
  if (modes.options.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    ModeControl,
    {
      api,
      provider,
      reply,
      modes,
      locked,
      refresh,
      accept
    }
  );
}

// src/client/session-facts.ts
var import_react4 = require("react");
var NOTHING = () => {
};
function useFact(session, read2) {
  return (0, import_react4.useSyncExternalStore)(
    (listener) => session?.subscribe(listener) ?? NOTHING,
    () => session === void 0 ? false : read2(session.getSnapshot())
  );
}
function useRemoved(session) {
  return useFact(session, (facts) => facts.removed === true);
}
function useStarted(session) {
  return useFact(session, (facts) => facts.blank === false);
}

// src/client/store.ts
var import_react5 = require("react");
function useStore(store) {
  return (0, import_react5.useSyncExternalStore)(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot()
  );
}

// src/client/mode-seat.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function CliModeSeat({ directory, modes, session }) {
  const state = useStore(directory);
  const locked = useRemoved(session);
  const started = useStarted(session);
  const provider = menuModels(state).current?.provider;
  if (!isCliRoute(provider)) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: MODE_SEAT_CLASS, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ModeMenu, { provider, api: modes, locked, started }) });
}

// src/client/model-menu.tsx
var import_react_dom = require("react-dom");
var import_dsh_client_ui_primitives5 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/effort-menu.tsx
var import_react6 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime5 = require("react/jsx-runtime");
var UNKNOWN_ERROR_LABEL2 = "\u672A\u77E5\u9519\u8BEF";
var UNLISTED_LEVEL_LABEL = "\u63A8\u7406\u7B49\u7EA7";
function selectionFor(row, level) {
  return {
    provider: row.provider,
    model: row.model,
    ...level.effort === void 0 ? {} : { reasoningEffort: level.effort }
  };
}
function useChooseEffort(models, select, close) {
  const [failure, setFailure] = (0, import_react6.useState)();
  const fail = (text) => {
    setFailure((previous) => ({ seq: (previous?.seq ?? 0) + 1, text }));
  };
  const choose = (key) => {
    close();
    const level = models.efforts.find((candidate) => candidate.key === key);
    if (models.current === void 0 || level === void 0 || level.key === models.effort?.key) return;
    select(selectionFor(models.current, level)).then(
      (result) => {
        if (result.error !== void 0) fail(result.error.message ?? UNKNOWN_ERROR_LABEL2);
      },
      (reason) => {
        fail(String(reason));
      }
    );
  };
  return { failure, clearFailure: () => setFailure(void 0), choose };
}
function EffortMenu({ models, pending, locked, select }) {
  const [open, setOpen] = (0, import_react6.useState)(false);
  const rootRef = (0, import_react6.useRef)(null);
  const { failure, clearFailure, choose } = useChooseEffort(models, select, () => {
    setOpen(false);
  });
  if (models.current === void 0 || models.efforts.length === 0) return null;
  const label = models.effort?.name ?? UNLISTED_LEVEL_LABEL;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { ref: rootRef, className: EFFORT_CLASS, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      import_dsh_client_ui_primitives2.Menu,
      {
        open: open && !locked,
        items: models.efforts.map((level) => ({ id: level.key, label: level.name })),
        selectedId: models.effort?.key,
        onSelect: choose,
        onClose: () => {
          setOpen(false);
        },
        side: "top",
        portal: true,
        anchor: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "button",
          {
            type: "button",
            className: TRIGGER_CLASS,
            "aria-label": `\u63A8\u7406\u7B49\u7EA7\uFF0C\u5F53\u524D ${label}`,
            "aria-haspopup": "menu",
            "aria-expanded": open,
            title: `\u63A8\u7406\u7B49\u7EA7\uFF1A${label}`,
            disabled: locked || pending !== null,
            onClick: () => {
              setOpen((value) => !value);
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: LABEL_CLASS, children: label }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives2.IconChevronDownOutlineRegular, { className: CHEVRON_CLASS, size: 14 })
            ]
          }
        )
      }
    ),
    failure !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      import_dsh_client_ui_primitives2.Toast,
      {
        text: `\u5207\u6362\u63A8\u7406\u7B49\u7EA7\u5931\u8D25\uFF1A${failure.text}`,
        icon: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives2.IconWarningOutlineRegular, {}),
        anchor: rootRef.current?.closest("[data-composer-card]") ?? null,
        onDone: clearFailure
      },
      failure.seq
    )
  ] });
}

// src/client/model-card.tsx
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/model-marks.ts
var FAMILIES = [
  ["deepseek", /deepseek/i],
  ["hunyuan", /(?:^|[\s/_.-])hy\d|hunyuan|混元/i],
  ["zhipu", /glm[-_]?\d|zhipu|chatglm|智谱/i],
  ["minimax", /minimax/i],
  ["stepfun", /stepfun|阶跃|(?:^|[\s/_.-])step[-_ ]?\d/i],
  ["xiaomi", /mimo|xiaomi|小米/i],
  ["kimi", /kimi|moonshot|(?:^|[\s/_.-])k\d/i],
  ["claude", /claude|(?:^|[\s/_.-])(?:opus|sonnet|haiku)(?:$|[\s/_.-]|\d)/i],
  ["codex", /gpt|codex|openai|(?:^|[\s/_.-])o\d(?:$|[\s/_.-])/i]
];
var VENDOR_MARKS = /* @__PURE__ */ new Set([
  "deepseek",
  "hunyuan",
  "zhipu",
  "minimax",
  "stepfun",
  "xiaomi",
  "kimi",
  "claude",
  "codex"
]);
function modelMarkOf({ provider, model, name }) {
  const text = `${model} ${name}`;
  const family = FAMILIES.find(([, pattern]) => pattern.test(text));
  if (family !== void 0) return family[0];
  const own = markOf(provider);
  if (own === void 0) return void 0;
  return VENDOR_MARKS.has(own) ? own : "unknown";
}

// src/client/model-card.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var SEARCH_ABOVE = 4;
var MENU_LABEL2 = "\u6A21\u578B";
var SEARCH_LABEL = "\u641C\u7D22\u6A21\u578B\u2026";
var NO_MATCH_LABEL = "\u6CA1\u6709\u5339\u914D\u7684\u6A21\u578B\u3002";
var NO_MODELS_LABEL = "\u6682\u65E0\u53EF\u7528\u6A21\u578B";
var ROW_MARK_SIZE = 14;
function ModelRow({ domId, model, selected, settling, active, busy, onHover, onChoose }) {
  const check = selected ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives3.IconCheckOutlineRegular, {}) : null;
  const mark = modelMarkOf(model);
  const detail = compactDescription(model.description);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "button",
    {
      type: "button",
      role: "menuitemradio",
      "aria-checked": selected,
      id: domId,
      tabIndex: -1,
      title: model.name,
      className: active ? `${ROW_CLASS} ${ROW_ACTIVE_CLASS}` : ROW_CLASS,
      disabled: busy,
      onMouseMove: active || busy ? void 0 : onHover,
      onClick: onChoose,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: ROW_MARK_CLASS, children: mark === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(MarkGlyph, { id: mark, size: ROW_MARK_SIZE }) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: ROW_NAME_CLASS, children: model.name }),
        detail !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: ROW_DESCRIPTION_CLASS, title: detail, children: detail }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: ROW_CHECK_CLASS, children: settling ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives3.StateDot, { state: "ongoing" }) : check })
      ]
    }
  );
}
function ModelSearch({ id, active, query, busy, searchRef, onQuery }) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: SEARCH_CLASS, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    import_dsh_client_ui_primitives3.Input,
    {
      ref: searchRef,
      className: SEARCH_INPUT_CLASS,
      type: "text",
      role: "searchbox",
      "aria-label": SEARCH_LABEL,
      "aria-controls": `${id}-rows`,
      "aria-activedescendant": active < 0 ? void 0 : `${id}-model-${active}`,
      placeholder: SEARCH_LABEL,
      value: query,
      readOnly: busy,
      onChange: (event) => {
        onQuery(event.target.value);
      }
    }
  ) });
}
function ModelRows({ id, models, sections, active, pending, onHighlight, onChoose }) {
  const starts = sections.map((_section, index) => rowCount(sections.slice(0, index)));
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { id: `${id}-rows`, className: `${ROWS_CLASS} scrollable`, role: "menu", "aria-label": MENU_LABEL2, children: sections.map((section, sectionIndex) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { role: "none", children: [
    section.headed && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: HEADING_CLASS, role: "presentation", children: section.name }),
    section.rows.map((row, rowIndex) => {
      const index = (starts[sectionIndex] ?? 0) + rowIndex;
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        ModelRow,
        {
          domId: `${id}-model-${index}`,
          model: row,
          selected: isRow(row, models.current),
          settling: isRow(row, pending),
          active: index === active,
          busy: pending !== null,
          onHover: () => {
            onHighlight(index);
          },
          onChoose: () => {
            onChoose(row);
          }
        },
        `${row.provider}/${row.model}`
      );
    })
  ] }, section.id)) });
}
function emptyLabel(models) {
  return rowCount(models.sections) === 0 ? NO_MODELS_LABEL : NO_MATCH_LABEL;
}
function ModelCard(props) {
  const {
    id,
    models,
    sections,
    active,
    pending,
    query,
    anchorStyle,
    cardRef,
    searchRef,
    onQuery,
    onHighlight,
    onChoose
  } = props;
  const busy = pending !== null;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    import_dsh_client_ui_primitives3.MenuSurface,
    {
      ref: cardRef,
      id: `${id}-menu`,
      className: MENU_CLASS,
      style: anchorStyle,
      role: "group",
      "aria-label": models.label,
      children: [
        rowCount(models.sections) > SEARCH_ABOVE && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ModelSearch, { id, active, query, busy, searchRef, onQuery }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ModelRows, { ...{ id, models, sections, active, pending, onHighlight, onChoose } }),
        sections.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: HINT_CLASS, role: "status", children: emptyLabel(models) }),
        models.unlisted !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: HINT_CLASS, role: "status", children: `\u8FD8\u6CA1\u6709\u8BFB\u5230 ${models.unlisted} \u7684\u6A21\u578B\u5217\u8868` })
      ]
    }
  );
}

// src/client/model-seat.ts
var import_react7 = require("react");
var import_dsh_client_ui_primitives4 = require("@deepseek-ai/dsh-client-ui-primitives");
var UNKNOWN_ERROR_LABEL3 = "\u672A\u77E5\u9519\u8BEF";
function keyAction({ key, shiftKey }) {
  if (key === "Escape" || key === "Tab" && shiftKey) return "close";
  if (key === "Enter" || key === "Tab") return "choose";
  if (key === "ArrowDown") return 1;
  return key === "ArrowUp" ? -1 : void 0;
}
function useCloseOnOutsidePress(open, inside, close) {
  (0, import_react7.useEffect)(() => {
    if (!open) return void 0;
    const onPress = (event) => {
      if (!inside.some((ref) => ref.current?.contains(event.target) === true)) close();
    };
    document.addEventListener("mousedown", onPress);
    return () => {
      document.removeEventListener("mousedown", onPress);
    };
  }, [open]);
}
function useMatchingRows(models, query, highlight) {
  const searchable = rowCount(models.sections) > SEARCH_ABOVE;
  const sections = (0, import_react7.useMemo)(
    () => models.sections.map((section) => ({ ...section, rows: (0, import_dsh_client_ui_primitives4.rankByName)(section.rows, searchable ? query.trim() : "") })).filter((section) => section.rows.length > 0),
    [models.sections, searchable, query]
  );
  const visible = (0, import_react7.useMemo)(() => sections.flatMap((section) => section.rows), [sections]);
  const currentIndex = visible.findIndex((row) => isRow(row, models.current));
  const active = Math.min(highlight ?? Math.max(0, currentIndex), visible.length - 1);
  return { searchable, sections, visible, active };
}
function useMenuFocus(open, searchable, activeRowId, searchRef) {
  (0, import_react7.useEffect)(() => {
    if (open && searchable && !(0, import_dsh_client_ui_primitives4.isMobileDevice)()) searchRef.current?.focus();
  }, [open, searchable, searchRef]);
  (0, import_react7.useLayoutEffect)(() => {
    if (open) document.getElementById(activeRowId)?.scrollIntoView({ block: "nearest" });
  }, [open, activeRowId]);
}
function useCompositionGuard() {
  const composition = (0, import_react7.useRef)();
  (0, import_react7.useEffect)(() => {
    const observed = (0, import_dsh_client_ui_primitives4.observeComposition)(document);
    composition.current = observed;
    return () => {
      observed.dispose();
    };
  }, []);
  return (event) => composition.current?.guards(event) ?? false;
}
function useChooseModel({ models, select, triggerRef, searchRef, closings, close }) {
  const [failure, setFailure] = (0, import_react7.useState)();
  const [settled, setSettled] = (0, import_react7.useState)(false);
  const fail = (text) => {
    setFailure((previous) => ({ seq: (previous?.seq ?? 0) + 1, text }));
    if (!(0, import_dsh_client_ui_primitives4.isMobileDevice)()) searchRef.current?.focus();
  };
  const choose = (row) => {
    setSettled(true);
    if (isRow(row, models.current)) {
      close(true);
      return;
    }
    const asked = closings.current;
    triggerRef.current?.focus();
    select({ provider: row.provider, model: row.model }).then(
      (result) => {
        if (result.error !== void 0) fail(result.error.message ?? UNKNOWN_ERROR_LABEL3);
        else if (closings.current === asked) close(true);
      },
      (reason) => {
        fail(String(reason));
      }
    );
  };
  return {
    failure,
    clearFailure: () => {
      setFailure(void 0);
    },
    settled,
    setSettled,
    choose
  };
}
function closeOnBlurOutside(inside, close) {
  return ({ relatedTarget }) => {
    const staysInside = relatedTarget instanceof Node && inside.some((ref) => ref.current?.contains(relatedTarget) === true);
    if (!staysInside) close();
  };
}
function useMenuState(triggerRef) {
  const [open, setOpen] = (0, import_react7.useState)(false);
  const [query, setQuery] = (0, import_react7.useState)("");
  const [highlight, setHighlight] = (0, import_react7.useState)(null);
  const closings = (0, import_react7.useRef)(0);
  const close = (restoreFocus = false) => {
    closings.current += 1;
    setOpen(false);
    setQuery("");
    setHighlight(null);
    if (restoreFocus)
      queueMicrotask(() => {
        triggerRef.current?.focus();
      });
  };
  return { open, setOpen, query, setQuery, highlight, setHighlight, closings, close };
}
function useSeatRefs() {
  return {
    rootRef: (0, import_react7.useRef)(null),
    triggerRef: (0, import_react7.useRef)(null),
    cardRef: (0, import_react7.useRef)(null),
    searchRef: (0, import_react7.useRef)(null)
  };
}
function useModelSeat({ models, pending, locked, load, select }) {
  const refs = useSeatRefs();
  const { rootRef, triggerRef, cardRef, searchRef } = refs;
  const { open, setOpen, query, setQuery, highlight, setHighlight, closings, close } = useMenuState(triggerRef);
  const id = (0, import_react7.useId)();
  const showing = open && !locked;
  const { searchable, sections, visible, active } = useMatchingRows(models, query, highlight);
  const composing = useCompositionGuard();
  const choosing = useChooseModel({ models, select, triggerRef, searchRef, closings, close });
  useCloseOnOutsidePress(showing, [rootRef, cardRef], close);
  useMenuFocus(showing, searchable, `${id}-model-${active}`, searchRef);
  const onKeyDown = (event) => {
    if (!showing || composing(event.nativeEvent)) return;
    const action = keyAction(event);
    if (action === void 0) return;
    event.preventDefault();
    const row = visible[active];
    if (action === "close") close(true);
    else if (pending !== null || row === void 0) return;
    else if (action === "choose") choosing.choose(row);
    else setHighlight((active + action + visible.length) % visible.length);
  };
  const onBlur = closeOnBlurOutside([rootRef, cardRef], () => {
    close();
  });
  const toggle = () => {
    if (open) {
      close(true);
      return;
    }
    choosing.setSettled(false);
    triggerRef.current?.focus();
    setOpen(true);
    load();
  };
  return {
    id,
    showing,
    query,
    setQuery,
    setHighlight,
    sections,
    active,
    ...refs,
    onKeyDown,
    onBlur,
    toggle,
    ...choosing
  };
}

// src/client/model-menu.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
var NO_MODEL_LABEL = "\u8BF7\u9009\u62E9\u6A21\u578B";
var LOADING_LABEL = "\u6B63\u5728\u52A0\u8F7D\u6A21\u578B\u2026";
function keepFocus(event) {
  if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
}
function ModelTrigger({ seat, models, pending, locked, label, anchorStyle }) {
  const { id, showing } = seat;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "button",
    {
      ref: seat.triggerRef,
      type: "button",
      className: TRIGGER_CLASS,
      style: anchorStyle,
      "aria-label": models.current === void 0 ? label : `\u9009\u62E9\u6A21\u578B\uFF0C\u5F53\u524D ${label}`,
      "aria-haspopup": "menu",
      "aria-expanded": showing,
      "aria-controls": showing ? `${id}-menu` : void 0,
      "aria-busy": pending !== null,
      title: label,
      "data-selection-focus": seat.settled ? "" : void 0,
      disabled: locked,
      onBlur: () => {
        seat.setSettled(false);
      },
      onClick: seat.toggle,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives5.IconDataOutlineRegular, { className: ICON_CLASS, size: 16 }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: LABEL_CLASS, children: label }),
        pending === null ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives5.IconChevronDownOutlineRegular, { className: CHEVRON_CLASS, size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives5.StateDot, { state: "ongoing" })
      ]
    }
  );
}
function ModelSeat(props) {
  const { models, pending, locked } = props;
  const seat = useModelSeat(props);
  const { id, showing, rootRef } = seat;
  const anchorStyle = { "--dsh-cli-model-anchor": `--dsh-cli-model-${id.replaceAll(":", "")}` };
  const label = models.current?.name ?? (models.loading ? LOADING_LABEL : NO_MODEL_LABEL);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { ref: rootRef, className: ROOT_CLASS, onKeyDown: seat.onKeyDown, onBlur: seat.onBlur, onMouseDown: keepFocus, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      ModelTrigger,
      {
        seat,
        models,
        pending,
        locked,
        label,
        anchorStyle
      }
    ),
    showing && (0, import_react_dom.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        ModelCard,
        {
          id,
          models,
          sections: seat.sections,
          active: seat.active,
          pending,
          query: seat.query,
          anchorStyle,
          cardRef: seat.cardRef,
          searchRef: seat.searchRef,
          onQuery: (next) => {
            seat.setQuery(next);
            seat.setHighlight(0);
          },
          onHighlight: seat.setHighlight,
          onChoose: seat.choose
        }
      ),
      document.body
    ),
    seat.failure !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      import_dsh_client_ui_primitives5.Toast,
      {
        text: `\u5207\u6362\u6A21\u578B\u5931\u8D25\uFF1A${seat.failure.text}`,
        icon: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives5.IconWarningOutlineRegular, {}),
        anchor: rootRef.current?.closest("[data-composer-card]") ?? null,
        onDone: seat.clearFailure
      },
      seat.failure.seq
    )
  ] });
}
function CliModelMenu({ available, directory, load, select, session }) {
  const state = useStore(directory);
  const locked = useRemoved(session);
  if (!available || !isCliRoute(state.current?.provider)) return null;
  const models = menuModels(state);
  const pending = state.pending ?? null;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: GROUP_CLASS, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(ModelSeat, { models, pending, locked, load, select }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(EffortMenu, { models, pending, locked, select })
  ] });
}

// src/client/mode-api.ts
var UNKNOWN_ERROR = "\u5207\u6362 CLI \u6A21\u5F0F\u5931\u8D25";
var BAD_REPLY = "\u6A21\u5F0F\u63A5\u53E3\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u7ED3\u679C";
var isObject = (value) => typeof value === "object" && value !== null;
var isText = (value) => typeof value === "string" && value.length > 0;
function modesOf(value) {
  if (!isObject(value) || !isText(value.configId) || !isText(value.current) || !Array.isArray(value.options)) {
    return void 0;
  }
  const options = value.options.flatMap(
    (option) => isObject(option) && isText(option.value) && isText(option.name) ? [{ value: option.value, name: option.name }] : []
  );
  return options.length === 0 ? void 0 : { configId: value.configId, current: value.current, options };
}
function replyOf(body) {
  if (!isObject(body)) throw new Error(BAD_REPLY);
  if (body.success !== true) throw new Error(isText(body.error) ? body.error : UNKNOWN_ERROR);
  const data = isObject(body.data) ? body.data : {};
  return { modes: modesOf(data.modes), pending: isText(data.pending) ? data.pending : void 0 };
}
function createModeApi(post2, sessionId) {
  const send = async (provider, mode) => {
    const response = await post2(MODE_ROUTE_PREFIX, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, provider, ...mode === void 0 ? {} : { mode } })
    });
    if (!response.ok) throw new Error(`${UNKNOWN_ERROR}\uFF08HTTP ${response.status}\uFF09`);
    return replyOf(await response.json());
  };
  return { read: (provider) => send(provider), write: (provider, mode) => send(provider, mode) };
}
var perSession = /* @__PURE__ */ new Map();
function modeApiFor(post2, sessionId) {
  const known = perSession.get(sessionId);
  if (known !== void 0) return known;
  const created = createModeApi(post2, sessionId);
  perSession.set(sessionId, created);
  return created;
}

// src/client/session-status-mark.tsx
var import_react8 = require("react");
var import_react_dom2 = require("react-dom");
var import_jsx_runtime8 = require("react/jsx-runtime");
var SESSION_STATUS_SLOT = "sidebar.session.row.trailing";
var SESSION_STATUS_MARK_CLASS = "dsh-cli-status-mark";
var ROW = '[data-row-key^="session:"]';
var LEADING_CELL = ':scope > [class*="_slot"]';
var MARK_SIZE = 14;
var STREAMING_COLOR = "#2f80ed";
var DOT_SIZE = "6px";
var MARK_GAP = "6px";
var HEARTBEAT = "dsh-cli-status-heartbeat";
var HEARTBEAT_PERIOD = "0.92s";
function useSessionProvider(list, sessionId) {
  const subscribe = (0, import_react8.useCallback)((listener) => list.subscribe(listener), [list]);
  return (0, import_react8.useSyncExternalStore)(subscribe, () => providerOfSession(list.getSnapshot().byId[sessionId]));
}
function leadingCellOf(anchor) {
  return anchor?.closest(ROW)?.querySelector(LEADING_CELL) ?? null;
}
function SessionStatusMark({
  sessionId,
  list
}) {
  const provider = useSessionProvider(list, sessionId);
  const [cell, setCell] = (0, import_react8.useState)(null);
  const anchor = (0, import_react8.useCallback)((node) => {
    setCell(leadingCellOf(node));
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { ref: anchor, hidden: true }),
    cell === null || provider === void 0 ? null : (0, import_react_dom2.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: SESSION_STATUS_MARK_CLASS, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(ProviderMark, { provider, size: MARK_SIZE }) }),
      cell
    )
  ] });
}
var CELL = `${ROW} > :has(> .${SESSION_STATUS_MARK_CLASS})`;
var STATUS_CELL = `${CELL}:has(> [data-state])`;
var SESSION_STATUS_STYLES = `
.${SESSION_STATUS_MARK_CLASS} { display: none; order: -1; color: var(--dsw-alias-label-secondary); }
${STATUS_CELL} { width: auto; gap: ${MARK_GAP}; }
${STATUS_CELL} > .${SESSION_STATUS_MARK_CLASS} { display: inline-flex; }
${STATUS_CELL} > [data-state] { width: ${DOT_SIZE} !important; height: ${DOT_SIZE} !important; }
${STATUS_CELL} > svg[data-state="ongoing"] {
  border-radius: 50%;
  background: ${STREAMING_COLOR};
  box-shadow: 0 0 0 4px color-mix(in srgb, ${STREAMING_COLOR} 18%, transparent);
  overflow: visible;
  animation: ${HEARTBEAT} ${HEARTBEAT_PERIOD} ease-in-out infinite;
}
${STATUS_CELL} > svg[data-state="ongoing"] > * { display: none; }
@keyframes ${HEARTBEAT} {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.35); opacity: 0.65; }
}
@media (prefers-reduced-motion: reduce) {
  ${STATUS_CELL} > svg[data-state="ongoing"] { animation: none; }
}
`;

// src/client/terminal-entry.tsx
var import_dsh_client_ui_primitives6 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime9 = require("react/jsx-runtime");
var TERMINAL_KIND = "terminal";
var SLOT = "conversation.session.header.utilities";
var ENTRY_ORDER = -1;
var ENTRY_CLASS = "dsh-cli-terminal-entry";
var TOOLTIP_LABEL = "\u7EC8\u7AEF";
var ARIA_LABEL = "\u5207\u6362\u7EC8\u7AEF";
var TOOLTIP_DELAY_MS = 500;
var TERMINAL_ENTRY_STYLES = `
.${ENTRY_CLASS} { flex: none; width: 28px; padding: 0; color: var(--dsw-alias-label-secondary); }
.${ENTRY_CLASS} svg { width: 15px; height: 15px; }
`;
function toggleTerminal(sidebar, sessionId) {
  const expanded = sidebar.isExpanded();
  if (expanded && sidebar.active()?.kind === TERMINAL_KIND) {
    sidebar.toggleExpanded();
    return;
  }
  const existing = sidebar.tabsIn(sessionId).find((tab) => tab.kind === TERMINAL_KIND);
  if (existing === void 0) {
    sidebar.openTab(TERMINAL_KIND);
    return;
  }
  sidebar.focus(existing.id);
  if (!expanded) sidebar.toggleExpanded();
}
function TerminalGlyph() {
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("svg", { viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: "M3 4L7 8L3 12", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: "M9 12H13", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })
  ] });
}
function TerminalEntry({ sessionId, sidebar }) {
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_dsh_client_ui_primitives6.Tooltip, { label: TOOLTIP_LABEL, side: "bottom", delayMs: TOOLTIP_DELAY_MS, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    import_dsh_client_ui_primitives6.Button,
    {
      size: "sm",
      className: ENTRY_CLASS,
      "aria-label": ARIA_LABEL,
      onClick: () => {
        toggleTerminal(sidebar, sessionId);
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(TerminalGlyph, {})
    }
  ) });
}
function registerTerminalEntry(ctx) {
  ctx.inject(["sidebarRight"], (child) => {
    child.slots.inject(
      SLOT,
      () => child.slots.register(
        {
          name: SLOT,
          id: "vyra-agent-cli-manager.terminal-entry",
          order: ENTRY_ORDER,
          inject: () => ({ sidebar: child.sidebarRight })
        },
        TerminalEntry
      )
    );
  });
}

// src/client/changes/changes-kind.ts
var CHANGES_KIND = "vyra-agent-cli-manager-changes";

// src/client/files-default.ts
var GUIDE_KIND = "guide";
var FILES_KIND = "files";
function replaceSoleGuide(sidebar, kinds) {
  const sessionId = sidebar.mounted.getSnapshot();
  if (sessionId === void 0 || !sidebar.isExpanded()) return;
  const [only, ...others] = sidebar.tabsIn(sessionId);
  if (only?.kind !== GUIDE_KIND || others.length > 0) return;
  if (kinds.get(FILES_KIND) === void 0) return;
  sidebar.openTab(FILES_KIND, { replaceTab: only.id });
  if (kinds.get(CHANGES_KIND) === void 0) return;
  sidebar.openTab(CHANGES_KIND);
  const files = sidebar.tabsIn(sessionId).find((tab) => tab.kind === FILES_KIND);
  if (files !== void 0) sidebar.focus(files.id);
}
function registerFilesDefault(ctx) {
  ctx.inject(["sidebarRight", "sidebarRightTabs"], (child) => {
    const check = () => {
      queueMicrotask(() => {
        replaceSoleGuide(child.sidebarRight, child.sidebarRightTabs);
      });
    };
    child.effect(() => child.sidebarRight.openTabs.subscribe(check), "vyra-agent-cli-manager: files by default (tabs)");
    child.effect(
      () => child.sidebarRight.mounted.subscribe(check),
      "vyra-agent-cli-manager: files by default (session)"
    );
  });
}

// src/client/launch-script-styles.ts
var LS = {
  group: "dsh-ls-group",
  run: "dsh-ls-run",
  more: "dsh-ls-more",
  menuRow: "dsh-ls-menu-row",
  menuName: "dsh-ls-menu-name",
  menuCommand: "dsh-ls-menu-command",
  dialog: "dsh-ls-dialog",
  list: "dsh-ls-list",
  row: "dsh-ls-row",
  rowText: "dsh-ls-row-text",
  rowName: "dsh-ls-row-name",
  rowCommand: "dsh-ls-row-command",
  badge: "dsh-ls-badge",
  rowActions: "dsh-ls-row-actions",
  iconButton: "dsh-ls-icon-button",
  empty: "dsh-ls-empty",
  form: "dsh-ls-form",
  field: "dsh-ls-field",
  label: "dsh-ls-label",
  textarea: "dsh-ls-textarea",
  hint: "dsh-ls-hint",
  error: "dsh-ls-error",
  footer: "dsh-ls-footer"
};
var MONO = "var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace)";
var LAUNCH_SCRIPT_STYLES = `
.${LS.group} { display: inline-flex; align-items: center; flex: none; }
.${LS.run} { flex: none; width: 28px; padding: 0; color: var(--dsw-alias-label-secondary); }
.${LS.run}[data-has-more] { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.${LS.run} svg { width: 15px; height: 15px; }
.${LS.more} {
  flex: none; width: 16px; padding: 0; color: var(--dsw-alias-label-tertiary);
  border-top-left-radius: 0; border-bottom-left-radius: 0;
}
.${LS.more} svg { width: 12px; height: 12px; }
.${LS.menuRow} { display: flex; flex-direction: column; min-width: 0; max-width: 280px; }
.${LS.menuName} { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.${LS.menuCommand} {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: ${MONO}; font-size: 11px; color: var(--dsw-alias-label-tertiary);
}
.${LS.dialog} { width: min(480px, 100%); }
.${LS.list} {
  margin: 0; padding: 0; list-style: none;
  display: flex; flex-direction: column; gap: 2px; max-height: 320px; overflow-y: auto; }
.${LS.row} {
  display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 4px 4px 4px 10px;
  border-radius: var(--dsw-radius-md);
}
.${LS.row}:hover, .${LS.row}:focus-within { background: var(--dsw-alias-interactive-bg-hover); }
.${LS.rowText} { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.${LS.rowName} {
  display: flex; align-items: center; gap: 6px; min-width: 0;
  font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary);
}
.${LS.rowName} > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.${LS.rowCommand} {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: ${MONO}; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary);
}
.${LS.badge} {
  flex: none; padding: 0 6px; border-radius: var(--dsw-radius-sm);
  font-size: 11px; line-height: 16px;
  color: var(--dsw-alias-state-business-primary);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);
}
.${LS.rowActions} { display: flex; flex: none; gap: 2px; opacity: 0; }
.${LS.row}:hover .${LS.rowActions}, .${LS.row}:focus-within .${LS.rowActions} { opacity: 1; }
.${LS.iconButton} { width: 28px; padding: 0; color: var(--dsw-alias-label-secondary); }
.${LS.iconButton}[data-danger] { color: var(--dsw-alias-state-error-primary); }
.${LS.iconButton} svg { width: 15px; height: 15px; }
.${LS.empty} {
  padding: 20px 12px; border: 0.5px dashed var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md);
  text-align: center; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-tertiary);
}
.${LS.form} { display: flex; flex-direction: column; gap: 14px; }
.${LS.field} { display: flex; flex-direction: column; gap: 6px; }
.${LS.label} { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
/* Three 18px lines plus the 8px padding above and below and the 0.5px borders. The
   textarea starts here and the person can drag it taller; anything longer scrolls. */
.${LS.textarea} {
  box-sizing: border-box; width: 100%; min-height: 71px; padding: 8px 10px; resize: vertical;
  border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md); outline: none;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  font-family: ${MONO}; font-size: 12px; line-height: 18px;
}
.${LS.textarea}:focus { border-color: var(--dsw-alias-state-business-primary); }
.${LS.hint} { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.${LS.error} { font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary); }
.${LS.footer} { display: flex; align-items: center; justify-content: flex-end; gap: 8px; width: 100%; }
.${LS.footer} > :first-child[data-leading] { margin-right: auto; }
`;

// src/client/session-tree-styles.ts
var GROUP = ':has(> * > [data-row-key^="workspace:"])';
var HEADER = ':has(> [data-row-key^="workspace:"])';
var ITEM = ':has(> [data-row-key^="session:"])';
var ROW2 = '[data-row-key^="session:"]';
var INDENT = "var(--dsh-workspace-indent, 0px)";
var LINE_X = "20px";
var ROW_SHIFT = "28px";
var ELBOW_WIDTH = "7px";
var ELBOW_RADIUS = "5px";
var ROW_GAP = "2px";
var FIRST_REACH = "9px";
var LINE = "1px solid var(--dsw-alias-border-l4)";
var CHIP_FILL = "var(--dsw-alias-border-l2)";
var CONTINUED = `${ITEM}:not(:nth-last-child(1 of ${ITEM}))`;
var SESSION_TREE_STYLES = `
${GROUP} > ${ITEM} { position: relative; }
${GROUP} > ${ITEM} > ${ROW2} {
  margin-inline-start: calc(${ROW_SHIFT} + ${INDENT});
  padding-inline-start: calc(var(--dsh-sidebar-row-padding) - var(--dsh-sidebar-paint-inset));
}
${GROUP} > ${ITEM}::before,
${GROUP} > ${CONTINUED}::after {
  content: '';
  position: absolute;
  left: calc(${LINE_X} + ${INDENT});
  pointer-events: none;
  box-sizing: border-box;
}
${GROUP} > ${ITEM}::before {
  top: -${ROW_GAP};
  height: calc(50% + ${ROW_GAP});
  width: ${ELBOW_WIDTH};
  border-left: ${LINE};
  border-bottom: ${LINE};
  border-bottom-left-radius: ${ELBOW_RADIUS};
}
${GROUP} > ${HEADER} + ${ITEM}::before {
  top: -${FIRST_REACH};
  height: calc(50% + ${FIRST_REACH});
}
${GROUP} > ${CONTINUED}::after {
  top: 50%;
  bottom: 0;
  border-left: ${LINE};
}
${GROUP} > ${ITEM} [class*="_timestamp"] {
  padding: 0 4px;
  border-radius: 4px;
  background: ${CHIP_FILL};
}
${GROUP} > button {
  width: calc(100% - ${ROW_SHIFT} - ${INDENT});
  margin-inline-start: calc(${ROW_SHIFT} + ${INDENT});
}
`;

// src/client/launch-scripts.ts
var STORAGE_PREFIX = "vyra-agent-cli-manager.launchScripts:";
var NO_DIRECTORY_KEY = `${STORAGE_PREFIX}*`;
var EMPTY2 = [];
var MAX_COMMAND_LENGTH = 4e3;
var MAX_NAME_LENGTH = 40;
function storageKey(cwd) {
  return cwd === void 0 || cwd === "" ? NO_DIRECTORY_KEY : `${STORAGE_PREFIX}${cwd}`;
}
function isRecord2(value) {
  return typeof value === "object" && value !== null;
}
function normalize(value) {
  if (!isRecord2(value)) return void 0;
  const { id, name, command } = value;
  if (typeof id !== "string" || typeof command !== "string" || command.trim() === "") return void 0;
  return { id, name: typeof name === "string" ? name : "", command };
}
function parseScripts(raw) {
  if (raw === null) return EMPTY2;
  let value;
  try {
    value = JSON.parse(raw);
  } catch (_error) {
    return EMPTY2;
  }
  if (!Array.isArray(value)) return EMPTY2;
  return value.map(normalize).filter((script) => script !== void 0);
}
function scriptLabel(script) {
  const name = script.name.trim();
  if (name !== "") return name;
  return script.command.trim().split(/\r?\n/, 1)[0] ?? "";
}
function shellInput(command) {
  const lines = command.trim().split(/\r?\n/).filter((line) => line.trim() !== "");
  return `${lines.join("\r")}\r`;
}
function draftProblem(draft) {
  if (draft.command.trim() === "") return "\u8BF7\u586B\u5199\u8981\u8FD0\u884C\u7684\u547D\u4EE4";
  if (draft.command.length > MAX_COMMAND_LENGTH) return `\u547D\u4EE4\u4E0D\u80FD\u8D85\u8FC7 ${MAX_COMMAND_LENGTH} \u4E2A\u5B57\u7B26`;
  if (draft.name.trim().length > MAX_NAME_LENGTH) return `\u540D\u79F0\u4E0D\u80FD\u8D85\u8FC7 ${MAX_NAME_LENGTH} \u4E2A\u5B57\u7B26`;
  return void 0;
}
function saveDraft(scripts, draft, newId) {
  const fields = { name: draft.name.trim(), command: draft.command.trim() };
  const { id } = draft;
  if (id === void 0 || !scripts.some((script) => script.id === id)) {
    return [...scripts, { id: newId(), ...fields }];
  }
  return scripts.map((script) => script.id === id ? { ...script, ...fields } : script);
}
function removeScript(scripts, id) {
  return scripts.filter((script) => script.id !== id);
}
function promoteScript(scripts, id) {
  const chosen = scripts.find((script) => script.id === id);
  if (chosen === void 0) return scripts;
  return [chosen, ...scripts.filter((script) => script.id !== id)];
}
function readRaw(storage, key) {
  try {
    return storage.getItem(key);
  } catch (_error) {
    return null;
  }
}
function createScriptBook(storage) {
  let cache = /* @__PURE__ */ new Map();
  let listeners = [];
  return {
    read(cwd) {
      const key = storageKey(cwd);
      const cached = cache.get(key);
      if (cached !== void 0) return cached;
      const scripts = parseScripts(readRaw(storage, key));
      cache = new Map(cache).set(key, scripts);
      return scripts;
    },
    write(cwd, scripts) {
      const key = storageKey(cwd);
      storage.setItem(key, JSON.stringify(scripts));
      cache = new Map(cache).set(key, scripts);
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((other) => other !== listener);
      };
    }
  };
}

// src/client/launch-script-run.ts
var TERMINAL_KIND2 = "terminal";
var ATTACH_TIMEOUT_MS = 15e3;
var DEAD_PHASES = /* @__PURE__ */ new Set(["failed", "closed", "closing"]);
var OPEN_FAILED = "\u6CA1\u80FD\u6253\u5F00\u7EC8\u7AEF\u6807\u7B7E";
var ATTACH_FAILED = "\u7EC8\u7AEF\u6CA1\u6709\u51C6\u5907\u597D\uFF0C\u547D\u4EE4\u6CA1\u6709\u53D1\u9001";
var ATTACH_TIMED_OUT = "\u7B49\u5F85\u7EC8\u7AEF\u8D85\u65F6\uFF0C\u547D\u4EE4\u6CA1\u6709\u53D1\u9001";
function whenWritable(view, timeoutMs) {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => void 0;
    const finish = (error) => {
      clearTimeout(timer);
      unsubscribe();
      if (error === void 0) resolve();
      else reject(error);
    };
    const check = () => {
      const state = view.state.getSnapshot();
      if (state.writable) finish();
      else if (DEAD_PHASES.has(state.phase)) finish(new Error(state.error ?? ATTACH_FAILED));
    };
    const timer = setTimeout(() => {
      finish(new Error(ATTACH_TIMED_OUT));
    }, timeoutMs);
    unsubscribe = view.state.subscribe(check);
    check();
  });
}
function openFreshTerminal(sidebar, sessionId) {
  const before = new Set(sidebar.tabsIn(sessionId).map((tab) => tab.id));
  sidebar.openTabIn(sessionId, TERMINAL_KIND2);
  const opened = sidebar.tabsIn(sessionId).find((tab) => tab.kind === TERMINAL_KIND2 && !before.has(tab.id));
  if (opened === void 0) throw new Error(OPEN_FAILED);
  return opened;
}
function createLaunchRunner(sidebar, terminals, timeoutMs = ATTACH_TIMEOUT_MS) {
  let owned = /* @__PURE__ */ new Map();
  return {
    async run(sessionId, script) {
      const key = `${sessionId}
${script.id}`;
      const previous = owned.get(key);
      if (previous !== void 0 && sidebar.tabsIn(sessionId).some((tab2) => tab2.id === previous)) {
        sidebar.closeIn(sessionId, previous);
      }
      const tab = openFreshTerminal(sidebar, sessionId);
      owned = new Map(owned).set(key, tab.id);
      const view = terminals.view(sessionId, tab.id, tab.contentId);
      await whenWritable(view, timeoutMs);
      view.write(shellInput(script.command));
      view.rename(scriptLabel(script)).catch(() => {
      });
    }
  };
}

// src/client/launch-script-entry.tsx
var import_react11 = require("react");
var import_dsh_client_ui_primitives10 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/launch-script-dialog.tsx
var import_dsh_client_ui_primitives9 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/launch-script-form.tsx
var import_react9 = require("react");
var import_dsh_client_ui_primitives7 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime10 = require("react/jsx-runtime");
var NAME_LABEL = "\u540D\u79F0";
var NAME_PLACEHOLDER = "\u4F8B\u5982\uFF1A\u5F00\u53D1\u670D\u52A1\u5668\uFF08\u53EF\u7559\u7A7A\uFF09";
var COMMAND_LABEL = "\u547D\u4EE4";
var COMMAND_PLACEHOLDER = "npm run dev";
var COMMAND_HINT = "\u5728\u4F1A\u8BDD\u7684\u5DE5\u4F5C\u76EE\u5F55\u4E0B\u6267\u884C\u3002\u591A\u884C\u547D\u4EE4\u4F1A\u9010\u884C\u6267\u884C\u3002\u2318/Ctrl + Enter \u4FDD\u5B58\u3002";
function useScriptForm(initial) {
  const [draft, setDraft] = (0, import_react9.useState)(initial);
  return {
    draft,
    problem: draftProblem(draft),
    setName: (name) => {
      setDraft((current) => ({ ...current, name }));
    },
    setCommand: (command) => {
      setDraft((current) => ({ ...current, command }));
    }
  };
}
function CommandField(props) {
  const commandId = (0, import_react9.useId)();
  const hintId = (0, import_react9.useId)();
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: LS.field, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("label", { className: LS.label, htmlFor: commandId, children: COMMAND_LABEL }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      "textarea",
      {
        id: commandId,
        className: LS.textarea,
        rows: 3,
        "data-modal-autofocus": "",
        spellCheck: false,
        autoCapitalize: "off",
        autoCorrect: "off",
        "aria-describedby": hintId,
        value: props.command,
        placeholder: COMMAND_PLACEHOLDER,
        onChange: (event) => {
          props.onChange(event.currentTarget.value);
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { id: hintId, className: LS.hint, children: COMMAND_HINT })
  ] });
}
function LaunchScriptForm(props) {
  const { form, error, onSubmit } = props;
  const nameId = (0, import_react9.useId)();
  const submitOnShortcut = (event) => {
    if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey) || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onSubmit();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: LS.form, onKeyDown: submitOnShortcut, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: LS.field, children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("label", { className: LS.label, htmlFor: nameId, children: NAME_LABEL }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        import_dsh_client_ui_primitives7.Input,
        {
          id: nameId,
          value: form.draft.name,
          maxLength: MAX_NAME_LENGTH,
          placeholder: NAME_PLACEHOLDER,
          onChange: (event) => {
            form.setName(event.currentTarget.value);
          }
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(CommandField, { command: form.draft.command, onChange: form.setCommand }),
    error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { role: "alert", className: LS.error, children: error })
  ] });
}

// src/client/launch-script-list.tsx
var import_react10 = require("react");
var import_dsh_client_ui_primitives8 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime11 = require("react/jsx-runtime");
var DEFAULT_BADGE = "\u9ED8\u8BA4";
var RUN = "\u8FD0\u884C";
var EDIT = "\u7F16\u8F91";
var MAKE_DEFAULT = "\u8BBE\u4E3A\u9ED8\u8BA4";
var DELETE = "\u5220\u9664";
var CONFIRM_DELETE = "\u518D\u70B9\u4E00\u6B21\u5220\u9664";
var EMPTY_TEXT = "\u8FD8\u6CA1\u6709\u542F\u52A8\u811A\u672C\u3002\u6DFB\u52A0\u4E00\u6761\u5E38\u7528\u547D\u4EE4\uFF0C\u4F8B\u5982\u542F\u52A8\u5F00\u53D1\u670D\u52A1\u5668\uFF0C\u4E4B\u540E\u5728\u6807\u9898\u680F\u4E00\u952E\u8FD0\u884C\u3002";
var TOOLTIP_DELAY_MS2 = 500;
function RowButton(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_dsh_client_ui_primitives8.Tooltip, { label: props.label, side: "top", delayMs: TOOLTIP_DELAY_MS2, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    import_dsh_client_ui_primitives8.Button,
    {
      size: "sm",
      className: LS.iconButton,
      "aria-label": props.label,
      "data-danger": props.danger === true ? "" : void 0,
      onClick: props.onClick,
      children: props.children
    }
  ) });
}
function RowActions(props) {
  const { script, first, actions, confirming, onConfirm } = props;
  const label = scriptLabel(script);
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: LS.rowActions, children: [
    first ? null : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      import_dsh_client_ui_primitives8.Button,
      {
        size: "sm",
        onClick: () => {
          actions.onPromote(script);
        },
        children: MAKE_DEFAULT
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(RowButton, { label: `${RUN} ${label}`, onClick: () => actions.onRun(script), children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_dsh_client_ui_primitives8.IconPlayOutlineRegular, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(RowButton, { label: `${EDIT} ${label}`, onClick: () => actions.onEdit(script), children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_dsh_client_ui_primitives8.IconEditOutlineRegular, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      RowButton,
      {
        label: confirming ? CONFIRM_DELETE : `${DELETE} ${label}`,
        danger: confirming,
        onClick: () => {
          if (confirming) actions.onRemove(script);
          else onConfirm();
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_dsh_client_ui_primitives8.IconTrashOutlineRegular, {})
      }
    )
  ] });
}
function ScriptRow(props) {
  const { script, first } = props;
  const [confirming, setConfirming] = (0, import_react10.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
    "li",
    {
      className: LS.row,
      onMouseLeave: () => {
        setConfirming(false);
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: LS.rowText, children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: LS.rowName, children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: scriptLabel(script) }),
            first ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: LS.badge, children: DEFAULT_BADGE }) : null
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: LS.rowCommand, title: script.command, children: script.command })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          RowActions,
          {
            ...props,
            confirming,
            onConfirm: () => {
              setConfirming(true);
            }
          }
        )
      ]
    }
  );
}
function LaunchScriptList(props) {
  if (props.scripts.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: LS.empty, children: EMPTY_TEXT });
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("ul", { className: LS.list, children: props.scripts.map((script, index) => /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(ScriptRow, { script, first: index === 0, actions: props.actions }, script.id)) });
}

// src/client/launch-script-dialog.tsx
var import_jsx_runtime12 = require("react/jsx-runtime");
var TITLE = "\u542F\u52A8\u811A\u672C";
var ADD_TITLE = "\u6DFB\u52A0\u542F\u52A8\u811A\u672C";
var EDIT_TITLE = "\u7F16\u8F91\u542F\u52A8\u811A\u672C";
var DESCRIPTION = "\u4FDD\u5B58\u5728\u5F53\u524D\u5DE5\u4F5C\u76EE\u5F55\u4E0B\uFF0C\u6240\u6709\u4F1A\u8BDD\u5171\u7528\u3002\u6BCF\u4E2A\u811A\u672C\u5728\u72EC\u7ACB\u7684\u7EC8\u7AEF\u6807\u7B7E\u91CC\u8FD0\u884C\uFF0C\u518D\u6B21\u8FD0\u884C\u4F1A\u5148\u7ED3\u675F\u4E0A\u4E00\u6B21\u3002";
var CLOSE = "\u5173\u95ED";
var ADD = "\u6DFB\u52A0\u811A\u672C";
var DONE = "\u5B8C\u6210";
var CANCEL = "\u53D6\u6D88";
var BACK = "\u8FD4\u56DE";
var SAVE = "\u4FDD\u5B58";
var LIST_PAGE = { kind: "list" };
var NEW_SCRIPT_PAGE = { kind: "form", draft: { name: "", command: "" } };
function FormPage(props) {
  const { draft, scripts, error, onPage, onChange, onClose, newId } = props;
  const form = useScriptForm(draft);
  const backToList = scripts.length > 0;
  const submit = () => {
    if (form.problem !== void 0) return;
    onChange(saveDraft(scripts, form.draft, newId));
    onPage(LIST_PAGE);
  };
  const shown = error ?? (form.draft.command.trim() === "" ? void 0 : form.problem);
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
    import_dsh_client_ui_primitives9.Modal,
    {
      open: true,
      title: draft.id === void 0 ? ADD_TITLE : EDIT_TITLE,
      closeLabel: CLOSE,
      className: LS.dialog,
      onClose,
      footer: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: LS.footer, children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_dsh_client_ui_primitives9.Button, { variant: "ghost", onClick: backToList ? () => onPage(LIST_PAGE) : onClose, children: backToList ? BACK : CANCEL }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_dsh_client_ui_primitives9.Button, { variant: "primary", disabled: form.problem !== void 0, onClick: submit, children: SAVE })
      ] }),
      children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(LaunchScriptForm, { form, error: shown, onSubmit: submit })
    }
  );
}
function ListPage(props) {
  const { scripts, error, onPage, onChange, onRun, onClose } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
    import_dsh_client_ui_primitives9.Modal,
    {
      open: true,
      title: TITLE,
      description: DESCRIPTION,
      closeLabel: CLOSE,
      className: LS.dialog,
      onClose,
      footer: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: LS.footer, children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          import_dsh_client_ui_primitives9.Button,
          {
            "data-leading": "",
            variant: "outline",
            icon: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_dsh_client_ui_primitives9.IconPlusOutlineRegular, { size: 14 }),
            onClick: () => onPage(NEW_SCRIPT_PAGE),
            children: ADD
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_dsh_client_ui_primitives9.Button, { variant: "primary", onClick: onClose, children: DONE })
      ] }),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          LaunchScriptList,
          {
            scripts,
            actions: {
              onRun,
              onEdit: (script) => onPage({ kind: "form", draft: script }),
              onPromote: (script) => onChange(promoteScript(scripts, script.id)),
              onRemove: (script) => onChange(removeScript(scripts, script.id))
            }
          }
        ),
        error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { role: "alert", className: LS.error, children: error })
      ]
    }
  );
}
function LaunchScriptDialog(props) {
  const { page } = props;
  if (page.kind === "list") return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ListPage, { ...props });
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(FormPage, { ...props, draft: page.draft }, page.draft.id ?? "new");
}

// src/client/launch-script-entry.tsx
var import_jsx_runtime13 = require("react/jsx-runtime");
var MANAGE_ID = "vyra-agent-cli-manager.launch-scripts.manage";
var SET_UP = "\u8BBE\u7F6E\u542F\u52A8\u811A\u672C";
var RUN_PREFIX = "\u8FD0\u884C\uFF1A";
var MORE = "\u542F\u52A8\u811A\u672C";
var MANAGE = "\u7BA1\u7406\u542F\u52A8\u811A\u672C\u2026";
var SAVE_FAILED = "\u6CA1\u80FD\u4FDD\u5B58\u542F\u52A8\u811A\u672C";
var TOOLTIP_DELAY_MS3 = 500;
function message(error) {
  return error instanceof Error ? error.message : String(error);
}
function useWorkspaceScripts(list, book, sessionId) {
  const subscribeList = (0, import_react11.useCallback)((listener) => list.subscribe(listener), [list]);
  const cwd = (0, import_react11.useSyncExternalStore)(subscribeList, () => list.getSnapshot().byId[sessionId]?.cwd);
  const subscribeBook = (0, import_react11.useCallback)((listener) => book.subscribe(listener), [book]);
  const scripts = (0, import_react11.useSyncExternalStore)(subscribeBook, () => book.read(cwd));
  return { cwd, scripts };
}
function MenuRow({ script }) {
  const label = scriptLabel(script);
  const command = script.command.trim();
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("span", { className: LS.menuRow, children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: LS.menuName, children: label }),
    command === label ? null : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: LS.menuCommand, children: command })
  ] });
}
function menuItems(scripts) {
  return [
    ...scripts.map((script) => ({
      id: script.id,
      label: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(MenuRow, { script }),
      icon: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_dsh_client_ui_primitives10.IconPlayOutlineRegular, { size: 14 })
    })),
    { id: MANAGE_ID, label: MANAGE, icon: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_dsh_client_ui_primitives10.IconSettingsOutlineRegular, { size: 14 }) }
  ];
}
function useLaunchActions({ sessionId, list, book, runner }) {
  const { cwd, scripts } = useWorkspaceScripts(list, book, sessionId);
  const [page, setPage] = (0, import_react11.useState)();
  const [toast, setToast] = (0, import_react11.useState)();
  const [saveError, setSaveError] = (0, import_react11.useState)();
  const openPage = (next) => {
    setSaveError(void 0);
    setPage(next);
  };
  const run = (script) => {
    openPage(void 0);
    runner.run(sessionId, script).catch((error) => {
      setToast(`\u6CA1\u80FD\u8FD0\u884C\u300C${scriptLabel(script)}\u300D\uFF1A${message(error)}`);
    });
  };
  const change = (next) => {
    try {
      book.write(cwd, next);
      setSaveError(void 0);
    } catch (error) {
      setSaveError(`${SAVE_FAILED}\uFF1A${message(error)}`);
    }
  };
  return { scripts, page, toast, saveError, openPage, run, change, clearToast: () => setToast(void 0) };
}
function RunButton(props) {
  const label = props.primary === void 0 ? SET_UP : `${RUN_PREFIX}${scriptLabel(props.primary)}`;
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_dsh_client_ui_primitives10.Tooltip, { label, side: "bottom", delayMs: TOOLTIP_DELAY_MS3, children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
    import_dsh_client_ui_primitives10.Button,
    {
      size: "sm",
      className: LS.run,
      "aria-label": label,
      "data-has-more": props.primary === void 0 ? void 0 : "",
      onClick: props.onClick,
      children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_dsh_client_ui_primitives10.IconPlayOutlineRegular, {})
    }
  ) });
}
function ScriptMenu(props) {
  const [open, setOpen] = (0, import_react11.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
    import_dsh_client_ui_primitives10.Menu,
    {
      open,
      items: menuItems(props.scripts),
      onSelect: (id) => {
        setOpen(false);
        const chosen = props.scripts.find((script) => script.id === id);
        if (chosen === void 0) props.onManage();
        else props.onRun(chosen);
      },
      onClose: () => {
        setOpen(false);
      },
      portal: true,
      anchor: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
        import_dsh_client_ui_primitives10.Button,
        {
          size: "sm",
          className: LS.more,
          "aria-label": MORE,
          "aria-haspopup": "menu",
          "aria-expanded": open,
          onClick: () => {
            setOpen((value) => !value);
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_dsh_client_ui_primitives10.IconChevronDownOutlineRegular, {})
        }
      )
    }
  );
}
function LaunchScriptEntry(props) {
  const { scripts, page, toast, saveError, openPage, run, change, clearToast } = useLaunchActions(props);
  const [anchor, setAnchor] = (0, import_react11.useState)(null);
  const primary = scripts[0];
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: LS.group, ref: setAnchor, children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
      RunButton,
      {
        primary,
        onClick: () => {
          if (primary === void 0) openPage(NEW_SCRIPT_PAGE);
          else run(primary);
        }
      }
    ),
    primary === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(ScriptMenu, { scripts, onRun: run, onManage: () => openPage(LIST_PAGE) }),
    page === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
      LaunchScriptDialog,
      {
        page,
        scripts,
        error: saveError,
        onPage: openPage,
        onChange: change,
        onRun: run,
        onClose: () => {
          openPage(void 0);
        },
        newId: props.newId
      }
    ),
    toast === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_dsh_client_ui_primitives10.Toast, { text: toast, anchor, onDone: clearToast })
  ] });
}

// src/client/launch-script-register.ts
var SLOT2 = "conversation.session.header.utilities";
var ENTRY_ORDER2 = -2;
function registerLaunchScripts(ctx, list, storage, newId) {
  ctx.inject(["sidebarRight", "webTerminals"], (child) => {
    const book = createScriptBook(storage);
    const runner = createLaunchRunner(child.sidebarRight, child.webTerminals);
    child.slots.inject(
      SLOT2,
      () => child.slots.register(
        {
          name: SLOT2,
          id: "vyra-agent-cli-manager.launch-scripts",
          order: ENTRY_ORDER2,
          inject: () => ({ list, book, runner, newId })
        },
        LaunchScriptEntry
      )
    );
  });
}

// src/client/feature-settings.ts
var FEATURES_STORAGE_KEY = "vyra-agent-cli-manager.features";
var FEATURES = [
  {
    id: "filesDefault",
    title: "\u53F3\u4FA7\u680F\u9ED8\u8BA4\u6253\u5F00\u5DE5\u4F5C\u533A\u6587\u4EF6",
    description: "\u5C55\u5F00\u53F3\u4FA7\u680F\u65F6\u76F4\u63A5\u663E\u793A\u5DE5\u4F5C\u533A\u6587\u4EF6\u3002\u5173\u95ED\u540E\u6062\u590D\u663E\u793A\u300C\u5F00\u59CB\u300D\u5F15\u5BFC\u9875\u3002"
  },
  {
    id: "gitChanges",
    title: "\u53F3\u4FA7\u680F\u7684\u53D8\u66F4\u9875",
    description: "\u5728\u53F3\u4FA7\u680F\u67E5\u770B\u3001\u6682\u5B58\u5E76\u63D0\u4EA4 Git \u53D8\u66F4\uFF0C\u548C\u5DE5\u4F5C\u533A\u6587\u4EF6\u4E00\u8D77\u6253\u5F00\u3002\u5173\u95ED\u540E\u79FB\u9664\u8FD9\u4E2A\u9875\u9762\u3002"
  },
  {
    id: "compactTabs",
    title: "\u53F3\u4FA7\u680F\u7D27\u51D1\u9875\u7B7E",
    description: "\u53F3\u4FA7\u680F\u7684\u9875\u7B7E\u53EA\u663E\u793A\u56FE\u6807\uFF0C\u60AC\u505C\u65F6\u663E\u793A\u540D\u79F0\u548C\u5173\u95ED\u6309\u94AE\u3002\u5173\u95ED\u540E\u6062\u590D\u56FE\u6807\u52A0\u6587\u5B57\u7684\u5BBD\u9875\u7B7E\u3002"
  },
  {
    id: "terminalEntry",
    title: "\u4F1A\u8BDD\u9876\u90E8\u7684\u7EC8\u7AEF\u6309\u94AE",
    description: "\u5728\u4F1A\u8BDD\u6807\u9898\u680F\u4E00\u952E\u6253\u5F00\u6216\u6536\u8D77\u7EC8\u7AEF\u3002\u5173\u95ED\u540E\u4ECE\u53F3\u4FA7\u680F\u6253\u5F00\u7EC8\u7AEF\u3002"
  },
  {
    id: "launchScripts",
    title: "\u4F1A\u8BDD\u9876\u90E8\u7684\u542F\u52A8\u811A\u672C",
    description: "\u5728\u4F1A\u8BDD\u6807\u9898\u680F\u4FDD\u5B58\u5E76\u4E00\u952E\u8FD0\u884C\u5E38\u7528\u547D\u4EE4\u3002\u5173\u95ED\u53EA\u9690\u85CF\u5165\u53E3\uFF0C\u5DF2\u4FDD\u5B58\u7684\u811A\u672C\u4F1A\u4FDD\u7559\u3002"
  },
  {
    id: "worktree",
    title: "\u9879\u76EE\u53F3\u952E\u65B0\u5EFA Worktree",
    description: "\u5728\u5DE6\u4FA7\u680F\u9879\u76EE\u7684\u53F3\u952E\u83DC\u5355\u91CC\u65B0\u5EFA Git worktree\uFF0C\u5E76\u4F5C\u4E3A\u65B0\u5DE5\u4F5C\u533A\u6253\u5F00\u3002\u5173\u95ED\u540E\u79FB\u9664\u8FD9\u4E2A\u83DC\u5355\u9879\u3002"
  }
];
var DEFAULT_FLAGS = {
  filesDefault: true,
  gitChanges: true,
  compactTabs: true,
  terminalEntry: true,
  launchScripts: true,
  worktree: true
};
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseFlags(raw) {
  if (raw === null) return DEFAULT_FLAGS;
  let value;
  try {
    value = JSON.parse(raw);
  } catch (_error) {
    return DEFAULT_FLAGS;
  }
  if (!isRecord3(value)) return DEFAULT_FLAGS;
  return FEATURES.reduce((flags, { id }) => {
    const stored = value[id];
    return typeof stored === "boolean" ? { ...flags, [id]: stored } : flags;
  }, DEFAULT_FLAGS);
}
function readFlags(storage) {
  try {
    return parseFlags(storage.getItem(FEATURES_STORAGE_KEY));
  } catch (_error) {
    return DEFAULT_FLAGS;
  }
}
function createFeatureSettings(storage) {
  let flags = readFlags(storage);
  let listeners = [];
  return {
    getSnapshot: () => flags,
    subscribe(listener) {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((candidate) => candidate !== listener);
      };
    },
    set(id, enabled) {
      if (flags[id] === enabled) return;
      flags = { ...flags, [id]: enabled };
      try {
        storage.setItem(FEATURES_STORAGE_KEY, JSON.stringify(flags));
      } catch (_error) {
      }
      for (const listener of listeners) listener();
    }
  };
}
function whileEnabled(settings, id, install) {
  let uninstall;
  const reconcile = () => {
    const enabled = settings.getSnapshot()[id];
    if (enabled && uninstall === void 0) uninstall = install();
    if (!enabled && uninstall !== void 0) {
      const current = uninstall;
      uninstall = void 0;
      current();
    }
  };
  reconcile();
  const unsubscribe = settings.subscribe(reconcile);
  return () => {
    unsubscribe();
    uninstall?.();
    uninstall = void 0;
  };
}

// src/client/compact-tabs.ts
var CHIP = "[data-dockkit-tab]";
var TITLE2 = "[data-dockkit-tab-title]";
var CLOSE2 = "[data-dockkit-tab-close]";
var SIDEBAR_TITLE = `${TITLE2} > [data-sidebar-right-tab]`;
var TIP_ATTR = "data-vyra-agent-cli-manager-tab-tip";
var CLOSE_ROOM_PX = 28;
var GLYPH_PX = 16;
var TIP_GAP_PX = 8;
var TIP_MARGIN_PX = 12;
var SIDEBAR_CHIP = `${CHIP}:has(> ${SIDEBAR_TITLE})`;
var ICON_CHIP = `${SIDEBAR_CHIP}:has(${TITLE2} :is(svg, img)):not(:has(${TITLE2} input))`;
var COMPACT_TABS_STYLES = `
${SIDEBAR_CHIP} { min-width: 0; max-width: 128px; padding: 0 8px; }
${ICON_CHIP} { flex: none; max-width: none; padding: 0 6px; }
${ICON_CHIP}[aria-selected="true"]:has(${CLOSE2}) { padding-right: ${String(CLOSE_ROOM_PX)}px; }
${ICON_CHIP} > ${TITLE2} {
  flex: none;
  width: ${String(GLYPH_PX)}px;
  overflow: hidden;
  white-space: nowrap;
  mask-image: none;
}
${ICON_CHIP} > ${TITLE2} :is(svg, img) { flex: none; }
${ICON_CHIP}:not([aria-selected="true"]) ${CLOSE2} { opacity: 0; pointer-events: none; }
[${TIP_ATTR}] {
  position: fixed;
  z-index: 1100;
  box-sizing: border-box;
  width: max-content;
  max-width: min(50vw, calc(100vw - 24px));
  padding: 3px 7px;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-tooltip-bg);
  color: var(--dsw-static-neutral-bluish-00);
  font-size: 13px;
  line-height: 20px;
  white-space: pre-line;
  overflow-wrap: break-word;
  pointer-events: none;
  transform: translateX(-50%);
}
`;
function tipPlacement(tip, chip, viewport) {
  const rect = chip.getBoundingClientRect();
  const width = tip.getBoundingClientRect().width;
  const center = Math.min(
    Math.max(rect.left + rect.width / 2, TIP_MARGIN_PX + width / 2),
    viewport - TIP_MARGIN_PX - width / 2
  );
  return { left: `${String(center)}px`, top: `${String(rect.bottom + TIP_GAP_PX)}px` };
}
function createCompactTip(doc) {
  const tip = doc.createElement("div");
  tip.setAttribute("role", "tooltip");
  tip.setAttribute(TIP_ATTR, "");
  tip.hidden = true;
  let owner;
  const hide = () => {
    owner = void 0;
    tip.hidden = true;
    tip.remove();
  };
  const show = (chip) => {
    const name = chip.querySelector(TITLE2)?.textContent.trim() ?? "";
    if (name === "") {
      hide();
      return;
    }
    owner = chip;
    tip.textContent = name;
    tip.hidden = false;
    doc.body.append(tip);
    const { left, top } = tipPlacement(tip, chip, doc.defaultView?.innerWidth ?? 0);
    tip.style.left = left;
    tip.style.top = top;
  };
  const onPointerOver = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const chip = target.closest(CHIP);
    if (chip?.matches(ICON_CHIP) === true) {
      if (chip !== owner) show(chip);
      return;
    }
    if (!owner?.contains(target)) hide();
  };
  const onPointerOut = (event) => {
    if (owner === void 0) return;
    const to = event.relatedTarget;
    if (to instanceof Node && owner.contains(to)) return;
    hide();
  };
  const onFocusIn = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const chip = target.closest(CHIP);
    if (chip?.matches(ICON_CHIP) === true) show(chip);
  };
  return { hide, onPointerOver, onPointerOut, onFocusIn };
}
function installCompactTabs(doc) {
  const tag = doc.createElement("style");
  tag.dataset.plugin = "vyra-agent-cli-manager.compact-tabs";
  tag.textContent = COMPACT_TABS_STYLES;
  doc.head.append(tag);
  const tip = createCompactTip(doc);
  doc.addEventListener("pointerover", tip.onPointerOver, true);
  doc.addEventListener("pointerout", tip.onPointerOut, true);
  doc.addEventListener("focusin", tip.onFocusIn, true);
  doc.addEventListener("focusout", tip.hide, true);
  doc.addEventListener("pointerdown", tip.hide, true);
  doc.addEventListener("scroll", tip.hide, true);
  doc.defaultView?.addEventListener("resize", tip.hide);
  return () => {
    doc.removeEventListener("pointerover", tip.onPointerOver, true);
    doc.removeEventListener("pointerout", tip.onPointerOut, true);
    doc.removeEventListener("focusin", tip.onFocusIn, true);
    doc.removeEventListener("focusout", tip.hide, true);
    doc.removeEventListener("pointerdown", tip.hide, true);
    doc.removeEventListener("scroll", tip.hide, true);
    doc.defaultView?.removeEventListener("resize", tip.hide);
    tip.hide();
    tag.remove();
  };
}

// src/client/settings-page.tsx
var import_dsh_client_ui_primitives12 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/cli-prefs-section.tsx
var import_dsh_client_ui_primitives11 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime14 = require("react/jsx-runtime");
var SECTION_INTRO = "\u8F93\u5165\u6846 CLI \u5207\u6362\u83DC\u5355\u91CC\u7684\u987A\u5E8F\u548C\u663E\u793A\u7684\u9879\u3002\u5173\u95ED\u7684 CLI \u4E0D\u518D\u51FA\u73B0\u5728\u83DC\u5355\u4E2D\u3002";
var EMPTY_HINT = "\u6253\u5F00\u4EFB\u4E00\u4F1A\u8BDD\u540E\uFF0C\u8FD9\u91CC\u4F1A\u5217\u51FA\u53EF\u5207\u6362\u7684 CLI\u3002";
var OFF_HINT = "\u5DF2\u5173\u95ED\uFF0C\u4E0D\u5728 CLI \u83DC\u5355\u4E2D\u663E\u793A";
var LOCKED_HINT = "\u5185\u7F6E\u63D0\u4F9B\u65B9\uFF0C\u59CB\u7EC8\u663E\u793A";
var SWITCH_ON_TITLE = "\u5173\u95ED\u540E\u4E0D\u518D\u51FA\u73B0\u5728 CLI \u83DC\u5355";
var SWITCH_OFF_TITLE = "\u5F00\u542F\u540E\u91CD\u65B0\u51FA\u73B0\u5728 CLI \u83DC\u5355";
var MORE_CLIS_HINT = "\u66F4\u591A CLI \u9002\u914D\u4E2D\u2026";
var MARK_SIZE2 = 16;
var ARROW_SIZE = 14;
var SECTION_CLASS = "vyra-agent-cli-manager-cli-prefs";
var CLI_PREFS_STYLES = `
.${SECTION_CLASS} { margin: 0; }
.${SECTION_CLASS}-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
.${SECTION_CLASS}-row + .${SECTION_CLASS}-row { border-top: 0.5px solid var(--dsw-alias-border-l2); }
.${SECTION_CLASS}-name { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; }
.${SECTION_CLASS}-off { color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); font-size: 12px; line-height: 18px; }
.${SECTION_CLASS}-locked { flex: 0 0 auto; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); font-size: 12px; line-height: 18px; }
.${SECTION_CLASS}-moves { display: flex; gap: 2px; }
.${SECTION_CLASS}-more { display: flex; align-items: center; gap: 10px; margin: 14px 0 0; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); font-size: 12px; line-height: 18px; }
.${SECTION_CLASS}-more::before, .${SECTION_CLASS}-more::after { content: ''; flex: 1; border-top: 1px dashed var(--dsw-alias-border-l2); }
`;
function MoveButtons({
  entry,
  first,
  last,
  prefs
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: `${SECTION_CLASS}-moves`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      import_dsh_client_ui_primitives11.Button,
      {
        size: "sm",
        "aria-label": `\u4E0A\u79FB ${entry.label}`,
        disabled: first,
        icon: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(import_dsh_client_ui_primitives11.IconChevronUpOutlineRegular, { size: ARROW_SIZE }),
        onClick: () => {
          prefs.move(entry.id, -1);
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      import_dsh_client_ui_primitives11.Button,
      {
        size: "sm",
        "aria-label": `\u4E0B\u79FB ${entry.label}`,
        disabled: last,
        icon: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(import_dsh_client_ui_primitives11.IconChevronDownOutlineRegular, { size: ARROW_SIZE }),
        onClick: () => {
          prefs.move(entry.id, 1);
        }
      }
    )
  ] });
}
function CliRow({
  entry,
  first,
  last,
  prefs
}) {
  const locked = isBuiltInChoice(entry.id);
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("li", { className: `${SECTION_CLASS}-row`, "aria-label": entry.label, children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: `${SECTION_CLASS}-name`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(ProviderMark, { provider: entry.id, size: MARK_SIZE2 }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { children: entry.label }),
      entry.enabled ? null : /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: `${SECTION_CLASS}-off`, role: "status", children: OFF_HINT })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(MoveButtons, { entry, first, last, prefs }),
    locked ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: `${SECTION_CLASS}-locked`, children: LOCKED_HINT }) : /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      import_dsh_client_ui_primitives11.Switch,
      {
        checked: entry.enabled,
        label: `\u542F\u7528 ${entry.label}`,
        title: entry.enabled ? SWITCH_ON_TITLE : SWITCH_OFF_TITLE,
        onChange: (next) => {
          prefs.setEnabled(entry.id, next);
        }
      }
    )
  ] });
}
function CliPrefsSection({ prefs }) {
  const entries = listedEntries(useStore(prefs));
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("section", { className: SECTION_CLASS, children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("p", { className: "vyra-agent-cli-manager-settings-intro", children: entries.length === 0 ? EMPTY_HINT : SECTION_INTRO }),
    entries.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("ul", { className: "vyra-agent-cli-manager-settings-list", children: entries.map((entry, index) => /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      CliRow,
      {
        entry,
        first: index === 0,
        last: index === entries.length - 1,
        prefs
      },
      entry.id
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("p", { className: `${SECTION_CLASS}-more`, children: MORE_CLIS_HINT })
  ] });
}

// src/client/cli-status-section.tsx
var import_react12 = require("react");

// src/client/cli-asset-panels.tsx
var import_jsx_runtime15 = require("react/jsx-runtime");
var CLASS = "vyra-agent-cli-manager-clis";
var LABELS = {
  skillsLoading: "\u6B63\u5728\u8BFB\u53D6\u6280\u80FD\u2026",
  skillsEmpty: "\u8BE5 CLI \u6CA1\u6709\u6280\u80FD\u3002",
  skillsFailed: "\u6280\u80FD\u8BFB\u53D6\u5931\u8D25",
  skillsFrom: "\u6280\u80FD\u76EE\u5F55\uFF1A",
  skillsBlocked: "\uFF08\u65E0 SKILL.md\uFF0C\u4E0D\u4F1A\u88AB\u52A0\u8F7D\uFF09",
  promptLoading: "\u6B63\u5728\u8BFB\u53D6\u63D0\u793A\u8BCD\u2026",
  promptEmpty: "\u8BE5 CLI \u6CA1\u6709\u5168\u5C40\u63D0\u793A\u8BCD\u6587\u4EF6\u3002",
  promptFailed: "\u63D0\u793A\u8BCD\u8BFB\u53D6\u5931\u8D25",
  promptFrom: "\u8DEF\u5F84\uFF1A"
};
function Note({ text }) {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: `${CLASS}-meta`, children: text });
}
function Problem({ text }) {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: `${CLASS}-error`, children: text });
}
function SkillsPanel({ state }) {
  if (state === void 0) return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Note, { text: LABELS.skillsLoading });
  if (state.error !== void 0) return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Problem, { text: `${LABELS.skillsFailed}\uFF1A${state.error}` });
  const from = `${LABELS.skillsFrom}${state.directories.join("\u3001")}`;
  if (state.skills.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Note, { text: from }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Note, { text: LABELS.skillsEmpty })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Note, { text: from }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: `${CLASS}-mcp-row`, children: state.skills.map((skill) => /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: skill.loadable ? `${CLASS}-mcp-name` : void 0, children: skill.loadable ? skill.name : `${skill.name}${LABELS.skillsBlocked}` }, skill.name)) })
  ] });
}
function PromptPanel({ state }) {
  if (state === void 0) return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Note, { text: LABELS.promptLoading });
  if (state.error !== void 0) return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Problem, { text: `${LABELS.promptFailed}\uFF1A${state.error}` });
  if (state.text === "") {
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Note, { text: `${LABELS.promptFrom}${state.path}` }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Note, { text: LABELS.promptEmpty })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Note, { text: `${LABELS.promptFrom}${state.path}\uFF08${String(state.text.length)} \u5B57\uFF09` }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("pre", { className: `${CLASS}-raw`, children: state.text })
  ] });
}

// src/client/cli-api.ts
var MCP_MATRIX_URL = "/vyra-agent-cli-manager/cli/mcp-matrix";
var MCP_ADD_URL = "/vyra-agent-cli-manager/cli/mcp-add";
var MCP_COPY_URL = "/vyra-agent-cli-manager/cli/mcp-copy";
var MCP_REMOVE_URL = "/vyra-agent-cli-manager/cli/mcp-remove";
var SKILLS_URL = "/vyra-agent-cli-manager/cli/skills";
var SKILLS_MATRIX_URL = "/vyra-agent-cli-manager/cli/skills-matrix";
var SKILL_ENABLE_URL = "/vyra-agent-cli-manager/cli/skill-enable";
var SKILL_DISABLE_URL = "/vyra-agent-cli-manager/cli/skill-disable";
var SKILL_INSTALL_URL = "/vyra-agent-cli-manager/cli/skill-install";
var PROMPT_URL = "/vyra-agent-cli-manager/cli/prompt";
async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.trim() === "" ? `HTTP ${String(response.status)}` : text.trim().slice(0, 160));
  }
}
function textOf2(value) {
  return typeof value === "string" ? value : "";
}
function dataOf(payload) {
  if (payload.success !== true) throw new Error(textOf2(payload.error) || "\u8BF7\u6C42\u5931\u8D25");
  const data = payload.data;
  if (typeof data !== "object" || data === null) throw new Error("\u8FD4\u56DE\u5185\u5BB9\u7F3A\u5C11 data");
  return data;
}
async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store"
  });
  return dataOf(await readJson(response));
}
function isSkill(value) {
  if (typeof value !== "object" || value === null) return false;
  const row = value;
  return typeof row.name === "string" && typeof row.loadable === "boolean";
}
async function writeAndCheck(url, body) {
  const data = await post(url, body);
  const exitCode = typeof data.exitCode === "number" ? data.exitCode : null;
  if (exitCode === 0 || exitCode === null) return;
  const detail = textOf2(data.stderr).trim() || textOf2(data.stdout).trim();
  throw new Error(detail === "" ? `\u9000\u51FA\u7801 ${String(exitCode)}` : detail.slice(-300));
}
async function addMcp(id, spec) {
  await writeAndCheck(MCP_ADD_URL, { id, ...spec });
}
async function removeMcp(id, name) {
  await writeAndCheck(MCP_REMOVE_URL, { id, name });
}
async function copyMcp(from, to, name) {
  await writeAndCheck(MCP_COPY_URL, { from, to, name });
}
function isColumn(value) {
  if (typeof value !== "object" || value === null) return false;
  const row = value;
  return typeof row.id === "string" && typeof row.name === "string" && typeof row.readable === "boolean";
}
function isCell(value) {
  if (typeof value !== "object" || value === null) return false;
  const row = value;
  return typeof row.id === "string" && (row.state === "on" || row.state === "off" || row.state === "unknown");
}
function isRow2(value) {
  if (typeof value !== "object" || value === null) return false;
  const row = value;
  return typeof row.name === "string" && Array.isArray(row.cells) && row.cells.every(isCell);
}
async function fetchMcpMatrix() {
  const data = await post(MCP_MATRIX_URL, {});
  return {
    columns: Array.isArray(data.columns) ? data.columns.filter(isColumn) : [],
    rows: Array.isArray(data.rows) ? data.rows.filter(isRow2) : []
  };
}
async function installSkill(source) {
  const data = await post(SKILL_INSTALL_URL, source);
  return {
    name: typeof data.name === "string" ? data.name : "",
    path: typeof data.path === "string" ? data.path : "",
    replaced: data.replaced === true
  };
}
function isSkillRow(value) {
  return isRow2(value) && typeof value.source === "string";
}
async function fetchSkillsMatrix() {
  const data = await post(SKILLS_MATRIX_URL, {});
  return {
    columns: Array.isArray(data.columns) ? data.columns.filter(isColumn) : [],
    rows: Array.isArray(data.rows) ? data.rows.filter(isSkillRow) : []
  };
}
async function enableSkill(id, name) {
  await post(SKILL_ENABLE_URL, { id, name });
}
async function disableSkill(id, name) {
  await post(SKILL_DISABLE_URL, { id, name });
}
async function fetchSkills(id) {
  const data = await post(SKILLS_URL, { id });
  return {
    skills: Array.isArray(data.skills) ? data.skills.filter(isSkill) : [],
    directories: Array.isArray(data.directories) ? data.directories.filter((item) => typeof item === "string") : [],
    error: textOf2(data.error) === "" ? void 0 : textOf2(data.error)
  };
}
async function fetchPrompt(id) {
  const data = await post(PROMPT_URL, { id });
  return {
    path: textOf2(data.path),
    text: textOf2(data.text),
    error: textOf2(data.error) === "" ? void 0 : textOf2(data.error)
  };
}

// src/client/cli-status-section.tsx
var import_jsx_runtime16 = require("react/jsx-runtime");
var STATUS_URL = "/vyra-agent-cli-manager/cli/status";
var UPGRADE_URL = "/vyra-agent-cli-manager/cli/upgrade";
var SECTION_CLASS2 = "vyra-agent-cli-manager-clis";
var LABELS2 = {
  intro: "\u8FD9\u91CC\u5217\u51FA\u672C\u63D2\u4EF6\u63A5\u5165\u7684 Agent CLI\u3002\u7248\u672C\u7531 Host \u5728\u672C\u673A\u63A2\u6D4B\uFF0C\u6700\u65B0\u7248\u67E5\u81EA npm\uFF1B\u5347\u7EA7\u4EA4\u7ED9\u5404 CLI \u81EA\u5DF1\u7684\u66F4\u65B0\u547D\u4EE4\uFF0C\u672C\u63D2\u4EF6\u4E0D\u731C\u5B83\u7684\u5B89\u88C5\u65B9\u5F0F\u3002",
  loading: "\u6B63\u5728\u8BFB\u53D6\u2026",
  empty: "\u6CA1\u6709\u53EF\u663E\u793A\u7684 CLI\u3002",
  missing: "\u672A\u5B89\u88C5",
  outdated: "\u6709\u65B0\u7248\u672C",
  unknown: "\u7248\u672C\u672A\u77E5",
  unverified: "\u672A\u5B9E\u6D4B",
  unverifiedHint: "\u672C\u673A\u672A\u5B89\u88C5\u8FC7\u8FD9\u4E2A CLI\uFF0C\u914D\u7F6E\u8DEF\u5F84\u6309\u5B98\u65B9\u6587\u6863\u586B\u5199\uFF0C\u672A\u7ECF\u5B9E\u6D4B\u3002",
  upgrade: "\u5347\u7EA7",
  upgrading: "\u5347\u7EA7\u4E2D\u2026",
  local: "\u672C\u673A",
  latest: "\u6700\u65B0",
  failed: "\u5347\u7EA7\u5931\u8D25",
  retry: "\u91CD\u8BD5",
  skills: "\u6280\u80FD",
  prompt: "\u63D0\u793A\u8BCD"
};
var CLI_STATUS_STYLES = `
.${SECTION_CLASS2} { display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; max-width: 720px; color: var(--dsw-alias-label-primary); }
.${SECTION_CLASS2}-intro { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.${SECTION_CLASS2}-list { margin: 0; padding: 0; list-style: none; }
.${SECTION_CLASS2}-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 0; }
.${SECTION_CLASS2}-row + .${SECTION_CLASS2}-row { border-top: 0.5px solid var(--dsw-alias-border-l1); }
.${SECTION_CLASS2}-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.${SECTION_CLASS2}-name { font-size: 14px; font-weight: 500; line-height: 20px; }
.${SECTION_CLASS2}-vendor { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.${SECTION_CLASS2}-meta { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.${SECTION_CLASS2}-badge { display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 10px; font-size: 11px; line-height: 18px; }
/* Only the two states worth noticing are drawn at all; both fill, because a clear row carries
   no badge. The up-to-date state used to draw a third, unfilled one on every healthy row, which
   is the state the user expects and has nothing to act on. */
.${SECTION_CLASS2}-badge[data-tone="warn"] { background: var(--dsw-alias-state-warning-secondary, rgba(229, 160, 58, 0.16)); color: var(--dsw-alias-state-warning-primary, #e5a03a); }
.${SECTION_CLASS2}-badge[data-tone="muted"] { background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-secondary); }
.${SECTION_CLASS2}-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
/* The outlined button of the settings pages the user already knows: a hairline border at rest,
   a fill on hover. 32px tall and a 10px radius to match every other control here. */
.${SECTION_CLASS2}-button { height: 32px; padding: 0 16px; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 10px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; cursor: pointer; transition: background-color 150ms ease, border-color 150ms ease; }
.${SECTION_CLASS2}-button:hover:not(:disabled) { border-color: var(--dsw-alias-border-l3, var(--dsw-alias-border-l2)); background: var(--dsw-alias-interactive-bg-hover); }
.${SECTION_CLASS2}-button:active:not(:disabled) { background: var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover)); }
.${SECTION_CLASS2}-button:disabled { color: var(--dsw-alias-label-secondary); cursor: default; }
.${SECTION_CLASS2}-button[aria-expanded="true"] { border-color: var(--dsw-alias-border-l3, var(--dsw-alias-border-l2)); }
.${SECTION_CLASS2}-button:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, currentColor); outline-offset: 1px; }
.${SECTION_CLASS2}-error { margin: 0; color: var(--dsw-alias-state-error-primary, #d1383d); font-size: 12px; line-height: 18px; }
.${SECTION_CLASS2}-fold { margin: 8px 0 0; padding: 10px 0 0; border-top: 0.5px solid var(--dsw-alias-border-l1); display: flex; flex-direction: column; gap: 4px; }
.${SECTION_CLASS2}-mcp-row { display: flex; gap: 8px; flex-wrap: wrap; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.${SECTION_CLASS2}-mcp-name { color: var(--dsw-alias-label-primary); }
.${SECTION_CLASS2}-raw { margin: 6px 0 0; padding: 10px; max-height: 220px; overflow: auto; border-radius: 10px; background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px; white-space: pre-wrap; word-break: break-all; }
`;
function isCliStatus(value) {
  if (typeof value !== "object" || value === null) return false;
  const row = value;
  return typeof row.id === "string" && typeof row.name === "string" && typeof row.installed === "boolean";
}
async function fetchStatuses() {
  const data = await post(STATUS_URL, {});
  return Array.isArray(data.clis) ? data.clis.filter(isCliStatus) : [];
}
async function requestUpgrade(id) {
  const data = await post(UPGRADE_URL, { id });
  const exitCode = typeof data.exitCode === "number" ? data.exitCode : null;
  if (exitCode === 0) return;
  const detail = textOf2(data.stderr).trim() || textOf2(data.stdout).trim();
  throw new Error(detail === "" ? `${LABELS2.failed}\uFF08\u9000\u51FA\u7801 ${String(exitCode)}\uFF09` : detail.slice(-200));
}
async function readFold(kind, id) {
  if (kind === "skills") return { skills: await fetchSkills(id) };
  return { prompt: await fetchPrompt(id) };
}
function Badge({ tone, text }) {
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: `${SECTION_CLASS2}-badge`, "data-tone": tone, children: text });
}
function RowFacts({ row }) {
  if (!row.installed) {
    return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: `${SECTION_CLASS2}-meta`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(Badge, { tone: "muted", text: LABELS2.missing }),
      row.latestVersion === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("span", { children: [
        " ",
        LABELS2.latest,
        " ",
        row.latestVersion
      ] })
    ] });
  }
  const version = row.version ?? LABELS2.unknown;
  const state = row.updateAvailable === true ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(Badge, { tone: "warn", text: LABELS2.outdated }) : null;
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: `${SECTION_CLASS2}-meta`, children: [
    state,
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("span", { children: [
      " ",
      LABELS2.local,
      " ",
      version,
      row.latestVersion === void 0 ? "" : ` \xB7 ${LABELS2.latest} ${row.latestVersion}`
    ] })
  ] });
}
function RowActions2({
  row,
  busy,
  openKind,
  onUpgrade,
  onToggle
}) {
  const folds = [
    { kind: "skills", label: LABELS2.skills },
    { kind: "prompt", label: LABELS2.prompt }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: `${SECTION_CLASS2}-actions`, children: [
    row.installed && row.updateAvailable === true ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
      "button",
      {
        type: "button",
        className: `${SECTION_CLASS2}-button`,
        disabled: busy,
        title: row.verified ? void 0 : LABELS2.unverifiedHint,
        onClick: () => {
          onUpgrade(row.id);
        },
        children: busy ? LABELS2.upgrading : LABELS2.upgrade
      }
    ) : null,
    folds.map((fold) => /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
      "button",
      {
        type: "button",
        className: `${SECTION_CLASS2}-button`,
        "aria-expanded": openKind === fold.kind,
        onClick: () => {
          onToggle(row.id, fold.kind);
        },
        children: fold.label
      },
      fold.kind
    ))
  ] });
}
function FoldBody({ kind, data }) {
  if (kind === "skills") return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(SkillsPanel, { state: data.skills });
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(PromptPanel, { state: data.prompt });
}
function Row({
  row,
  busy,
  fold,
  onUpgrade,
  onToggle
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("li", { className: `${SECTION_CLASS2}-row`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: `${SECTION_CLASS2}-head`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: `${SECTION_CLASS2}-name`, children: row.name }),
        row.vendor === row.name ? null : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: `${SECTION_CLASS2}-vendor`, children: row.vendor }),
        row.verified ? null : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(Badge, { tone: "muted", text: LABELS2.unverified })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(RowFacts, { row }),
      fold === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: `${SECTION_CLASS2}-fold`, children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(FoldBody, { kind: fold.kind, data: fold.data }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(RowActions2, { row, busy, openKind: fold?.kind, onUpgrade, onToggle })
  ] });
}
function SectionBody({
  state,
  busyId,
  upgradeError,
  foldOf,
  onRetry,
  onUpgrade,
  onToggle
}) {
  const { rows, error, loading } = state;
  const quiet = `${SECTION_CLASS2}-intro`;
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_jsx_runtime16.Fragment, { children: [
    loading && rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("p", { className: quiet, children: LABELS2.loading }) : null,
    error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("p", { className: `${SECTION_CLASS2}-error`, children: error }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("button", { type: "button", className: `${SECTION_CLASS2}-button`, onClick: onRetry, children: LABELS2.retry })
    ] }),
    upgradeError === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("p", { className: `${SECTION_CLASS2}-error`, children: upgradeError }),
    error === void 0 && !loading && rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("p", { className: quiet, children: LABELS2.empty }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("ul", { className: `${SECTION_CLASS2}-list`, children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
      Row,
      {
        row,
        busy: busyId === row.id,
        fold: foldOf(row.id),
        onUpgrade,
        onToggle
      },
      row.id
    )) })
  ] });
}
function useFold() {
  const [fold, setFold] = (0, import_react12.useState)(void 0);
  const load = (0, import_react12.useCallback)((id, kind) => {
    const key = `${id}:${kind}`;
    const keep = (data) => {
      setFold((current) => current?.key === key ? { key, data } : current);
    };
    void readFold(kind, id).then(keep).catch((error) => {
      keep(dataOfFailure(kind, error instanceof Error ? error.message : String(error)));
    });
  }, []);
  const toggle = (0, import_react12.useCallback)(
    (id, kind) => {
      const key = `${id}:${kind}`;
      if (fold?.key === key) {
        setFold(void 0);
        return;
      }
      setFold({ key, data: {} });
      load(id, kind);
    },
    [fold, load]
  );
  const foldOf = (0, import_react12.useCallback)(
    (id) => {
      if (fold === void 0) return void 0;
      const [owner, kind] = fold.key.split(":");
      return owner === id ? { kind, data: fold.data } : void 0;
    },
    [fold]
  );
  return { fold, foldOf, toggle, reload: load };
}
function dataOfFailure(kind, error) {
  if (kind === "skills") return { skills: { skills: [], directories: [], error } };
  return { prompt: { path: "", text: "", error } };
}
function useUpgrade(load) {
  const [busyId, setBusyId] = (0, import_react12.useState)(void 0);
  const [error, setError] = (0, import_react12.useState)(void 0);
  const upgrade = (0, import_react12.useCallback)(
    (id) => {
      setError(void 0);
      setBusyId(id);
      void requestUpgrade(id).then(load).catch((failure) => {
        setError(`${LABELS2.failed}\uFF1A${failure instanceof Error ? failure.message : String(failure)}`);
      }).finally(() => {
        setBusyId(void 0);
      });
    },
    [load]
  );
  return { busyId, error, upgrade };
}
function useCliPanel() {
  const [state, setState] = (0, import_react12.useState)({ rows: [], error: void 0, loading: true });
  const folds = useFold();
  const load = (0, import_react12.useCallback)(async () => {
    setState((previous) => ({ ...previous, loading: true }));
    try {
      setState({ rows: await fetchStatuses(), error: void 0, loading: false });
    } catch (error) {
      setState({ rows: [], error: error instanceof Error ? error.message : String(error), loading: false });
    }
  }, []);
  (0, import_react12.useEffect)(() => {
    void load();
  }, [load]);
  const upgrade = useUpgrade(load);
  return {
    state,
    busyId: upgrade.busyId,
    upgradeError: upgrade.error,
    foldOf: folds.foldOf,
    retry: () => void load(),
    upgrade: upgrade.upgrade,
    toggle: folds.toggle,
    reload: folds.reload
  };
}
function CliStatusSection() {
  const panel = useCliPanel();
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: SECTION_CLASS2, children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("p", { className: `${SECTION_CLASS2}-intro`, children: LABELS2.intro }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
      SectionBody,
      {
        state: panel.state,
        busyId: panel.busyId,
        upgradeError: panel.upgradeError,
        foldOf: panel.foldOf,
        onRetry: panel.retry,
        onUpgrade: panel.upgrade,
        onToggle: panel.toggle
      }
    )
  ] });
}

// src/client/cli-mcp-tab.tsx
var import_react16 = require("react");

// src/client/cli-mcp-add.tsx
var import_react13 = require("react");

// src/client/mcp-tab-styles.ts
var MCP_TAB_CLASS = "vyra-agent-cli-manager-mcp";
var SKILL_TAB_CLASS = "vyra-agent-cli-manager-skills";
function matrixTabStyles(prefix) {
  return `
/*
 * The matrix, sized and spaced the way the rest of this plugin's panels now are: 32px controls,
 * 10px radii, a hairline (\`border-l1\`) between rows rather than a rule. The radius and the
 * lighter hairline are what make the table read as a list of rows instead of a grid.
 */
.${prefix} { display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; max-width: 720px; color: var(--dsw-alias-label-primary); }
.${prefix}-intro { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.${prefix}-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
/* The extra slot holds more than one control in the skills tab (the add form and the coverage
   line), which the slot's own single-row layout would lay out side by side. */
.${prefix}-stack { display: flex; flex-direction: column; gap: 8px; }
.${prefix}-input { height: 32px; padding: 0 10px; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 10px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; box-sizing: border-box; }
.${prefix}-input:focus-visible { outline: none; border-color: var(--dsw-focus-ring-color, var(--dsw-alias-border-l4, var(--dsw-alias-border-l2))); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-focus-ring-color, currentColor) 18%, transparent); }
.${prefix}-count { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.${prefix}-table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
.${prefix}-table th { padding: 8px 6px; border-bottom: 0.5px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); font-weight: 500; text-align: left; font-size: 11px; }
.${prefix}-table td { padding: 10px 6px; border-bottom: 0.5px solid var(--dsw-alias-border-l1); vertical-align: top; }
.${prefix}-table tr:last-child td { border-bottom: none; }
.${prefix}-table th:first-child, .${prefix}-table td:first-child { width: auto; }
.${prefix}-table th:not(:first-child), .${prefix}-table td:not(:first-child) { width: 44px; }
.${prefix}-cell { text-align: center; }
.${prefix}-name { display: block; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 19px; }
.${prefix}-detail { display: block; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px; word-break: break-all; }
.${prefix}-check { cursor: pointer; }
.${prefix}-check:disabled { cursor: default; opacity: 0.45; }
.${prefix}-error { margin: 0; color: var(--dsw-alias-state-error-primary, #d1383d); font-size: 12px; line-height: 18px; }
.${prefix}-form { display: flex; flex-direction: column; gap: 10px; padding: 14px 0 0; border-top: 0.5px solid var(--dsw-alias-border-l1); }
.${prefix}-button { height: 32px; padding: 0 16px; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 10px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; cursor: pointer; transition: background-color 150ms ease, border-color 150ms ease; }
.${prefix}-button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.${prefix}-button:active:not(:disabled) { background: var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover)); }
.${prefix}-button:disabled { color: var(--dsw-alias-label-secondary); cursor: default; }
.${prefix}-button:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, currentColor); outline-offset: 1px; }
`;
}
var MCP_TAB_STYLES = matrixTabStyles(MCP_TAB_CLASS);
var SKILL_TAB_STYLES = matrixTabStyles(SKILL_TAB_CLASS);

// src/client/cli-mcp-add.tsx
var import_jsx_runtime17 = require("react/jsx-runtime");
var LABELS3 = {
  name: "\u540D\u79F0",
  target: "\u6DFB\u52A0\u5230",
  transport: "\u7C7B\u578B",
  command: "\u542F\u52A8\u547D\u4EE4",
  url: "URL",
  env: "\u73AF\u5883\u53D8\u91CF\uFF08\u6BCF\u884C\u4E00\u4E2A KEY=VALUE\uFF09",
  add: "\u6DFB\u52A0",
  adding: "\u6DFB\u52A0\u4E2D\u2026",
  failed: "\u6DFB\u52A0\u5931\u8D25",
  namePlaceholder: "my-server",
  commandPlaceholder: "npx -y @scope/package",
  urlPlaceholder: "https://example.com/mcp",
  noTarget: "\u6CA1\u6709\u53EF\u4EE5\u5199\u5165\u7684 CLI\u3002"
};
function useAddFields(defaultTargetId) {
  const [name, setName] = (0, import_react13.useState)("");
  const [targetId, setTargetId] = (0, import_react13.useState)(defaultTargetId);
  const [transport, setTransport] = (0, import_react13.useState)("stdio");
  const [value, setValue] = (0, import_react13.useState)("");
  const [env, setEnv] = (0, import_react13.useState)("");
  return { name, setName, targetId, setTargetId, transport, setTransport, value, setValue, env, setEnv };
}
function envPairsOf(text) {
  return text.split("\n").map((line) => line.trim()).filter((line) => line !== "");
}
function useSubmit(fields, onDone) {
  const [busy, setBusy] = (0, import_react13.useState)(false);
  const [problem, setProblem] = (0, import_react13.useState)(void 0);
  const submit = () => {
    setBusy(true);
    setProblem(void 0);
    const pairs = envPairsOf(fields.env);
    const spec = fields.transport === "http" ? { name: fields.name, transport: fields.transport, url: fields.value } : {
      name: fields.name,
      transport: fields.transport,
      command: fields.value,
      ...pairs.length === 0 ? {} : { env: pairs }
    };
    void addMcp(fields.targetId, spec).then(() => {
      onDone();
    }).catch((error) => {
      setProblem(`${LABELS3.failed}\uFF1A${error instanceof Error ? error.message : String(error)}`);
    }).finally(() => {
      setBusy(false);
    });
  };
  return { busy, problem, submit };
}
function useAddServer(targets, onDone) {
  const fields = useAddFields(targets[0]?.id ?? "");
  const first = targets[0]?.id ?? "";
  const effective = { ...fields, targetId: fields.targetId === "" ? first : fields.targetId };
  const submit = useSubmit(effective, onDone);
  return { ...effective, ...submit };
}
function TargetSelect({
  form,
  targets
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { children: LABELS3.target }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
      "select",
      {
        className: `${MCP_TAB_CLASS}-input`,
        value: form.targetId,
        onChange: (event) => {
          form.setTargetId(event.target.value);
        },
        children: targets.map((target) => /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("option", { value: target.id, children: target.name }, target.id))
      }
    )
  ] });
}
function NameRow({
  form,
  targets
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: `${MCP_TAB_CLASS}-bar`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { children: LABELS3.name }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
      "input",
      {
        className: `${MCP_TAB_CLASS}-input`,
        value: form.name,
        placeholder: LABELS3.namePlaceholder,
        onChange: (event) => {
          form.setName(event.target.value);
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(TargetSelect, { form, targets })
  ] });
}
function ValueRow({ form }) {
  const remote = form.transport === "http";
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: `${MCP_TAB_CLASS}-bar`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { children: LABELS3.transport }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
      "select",
      {
        className: `${MCP_TAB_CLASS}-input`,
        value: form.transport,
        onChange: (event) => {
          form.setTransport(event.target.value === "http" ? "http" : "stdio");
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("option", { value: "stdio", children: "stdio" }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("option", { value: "http", children: "http" })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { children: remote ? LABELS3.url : LABELS3.command }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
      "input",
      {
        className: `${MCP_TAB_CLASS}-input`,
        value: form.value,
        placeholder: remote ? LABELS3.urlPlaceholder : LABELS3.commandPlaceholder,
        onChange: (event) => {
          form.setValue(event.target.value);
        }
      }
    )
  ] });
}
function AddServer({
  targets,
  onDone
}) {
  const form = useAddServer(targets, onDone);
  if (targets.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("p", { className: `${MCP_TAB_CLASS}-count`, children: LABELS3.noTarget });
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: `${MCP_TAB_CLASS}-form`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(NameRow, { form, targets }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(ValueRow, { form }),
    form.transport === "http" ? null : /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: `${MCP_TAB_CLASS}-bar`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { children: LABELS3.env }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
        "textarea",
        {
          className: `${MCP_TAB_CLASS}-input`,
          rows: 2,
          value: form.env,
          onChange: (event) => {
            form.setEnv(event.target.value);
          }
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: `${MCP_TAB_CLASS}-bar`, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("button", { type: "button", className: `${MCP_TAB_CLASS}-button`, disabled: form.busy, onClick: form.submit, children: form.busy ? LABELS3.adding : LABELS3.add }) }),
    form.problem === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("p", { className: `${MCP_TAB_CLASS}-error`, children: form.problem })
  ] });
}

// src/client/matrix-shell.tsx
var import_react14 = require("react");

// src/client/matrix-table.tsx
var import_jsx_runtime18 = require("react/jsx-runtime");
function shortNameOf(name) {
  return name.split(" ")[0] ?? name;
}
function subtitleOf(row) {
  const parts = [row.transport, row.detail].filter((part) => part !== "");
  return parts.length === 0 ? row.description ?? "" : parts.join(" \xB7 ");
}
function CellView({
  cell,
  tableClass,
  label,
  onToggle
}) {
  const reason = cell.blocked ?? (cell.state === "unknown" ? "\u8FD9\u4E00\u5217\u8BFB\u4E0D\u51FA\u6765" : void 0);
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
    "input",
    {
      type: "checkbox",
      className: `${tableClass}-check`,
      checked: cell.state === "on",
      disabled: reason !== void 0,
      "aria-label": label,
      title: reason,
      onChange: onToggle
    }
  );
}
function RowView({
  row,
  columns,
  tableClass,
  busy,
  onToggle
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("tr", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("td", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: `${tableClass}-name`, children: row.name }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: `${tableClass}-detail`, children: subtitleOf(row) })
    ] }),
    row.cells.map((cell) => /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("td", { className: `${tableClass}-cell`, children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
      CellView,
      {
        cell,
        tableClass,
        label: `${row.name} \u5728 ${columns.find((column) => column.id === cell.id)?.name ?? cell.id}`,
        onToggle: () => {
          if (!busy) onToggle(cell, row);
        }
      }
    ) }, cell.id))
  ] });
}
function MatrixTable({
  tableClass,
  columns,
  rows,
  busy,
  onToggle
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("table", { className: `${tableClass}-table`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("tr", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("th", { children: "\u540D\u79F0" }),
      columns.map((column) => /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("th", { className: `${tableClass}-cell`, title: column.problem ?? column.name, children: shortNameOf(column.name) }, column.id))
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("tbody", { children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(RowView, { row, columns, tableClass, busy, onToggle }, row.name)) })
  ] });
}

// src/client/matrix-shell.tsx
var import_jsx_runtime19 = require("react/jsx-runtime");
var LABELS4 = {
  refresh: "\u91CD\u65B0\u8BFB\u53D6"
};
function Toolbar({
  className,
  search,
  setSearch,
  placeholder,
  countText,
  onReload,
  addLabel,
  onAdd
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: `${className}-bar`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
      "input",
      {
        className: `${className}-input`,
        value: search,
        placeholder,
        "aria-label": placeholder,
        onChange: (event) => {
          setSearch(event.target.value);
        }
      }
    ),
    addLabel === void 0 || onAdd === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("button", { type: "button", className: `${className}-button`, onClick: onAdd, children: addLabel }),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: `${className}-count`, children: countText }),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("button", { type: "button", className: `${className}-button`, onClick: onReload, children: LABELS4.refresh })
  ] });
}
function MatrixShell(props) {
  const [search, setSearch] = (0, import_react14.useState)("");
  const needle = search.trim().toLowerCase();
  const rows = needle === "" ? props.rows : props.rows.filter((row) => props.matches(row, needle));
  const { className } = props;
  const quiet = `${className}-intro`;
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("p", { className: quiet, children: props.intro }),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
      Toolbar,
      {
        className,
        search,
        setSearch,
        placeholder: props.searchPlaceholder,
        countText: props.countText,
        onReload: props.onReload,
        addLabel: props.addLabel,
        onAdd: props.onAdd
      }
    ),
    props.error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("p", { className: `${className}-error`, children: props.error }),
    props.columns.filter((column) => column.note !== void 0).map((column) => /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("p", { className: `${className}-error`, children: column.note }, column.id)),
    props.loading ? /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("p", { className: quiet, children: props.loadingText }) : null,
    !props.loading && props.rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("p", { className: quiet, children: props.noneText }) : null,
    rows.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
      MatrixTable,
      {
        tableClass: props.tableClass,
        columns: props.columns,
        rows,
        busy: props.busy,
        onToggle: props.onToggle
      }
    ),
    !props.loading && props.rows.length > 0 && rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("p", { className: quiet, children: props.emptyText }) : null,
    props.extra,
    props.children
  ] });
}

// src/client/modal.tsx
var import_react15 = require("react");
var import_jsx_runtime20 = require("react/jsx-runtime");
var MODAL_CLASS = "vyra-agent-cli-manager-modal";
var MODAL_STYLES = `
.${MODAL_CLASS}-backdrop { position: fixed; inset: 0; z-index: 100; display: flex; align-items: flex-start; justify-content: center; padding: 12vh 16px 16px; background: var(--dsw-alias-bg-mask-2, rgb(0 0 0 / 40%)); }
.${MODAL_CLASS}-panel { display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; width: 100%; max-width: 520px; max-height: 76vh; overflow: auto; padding: 20px; border-radius: 14px; background: var(--dsw-alias-bg-layer-1); box-shadow: var(--dsw-elevation-prominent, var(--dsw-elevation-panel)); color: var(--dsw-alias-label-primary); }
.${MODAL_CLASS}-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.${MODAL_CLASS}-title { margin: 0; font-size: 15px; font-weight: 600; line-height: 22px; }
/* A hairline glyph button, the way a sheet closes: no fill at rest, one on hover. */
.${MODAL_CLASS}-close { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: none; border-radius: 8px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 16px; line-height: 1; cursor: pointer; transition: background-color 150ms ease, color 150ms ease; }
.${MODAL_CLASS}-close:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.${MODAL_CLASS}-close:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, currentColor); outline-offset: 1px; }
`;
var CLOSE_GLYPH = "\u2715";
function Modal2({
  title,
  onClose,
  children
}) {
  const panel = (0, import_react15.useRef)(null);
  const titleId = (0, import_react15.useId)();
  (0, import_react15.useEffect)(() => {
    const previous = document.activeElement;
    panel.current?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  (0, import_react15.useEffect)(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
    "div",
    {
      className: `${MODAL_CLASS}-backdrop`,
      onClick: (event) => {
        if (event.target === event.currentTarget) onClose();
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
        "div",
        {
          ref: panel,
          className: `${MODAL_CLASS}-panel`,
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": titleId,
          tabIndex: -1,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: `${MODAL_CLASS}-head`, children: [
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("h3", { className: `${MODAL_CLASS}-title`, id: titleId, children: title }),
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("button", { type: "button", className: `${MODAL_CLASS}-close`, "aria-label": "\u5173\u95ED", onClick: onClose, children: CLOSE_GLYPH })
            ] }),
            children
          ]
        }
      )
    }
  );
}

// src/client/cli-mcp-tab.tsx
var import_jsx_runtime21 = require("react/jsx-runtime");
var LABELS5 = {
  intro: "\u8FD9\u91CC\u628A\u6BCF\u4E2A CLI \u81EA\u5DF1\u914D\u7F6E\u91CC\u7684 MCP \u6C47\u603B\u6210\u4E00\u5F20\u8868\uFF1A\u52FE\u4E0A\u5373\u5728\u90A3\u4E2A CLI \u91CC\u6DFB\u52A0\uFF0C\u53D6\u6D88\u5373\u5728\u90A3\u4E2A CLI \u91CC\u5220\u9664\u3002\u63D2\u4EF6\u4E0D\u5B58\u526F\u672C\uFF0C\u6240\u4EE5\u4E0D\u5B58\u5728\u300C\u6539\u5E94\u7528\u914D\u7F6E\u4F1A\u88AB\u8986\u76D6\u300D\u7684\u95EE\u9898\uFF1B\u7070\u6389\u7684\u683C\u5B50\u5199\u7740\u4E3A\u4EC0\u4E48\u6539\u4E0D\u4E86\u3002",
  search: "\u641C\u7D22\u540D\u79F0\u3001\u547D\u4EE4\u6216\u5730\u5740",
  loading: "\u6B63\u5728\u8BFB\u53D6\u5404 CLI \u7684\u914D\u7F6E\u2026",
  empty: "\u6CA1\u6709\u5339\u914D\u7684 MCP \u670D\u52A1\u5668\u3002",
  none: "\u6CA1\u6709\u4EFB\u4F55 CLI \u914D\u7F6E MCP \u670D\u52A1\u5668\u3002",
  count: (shown, total, columns) => `${String(total)} \u4E2A MCP \xB7 \u5339\u914D ${String(shown)} \xB7 ${String(columns)} \u4E2A CLI`,
  failed: "\u64CD\u4F5C\u5931\u8D25",
  noSource: "\u8FD9\u4E00\u884C\u6CA1\u6709\u4EFB\u4F55 CLI \u6301\u6709\u5B83\uFF0C\u65E0\u6CD5\u590D\u5236",
  add: "\u6DFB\u52A0 MCP"
};
function useMatrix() {
  const [query, setQuery] = (0, import_react16.useState)({
    columns: [],
    rows: [],
    loading: true,
    busy: false,
    error: void 0
  });
  const load = (0, import_react16.useCallback)(async () => {
    setQuery((previous) => ({ ...previous, loading: true }));
    try {
      const { columns, rows } = await fetchMcpMatrix();
      setQuery({ columns, rows, loading: false, busy: false, error: void 0 });
    } catch (error) {
      const message2 = error instanceof Error ? error.message : String(error);
      setQuery({ columns: [], rows: [], loading: false, busy: false, error: message2 });
    }
  }, []);
  (0, import_react16.useEffect)(() => {
    void load();
  }, [load]);
  const toggle = (0, import_react16.useCallback)(
    (cell, row) => {
      const source = row.cells.find((candidate) => candidate.state === "on");
      setQuery((previous) => ({ ...previous, busy: true, error: void 0 }));
      const change = cell.state === "on" ? removeMcp(cell.id, row.name) : source === void 0 ? Promise.reject(new Error(LABELS5.noSource)) : copyMcp(source.id, cell.id, row.name);
      void change.then(load).catch((error) => {
        const message2 = error instanceof Error ? error.message : String(error);
        setQuery((previous) => ({ ...previous, busy: false, error: `${LABELS5.failed}\uFF1A${message2}` }));
      });
    },
    [load]
  );
  return { ...query, reload: () => void load(), toggle };
}
function McpTab() {
  const matrix = useMatrix();
  const [adding, setAdding] = (0, import_react16.useState)(false);
  const targets = matrix.columns.filter((column) => column.readable);
  const close = (0, import_react16.useCallback)(() => {
    setAdding(false);
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
    MatrixShell,
    {
      className: MCP_TAB_CLASS,
      tableClass: MCP_TAB_CLASS,
      intro: LABELS5.intro,
      searchPlaceholder: LABELS5.search,
      loadingText: LABELS5.loading,
      noneText: LABELS5.none,
      emptyText: LABELS5.empty,
      countText: LABELS5.count(matrix.rows.length, matrix.rows.length, matrix.columns.length),
      columns: matrix.columns,
      rows: matrix.rows,
      loading: matrix.loading,
      busy: matrix.busy,
      error: matrix.error,
      matches: (row, needle) => row.name.toLowerCase().includes(needle) || row.detail.toLowerCase().includes(needle),
      onToggle: matrix.toggle,
      onReload: matrix.reload,
      addLabel: LABELS5.add,
      onAdd: () => {
        setAdding(true);
      },
      children: adding ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(Modal2, { title: LABELS5.add, onClose: close, children: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
        AddServer,
        {
          targets,
          onDone: () => {
            close();
            matrix.reload();
          }
        }
      ) }) : null
    }
  );
}

// src/client/cli-skills-tab.tsx
var import_react18 = require("react");

// src/client/cli-skill-add.tsx
var import_react17 = require("react");
var import_jsx_runtime22 = require("react/jsx-runtime");
var LABELS6 = {
  title: "\u6DFB\u52A0\u6280\u80FD",
  intro: "\u6280\u80FD\u88C5\u8FDB\u5171\u4EAB\u76EE\u5F55\uFF0C\u4E4B\u540E\u5728\u4E0A\u9762\u7684\u8868\u683C\u91CC\u52FE\u9009\u8981\u8BA9\u54EA\u4E9B CLI \u52A0\u8F7D\u5B83\u3002",
  paste: "\u7C98\u8D34 SKILL.md",
  github: "GitHub \u4ED3\u5E93",
  local: "\u672C\u5730\u76EE\u5F55",
  pastePlaceholder: "---\nname: my-skill\ndescription: \u4EC0\u4E48\u65F6\u5019\u8BE5\u7528\u8FD9\u4E2A\u6280\u80FD\n---\n\n\u5177\u4F53\u6307\u4EE4\u2026",
  repoPlaceholder: "owner/repo\uFF0C\u6216\u7C98\u8D34 GitHub \u94FE\u63A5",
  pathLabel: "\u4ED3\u5E93\u5185\u7684\u8DEF\u5F84\uFF08\u53EF\u9009\uFF09",
  pathPlaceholder: "skills/my-skill",
  dirLabel: "\u6280\u80FD\u6240\u5728\u76EE\u5F55",
  dirPlaceholder: "C:\\path\\to\\my-skill",
  nameLabel: "\u6280\u80FD\u540D\uFF08\u53EF\u9009\uFF09",
  namePlaceholder: "\u9ED8\u8BA4\u53D6 SKILL.md \u91CC\u7684 name",
  submit: "\u6DFB\u52A0",
  submitting: "\u6DFB\u52A0\u4E2D\u2026",
  failed: "\u6DFB\u52A0\u5931\u8D25"
};
var SOURCES = [
  { id: "paste", label: LABELS6.paste },
  { id: "github", label: LABELS6.github },
  { id: "local", label: LABELS6.local }
];
function useAddSkill(onDone) {
  const [kind, setKind] = (0, import_react17.useState)("paste");
  const [text, setText] = (0, import_react17.useState)("");
  const [path, setPath] = (0, import_react17.useState)("");
  const [name, setName] = (0, import_react17.useState)("");
  const [busy, setBusy] = (0, import_react17.useState)(false);
  const [problem, setProblem] = (0, import_react17.useState)(void 0);
  const spec = () => {
    const named = name.trim() === "" ? {} : { name: name.trim() };
    if (kind === "paste") return { kind: "paste", markdown: text, ...named };
    if (kind === "local") return { kind: "local", directory: text.trim(), ...named };
    const inside = path.trim();
    return { kind: "github", repository: text.trim(), ...inside === "" ? {} : { path: inside }, ...named };
  };
  const submit = () => {
    if (text.trim() === "") {
      setProblem(kind === "paste" ? "\u8BF7\u7C98\u8D34 SKILL.md \u7684\u5185\u5BB9" : "\u8BF7\u586B\u5199\u6765\u6E90");
      return;
    }
    setBusy(true);
    setProblem(void 0);
    void installSkill(spec()).then((outcome) => {
      setText("");
      setPath("");
      setName("");
      onDone(outcome.path, outcome.replaced);
    }).catch((error) => {
      setProblem(`${LABELS6.failed}\uFF1A${error instanceof Error ? error.message : String(error)}`);
    }).finally(() => {
      setBusy(false);
    });
  };
  const pick = (value) => {
    setKind(value);
    setText("");
    setProblem(void 0);
  };
  return { kind, pick, text, setText, path, setPath, name, setName, busy, problem, submit };
}
function AddSkill({ onDone }) {
  const form = useAddSkill((path, replaced) => {
    onDone(`${replaced ? "\u5DF2\u66FF\u6362" : "\u5DF2\u6DFB\u52A0"}\u6280\u80FD\uFF1A${path}`);
  });
  const multiline = form.kind === "paste";
  return /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: `${SKILL_TAB_CLASS}-form`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("p", { className: `${SKILL_TAB_CLASS}-intro`, children: [
      LABELS6.title,
      " \xB7 ",
      LABELS6.intro
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: `${SKILL_TAB_CLASS}-bar`, children: SOURCES.map((source) => /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
      "button",
      {
        type: "button",
        className: `${SKILL_TAB_CLASS}-button`,
        "aria-pressed": form.kind === source.id,
        onClick: () => {
          form.pick(source.id);
        },
        children: source.label
      },
      source.id
    )) }),
    multiline ? /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
      "textarea",
      {
        className: `${SKILL_TAB_CLASS}-input`,
        rows: 10,
        value: form.text,
        placeholder: LABELS6.pastePlaceholder,
        "aria-label": LABELS6.paste,
        onChange: (event) => {
          form.setText(event.target.value);
        }
      }
    ) : /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
      "input",
      {
        className: `${SKILL_TAB_CLASS}-input`,
        value: form.text,
        placeholder: form.kind === "local" ? LABELS6.dirPlaceholder : LABELS6.repoPlaceholder,
        "aria-label": form.kind === "local" ? LABELS6.dirLabel : LABELS6.github,
        onChange: (event) => {
          form.setText(event.target.value);
        }
      }
    ),
    form.kind !== "github" ? null : /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
      "input",
      {
        className: `${SKILL_TAB_CLASS}-input`,
        value: form.path,
        placeholder: LABELS6.pathPlaceholder,
        "aria-label": LABELS6.pathLabel,
        onChange: (event) => {
          form.setPath(event.target.value);
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
      "input",
      {
        className: `${SKILL_TAB_CLASS}-input`,
        value: form.name,
        placeholder: LABELS6.namePlaceholder,
        "aria-label": LABELS6.nameLabel,
        onChange: (event) => {
          form.setName(event.target.value);
        }
      }
    ),
    form.problem === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("p", { className: `${SKILL_TAB_CLASS}-error`, children: form.problem }),
    /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: `${SKILL_TAB_CLASS}-bar`, children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
      "button",
      {
        type: "button",
        className: `${SKILL_TAB_CLASS}-button`,
        disabled: form.busy,
        onClick: form.submit,
        children: form.busy ? LABELS6.submitting : LABELS6.submit
      }
    ) })
  ] });
}

// src/client/cli-skills-tab.tsx
var import_jsx_runtime23 = require("react/jsx-runtime");
var LABELS7 = {
  intro: "\u8FD9\u91CC\u628A\u5404 CLI \u4F1A\u52A0\u8F7D\u7684\u6280\u80FD\u6C47\u603B\u6210\u4E00\u5F20\u8868\uFF1A\u52FE\u4E0A\u4F1A\u5728\u90A3\u4E2A CLI \u7684\u6280\u80FD\u76EE\u5F55\u91CC\u5EFA\u4E00\u4E2A\u94FE\u63A5\u6307\u5411\u6280\u80FD\u7684\u771F\u5B9E\u76EE\u5F55\uFF0C\u53D6\u6D88\u5219\u53EA\u5220\u6389\u8FD9\u4E2A\u94FE\u63A5\u3002\u6280\u80FD\u672C\u4F53\u53EA\u6709\u4E00\u4EFD\uFF0C\u6539\u4E00\u6B21\u6240\u6709 CLI \u540C\u6B65\u751F\u6548\uFF1B\u6807\u6CE8\u300C\u771F\u5B9E\u76EE\u5F55\u300D\u7684\u683C\u5B50\u672C\u63D2\u4EF6\u4E0D\u4F1A\u5220\u3002",
  search: "\u641C\u7D22\u6280\u80FD\u540D\u79F0\u6216\u8BF4\u660E",
  loading: "\u6B63\u5728\u8BFB\u53D6\u5404 CLI \u7684\u6280\u80FD\u76EE\u5F55\u2026",
  empty: "\u6CA1\u6709\u5339\u914D\u7684\u6280\u80FD\u3002",
  none: "\u6CA1\u6709\u4EFB\u4F55 CLI \u6709\u6280\u80FD\u3002",
  count: (total, columns) => `${String(total)} \u4E2A\u6280\u80FD \xB7 ${String(columns)} \u4E2A CLI`,
  failed: "\u64CD\u4F5C\u5931\u8D25"
};
function isSkillRow2(row) {
  return "source" in row;
}
function useSkillsMatrix() {
  const [query, setQuery] = (0, import_react18.useState)({
    columns: [],
    rows: [],
    loading: true,
    busy: false,
    error: void 0
  });
  const load = (0, import_react18.useCallback)(async () => {
    setQuery((previous) => ({ ...previous, loading: true }));
    try {
      const { columns, rows } = await fetchSkillsMatrix();
      setQuery({ columns, rows, loading: false, busy: false, error: void 0 });
    } catch (error) {
      const message2 = error instanceof Error ? error.message : String(error);
      setQuery({ columns: [], rows: [], loading: false, busy: false, error: message2 });
    }
  }, []);
  (0, import_react18.useEffect)(() => {
    void load();
  }, [load]);
  const toggle = (0, import_react18.useCallback)(
    (cell, row) => {
      setQuery((previous) => ({ ...previous, busy: true, error: void 0 }));
      const change = cell.state === "on" ? disableSkill(cell.id, row.name) : enableSkill(cell.id, row.name);
      void change.then(load).catch((error) => {
        const message2 = error instanceof Error ? error.message : String(error);
        setQuery((previous) => ({ ...previous, busy: false, error: `${LABELS7.failed}\uFF1A${message2}` }));
      });
    },
    [load]
  );
  return { ...query, reload: () => void load(), toggle };
}
function SkillsTab() {
  const matrix = useSkillsMatrix();
  const [notice, setNotice] = (0, import_react18.useState)("");
  const [adding, setAdding] = (0, import_react18.useState)(false);
  const close = (0, import_react18.useCallback)(() => {
    setAdding(false);
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
    MatrixShell,
    {
      className: SKILL_TAB_CLASS,
      tableClass: SKILL_TAB_CLASS,
      intro: LABELS7.intro,
      searchPlaceholder: LABELS7.search,
      loadingText: LABELS7.loading,
      noneText: LABELS7.none,
      emptyText: LABELS7.empty,
      countText: LABELS7.count(matrix.rows.length, matrix.columns.length),
      columns: matrix.columns,
      rows: matrix.rows,
      loading: matrix.loading,
      busy: matrix.busy,
      error: matrix.error,
      matches: (row, needle) => row.name.toLowerCase().includes(needle) || (row.description ?? "").toLowerCase().includes(needle),
      onToggle: (cell, row) => {
        if (isSkillRow2(row)) matrix.toggle(cell, row);
      },
      onReload: matrix.reload,
      addLabel: "\u6DFB\u52A0\u6280\u80FD",
      onAdd: () => {
        setAdding(true);
      },
      extra: /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: `${SKILL_TAB_CLASS}-stack`, children: [
        notice === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("p", { className: `${SKILL_TAB_CLASS}-count`, children: notice }),
        matrix.rows.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("p", { className: `${SKILL_TAB_CLASS}-count`, children: [
          "\u771F\u5B9E\u76EE\u5F55\uFF1A",
          matrix.rows.filter((row) => row.source !== "").length,
          " \u4E2A\u53EF\u94FE\u63A5 \xB7",
          " ",
          matrix.rows.filter((row) => row.source === "").length,
          " \u4E2A\u53EA\u6709\u94FE\u63A5"
        ] })
      ] }),
      children: adding ? /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Modal2, { title: "\u6DFB\u52A0\u6280\u80FD", onClose: close, children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
        AddSkill,
        {
          onDone: (message2) => {
            close();
            setNotice(message2);
            matrix.reload();
          }
        }
      ) }) : null
    }
  );
}

// src/client/settings-about.tsx
var import_react19 = require("react");

// src/client/assets/qq-group.png
var qq_group_default = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAWgAAAKACAIAAAA+eHXwAAEAAElEQVR42uy9d5xlVZU2/Ky9zzk338pVnXNumgySs4gIAoqiiGMOI6+jzjjB109fDDPjzDiOvr4zY06oMCoSREBQUOwmNNB0oHNO1ZXTjSfsvb4/zr23bsWu6gQN+/n1D6pu3Xv2Offs/Zy113rWWsTMMDAwMJgMhPkKDAwMDHEYGBgY4jAwMDDEYWBgYIjDwMDAEIeBgYGBIQ4DAwNDHAYGBoY4DAwMDHEYGBgY4jAwMDAwxGFgYGCIw8DAwBCHgYGBIQ4DAwNDHAYGBgaGOAwMDAxxGBgYGOIwMDAwxGFgYGCIw8DAwBCHgYGBgSEOAwMDQxwGBgaGOAwMDAxxGBgYGOIwMDAwMMRhYGBgiMPAwMAQh4GBgSEOAwMDQxwGBgYGhjgMDAwMcRgYGBjiMDAwMMRhYGBgiMPAwMDAEIeBgYEhDgMDA0McBgYGhjgMDAwMcRgYGBjiMDAwMDDEYWBgYIjDwMDAEIeBgYEhDgMDA0McBgYGBoY4DAwMDHEYGBgY4jAwMDDEYWBgYIjDwMDAwBCHgYGBIQ4DAwNDHAYGBoY4DAwMDHEYGBgYGOIwMDAwxGFgYGCIw8DAwBCHgYGBIQ4DAwNDHAYGBgaGOAwMDAxxGBgYGOIwMDAwxGFgYGCIw8DAwMAQh4GBgSEOAwMDQxwGBgaGOAwMDAxxGBgYGBjiMDAwMMRhYGBgiMPAwMAQh4GBgSEOAwMDA+skPW9mNjfP4FUAIjopT/sVuAINKRgYvMLJ5RVBHIYpDAxOLh55OYnD8IWBwUnKIC8DcRi+MDA42RnkhBKHoQwDg1cHfZwI4jB8YWDwKmOQ40schjIMDF6V9HG8iMNQhoHBq5g+jj1xGCYyMHjFrfNjfdhjTBzH6miGJgwMju2aP7bccSyJ42gOZZjCwOB4r/9jyB308toIhi8MDE4kCxwz++Xol66hDAOD1xp9HC1xTPbjRzycIRoDQwTH8INHyR10whwTx+/NBgaGSo73m48ZcRxzIjBkYWBw9Ev9xHCH9UpIUXmFRHYMDF7hUdVweo9/KGZ+5UrOJ/ip8d828aENHRgYipnsOyd4nCN0rx7Bmjx61jhWhGJgYKhknL8eP+4QJ357YljDwOAYPqqPeK2d0K3K0TgsKn+iMsycMDA4GkIJcfSmx6SjuScmOFL9ohDCUIaBwTGkD631+BRwzMMx4gTYVIY1DAxwPD0gQoiJr8ETvVU5sk1K9YtSSnObDQyOE5RSR2l3TPyhLk6krWFurYHB8cOJtDvE8VNSVH/EuEINDE7AnqV6lR0/pcUxszhGjjfsFcMaBgYnXvFx2IV5fC2Oo1deGOIwMHiFqE6PiZBKmPqgBgZ4rYrHjqPFMVl+GvaKIREDg5eXLCa7YZnImhWmFZOBgTE0TmiuyvFzvRgYGBxXHjnKpSqMuWFgYIyOY0wcR5zJYljDwOAVxR3HNitNGIPCwMDQysu2VRnrJAy/GBi8QhjhBEnOTSsDA4PXrFkx/geFoQYDA0MrL89WZSwfjOEXA4NXlFv0hOaqGBgYGGAifVVerp6yJwBa67DU2sgaqKZoiMGryeg4yuTScY5gHVsl/IkpW3ZkZOF5ntY6CALf95VSw6q8SimFELZtW5YV/mBIxOBV47aopoBhdHBk/GK96r/HIAgKhYLneb7vV2q6jixboLVm5mKxGNodtm3bth2Px025QwMDTLzm6MSbNYxqcVT/IISwLOtloYxcLue6bmhfTIpWw/dblhWNRmOx2Mty/gYGRzbttdaV2T7yh5EPziPoq2C9Wqu25vP5QqFQoYxJt40gAuD7fmiwJBKJWCxmNi8GBq9a4vA8L5PJuK4bLv6j8Q+Fn1VKhQdMpVK2bZtJY2DwaiOOQqEwMDBQbarhGDmcisViEAQ1NTWRSMTMG4PXOMSrKY8+n8/39/dXd7XCMa3mqJTq7+93Xffkuseh33fYK+FOGMetsdj4Bx+1PITWuroziMErOct+0s7RCcZiT7xzNGSNE3ADpJTHxO6Y+Lqt+FYmeO+Pxto67Jqv/h6OciDjM8IJdI7iiPyjY75+PIhj2A8ngDgKhUJ/f//RVByY1Bo4VtyBE+Lx2bt379y5c8MLDF3FGzZs2LBhw5IlS84888xKvOnIunMGQTDyW127dm08Hl+6dKlSathkDcPbIWuE9kX4kb6+vs7Ozt27d1999dUj328wWeIYNZ5yDInDehXksLmuOzAwMKlelkQUSrwq7s8gCCYesg33LHV1dUfgKw1HKRQKu3btOqzhwMxSygULFoSP909+8pNPPfWUEGJUo6Dy/rvvvnv27NlBEFiWtWXLlrPPPnvJkiVPPvlkbW1t+M4777zza1/72vve974f/OAHww7y4IMPPvHEE5ZlVb6KMDIlhAgNBGYOX/nYxz42f/78kY+EG2+88f777z/nnHNWr1490qYoFAof//jHN23adNddd82ePbvy+urVq6+//nqt9WOPPXbVVVeZ9f8Kl5+e9M5RrXUmk5m42U9E0Wg0Go1allV5mimlfN8PdWKYcMQ3m83W1NRM1t7WWkspN2zYcOGFF4ZLvXKHKgZaNRGk0+kNGzZMmzYNwPr165977rmJ7Noqro1Vq1b5vn/o0KH3v//9oQTOtu2NGzdalvXEE0/ccMMNSqmQif7mb/7m8ssv/+1vf/utb31rIhfy5je/eerUqb/61a8qJ6yUklIeOnTIsqwXX3zxC1/4wvz580Pjgog8z5s7d+6CBQseeOCBzs7OCy+88I477njuuedyuRwz53K5kM1vv/32c889NwgCKWU0Gv2Xf/mXhoaGo1dPG8BEVaqRzWY9z5vgrCKiRCKRSCSGrfZQKhqJRLLZbLjqJoJiseg4TiKRwBEpTYYZ+WP5PqqNqVQqJaV8z3ve8zd/8ze+71ee9uHi3Lp169vf/vYKIYbL9eGHHwZw3XXX3XPPPZlMpvrIe/bs2bNnT+XXt771reEQlmUtXLjwpptuCjnl5z//+cGDB88777zLLrssjEz/8Ic/DIPTnZ2d73nPe8a6xjvuuGPYK+edd97TTz/99NNPX3vttdu2bWttbf3Od74zzP28bdu2bdu2VV787Gc/a4jDEMex38Dn8/mJs0YymUwkEmO9X0qZTqcrT+yJWHG5XC4SiUzKgxNy1vLly//whz9UNkpSyh//+Mc/+clPAHzzm99ctmxZyAXMbNt2Y2NjuHKCIFBK3XPPPY899tgwfiGiMAenYsVYlnXw4ME//vGPUsoPfehD4TJmZsdxvvjFL377299+5zvf+dWvftX3fSllsVgMNzJSyiAITjnllH/8x38Mj/zcc8/t3bv3hhtu+PSnPx2+8tOf/jSXywVBkEql3vSmN4XMFY/HOzs76+vrK6lAsVgsn89HIhEpZWjsXHDBBcw8f/78lStXPvvss9ddd92KFSvq6+u/9KUvPfHEE1rrL33pS6effnpfX98f/vCHW265RWs9ZcoU0wnQEAeOeSRlgpKNcB6PwxrVJkmY2HLYw4YrOZ/Ph3QzKVFZOp2+4oorql9/9tlnwwV/ySWXrFixYqQZUtG/Ll269IorrgiCoDraIoRob28f5rP49a9/nclkUqnUihUrnnnmmYceeij8yAsvvADgpZde+vd///fw4GedddZtt91WcW/t2rXrF7/4Rcgp+/fvB7Bq1arZs2crpXp6esKAdLFYrK+vf/DBB8Oxtm/ffvPNN1911VWf+9znKrbSO97xjmg0+v3vfz+VSlXO6lvf+lZDQ8Pb3vY2ADfddNP999//zDPPWJb1zW9+88Mf/nD44m9+85vTTjvtk5/85DA/n8GrjThOvD819EpMkDWklLFYbCJvtiwrFouNtY8YyQKFQiEej082bBTKFlB2g1uWVSgUwl8zmYxSKjRDKqZQ9WcTiURzc3N1ODO0RyoiiPBeBEHw3e9+t2LRPPzww1//+terjxPGVsKfr7rqqne9611EFJ7VCy+8cMstt1S/+b777rvvvvtGvQu2bd97770f+MAHent7169ff8UVV5x//vkA7r333nCjtHr16v/+7/9+4xvfCOChhx76y7/8SwD/8A//8IlPfOJnP/vZ3/7t3wJ4wxveMH/+/B/84Ad9fX3hVuVTn/pULBb7yEc+YgK3r5xE+1eDxZHP5yf4RYTpahOPgESj0VwuN0GHq9a6UChUP1EnyDgVOgh5rbI2hBDhn0ZGIsNTWrly5dNPPz0ynFw54fCHu+++e8OGDZXX6+rqLMt6+9vf/rGPfewb3/jGL3/5yze+8Y2f/exn77vvvq9//etNTU3VCv0ZM2ZcdNFFoY/jD3/4Q1dX19KlS08//XSlVKFQeOSRR3zfrzhrvvSlL335y19m5qlTp/785z+/8MILwxHf8573tLS0vO9979u7d+911113xx13fOpTnzrzzDNvu+22n/70p1/5yleWL1/+2c9+NryQRx555JFHHhl2vR/96EenTZt2/fXXV9Oowatzq3JiTA+t9aQUnI7jTPypJaV0HGfi5kxY6eMEPBVDu+a9733vHXfcUSwWK2spjJW89NJLb3jDGypvvvfee4c9ZJRSM2fOvPDCC8M/TZ8+/cILL9yyZUu1ijS8ivPOO++uu+4KX7nyyisff/zx97znPX//938fHqShoaGitbvlllseeOABAKeeeup73vOeRx999LLLLgu3Ttu2bXvooYe+9a1v/e///b83bdr0+c9/vra29uMf//idd97Z1NRUX19/2223vfTSS6tXr541a1Z9fX1dXZ3jOGFBg0Qi8fWvf92yrKlTpxrP6CvH0DjpLQ7P84aJi8bHpAQXYVywsneYiKfD87xoNHpc730YMwbw7W9/+9vf/jbGlQAppZYsWRKPxx3HCSOdxWKRmb/5zW/+6Ec/GhgYCH2cv/nNbzzPsyxrmGavra3t6aefDmOiXV1dADZt2vTMM89orTs7O8N9XPjOj3zkIw8//PCNN9746U9/+qqrrspkMnPmzAldFZ///Of/53/+59lnn33kkUduvPHGKVOmvO997wutmL/8y7+cN28egL/7u7+76aabOjs777jjjttvvz0ajX7729++6aabfN//6U9/On/+/EQiEdKQWf/GOXpsiGPiPBpuVSZ1/EnN1BOQZBEaF6FW9dprr337298ersDqR8r+/fs///nPA6itrZVSLl++/HOf+9z3v//9vr4+pVR9ff2UKVOEENlsNjxbpVSxWAzjIxULIgzZrly58oILLqg+gZ/85Cdh0GeYl/faa69duXLlWWedJaW84oor7r///k9+8pOnnXba6tWr/+d//ie0j2bOnPn444+HhZGY2ff9q6++Ogz0zp0798knnxRC7Nq166GHHrIs6zOf+czq1as9z5syZUoY6jbmxmuLOI7rnuV4L9RJ6a+ZeVLC02FK7fDnymYhlHiEEc2KYOy3v/3tj370oxdffFEIsX///lWrVjFzhQ3Db6OrqyuMvHzwgx8899xzP/vZz+bz+X/7t3+zbTufz99666333XfftGnT7rzzzttvv/173/veRz7ykX/6p3966qmn7r333rPPPjs8/5A4QpYJQzl79uwpFAoNDQ3hK77v7969u/L9+75/7rnnhtbQd77zne3bt2/atOmKK64IxTW33nrrRz/6Uc/zampqKm7arVu3HjhwIAiCSCQS0l9DQ0M8Hk8kEqGJlEwmi8ViPp//0Y9+dM455yxfvtzsVl4hO5RjQxwvlzI9TO6cbAR0ss7LalknJhDiUUpN3K6pfmf4czweD3+tra21LGvYodasWRM6JjA0GjLqmTz22GM7duz48pe/XCgUwksIYy5bt25duXJlqEMHcNFFF6VSqTe84Q2hZySkiba2ttBz8V//9V9hxOTiiy9euXLlRz/60S996UtKqba2tlNOOaW/vz/8VkNrS0oppWxubv785z//7ne/OxTgNjU1feUrXyEix3Eqd01KuWrVqiAIFi9efPrppz/yyCNa67q6upqamkptx1DzSkSf+MQnzjrrrMcff9wQxyuNVqyTNI1nUg6O400c4bKcSBQmvFvZbPY3v/lNRayltbYsa/Xq1eF5/vKXv1y3bl0o0wiPXFdX9973vjcMZx44cOCZZ56566675s2b9+UvfzmXyyUSiW984xuhHPPcc89dtGhRMpkMxWOV0u1BEMyYMWPLli1XXXXVz3/+85Ct+vv7Ozo6Ghsbwy2PECKfz4ecMmvWrFHzoEJGC4Kg8qdw99Te3r5q1aq77777scceqwRcuru7L7nkkhtuuOGGG244/fTTa2trwzc/+uijRHTJJZcA+PGPfyyEWLZsWVNTU7V2JkyNsSwr1NqbBj3Gx3FcCkyMv1ZD8eJk4xcTD6xMfGaHi7mtre3WW28d6z1f+MIXhr0ybdq0gwcPHjx48OGHH37kkUdC+VZ3d/fMmTPnzp1bLBZffPHFQ4cOff/733/ooYcuuOCCq6+++pZbbglZKYz79vb27t+//89//nNlVQdB8JGPfOSzn/3snDlzFi9eLIT42Mc+1tfX19raCuCUU06ppM+EC9iyrK9+9aubN2/etWuX67rhRqm3t/ev//qvd+/evWnTps7OTpRlJn/7t3+7d+/eH/7wh7t37/7617/+9a9/febMmQsXLrzooos+/vGPP/XUU0R0/fXXP/LII7/+9a+11u94xzscx5FSWpYV3lwhxKpVqwYGBqZPn26IwxDHsSSOCS5pIUQ0Gp2s0SGEcBynWCxOnJ4mPrnDKGNYUb06nBHaLNUcF+aez5gxIwiCL3zhC4899hiAxsbGG2644dZbb21oaAi3bPfff//vfve7e+6555lnnrnnnnvuueeeK664oqamJhTFW5a1atWqMNIBYPHixbfffvu6devCZLOurq7nn38ewD//8z8/8MADSqlUKnXeeedVKm709/eHErVqZWpjY+P8+fPT6fTWrVuffvrp8MVZs2bddNNNH/vYxxYtWgTgL/7iL/7zP//zscce6+/v379///79+2+99dY1a9a0t7cT0eLFi2+55RbP8y6++OKbb755//79QRC0tbXV1tbW1NTs27fvne98J4ALL7zQ+EcNcRyz7dkEiSM0N46sUGj4DKw2y4+JzxXAzJkz169fP3EjJXzm/+d//ucnPvGJt7zlLTfccENTU1M1Da1YsWLFihWf/vSn169ff/fdd0+fPn3BggXhnxYtWpTL5d7xjnesXbt2375973vf+970pjeFW4bu7u5nn3326aef3rJlywUXXDB9+vQvfvGLtbW1uVyusbGxouX/q7/6qx07dlx55ZXpdLqzs9O27XQ6/d73vre5uRnAd7/73U996lOnnnrqZZdddvHFF4dO0HCfddlll1122WV79+7985//HKbqf+ADH+jv77/rrrteeumlRYsW/eIXv/jCF77wr//6r2F9ky984QtSylmzZv3whz/89re/7Xne5Zdfft1114UCObNW8cpvjzDB3ggTqeJzPAr55PP53t7eCUZMk8nkZGWdlfPv7++feBJdfX39CSvtEwY1qgVgoaNk2J4ojH2GJDjMSTSyRs44PXsm7l0LHTfhran++QT7/GEK+YxRwmeCBcEO6yI8KS2OicdKhRBHvJjDyh2hbmqCztTjF5AKWSDczoQhjGGXGa7PkEEqv1YiGhUzrbqSY6UNVXX7y5GrvVLIpzodprquT3ic8FPVJ1Yp9hXO4/Aj1TuyiuUYXl148IqbIzy46Whjtio4hmqocAoednFOKkVlVGfEBGMrk627d8SBnvHtrMp6HsZQlea4Y+XLDFvtY70ychkf9qyGnVL1oNWnVC3SMzrR11aV81cacYTK8aOxh0MX6cRX9StxL/pKPTEDQxwvw1ZlghZs+LaKCnOyae/hQBMxbarTWw0MDHG8UrdYEyMOKaXWupKdgcnkwmSz2Ymbzaa7vYHxcZwEcBxnIhW6QiFDPp8PqxNjMq7pbDZbXez7mFhA4zdnGBloGEuNakjKwBDHkSAUg44vsmDmsB0kgGKxOPHwSqXYRyaTOayP4MhcsMOOOawzdnWvEzNHDQxx4Bj6/BzHOWyqW4VZCoWC4zixWGwitkA+nw97Vk9Qomrb9mTNmQMHDti2HSbd1NXVxePx+++//8orr2xoaLj//vvPPvvs6dOnM/PmzZs7OjoqnuDwlNLp9GmnnTZxTVTls2O9UrnGkeUIR8ouqn8YedhR3zPO6KMObWB8HMcRh608XD1ftda5XG4ing7P88JOHxOMmwohJsJHw1Zye3v7r3/9682bN2/ZsuXRRx+NRCJNTU0bN27ctm1bPp+vq6sLV9Tjjz/e19dXfSZKqT/96U+hFr6Sdz+++za0ZaqvPXylWiaktfY8b1jctHqvFJYCGiYlCl887HtGhoGr3xAEge/7hjWMxXGCYNt2NBqdYB5aNBqdCNGEbteamprQ6JjgpmmCIVtUtZ6bMWPG5s2bZ8+eLYRYvXr1888/39bW5nnepk2bamtrf//737/pTW8SQiQSiYsvvrihoaH6462trdVMcdgl197e/vvf//7ss89evHhx+GDft2/fH//4xyuuuGLGjBnM/MILL2zatElr3dTUdM0114QGzqZNm1588cWbb745Fov5vv/www9nMplCoXDJJZcsWrSImbPZ7EMPPVQsFmtqat785jdns9nf/e53xWLR9/3LLrts3rx5mUzm/vvvD7n4rLPOOu2008LR+/r6HnzwwRtuuCGVSq1evXrbtm2+78+cOfPKK680aSmGOE6Q0TGRPDQiisVioRtiWCnwYc6F6k1QmIR22CPH4/FJlfwJ08bWrVvX39+/c+dOZu7o6LjyyivPPvvsDRs27N+//9prr0VVw8S77747nU5XzHvf93t7e6tdKo899tjUqVNPOeWUYZuLcJWuXbt2zZo1PT09YY0MIcRTTz21ZcuWnp6eSgEhInrzm9/sOM6dd965Zs2ac84554EHHujq6spms5Vv6cwzz2xubt66detDDz20YMECIvrVr361YMGC888/PyxNmMlkli5dunjx4s2bNz/00EO33357f39/oVC44YYbgiCo7iDx+OOPb9my5frrrwcwY8aM5cuXK6W+//3vz549e+HChUaKbogDJyC2EovFcrnc+E9dZs5kMuH8HpYpVyGOYX+aSL2PsFfLpMyN8JjTp0+Px+Otra1nnnlmWLkvkUisWbPm0KFD3d3da9euTSQSc+bM8TzvjDPOmDt3biQSqZgYWuu9e/eGQvjQ3dvb2xsuy2FLLvxO5s2bd+qpp957772VQqHLly+/4IILfvKTn4QcKoQ466yzwo/MmzcvLEd66aWXRqPRH//4x5XvecaMGQCmTZsWaup27txpWdbFF19cqe41ffr0MAV++fLlTz75JICwyVOYC1chsvXr1yulli5dGhJZWG4DQDqdNnxhiOPEIZVKeZ532BzWUVsuVnsHJysJD4MpE9z+jOw4/eijj/b19a1Zs6avry+ZTOZyuZ6enmw267puT0+PEGLNmjVr165Np9MvvPBCpVl0ZY/24osvTp06Neyi9va3v32cPUvIKRXriZnDdV7dNzMs4dXR0fHSSy+FhUJqa2vD9i6V4+zevXvt2rWHDh265ppriKi1tVVr/cADD+zfv3/BggVveMMbKi2jfvOb30ydOjX0mxw8ePDHP/5xMpl8wxvekEwme3t7n3766Xe84x333ntv+J0PDAysXr16z549c+bMWbBggTE3DHHghMnPa2pquru7jyY95MgyR5LJ5BFEYbXWsVjsjDPOsCzr9a9/veu6nuc1NjZOmzZt165du3fvDju8KaXOOuusZ555Ril14403Vjesk1JW683GT0Kt9Hwe65VQ9rphw4bHH3/8mmuuaWlpGTVcEovFZs6cKaVcu3btvHnzwh3TW97yFinld7/73ZkzZy5btqxYLIb1DW+++WZmnjNnzvvf/37XdX//+98/8MADN99884MPPnjVVVfV1NQEQRBaamHBQcuy9u7d29bWNmXKFMMdhjhwwjQd6XR6YGDgRE64RCIx2WBKNUk988wzBw4cCIuMKaVmzZrV2dnZ399f6Xp92WWXpVIp3/czmcx9991XIY4w2f+WW25pbm6uFPg67HAjE6iri/StWbNmzZo1733ve0NjZOR7iGjKlClhG9dvfOMbnZ2diURiwYIFYb2CBQsWdHV1BUHw85//fPHixWHpnXCDE7LD9ddff9ddd23atOngwYMbN25cs2ZNb2/vAw88cO211zY2Np566qmhp+aZZ5658cYbDXEY4jhxSCaTWutMJnMConrMHNb4OIL5HT7td+zY0d7ePm/evNBBeNddd82YMWPatGk7d+7s7OxcsWKFUirs0nL55Zdfeuml1SVOhBDf/e53q4det25dXV3drFmzxllylTrAI1/JZrN//OMf3/nOd9q23dvbG41GKw1ifN8Ph+7v73ddt76+PgzoxOPx+fPnr169uq+vz7KsHTt2vPOd73zqqafi8fi5557b19dHRKlUamBgQEoZjUZXrlyZSqWWLVs2e/bssBx8W1vbeeedl0qlDh482NjY6Pv+/v37ly9fbhakIY4TjXAzn81mj+vzipkTicSRsUblGV5XV/fmN7/56aeffumll1zXdV139uzZoSdCKTVnzhyMUJdXSOHgwYO+71d7PZ577rl58+aNTxyNjY1hj5IKmpubQ9+qUqq2tvaRRx4hItd1Fy1adPnll4fjtrS0hAfM5/MPP/xwPB7P5XLX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agFANBrtcxFeeOGFu+6664UXXrjjjju0FCqlLrvsMkR86623Vq5cWV9f39HRgYhPP/30zp07jx8//swzz0ydOnXp0qULFix45ZVXvvSlL7muq91G+fn54XCYc37u+jXOFRvcOJMnc0HJRzwe37ZtW3V19U033XTfffc1NTXt3btXB0QZY7t37w4EAj/96U+3bdumfZP9H+CxWOy+++7LysrauXPn5s2bd+3atXz58nXr1ulntc/nq6qq0oYGY2zAwE3qwf71r3/9e9/73r/927/dcMMN8Xj8qaeeMgxDqw/nXE8QHn74Ydd1c3Nzn3rqqeXLl3d0dDz44IPZ2dktLS2NjY0PPfTQs88+e8o0CqVUV1eXth20a1P/+vrwUn+onaPV1dWbNm0qLy+/5557XnzxxQcffNB1XcMw2tvbn3zyyba2tg0bNjQ0NGRnZ8disZQW6BeGYTQ3N//mN7/p7OzUp5+ZmanliSTj/BGO/id2HouInu0//fTT69evj8fja9euveGGGyoqKuLxeGrgrVq1KpFIvPTSS0Nv6vDhw3/1V3/V2tp64403/uhHP4rH4/pp7HmeYRj//d//3dbWpsfhgMFd/U3TNF966aUXX3xx8uTJv/vd77KysmbMmPG1r32tubl5y5YtehLR3t7e0NBwxRVXPPTQQx999BFjbMOGDa2trUIIn8+3f//+xx57TEdM9AkOltaBiG1tbYZhGIYRDocty9L2Vx9XjlbP73znO7fccktWVtY//MM/PPDAA/fff79t267r5uXl3XvvvX6//5FHHgmFQkKIuXPnLlq06K233tqyZcu3vvUtAKirq4vH41VVVa7rZmRktLW1vfnmmwUFBakrfIG4Nj6t0zQ+3RM+L+VDz/ZXr17993//9zfeeOPChQsZY5dcckn6d7Kzs4UQSqkh7H9ELC4u/uCDD5555hnP87Kzs4PBYPrUfceOHU1NTQCgYyUDon0ozc3N1113XXl5+cqVK7Oysj766KO77rqrq6tr3759t912m5TyySefXL9+/Ve/+lXP85RS27Zt0y5e7ZHhnJeWlqYcNCkF6W/aIOK+ffsmTJiglIpGo4ZhaLdF+gxLCGHb9uuvv/7HP/7x0KFDnuctX778iiuu+NrXvvbrX//adV2l1I9+9KPq6urs7Oyurq729vbLL7+8srKyurq6vb29pqbGtu1vfetbS5YsWbNmzb333lteXv6nP/0pNzd31apV4XDY7/cLIfT8hSTjfBOO894GycnJ0bdvOBzu/xvrsZfKgxxsI4FAgHMej8e1Ed5nPqIn89FotLa2djAnq1IqGAx++9vf1v8MhUJvvfXWtddeu27durq6ugcffPCNN97QHx07doxzbhiGz+cLhUL19fX6CBljBQUFWpsQ8fDhw88///wTTzwxoN4h4ptvvnnttdfquIk2PSKRSEVFBSJ2d3frhLQdO3bcc88969evnzBhguu6Qojnnntu5syZTzzxxHe/+93XX3+9rq7u+uuvX7t2LQDcfvvtf/EXf4GI69evr6ioePTRR7Vovvnmm3fccceHH354ySWXlJWV/d3f/d3MmTPb2trWrFkTCoV+/vOfn51Bt/MjhmiczRflnJYSKaUQIhwO27a9d+/eo0ePphKiEbG5ufmU2V/Qm7sVjUZN04xEIm+//XbqoW0YxieffDJhwoQtW7asWrVKP2b72z7xePz2229fvHjxG2+8UVtbm52dffPNN7e2turBeejQIe00WbBgQWFh4e7du1euXFlWVvbjH/9Ym/2a559/Xs+zEHHjxo3l5eWcc31s6edrGIZ++H//+9/v6urasmVLfn6+bdsHDx785je/yTnfu3dvRkbG66+//pd/+ZdPP/30zTffrOdcUsqcnJw//OEPV1555fHjx7/+9a+/9NJL3/ve9/7jP/4jFAp1dXUtXrwYAA4cOBAOhxctWgQA27dv//a3vz1//vyenp7HH3/8j3/84/bt25977rk333zzlltuufPOO4uLiwfLZyeZOK+EYwwv3KerOHpUr1+/fs2aNXl5eaWlpRs3bnznnXf0FEYpxTmvqakZ+p7WN30sFrvtttvKy8t/9atf9fT0vPzyy/qapAKZV1555XXXXbd9+3YdkhhQv2zbfvvtt2+66abLL7989uzZH3zwQVVV1datW4UQX/7yl3ft2uU4TkFBQVFR0bJly5544okf//jHkUgkNzdXKbV69erdu3eHQiEdfEHETZs2ffnLXx7smj/++OOrV69uaGi48847Xdd9/fXXu7u7V65cqYO+999/v+d5r7766k9/+tNVq1alpIdzLoRYunTp5s2bH3vssSlTphQVFcViMW0BBYNBnbkfDod1eqvrun/zN3+j9/vcc8/96le/+ud//ueXX36ZMdbZ2Tlz5szi4mLtZ6XxP14nRevTYXzyzTs7O48cOTJv3rxAIND/O/v27Zs8ebIenEMHKfbt25eVlTV9+vT+n3Z2djY0NMybN29Eh9fS0tLZ2Tl79uz+eue6rm3b6W92dHS0tLQUFxdnZ2frQ/3DH/7wmc98Jjs7e8Czrq2tLS4u5py3tbXl5ORYluW6ruM4+iJEo1HbtrVY9M9GT38nFouFQqGJEyfq08zOzmaMNTY2dnd3z549W3tb9f/37Nlj23ZOTs6UKVMAYNeuXRMnTiwuLj5fRywJxwVE/wzRkT4MU+GM9FSR1EaGvw41NZb6RC5T/svBhGzAVSejW18/xKLYPumeOqw7zIW5oztCgoTjrLM7hogL6gDEcB6JeiwNOCSGGIGjW8zef5z3PwsdBhrsyPXtlFqv1KeCxohKaaSEIP3P+x95+uL6EV1YgoSDIIgzCpl2BEGQcBAEQcJBEAQJB0EQJBwEQZBwEARBkHAQBEHCQRAECQdBECQcBEGQcBAEQZBwEARBwkEQBAkHQRAkHARBkHAQBEGQcBAEQcJBEAQJB0EQJBwEQZBwEARBwkEQBEHCQRAECQdBECQcBEGQcBAEQcJBEARBwkEQBAkHQRAkHARBkHAQBEHCQRAEQcJBEAQJB0EQJBwEQZBwEARBwkEQBEHCQRAECQdBECQcBEGQcBAEQcJBEAQJB0EQBAkHQRAkHARBkHAQBEHCQRAECQdBEAQJB0EQJBwEQZBwEARBwkEQBAkHQRAECQdBECQcBEGQcBAEQcJBEAQJB0EQBAkHQRAkHARBkHAQBEHCQRAECQdBECQcBEEQJBwEQZBwEARBwkEQBAkHQRAkHARBECQcBEGQcBAEQcJBEAQJB0EQJBwEQRAkHARBkHAQBEHCQRAECQdBECQcBEEQJBwEQZBwEARBwkEQxNmIQZfgAkEppZRKfwcREZGuDDEKsM/NRJyvqjGgRkgpGSOrkyDhIAaRjOPHj5eXl7e0tDiOk5mZOXny5MWLFwcCAdIOgqYqxACqkUgk/uu//uujjz6Kx+N6eqKfFkVFRffee+9ll11G2kGQxUGcJByu665du3bnzp1ZWVmMsdTPrQXFdd0HH3zw6quvPqV26D/USjS0Z0Q7U/R3yIcCFFUhzi2klIj4+9//fseOHbm5uUopIYTsRQhhWZZt27/61a8aGhrSNaW/EOhNISJjTGuBlHLAPWqx0F9DRCklPZlIOIhzydZgjLW2tn7wwQdZWVme5w04zg3DiMViGzZsSNkUA052GGOJRKKurq66urqtrQ0A+guN3iMAtLW1VVdXHz9+PJFIaAUh7SAfB3HOmBuc8+3bt/f09GRmZg5oIACAEMK27X379oVCoezs7D7BF/3PSCTy1ltv7dq1q62tTQjh9/unTJly4403Ll26NPV9/WLnzp3vvPNObW1tLBbjnOfl5S1duvTWW28NBoODhXWIcxT+gx/8gK7C+YeeKbzxxhttbW2maQ7xzOech8Ph2bNnFxcXpw9v/bq1tfWpp57avHlzLBbLz8/PyclxHKeqqmr79u1Synnz5uktI+K6detefPHFhoaGYDBYUFBgWVZzc3NZWVl5efmiRYtIO8jiIM6NYIrjOC0tLYZhnHKmIISor69fsmRJn296nvfCCy8cOXJk5syZd91116xZsyzL6urq+uijjzZs2PD73/++tLT0yiuvBIDNmzf//ve/DwQCd9xxx7XXXpubm5tIJCorK9etW1dZWfnLX/7ykUceocAN+TiIc4BoNBqNRof5kA+FQulBEO0NLSsrKysrKywsXL16tU76MAwjPz//9ttvX7Fihed577zzjvazbty4UUq5YsWKO+64Iz8/n3MeCAQWLVq0evXqgoKCffv2HTx4UPtK6Xch4SDO7p+2NwIynHnNgN7TioqKWCy2ZMmSkpISIYS2R3RQ5s/+7M9ycnLq6+u7u7s7OjoaGxtzc3NXrFihP9VWjxCipKRk8eLF0Wj08OHD9IuQcBDnAD09PTquccqpCmOso6Ojf9pFIpFQSulQbip9QwdZMjIysrKy4vF4OBx2XddxnEAgEAgEUmqVyjQrKCgAgO7ubvpFSDiIs93HAQBbtmyJRCKn9CxIKW3bPnToUENDw4Ch0z5OzfTUjJRntP8fprI/0r9JkHAQZ/UkJZFIbNu2zefzDWfEMsYikcgnn3wynBHOOT+lt0JrjWEYJBkkHAScKxkcAFBWVtbY2GhZ1nDGrVLK5/Pt2LHDcZx0C6WPoQEAu3fv/sUvflFXVxcIBPpkfKS+r5PZn3/++U2bNuktUyAWKBxLnBNs27Zt+I96pZRlWY2NjRUVFQsWLEhZE9q4SCQSKWlob29fv379zp07r732Wj0TMQyDMWYYhuu6ruv6fD49bdm6devbb7+9c+dOv99vGAbnnH4UsjiIszrTPBKJVFZW2rY9fO3Qs489e/akv1lSUmKaZnl5ueu6pmkKIebNm3frrbdKKd95552Ojo6ioqKcnJysrKzc3NzOzs6ysjJEFEIYhnHXXXdNnz59z549u3bt8vv9U6dOpTkLCQdxVrtFa2pqOjs7h+9f0OFYRDx27JheJqtnFosXLy4uLj527NhLL70UjUY558XFxQ899NAVV1xhmiYAlJaW2rZt2/ayZcscx3n11VcPHz7MOTdNc+XKlatWrQoGg4Zh+P3+adOmUcExoJRz4mzOGd27d+/27dvnzZsXDoeFEEMPV0R0XXfixInBYLCtrW358uU+n09/ZNt2fn7+jh07qqqq9uzZU19ff+jQoXfffffAgQOxWExK2d7eXlVVNX/+/Dlz5hw5cuTo0aO7d++uqqqqqanZunXr+++/39XVFY/HlVJ79uzJz8+fNGkS+TtIOAg4Cz2jjLFNmzZJKb/+9a9v2rTJdd2hB6qe2lx11VW33nrru+++e91112VmZqYmLyUlJaWlpTU1NbqAWHl5eX19PSJec801ixYtqqioqKqquv766ydMmLB48eKurq66urrKysr9+/dXVlaGw+HJkyffcsstkUhk//79hYWFixYtIuEAKuRDnJ0Wx759+/Ly8kpKSn7yk5/s2LEjMzNTCDGEcITD4UcffXTRokVbt26dPXt2Tk5On2WvsVhs//79TU1NAJCZmTlz5szS0lIAqK2tLS8vv/rqqzMzM/X3q6qqDh8+nEgkTNMsLS2dPXu2z+eLxWJbt26dMGHCwoULSThIOIizXURqamqeeOIJvcR+wB9aq8ayZcu+8Y1v6H8Os6CxLvOV/n56RJbqIQM5R4lztxPCtGnT/vqv/1rHTVk/OOeu606dOvWhhx7SDtEB07p00rpezKZriKWq++j30xfyp76W+mbqa/SIIouDOAe0Q0r5wQcfvP/++01NTSkpSZcGnVth2/aMGTPuvvtuHTGleQQBlAB2IRfyEUIcPnxYSjllyhREtCyLc+73+/1+fzwe9zwvEom4rquUam1traqqIuEgyOIg+lYtHqwh02CuDYIg4aAGbgN0gUzpxWB+TYIg4SAIAiiqQhAECQdBECQcBEGQcBAEQZBwEARBwkEQBAkHQRAkHARBkHAQBEHCQRAEQcJBEAQJB0EQJBwEQZBwEARBwkEQBEHCQRAECQdBECQcBEGQcBAEQcJBEAQxEP8fqZG+XvOex6sAAAAASUVORK5CYII=";

// src/client/settings-about.tsx
var import_jsx_runtime24 = require("react/jsx-runtime");
var PLUGIN_VERSION = true ? "1.0.0" : "\u5F00\u53D1\u7248";
var REPO_URL = "https://github.com/lanxiake/dsh-vyra-plugins";
var VERSION_LABEL = "\u7248\u672C";
var VERSION_VALUE = /^\d/.test(PLUGIN_VERSION) ? `v${PLUGIN_VERSION}` : PLUGIN_VERSION;
var QQ_LABEL = "QQ\u4EA4\u6D41\u7FA4";
var QQ_DESC = "\u626B\u63CF\u4E8C\u7EF4\u7801\u52A0\u5165 QQ \u4EA4\u6D41\u7FA4\uFF08\u7FA4\u53F7 1121362543\uFF09\uFF0C\u83B7\u53D6\u6700\u65B0\u8D44\u8BAF\u548C\u6280\u672F\u652F\u6301";
var QQ_TIP = "\u4F7F\u7528 QQ \u626B\u4E00\u626B";
var QQ_QR_ALT = "\u5B98\u65B9 QQ \u4EA4\u6D41\u7FA4\u4E8C\u7EF4\u7801";
var QR_WIDTH = 180;
var ABOUT_CLASS = "vyra-agent-cli-manager-about";
var SETTINGS_ABOUT_STYLES = `
.${ABOUT_CLASS} { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 0; }
.${ABOUT_CLASS}-pill { position: relative; display: inline-flex; align-items: center; gap: 6px; box-sizing: border-box; height: 28px; padding: 0 12px; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 14px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; line-height: 18px; text-decoration: none; white-space: nowrap; transition: background-color 150ms ease, color 150ms ease; }
.${ABOUT_CLASS}-value { color: var(--dsw-alias-label-primary); font-weight: 500; }
button.${ABOUT_CLASS}-pill, a.${ABOUT_CLASS}-pill { cursor: pointer; }
button.${ABOUT_CLASS}-pill:hover, a.${ABOUT_CLASS}-pill:hover, .${ABOUT_CLASS}-pill[aria-expanded="true"] { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); border-color: var(--dsw-alias-border-l3, var(--dsw-alias-border-l2)); }
button.${ABOUT_CLASS}-pill:focus-visible, a.${ABOUT_CLASS}-pill:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, currentColor); outline-offset: 1px; }
.${ABOUT_CLASS}-anchor { position: relative; }
.${ABOUT_CLASS}-qr { position: absolute; top: calc(100% + 8px); left: 0; z-index: 10; width: 240px; padding: 16px; border-radius: 14px; background: var(--dsw-alias-bg-layer-1); box-shadow: var(--dsw-elevation-panel); color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; text-align: center; }
.${ABOUT_CLASS}-qr p { margin: 0; }
.${ABOUT_CLASS}-qr img { display: block; margin: 12px auto 8px; padding: 8px; border-radius: 10px; background: #fff; }
`;
function useEscape(active, close) {
  (0, import_react19.useEffect)(() => {
    if (!active) return void 0;
    const onKey = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [active, close]);
}
function QqGroup() {
  const [open, setOpen] = (0, import_react19.useState)(false);
  useEscape(open, () => {
    setOpen(false);
  });
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("span", { className: `${ABOUT_CLASS}-anchor`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
      "button",
      {
        type: "button",
        className: `${ABOUT_CLASS}-pill`,
        "aria-expanded": open,
        onClick: () => {
          setOpen((value) => !value);
        },
        children: QQ_LABEL
      }
    ),
    open ? /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: `${ABOUT_CLASS}-qr`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("p", { children: QQ_DESC }),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("img", { src: qq_group_default, alt: QQ_QR_ALT, width: QR_WIDTH }),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("p", { children: QQ_TIP })
    ] }) : null
  ] });
}
function VersionPill() {
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("span", { className: `${ABOUT_CLASS}-pill`, children: [
    VERSION_LABEL,
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { className: `${ABOUT_CLASS}-value`, children: VERSION_VALUE })
  ] });
}
function SettingsAbout() {
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: ABOUT_CLASS, children: [
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(VersionPill, {}),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(QqGroup, {}),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("a", { className: `${ABOUT_CLASS}-pill`, href: REPO_URL, target: "_blank", rel: "noreferrer", children: "GitHub" })
  ] });
}

// src/client/settings-tabs.tsx
var import_react20 = require("react");
var import_jsx_runtime25 = require("react/jsx-runtime");
var TABS_CLASS = "vyra-agent-cli-manager-tabs";
var SETTINGS_TABS_STYLES = `
/*
 * A segmented control, the way macOS 13+ draws one: a recessed track with the selected segment
 * raised out of it on a lighter fill and a hairline shadow.
 *
 * Recessed-vs-raised rather than an underline, because an underline reads as navigation between
 * pages (which is what DSH's own settings do, and what this deliberately is not) \u2014 these tabs
 * switch a panel in place, and the segmented control is the platform's idiom for exactly that.
 *
 * Every colour is a DSH theme variable, so both themes are correct without a second rule: the
 * track is one layer below the page, the selected segment one layer above it, and the direction
 * of "lighter" is whatever the active theme says it is. Hard-coding white would invert on the
 * dark theme.
 */
.${TABS_CLASS} { display: inline-flex; gap: 2px; margin: 4px 0 20px; padding: 2px; border-radius: 10px; background: var(--dsw-alias-bg-layer-3); }
.${TABS_CLASS}-tab {
  position: relative;
  margin: 0;
  padding: 6px 14px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
  /* Only the properties that change, and short: a segment should feel like it snaps. */
  transition: background-color 150ms ease, color 150ms ease;
}
.${TABS_CLASS}-tab:hover:not([aria-selected="true"]) { color: var(--dsw-alias-label-primary); }
.${TABS_CLASS}-tab[aria-selected="true"] {
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
  box-shadow: 0 1px 2px var(--dsw-elevation-soft, rgb(0 0 0 / 12%));
}
.${TABS_CLASS}-tab:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, currentColor); outline-offset: 1px; }
`;
function nextIndex(key, index, count) {
  switch (key) {
    case "ArrowRight":
      return (index + 1) % count;
    case "ArrowLeft":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return void 0;
  }
}
function TabButton({
  tab,
  prefix,
  active,
  onSelect
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
    "button",
    {
      type: "button",
      role: "tab",
      id: `${prefix}-${tab.id}-tab`,
      "data-tab": tab.id,
      className: `${TABS_CLASS}-tab`,
      "aria-selected": active,
      "aria-controls": `${prefix}-${tab.id}-panel`,
      tabIndex: active ? 0 : -1,
      onClick: onSelect,
      children: tab.label
    }
  );
}
function SettingsTabs({
  tabs,
  label
}) {
  const [selected, setSelected] = (0, import_react20.useState)(tabs[0]?.id);
  const strip = (0, import_react20.useRef)(null);
  const prefix = (0, import_react20.useId)();
  const current = tabs.find((tab) => tab.id === selected) ?? tabs[0];
  const onKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.id === current?.id);
    const next = nextIndex(event.key, index, tabs.length);
    const target = next === void 0 ? void 0 : tabs[next];
    if (target === void 0) return;
    event.preventDefault();
    setSelected(target.id);
    strip.current?.querySelector(`[data-tab="${target.id}"]`)?.focus();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)(import_jsx_runtime25.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("div", { ref: strip, className: TABS_CLASS, role: "tablist", "aria-label": label, onKeyDown, children: tabs.map((tab) => /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
      TabButton,
      {
        tab,
        prefix,
        active: tab.id === current?.id,
        onSelect: () => {
          setSelected(tab.id);
        }
      },
      tab.id
    )) }),
    current === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("div", { role: "tabpanel", id: `${prefix}-${current.id}-panel`, "aria-labelledby": `${prefix}-${current.id}-tab`, children: current.render() })
  ] });
}

// src/client/settings-page.tsx
var import_jsx_runtime26 = require("react/jsx-runtime");
var SETTINGS_TITLE = "Agent CM";
var CLI_STATUS_TAB_LABEL = "Agent CLI";
var MCP_TAB_LABEL = "MCP";
var SKILLS_TAB_LABEL = "\u6280\u80FD";
var CLI_TAB_LABEL = "CLI \u5217\u8868";
var PAGE_CLASS = "vyra-agent-cli-manager-settings";
var SETTINGS_PAGE_STYLES = `
.${PAGE_CLASS} { display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; max-width: 720px; color: var(--dsw-alias-label-primary); }
.${PAGE_CLASS}-header { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; }
.${PAGE_CLASS} h1 { margin: 0; color: var(--dsw-alias-label-primary); font-size: 17px; line-height: 24px; font-weight: 600; letter-spacing: -0.01em; }
.${PAGE_CLASS}-intro { margin: 0 0 12px; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.${PAGE_CLASS}-list { margin: 0; padding: 0; list-style: none; }
/* The host paints an on switch with the brand color, which is near-white in the dark theme;
   a green track (with a white thumb) reads as "on" at a glance in both themes. */
.${PAGE_CLASS} [role="switch"][aria-checked="true"] { background: var(--dsw-alias-state-success-primary, #2da44e); }
.${PAGE_CLASS} [role="switch"][aria-checked="true"] > span { background: #fff; }
.${PAGE_CLASS}-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 0; }
.${PAGE_CLASS}-row + .${PAGE_CLASS}-row { border-top: 0.5px solid var(--dsw-alias-border-l1); }
.${PAGE_CLASS}-title { color: var(--dsw-alias-label-primary); font-size: 14px; font-weight: 500; line-height: 20px; }
.${PAGE_CLASS}-desc { margin-top: 3px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
${SETTINGS_TABS_STYLES}${CLI_STATUS_STYLES}${MCP_TAB_STYLES}${SKILL_TAB_STYLES}${CLI_PREFS_STYLES}${SETTINGS_ABOUT_STYLES}${MODAL_STYLES}`;
function SettingsPage({
  settings,
  cliPrefs
}) {
  const tabs = [
    { id: "clis", label: CLI_STATUS_TAB_LABEL, render: () => /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(CliStatusSection, {}) },
    { id: "mcp", label: MCP_TAB_LABEL, render: () => /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(McpTab, {}) },
    { id: "skills", label: SKILLS_TAB_LABEL, render: () => /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(SkillsTab, {}) },
    { id: "cli", label: CLI_TAB_LABEL, render: () => /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(CliPrefsSection, { prefs: cliPrefs }) }
    // The 界面交互 tab is not offered. Its switches only ever turned off parts of this plugin,
    // which is a decision the CLI/MCP/技能 tabs already cover per item, and a page of toggles for
    // features the user deliberately installed reads as doubt about its own product.
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: PAGE_CLASS, children: [
    /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: `${PAGE_CLASS}-header`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("h1", { children: SETTINGS_TITLE }),
      /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(SettingsAbout, {})
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(SettingsTabs, { tabs, label: SETTINGS_TITLE })
  ] });
}
function SettingsIcon({ size }) {
  return /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(import_dsh_client_ui_primitives12.IconSlidersTwoOutlineRegular, { size });
}

// src/client/settings-register.ts
var SETTINGS_SECTION_ID = "vyra-agent-cli-manager.settings";
var SETTINGS_ORDER = 50;
function isDisposable(value) {
  return typeof value === "object" && value !== null && "dispose" in value && typeof value.dispose === "function";
}
function registerSettingsPage(ctx, settings, cliPrefs) {
  ctx.slots.inject(
    "settings.section",
    () => ctx.slots.register(
      {
        name: "settings.section",
        id: SETTINGS_SECTION_ID,
        order: SETTINGS_ORDER,
        label: SETTINGS_TITLE,
        inject: () => ({ settings, cliPrefs })
      },
      SettingsPage
    )
  );
  ctx.slots.inject(
    "settings.section.icon",
    () => ctx.slots.register({ name: "settings.section.icon", id: SETTINGS_SECTION_ID }, SettingsIcon)
  );
}
function gateInject(ctx, settings, id, inject2) {
  return (deps, apply2) => {
    ctx.effect(
      () => whileEnabled(settings, id, () => {
        const fiber = inject2(deps, apply2);
        return () => {
          if (!isDisposable(fiber)) return;
          fiber.dispose().catch((_error) => {
          });
        };
      }),
      `vyra-agent-cli-manager: ${id} switch`
    );
    return void 0;
  };
}

// src/client/worktree/worktree-register.tsx
var import_react26 = require("react");

// src/client/git-post.ts
var NETWORK_FAILED = "\u65E0\u6CD5\u8FDE\u63A5\u5230 DSH \u670D\u52A1";
async function answerOf(response) {
  try {
    const body = await response.json();
    return typeof body === "object" && body !== null ? body : {};
  } catch (_error) {
    return {};
  }
}
function gitPost(fetchFn, cwd) {
  return async (operation, body = {}) => {
    let response;
    try {
      response = await fetchFn(`${GIT_ROUTE_PREFIX}/${operation}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ...body, cwd })
      });
    } catch (error) {
      throw new Error(NETWORK_FAILED, { cause: error });
    }
    const answer = await answerOf(response);
    if (!response.ok || answer.success !== true) {
      throw new Error(typeof answer.error === "string" ? answer.error : `\u8BF7\u6C42\u5931\u8D25\uFF08${String(response.status)}\uFF09`);
    }
    return answer.data;
  };
}

// src/client/worktree/worktree-api.ts
function createWorktreeApi(fetchFn, cwd) {
  const post2 = gitPost(fetchFn, cwd);
  return {
    info: () => post2("worktree-info"),
    create: (request) => post2("worktree-add", request)
  };
}

// src/client/worktree/worktree-dialog.tsx
var import_react23 = require("react");
var import_dsh_client_ui_primitives15 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/worktree/worktree-fields.tsx
var import_react22 = require("react");
var import_dsh_client_ui_primitives14 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/worktree/branch-picker.tsx
var import_react21 = require("react");
var import_dsh_client_ui_primitives13 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/worktree/worktree-styles.ts
var WT = {
  dialog: "dsh-wt-dialog",
  body: "dsh-wt-body",
  tabs: "dsh-wt-tabs",
  tab: "dsh-wt-tab",
  field: "dsh-wt-field",
  label: "dsh-wt-label",
  hint: "dsh-wt-hint",
  picker: "dsh-wt-picker",
  options: "dsh-wt-options",
  option: "dsh-wt-option",
  toggle: "dsh-wt-toggle",
  status: "dsh-wt-status",
  error: "dsh-wt-error",
  footer: "dsh-wt-footer"
};
var OPTIONS_MAX_HEIGHT = "220px";
var WORKTREE_STYLES = `
.${WT.dialog} { width: min(480px, 100%); }
.${WT.body} { display: flex; flex-direction: column; gap: 14px; }
.${WT.tabs} { display: flex; gap: 6px; }
.${WT.tab} {
  height: 28px; padding: 0 12px; border: none; border-radius: var(--dsw-radius-md);
  background: transparent; color: var(--dsw-alias-label-secondary);
  font-size: 13px; line-height: 20px; cursor: pointer;
}
.${WT.tab}:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.${WT.tab}[aria-selected="true"] {
  background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); font-weight: 500;
}
.${WT.tab}:focus-visible { box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, currentColor); outline: none; }
.${WT.field} { display: flex; flex-direction: column; gap: 6px; }
.${WT.label} { font-size: 13px; line-height: 20px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.${WT.hint} { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.${WT.picker} { position: relative; display: flex; flex-direction: column; }
.${WT.options} {
  position: absolute; z-index: 10; top: calc(100% + 4px); left: 0; right: 0;
  max-height: ${OPTIONS_MAX_HEIGHT}; overflow-y: auto; padding: 4px;
}
.${WT.option} {
  padding: 6px 8px; border-radius: var(--dsw-radius-sm);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); cursor: pointer;
}
.${WT.option}[aria-selected="true"] { background: var(--dsw-alias-interactive-bg-hover); }
.${WT.toggle} {
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary);
}
.${WT.status} { margin: 0; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }
.${WT.error} {
  font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary);
  white-space: pre-wrap; overflow-wrap: anywhere;
}
.${WT.footer} { display: flex; align-items: center; justify-content: flex-end; gap: 8px; width: 100%; }
`;

// src/client/worktree/branch-picker.tsx
var import_jsx_runtime27 = require("react/jsx-runtime");
var MAX_OPTIONS = 100;
function matchingBranches(options, query) {
  const needle = query.trim().toLowerCase();
  const listed = needle === "" || options.includes(query.trim()) ? options : options.filter((name) => name.toLowerCase().includes(needle));
  return listed.slice(0, MAX_OPTIONS);
}
function usePickerKeys(matches, choose) {
  const [open, setOpen] = (0, import_react21.useState)(false);
  const [active, setActive] = (0, import_react21.useState)(0);
  const onKeyDown = (event) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive(open ? (active + step + matches.length) % Math.max(matches.length, 1) : 0);
      setOpen(true);
    } else if (event.key === "Enter" && open && matches[active] !== void 0) {
      event.preventDefault();
      choose(matches[active]);
      setOpen(false);
    } else if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
    }
  };
  return { open, setOpen, active, setActive, onKeyDown };
}
function BranchOptions(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(import_dsh_client_ui_primitives13.MenuSurface, { id: props.id, role: "listbox", className: WT.options, children: props.matches.map((name, index) => /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
    "div",
    {
      role: "option",
      "aria-selected": index === props.active,
      className: WT.option,
      title: name,
      onMouseDown: (event) => {
        event.preventDefault();
        props.onPick(name);
      },
      children: name
    },
    name
  )) });
}
function BranchPicker(props) {
  const { id, value, options, placeholder, disabled, onChange } = props;
  const listId = (0, import_react21.useId)();
  const matches = matchingBranches(options, value);
  const keys = usePickerKeys(matches, onChange);
  const shown = keys.open && matches.length > 0;
  return /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("div", { className: WT.picker, children: [
    /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
      import_dsh_client_ui_primitives13.Input,
      {
        id,
        role: "combobox",
        "aria-expanded": shown,
        "aria-controls": listId,
        "aria-autocomplete": "list",
        autoComplete: "off",
        spellCheck: false,
        value,
        placeholder,
        disabled,
        onChange: (event) => {
          onChange(event.target.value);
          keys.setOpen(true);
          keys.setActive(0);
        },
        onFocus: () => {
          keys.setOpen(true);
        },
        onBlur: () => {
          keys.setOpen(false);
        },
        onKeyDown: keys.onKeyDown
      }
    ),
    shown ? /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
      BranchOptions,
      {
        id: listId,
        matches,
        active: keys.active,
        onPick: (name) => {
          onChange(name);
          keys.setOpen(false);
        }
      }
    ) : null
  ] });
}

// src/client/worktree/worktree-form.ts
var PR_BRANCH_PREFIX = "pr-";
var PR_INPUT = /^#?(\d+)$|\/pull\/(\d+)(?:[/?#]|$)/;
var UNSAFE_SEGMENT = /[\\/:*?"<>|\s]+/g;
var EDGE_DASHES = /^-+|-+$/g;
var TITLE_SEPARATOR = " / ";
var MISSING_BRANCH = "\u8BF7\u586B\u5199\u5206\u652F\u540D";
var MISSING_BASE = "\u8BF7\u9009\u62E9\u57FA\u51C6\u5206\u652F";
var MISSING_EXISTING = "\u8BF7\u9009\u62E9\u5206\u652F";
var MISSING_PR = "\u8BF7\u586B\u5199 PR \u7F16\u53F7\u6216\u94FE\u63A5";
var MISSING_PATH = "\u8BF7\u586B\u5199\u4F4D\u7F6E";
function initialForm(info) {
  return {
    mode: "new",
    branch: "",
    base: info.current ?? info.local[0] ?? "",
    existing: "",
    pr: "",
    prBranch: "",
    prBranchEdited: false,
    path: "",
    openSession: true
  };
}
function prNumber(input) {
  const match = PR_INPUT.exec(input.trim());
  const number = Number(match?.[1] ?? match?.[2]);
  return Number.isSafeInteger(number) && number > 0 ? number : void 0;
}
function withPr(form, pr) {
  if (form.prBranchEdited) return { ...form, pr };
  const number = prNumber(pr);
  return { ...form, pr, prBranch: number === void 0 ? "" : `${PR_BRANCH_PREFIX}${String(number)}` };
}
function branchOf(form, info) {
  if (form.mode === "new") return form.branch.trim();
  if (form.mode === "pr") return form.prBranch.trim();
  const existing = form.existing.trim();
  return info.remote.includes(existing) ? existing.slice(existing.indexOf("/") + 1) : existing;
}
function defaultPath(info, branch) {
  const segment = branch.replace(UNSAFE_SEGMENT, "-").replace(EDGE_DASHES, "");
  return segment === "" ? "" : `${info.parent}${info.separator}${segment}`;
}
function targetPath(form, info) {
  const typed = form.path.trim();
  return typed === "" ? defaultPath(info, branchOf(form, info)) : typed;
}
function fieldProblem(form) {
  switch (form.mode) {
    case "new":
      if (form.branch.trim() === "") return MISSING_BRANCH;
      return form.base.trim() === "" ? MISSING_BASE : void 0;
    case "existing":
      return form.existing.trim() === "" ? MISSING_EXISTING : void 0;
    case "pr":
      if (prNumber(form.pr) === void 0) return MISSING_PR;
      return form.prBranch.trim() === "" ? MISSING_BRANCH : void 0;
  }
}
function formProblem(form, info) {
  return fieldProblem(form) ?? (targetPath(form, info) === "" ? MISSING_PATH : void 0);
}
function requestOf(form, info) {
  const path = targetPath(form, info);
  switch (form.mode) {
    case "new":
      return { mode: "new", branch: form.branch.trim(), base: form.base.trim(), path };
    case "existing":
      return { mode: "existing", branch: form.existing.trim(), path };
    case "pr":
      return { mode: "pr", pr: form.pr.trim(), branch: form.prBranch.trim(), path };
  }
}
function workspaceTitle(info, branch) {
  return `${info.name}${TITLE_SEPARATOR}${branch}`;
}

// src/client/worktree/worktree-fields.tsx
var import_jsx_runtime28 = require("react/jsx-runtime");
var MODES = [
  { id: "new", label: "\u65B0\u5206\u652F" },
  { id: "existing", label: "\u5DF2\u6709\u5206\u652F" },
  { id: "pr", label: "\u4ECE PR \u521B\u5EFA" }
];
var BRANCH_LABEL = "\u5206\u652F\u540D";
var BRANCH_PLACEHOLDER = "feature/my-change";
var BASE_LABEL = "\u57FA\u4E8E\uFF08base\uFF09";
var BASE_HINT = "\u4E0B\u62C9\u53EF\u641C\u7D22\u672C\u5730\u4E0E\u8FDC\u7A0B\u5206\u652F\uFF1B\u9009\u8FDC\u7A0B\u5206\u652F\u65F6\u521B\u5EFA\u524D\u5148 fetch";
var EXISTING_LABEL = "\u5206\u652F";
var EXISTING_PLACEHOLDER = "\u641C\u7D22\u672C\u5730\u6216\u8FDC\u7A0B\u5206\u652F";
var EXISTING_HINT = "\u8FDC\u7A0B\u5206\u652F\u4F1A\u5728\u672C\u5730\u5EFA\u4E00\u4E2A\u540C\u540D\u5206\u652F\u5E76\u8DDF\u8E2A\u5B83";
var PR_LABEL = "PR";
var PR_PLACEHOLDER = "#123 \u6216 PR \u94FE\u63A5";
var PR_HINT = "\u4ECE\u8FDC\u7A0B\u4ED3\u5E93\u62C9\u53D6 PR \u7684\u6700\u65B0\u63D0\u4EA4\uFF08\u6709 upstream \u65F6\u4F18\u5148\u7528 upstream\uFF09";
var PATH_LABEL = "\u4F4D\u7F6E";
var PATH_HINT = "\u9ED8\u8BA4\u653E\u5728\u4ED3\u5E93\u540C\u7EA7\u7684 <repo>-worktrees/ \u76EE\u5F55\u4E0B\uFF0C\u53EF\u4FEE\u6539";
var OPEN_SESSION = "\u521B\u5EFA\u540E\u6253\u5F00\u65B0\u4F1A\u8BDD\uFF08AI \u7ACB\u523B\u5728\u8BE5 worktree \u91CC\u5F00\u5DE5\uFF09";
function ModeTabs({ form, disabled, onChange }) {
  return /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("div", { role: "tablist", "aria-label": "Worktree \u6765\u6E90", className: WT.tabs, children: MODES.map((mode) => /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(
    "button",
    {
      type: "button",
      role: "tab",
      "aria-selected": form.mode === mode.id,
      className: WT.tab,
      disabled,
      onClick: () => {
        onChange({ ...form, mode: mode.id });
      },
      children: mode.label
    },
    mode.id
  )) });
}
function Field(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)("div", { className: WT.field, children: [
    /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("label", { htmlFor: props.id, className: WT.label, children: props.label }),
    props.children,
    props.hint === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("span", { className: WT.hint, children: props.hint })
  ] });
}
function TextField(props) {
  const id = (0, import_react22.useId)();
  return /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(Field, { id, label: props.label, ...props.hint === void 0 ? {} : { hint: props.hint }, children: /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(
    import_dsh_client_ui_primitives14.Input,
    {
      id,
      value: props.value,
      placeholder: props.placeholder,
      spellCheck: false,
      autoComplete: "off",
      disabled: props.disabled,
      onChange: (event) => {
        props.onChange(event.target.value);
      }
    }
  ) });
}
function PickerField(props) {
  const id = (0, import_react22.useId)();
  return /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(Field, { id, label: props.label, hint: props.hint, children: /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(BranchPicker, { ...props, id }) });
}
function SourceFields({ form, info, disabled, onChange }) {
  const branches = [...info.local, ...info.remote];
  if (form.mode === "new") {
    return /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)(import_jsx_runtime28.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(
        TextField,
        {
          label: BRANCH_LABEL,
          value: form.branch,
          placeholder: BRANCH_PLACEHOLDER,
          disabled,
          onChange: (branch) => {
            onChange({ ...form, branch });
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(
        PickerField,
        {
          label: BASE_LABEL,
          hint: BASE_HINT,
          value: form.base,
          options: branches,
          placeholder: EXISTING_PLACEHOLDER,
          disabled,
          onChange: (base) => {
            onChange({ ...form, base });
          }
        }
      )
    ] });
  }
  if (form.mode === "existing") {
    return /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(
      PickerField,
      {
        label: EXISTING_LABEL,
        hint: EXISTING_HINT,
        value: form.existing,
        options: branches,
        placeholder: EXISTING_PLACEHOLDER,
        disabled,
        onChange: (existing) => {
          onChange({ ...form, existing });
        }
      }
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(PrFields, { form, disabled, onChange });
}
function PrFields({ form, disabled, onChange }) {
  return /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)(import_jsx_runtime28.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(
      TextField,
      {
        label: PR_LABEL,
        value: form.pr,
        placeholder: PR_PLACEHOLDER,
        hint: PR_HINT,
        disabled,
        onChange: (pr) => {
          onChange(withPr(form, pr));
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(
      TextField,
      {
        label: BRANCH_LABEL,
        value: form.prBranch,
        placeholder: "pr-123",
        disabled,
        onChange: (prBranch) => {
          onChange({ ...form, prBranch, prBranchEdited: true });
        }
      }
    )
  ] });
}
function WorktreeFields(props) {
  const { form, info, disabled, onChange } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)("div", { className: WT.body, children: [
    /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(ModeTabs, { form, disabled, onChange }),
    /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(SourceFields, { ...props }),
    /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(
      TextField,
      {
        label: PATH_LABEL,
        value: form.path,
        placeholder: defaultPath(info, branchOf(form, info)),
        hint: PATH_HINT,
        disabled,
        onChange: (path) => {
          onChange({ ...form, path });
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)("div", { className: WT.toggle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(
        import_dsh_client_ui_primitives14.Switch,
        {
          checked: form.openSession,
          label: OPEN_SESSION,
          disabled,
          onChange: (openSession) => {
            onChange({ ...form, openSession });
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("span", { "aria-hidden": "true", children: OPEN_SESSION })
    ] })
  ] });
}

// src/client/worktree/worktree-dialog.tsx
var import_jsx_runtime29 = require("react/jsx-runtime");
var TITLE3 = "\u65B0\u5EFA Worktree";
var CLOSE3 = "\u5173\u95ED";
var CANCEL2 = "\u53D6\u6D88";
var CREATE = "\u521B\u5EFA Worktree";
var CREATING = "\u6B63\u5728\u521B\u5EFA\u2026";
var LOADING = "\u6B63\u5728\u8BFB\u53D6\u4ED3\u5E93\u4FE1\u606F\u2026";
var NOT_A_REPO = "\u8FD9\u4E2A\u5DE5\u4F5C\u533A\u4E0D\u5728 Git \u4ED3\u5E93\u91CC\uFF0C\u65E0\u6CD5\u521B\u5EFA worktree\u3002";
var NOT_READY = "\u8FD8\u6CA1\u6709\u8BFB\u5230\u4ED3\u5E93\u4FE1\u606F";
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
function useRepoInfo(api) {
  const [state, setState] = (0, import_react23.useState)({ phase: "loading" });
  (0, import_react23.useEffect)(() => {
    let live = true;
    api.info().then(
      (answer) => {
        if (live) setState(answer.repo ? { phase: "ready", info: answer } : { phase: "failed", message: NOT_A_REPO });
      },
      (error) => {
        if (live) setState({ phase: "failed", message: messageOf(error) });
      }
    );
    return () => {
      live = false;
    };
  }, [api]);
  return state;
}
function useCreate(props) {
  const [busy, setBusy] = (0, import_react23.useState)(false);
  const [error, setError] = (0, import_react23.useState)();
  const create = async (form, info) => {
    setBusy(true);
    setError(void 0);
    try {
      const created = await props.api.create(requestOf(form, info));
      if (!("path" in created)) throw new Error(NOT_A_REPO);
      const title = workspaceTitle(info, created.branch);
      await props.onCreated({ ...created, title, openSession: form.openSession });
      props.onClose();
    } catch (reason) {
      setError(messageOf(reason));
      setBusy(false);
    }
  };
  return { busy, error, create };
}
function Footer(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime29.jsxs)("div", { className: WT.footer, children: [
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_dsh_client_ui_primitives15.Button, { variant: "ghost", disabled: props.busy, onClick: props.onCancel, children: CANCEL2 }),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(
      import_dsh_client_ui_primitives15.Button,
      {
        variant: "primary",
        disabled: props.problem !== void 0 || props.busy,
        title: props.problem,
        onClick: props.onCreate,
        children: props.busy ? CREATING : CREATE
      }
    )
  ] });
}
function StatusLine({ state }) {
  return /* @__PURE__ */ (0, import_jsx_runtime29.jsx)("p", { className: WT.status, role: state.phase === "failed" ? "alert" : "status", children: state.phase === "loading" ? LOADING : state.message });
}
function onEnter(submit) {
  return (event) => {
    if (event.key !== "Enter" || event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (!(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    submit();
  };
}
function WorktreeDialog(props) {
  const state = useRepoInfo(props.api);
  const info = state.phase === "ready" ? state.info : void 0;
  const [edited, setForm] = (0, import_react23.useState)();
  const form = edited ?? (info === void 0 ? void 0 : initialForm(info));
  const { busy, error, create } = useCreate(props);
  const problem = info === void 0 || form === void 0 ? NOT_READY : formProblem(form, info);
  const submit = () => {
    if (info !== void 0 && form !== void 0 && problem === void 0 && !busy) void create(form, info);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(
    import_dsh_client_ui_primitives15.Modal,
    {
      open: true,
      title: TITLE3,
      ...info === void 0 ? {} : { description: `\u57FA\u4E8E\u4ED3\u5E93 ${info.name}` },
      closeLabel: CLOSE3,
      className: WT.dialog,
      onClose: busy ? () => void 0 : props.onClose,
      footer: /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(Footer, { busy, problem, onCancel: props.onClose, onCreate: submit }),
      children: state.phase !== "ready" || form === void 0 ? state.phase !== "ready" && /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(StatusLine, { state }) : /* @__PURE__ */ (0, import_jsx_runtime29.jsxs)("div", { onKeyDown: onEnter(submit), children: [
        /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(WorktreeFields, { form, info: state.info, disabled: busy, onChange: setForm }),
        error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime29.jsx)("p", { role: "alert", className: WT.error, children: error })
      ] })
    }
  );
}

// src/client/worktree/worktree-icons.tsx
var import_jsx_runtime30 = require("react/jsx-runtime");
var STROKE = { stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round" };
function NewWorktreeIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("circle", { cx: "4.5", cy: "3.5", r: "1.5", ...STROKE }),
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("circle", { cx: "4.5", cy: "12.5", r: "1.5", ...STROKE }),
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("circle", { cx: "11.5", cy: "5", r: "1.5", ...STROKE }),
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("path", { d: "M4.5 5v6M11.5 6.5c0 2.5-3 2.5-6.2 4.6", ...STROKE }),
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("path", { d: "M12.5 10.5v4M10.5 12.5h4", ...STROKE })
  ] });
}
function BranchIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("circle", { cx: "5", cy: "3.5", r: "1.5", ...STROKE }),
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("circle", { cx: "5", cy: "12.5", r: "1.5", ...STROKE }),
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("circle", { cx: "11.5", cy: "5", r: "1.5", ...STROKE }),
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("path", { d: "M5 5v6M11.5 6.5c0 2.5-3 2.5-5.8 4.6", ...STROKE })
  ] });
}
function ChevronIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("path", { d: "M6.5 4.5 10 8l-3.5 3.5", ...STROKE }) });
}
function NewSessionIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("path", { d: "M8 2.5a5.5 5.5 0 1 0 2.6 10.35L13.5 13.5l-.65-2.9A5.5 5.5 0 0 0 8 2.5Z", ...STROKE }),
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("path", { d: "M8 5.75v4.5M5.75 8h4.5", ...STROKE })
  ] });
}

// src/client/worktree/worktree-checkouts.ts
function createCheckouts(fetchFn) {
  let known = /* @__PURE__ */ new Map();
  let asking = /* @__PURE__ */ new Set();
  let listeners = [];
  const settle = (path, checkout) => {
    asking = new Set([...asking].filter((candidate) => candidate !== path));
    known = new Map(known).set(path, checkout);
    for (const listener of listeners) listener();
  };
  const ask = (path) => {
    asking = new Set(asking).add(path);
    gitPost(
      fetchFn,
      path
    )("worktree-of").then(
      (answer) => {
        settle(path, answer.repo ? { top: answer.top, main: answer.main, branch: answer.branch } : null);
      },
      (_error) => {
        settle(path, null);
      }
    );
  };
  return {
    getSnapshot: () => known,
    subscribe(listener) {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((candidate) => candidate !== listener);
      };
    },
    track: (paths) => {
      for (const path of paths) if (!known.has(path) && !asking.has(path)) ask(path);
    },
    refresh: () => {
      for (const path of known.keys()) if (!asking.has(path)) ask(path);
    }
  };
}

// src/client/worktree/worktree-expansion.ts
var EXPANSION_STORAGE_KEY = "vyra-agent-cli-manager.worktree-expansion";
var NO_CHOICES = { groups: {}, worktrees: {} };
function choicesOf(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry) => typeof entry[1] === "boolean")
  );
}
function parseExpansion(raw) {
  if (raw === null) return NO_CHOICES;
  try {
    const value = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return NO_CHOICES;
    return { groups: choicesOf(Reflect.get(value, "groups")), worktrees: choicesOf(Reflect.get(value, "worktrees")) };
  } catch (_error) {
    return NO_CHOICES;
  }
}
function read(storage) {
  try {
    return parseExpansion(storage.getItem(EXPANSION_STORAGE_KEY));
  } catch (_error) {
    return NO_CHOICES;
  }
}
function isOpen(expansion, kind, id, fallback) {
  return expansion[kind][id] ?? fallback;
}
function createExpansion(storage) {
  let state = read(storage);
  let listeners = [];
  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((candidate) => candidate !== listener);
      };
    },
    set: (kind, id, open) => {
      if (state[kind][id] === open) return;
      state = { ...state, [kind]: { ...state[kind], [id]: open } };
      try {
        storage.setItem(EXPANSION_STORAGE_KEY, JSON.stringify(state));
      } catch (_error) {
      }
      for (const listener of listeners) listener();
    }
  };
}

// src/client/worktree/worktree-tree.tsx
var import_react25 = require("react");
var import_react_dom3 = require("react-dom");

// src/client/worktree/worktree-anchors.ts
var import_react24 = require("react");
var ANCHOR_ATTRIBUTE = "data-vyra-agent-cli-manager-worktrees";
var HIDE_STYLE_ATTRIBUTE = "data-vyra-agent-cli-manager-worktree-hide";
var quoted = (id) => id.replace(/["\\]/g, "\\$&");
var rowSelector = (id) => `[data-row-key="workspace:${quoted(id)}"]`;
function sectionOf(doc, id) {
  return doc.querySelector(`[role="tree"] ${rowSelector(id)}`)?.parentElement?.parentElement ?? void 0;
}
function containerFor(doc, id, existing) {
  if (existing !== void 0) return existing;
  const container = doc.createElement("div");
  container.setAttribute(ANCHOR_ATTRIBUTE, id);
  return container;
}
function sameAnchors(a, b) {
  return a.size === b.size && [...a].every(([id, element]) => b.get(id) === element);
}
function placeAnchors(doc, current, ids) {
  const placed = ids.flatMap((id) => {
    const section = sectionOf(doc, id);
    if (section === void 0) return [];
    const container = containerFor(doc, id, current.get(id));
    if (section.lastElementChild !== container) section.append(container);
    return [[id, container]];
  });
  const next = new Map(placed);
  for (const [id, container] of current) if (next.get(id) !== container) container.remove();
  return next;
}
function useGroupAnchors(doc, ids) {
  const [anchors, setAnchors] = (0, import_react24.useState)(/* @__PURE__ */ new Map());
  const key = ids.join("\n");
  (0, import_react24.useEffect)(() => {
    const wanted = key === "" ? [] : key.split("\n");
    let current = /* @__PURE__ */ new Map();
    let frame;
    const sync = () => {
      frame = void 0;
      const next = placeAnchors(doc, current, wanted);
      if (sameAnchors(current, next)) return;
      current = next;
      setAnchors(next);
    };
    const observer = new MutationObserver(() => {
      frame ??= requestAnimationFrame(sync);
    });
    observer.observe(doc.body, { childList: true, subtree: true });
    sync();
    return () => {
      observer.disconnect();
      if (frame !== void 0) cancelAnimationFrame(frame);
      for (const container of current.values()) container.remove();
      setAnchors(/* @__PURE__ */ new Map());
    };
  }, [doc, key]);
  return anchors;
}
function hiddenGroupRules(ids) {
  return [...ids].map((id) => `[role="tree"] :has(> * > ${rowSelector(id)}) { display: none !important; }`).join("\n");
}
function useHiddenGroups(doc, ids) {
  const rules = hiddenGroupRules(ids);
  (0, import_react24.useEffect)(() => {
    const tag = doc.createElement("style");
    tag.setAttribute(HIDE_STYLE_ATTRIBUTE, "");
    tag.textContent = rules;
    doc.head.append(tag);
    return () => {
      tag.remove();
    };
  }, [doc, rules]);
}

// src/client/worktree/worktree-group.tsx
var import_dsh_client_ui_primitives16 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/worktree/worktree-layout.ts
var UNTITLED = "\u65B0\u4F1A\u8BDD";
var MINUTE_MS = 6e4;
var HOUR_MS = 60 * MINUTE_MS;
var DAY_MS = 24 * HOUR_MS;
var pathKey = (path) => path.replace(/\\/g, "/").replace(/\/+$/, "");
function layoutWorktrees(items, checkouts) {
  const byPath = new Map(items.map((item) => [pathKey(item.path), item.workspaceId]));
  const pairs = items.flatMap((item) => {
    const checkout = checkouts.get(item.path);
    if (checkout === void 0 || checkout === null || pathKey(checkout.top) === pathKey(checkout.main)) return [];
    const parent = byPath.get(pathKey(checkout.main));
    return parent === void 0 || parent === item.workspaceId ? [] : [{ parent, entry: { ...item, branch: checkout.branch } }];
  });
  const byParent = pairs.reduce(
    (groups, { parent, entry }) => new Map(groups).set(parent, [...groups.get(parent) ?? [], entry]),
    /* @__PURE__ */ new Map()
  );
  return { byParent, childIds: new Set(pairs.map(({ entry }) => entry.workspaceId)) };
}
function currentSessionId(byId) {
  return Object.entries(byId).find(([, session]) => (session?.retainedBy?.mainView ?? 0) > 0)?.[0];
}
function timeOf(value) {
  if (value === void 0) return void 0;
  return typeof value === "number" ? value : Date.parse(value);
}
function sessionRows(entry, byId, archived) {
  const current = currentSessionId(byId);
  return entry.sessionIds.flatMap((id) => {
    const session = byId[id];
    if (session === void 0 || archived.has(id)) return [];
    if (session.blank === true && id !== current) return [];
    const title = session.blank === true ? "" : session.title?.trim() ?? "";
    return [
      {
        id,
        title: title === "" ? UNTITLED : title,
        updatedAt: timeOf(session.updatedAt),
        running: session.running === true,
        current: id === current
      }
    ];
  });
}
function relativeTime(at, now) {
  if (at === void 0 || Number.isNaN(at)) return "";
  const elapsed = Math.max(0, now - at);
  if (elapsed < MINUTE_MS) return "\u521A\u521A";
  if (elapsed < HOUR_MS) return `${String(Math.floor(elapsed / MINUTE_MS))}\u5206\u949F`;
  if (elapsed < DAY_MS) return `${String(Math.floor(elapsed / HOUR_MS))}\u5C0F\u65F6`;
  return `${String(Math.floor(elapsed / DAY_MS))}\u5929`;
}

// src/client/worktree/worktree-group-styles.ts
var WG = {
  group: "dsh-wtg",
  header: "dsh-wtg-header",
  toggle: "dsh-wtg-toggle",
  chevron: "dsh-wtg-chevron",
  glyph: "dsh-wtg-glyph",
  iconButton: "dsh-wtg-icon-button",
  worktree: "dsh-wtg-worktree",
  session: "dsh-wtg-session",
  label: "dsh-wtg-label",
  time: "dsh-wtg-time",
  empty: "dsh-wtg-empty"
};
var INDENT2 = "var(--dsh-workspace-indent, 0px)";
var HEADER_SHIFT = "28px";
var WORKTREE_SHIFT = "40px";
var SESSION_SHIFT = "64px";
var ROW_HEIGHT = "32px";
var HOVER = "var(--dsw-alias-interactive-bg-hover)";
var WORKTREE_GROUP_STYLES = `
[role="tree"] :has(> * > [data-row-key^="workspace:"][aria-expanded="false"]) > [${ANCHOR_ATTRIBUTE}] { display: none; }
.${WG.group} { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }
.${WG.header}, .${WG.worktree}, .${WG.session} {
  display: flex; align-items: center; box-sizing: border-box; height: ${ROW_HEIGHT};
  border-radius: var(--dsw-radius-md); cursor: pointer; user-select: none;
}
.${WG.header} { margin-inline-start: calc(${HEADER_SHIFT} + ${INDENT2}); padding: 0 6px 0 2px; }
.${WG.worktree} {
  gap: var(--dsh-sidebar-label-gap, 6px); margin-inline-start: calc(${WORKTREE_SHIFT} + ${INDENT2}); padding: 0 6px 0 2px;
  font-size: 14px; line-height: 20px; color: var(--dsw-alias-label-primary);
}
.${WG.session} {
  gap: 6px; margin-inline-start: calc(${SESSION_SHIFT} + ${INDENT2}); padding: 0 8px;
  font-size: 14px; line-height: 20px; color: var(--dsw-alias-label-primary);
}
.${WG.header}:hover, .${WG.worktree}:hover, .${WG.session}:hover, .${WG.session}[aria-selected="true"] { background: ${HOVER}; }
.${WG.worktree}:focus-visible, .${WG.session}:focus-visible, .${WG.toggle}:focus-visible, .${WG.iconButton}:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, currentColor); outline-offset: -2px;
}
.${WG.toggle} {
  display: flex; flex: 1; align-items: center; gap: 4px; min-width: 0; height: 100%; padding: 0;
  border: none; background: transparent; color: var(--dsw-alias-label-tertiary);
  font-size: 13px; line-height: 20px; text-align: left; cursor: pointer;
}
.${WG.chevron}, .${WG.glyph} {
  display: inline-flex; flex: none; color: var(--dsw-alias-label-caption);
  transition: transform 0.15s var(--ds-ease-in-out, ease);
}
[aria-expanded="true"] > .${WG.chevron} { transform: rotate(90deg); }
.${WG.glyph} { color: var(--dsw-alias-label-tertiary); }
.${WG.label} { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.${WG.time} { flex: none; font-size: 10px; line-height: 16px; color: var(--dsw-alias-label-tertiary); }
.${WG.iconButton} {
  display: inline-flex; flex: none; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0;
  border: none; border-radius: var(--dsw-radius-xs); background: transparent;
  color: var(--dsw-alias-label-tertiary); cursor: pointer; opacity: 0;
}
.${WG.header}:hover .${WG.iconButton}, .${WG.worktree}:hover .${WG.iconButton},
.${WG.header}:focus-within .${WG.iconButton}, .${WG.worktree}:focus-within .${WG.iconButton} { opacity: 1; }
.${WG.iconButton}:hover { color: var(--dsw-alias-label-primary); }
@media (hover: none) { .${WG.iconButton} { opacity: 1; } }
.${WG.empty} {
  display: flex; align-items: center; height: 28px; margin-inline-start: calc(${SESSION_SHIFT} + ${INDENT2});
  font-size: 12px; color: var(--dsw-alias-label-tertiary);
}
@media (prefers-reduced-motion: reduce) { .${WG.chevron} { transition: none; } }
`;

// src/client/worktree/worktree-group.tsx
var import_jsx_runtime31 = require("react/jsx-runtime");
var GROUP_LABEL = "Worktrees";
var NEW_WORKTREE = "\u65B0\u5EFA Worktree";
var NO_SESSIONS = "\u6682\u65E0\u4F1A\u8BDD";
function pointOf(event) {
  event.preventDefault();
  event.stopPropagation();
  return { x: event.clientX, y: event.clientY };
}
function onActivate(run) {
  return (event) => {
    if (event.target !== event.currentTarget || event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    run();
  };
}
function SessionItem({ row, actions, now }) {
  return /* @__PURE__ */ (0, import_jsx_runtime31.jsxs)(
    "div",
    {
      role: "treeitem",
      "aria-selected": row.current,
      "aria-label": row.title,
      tabIndex: 0,
      className: WG.session,
      title: row.title,
      onClick: () => {
        actions.openSession(row.id);
      },
      onKeyDown: onActivate(() => {
        actions.openSession(row.id);
      }),
      onContextMenu: (event) => {
        actions.sessionMenu(row, pointOf(event));
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime31.jsx)("span", { className: WG.label, children: row.title }),
        row.running ? /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(import_dsh_client_ui_primitives16.StateDot, { state: "ongoing" }) : /* @__PURE__ */ (0, import_jsx_runtime31.jsx)("span", { className: WG.time, children: relativeTime(row.updatedAt, now) })
      ]
    }
  );
}
function WorktreeRow(props) {
  const { entry, open, actions } = props;
  const toggle = () => {
    actions.setOpen("worktrees", entry.workspaceId, !open);
  };
  const newSession = `\u5728\u201C${entry.branch}\u201D\u4E2D\u65B0\u5EFA\u4F1A\u8BDD`;
  return /* @__PURE__ */ (0, import_jsx_runtime31.jsxs)(
    "div",
    {
      role: "treeitem",
      "aria-expanded": open,
      "aria-label": entry.branch,
      tabIndex: 0,
      className: WG.worktree,
      title: entry.path,
      onClick: toggle,
      onKeyDown: onActivate(toggle),
      onContextMenu: (event) => {
        actions.worktreeMenu(entry, pointOf(event));
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime31.jsx)("span", { className: WG.chevron, children: /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(ChevronIcon, {}) }),
        /* @__PURE__ */ (0, import_jsx_runtime31.jsx)("span", { className: WG.glyph, children: /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(BranchIcon, {}) }),
        /* @__PURE__ */ (0, import_jsx_runtime31.jsx)("span", { className: WG.label, children: entry.branch }),
        /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(
          "button",
          {
            type: "button",
            className: WG.iconButton,
            "aria-label": newSession,
            title: newSession,
            onClick: (event) => {
              event.stopPropagation();
              actions.newSession(entry.workspaceId);
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(NewSessionIcon, {})
          }
        )
      ]
    }
  );
}
function WorktreeItem(props) {
  const { entry, actions, now } = props;
  const rows = sessionRows(entry, props.sessions, props.archived);
  const open = isOpen(
    props.expansion,
    "worktrees",
    entry.workspaceId,
    rows.some((row) => row.current)
  );
  return /* @__PURE__ */ (0, import_jsx_runtime31.jsxs)(import_jsx_runtime31.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(WorktreeRow, { entry, open, actions }),
    open ? /* @__PURE__ */ (0, import_jsx_runtime31.jsxs)("div", { role: "group", children: [
      rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime31.jsx)("div", { className: WG.empty, children: NO_SESSIONS }) : null,
      rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(SessionItem, { row, actions, now }, row.id))
    ] }) : null
  ] });
}
function WorktreeGroup(props) {
  const { parent, entries, actions } = props;
  const holdsCurrent = entries.some(
    (entry) => sessionRows(entry, props.sessions, props.archived).some((row) => row.current)
  );
  const open = isOpen(props.expansion, "groups", parent.workspaceId, holdsCurrent);
  return /* @__PURE__ */ (0, import_jsx_runtime31.jsxs)("div", { className: WG.group, children: [
    /* @__PURE__ */ (0, import_jsx_runtime31.jsxs)("div", { className: WG.header, children: [
      /* @__PURE__ */ (0, import_jsx_runtime31.jsxs)(
        "button",
        {
          type: "button",
          className: WG.toggle,
          "aria-expanded": open,
          onClick: () => {
            actions.setOpen("groups", parent.workspaceId, !open);
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime31.jsx)("span", { className: WG.chevron, children: /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(ChevronIcon, {}) }),
            `${GROUP_LABEL} \xB7 ${String(entries.length)}`
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(
        "button",
        {
          type: "button",
          className: WG.iconButton,
          "aria-label": NEW_WORKTREE,
          title: NEW_WORKTREE,
          onClick: () => {
            actions.newWorktree(parent);
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(NewWorktreeIcon, {})
        }
      )
    ] }),
    open ? /* @__PURE__ */ (0, import_jsx_runtime31.jsx)("div", { role: "group", "aria-label": GROUP_LABEL, children: entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(WorktreeItem, { ...props, entry }, entry.workspaceId)) }) : null
  ] });
}

// src/client/worktree/worktree-tree.tsx
var import_jsx_runtime32 = require("react/jsx-runtime");
var NO_ITEMS = [];
var CLOCK_MS = 6e4;
function useNow() {
  const [now, setNow] = (0, import_react25.useState)(() => Date.now());
  (0, import_react25.useEffect)(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, CLOCK_MS);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return now;
}
function WorktreeTree(props) {
  const { doc, checkouts, expansion } = props;
  const workspaces = useStore(props.workspaces);
  const sessions = useStore(props.sessions);
  const known = useStore(checkouts);
  const choices2 = useStore(expansion);
  const now = useNow();
  const items = workspaces.items ?? NO_ITEMS;
  (0, import_react25.useEffect)(() => {
    checkouts.track(items.map((item) => item.path));
  }, [checkouts, items]);
  const layout = (0, import_react25.useMemo)(() => layoutWorktrees(items, known), [items, known]);
  const archived = (0, import_react25.useMemo)(() => new Set(workspaces.archivedSessionIds), [workspaces.archivedSessionIds]);
  useHiddenGroups(doc, layout.childIds);
  const anchors = useGroupAnchors(doc, [...layout.byParent.keys()]);
  const actions = {
    ...props.actions,
    setOpen: (kind, id, open) => {
      if (kind === "groups" && open) checkouts.refresh();
      expansion.set(kind, id, open);
    }
  };
  const groups = [...layout.byParent].flatMap(([parentId, entries]) => {
    const anchor = anchors.get(parentId);
    const parent = items.find((item) => item.workspaceId === parentId);
    if (anchor === void 0 || parent === void 0) return [];
    const group = /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(
      WorktreeGroup,
      {
        parent,
        entries,
        sessions: sessions.byId,
        archived,
        expansion: choices2,
        actions,
        now
      }
    );
    return [/* @__PURE__ */ (0, import_jsx_runtime32.jsx)(import_react25.Fragment, { children: (0, import_react_dom3.createPortal)(group, anchor) }, parentId)];
  });
  return /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(import_jsx_runtime32.Fragment, { children: groups });
}

// src/client/worktree/worktree-register.tsx
var import_jsx_runtime33 = require("react/jsx-runtime");
var DEPENDENCIES = ["contextMenus", "workspaces", "sessions", "uiWorkspace", "slots"];
var MENU_ID = "vyra-agent-cli-manager.worktree";
var ICON_KEY2 = "vyra-agent-cli-manager.worktree";
var ICON_SLOT2 = "contextMenu.icon";
var HOST_SLOT = "sidebar.footer.action";
var HOST_ID = "vyra-agent-cli-manager.worktree-dialog";
var TREE_ID = "vyra-agent-cli-manager.worktree-tree";
var MENU_ORDER2 = 10;
var LABEL2 = "\u65B0\u5EFA Worktree\u2026";
var CREATED = "\u5DF2\u521B\u5EFA Worktree\uFF1A";
function dialogRequests() {
  let target;
  let listeners = [];
  const set = (next) => {
    target = next;
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => target,
    subscribe(listener) {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((candidate) => candidate !== listener);
      };
    },
    open: (next) => {
      set({ ...next });
    },
    close: () => {
      set(void 0);
    }
  };
}
function messageOf2(error) {
  return error instanceof Error ? error.message : String(error);
}
function finisher(services) {
  return async (created) => {
    let workspaceId;
    try {
      workspaceId = (await services.workspaces.create({ path: created.path })).workspaceId;
    } catch (error) {
      throw new Error(`Worktree \u5DF2\u521B\u5EFA\u5728 ${created.path}\uFF0C\u4F46\u6CA1\u80FD\u52A0\u5165\u4FA7\u8FB9\u680F\uFF1A${messageOf2(error)}`, { cause: error });
    }
    try {
      await services.workspaces.rename(workspaceId, created.title);
    } catch (_error) {
    }
    if (created.openSession) services.uiWorkspace.startSession(workspaceId);
    services.contextMenus.notify?.(`${CREATED}${created.branch}`, true);
  };
}
function WorktreeHost({ requests, fetchFn, finish }) {
  const target = useStore(requests);
  const api = (0, import_react26.useMemo)(
    () => target === void 0 ? void 0 : createWorktreeApi(fetchFn, target.path),
    [fetchFn, target]
  );
  if (target === void 0 || api === void 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime33.jsx)(WorktreeDialog, { api, onCreated: finish, onClose: requests.close }, target.workspaceId);
}
function treeProps(services, requests, fetchFn, storage) {
  const props = {
    doc: document,
    workspaces: services.workspaces.list,
    sessions: services.sessions.list,
    checkouts: createCheckouts(fetchFn),
    expansion: createExpansion(storage),
    actions: {
      newWorktree: (parent) => {
        requests.open({ workspaceId: parent.workspaceId, path: parent.path, displayTitle: parent.title });
      },
      newSession: (workspaceId) => {
        services.uiWorkspace.startSession(workspaceId);
      },
      openSession: (sessionId) => {
        services.uiWorkspace.openSession(sessionId);
      },
      worktreeMenu: (entry, point) => {
        const value = { workspaceId: entry.workspaceId, path: entry.path, displayTitle: entry.title };
        services.contextMenus.open({ kind: "workspace", value }, point);
      },
      sessionMenu: (row, point) => {
        services.contextMenus.open({ kind: "session", value: { sessionId: row.id, displayTitle: row.title } }, point);
      }
    }
  };
  return props;
}
function registerWorktree(ctx, fetchFn, storage) {
  ctx.inject(DEPENDENCIES, (child) => {
    const requests = dialogRequests();
    const finish = finisher(child);
    const tree = treeProps(child, requests, fetchFn, storage);
    child.slots.inject(
      HOST_SLOT,
      () => child.slots.register(
        { name: HOST_SLOT, id: HOST_ID, inject: () => ({ requests, fetchFn, finish }) },
        WorktreeHost
      )
    );
    child.slots.inject(
      HOST_SLOT,
      () => child.slots.register({ name: HOST_SLOT, id: TREE_ID, inject: () => tree }, WorktreeTree)
    );
    child.slots.inject(ICON_SLOT2, () => child.slots.register({ name: ICON_SLOT2, key: ICON_KEY2 }, NewWorktreeIcon));
    child.effect(
      () => child.contextMenus.register({
        id: MENU_ID,
        target: "workspace",
        order: MENU_ORDER2,
        resolve: (target) => [
          {
            id: "new-worktree",
            label: LABEL2,
            icon: { key: ICON_KEY2 },
            run: () => {
              requests.open(target);
            }
          }
        ]
      }),
      "vyra-agent-cli-manager: new worktree menu"
    );
    child.effect(() => requests.close, "vyra-agent-cli-manager: close worktree dialog");
  });
}

// src/client/index.tsx
var import_jsx_runtime34 = require("react/jsx-runtime");
var SLOT3 = "conversation.input.left";
var MODEL_SLOT = "conversation.input.right";
var MODE_SLOT = "conversation.input.left";
var MODE_SEAT_ORDER = 1;
var SESSION_ROW_SLOT = "sidebar.session.row.leading";
var MODEL_MENU_ORDER = 1e3;
var SESSION_MARK_ORDER = 20;
var WRAP_CLASS = "dsh-cli-switcher-wrap";
var BUTTON_CLASS = "dsh-cli-switcher";
var SESSION_MARK_CLASS = "dsh-cli-session-mark";
var NOT_STARTED = { blank: true };
var NO_CHOICE_LABEL = "\u9009\u62E9 CLI";
var SWITCH_FAILED_LABEL = "\u5207\u6362\u5931\u8D25";
var STYLES = `
.${WRAP_CLASS} { order: -1; }
:has(> * > .${WRAP_CLASS}) > :first-child { order: -2; }
.${BUTTON_CLASS} {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 4px 0 8px;
  border: none;
  border-radius: var(--dsw-radius-sm);
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
}
.${BUTTON_CLASS}:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.${BUTTON_CLASS}:focus-visible { box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, currentColor); }
.${BUTTON_CLASS}:disabled { cursor: default; }
.${SESSION_MARK_CLASS} { display: inline-flex; color: var(--dsw-alias-label-secondary); }
[data-slot="${SESSION_ROW_SLOT}"] > * ~ .${SESSION_MARK_CLASS} { display: none; }
`;
var BROWSER_STORAGE = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => {
    window.localStorage.setItem(key, value);
  }
};
function installStyles() {
  const tag = document.createElement("style");
  tag.dataset.plugin = "vyra-agent-cli-manager";
  tag.textContent = `${STYLES}${MODEL_MENU_STYLES}${TERMINAL_ENTRY_STYLES}${LAUNCH_SCRIPT_STYLES}${SESSION_TREE_STYLES}${SESSION_STATUS_STYLES}${SETTINGS_PAGE_STYLES}${WORKTREE_STYLES}${WORKTREE_GROUP_STYLES}`;
  document.head.append(tag);
  return () => {
    tag.remove();
  };
}
function useStarted2(session) {
  const snapshot = (0, import_react27.useSyncExternalStore)(
    (listener) => session?.subscribe(listener) ?? (() => {
    }),
    () => session?.getSnapshot() ?? NOT_STARTED
  );
  return snapshot.blank === false;
}
function useChoose(state, select) {
  const [error, setError] = (0, import_react27.useState)();
  const choose = (id) => {
    setError(void 0);
    const selection = selectionForChoice(state, id);
    if (selection === void 0) return;
    void select(selection).then(
      (result) => {
        setError(result.error?.message);
      },
      (reason) => {
        setError(String(reason));
      }
    );
  };
  return { error, choose };
}
function CliSwitcher({ directory, load, select, session, prefs }) {
  const state = useStore(directory);
  const started = useStarted2(session);
  const prefsSnapshot = useStore(prefs);
  const [open, setOpen] = (0, import_react27.useState)(false);
  const { error, choose } = useChoose(state, select);
  (0, import_react27.useEffect)(load, [load]);
  const { visible, items: listed, currentId, currentLabel } = cliChoices(state);
  (0, import_react27.useEffect)(() => {
    prefs.remember(listed);
  }, [prefs, listed]);
  if (!visible) return null;
  const items = arrangeChoices(listed, prefsSnapshot);
  const hint = started ? "\u8981\u6362 CLI\uFF0C\u8BF7\u65B0\u5EFA\u4F1A\u8BDD" : error ?? "\u5207\u6362 CLI";
  const label = error === void 0 ? currentLabel ?? NO_CHOICE_LABEL : SWITCH_FAILED_LABEL;
  return /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(
    import_dsh_client_ui_primitives17.Menu,
    {
      open: open && !started,
      className: WRAP_CLASS,
      items: items.map((item) => ({ ...item, icon: /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(ProviderMark, { provider: item.id, size: 14 }) })),
      selectedId: currentId,
      onSelect: (id) => {
        setOpen(false);
        choose(id);
      },
      onClose: () => {
        setOpen(false);
      },
      side: "top",
      portal: true,
      anchor: /* @__PURE__ */ (0, import_jsx_runtime34.jsxs)(
        "button",
        {
          type: "button",
          className: BUTTON_CLASS,
          "aria-label": "\u5207\u6362 CLI",
          title: hint,
          disabled: started,
          onClick: () => {
            setOpen((value) => !value);
          },
          children: [
            currentId === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(ProviderMark, { provider: currentId, size: 14 }),
            label,
            started ? null : /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(import_dsh_client_ui_primitives17.IconChevronDownOutlineRegular, { size: 14 })
          ]
        }
      )
    }
  );
}
function SessionMark({ sessionId, list }) {
  const provider = useSessionProvider(list, sessionId);
  if (provider === void 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime34.jsx)("span", { className: SESSION_MARK_CLASS, children: /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(ProviderMark, { provider, size: 14 }) });
}
function directoryFace(ctx, sessionId) {
  const directory = ctx.modelDirectories.directoryFor(sessionId);
  return {
    directory: directory.store,
    load: () => {
      directory.load().catch(() => {
      });
    },
    select: (selection) => directory.select(selection),
    session: ctx.sessions.binding(sessionId)?.session
  };
}
function registerSwitchableFeatures(ctx, settings) {
  const terminal = {
    slots: ctx.slots,
    inject: gateInject(ctx, settings, "terminalEntry", (deps, apply2) => ctx.inject(deps, apply2))
  };
  const files = {
    inject: gateInject(ctx, settings, "filesDefault", (deps, apply2) => ctx.inject(deps, apply2))
  };
  const scripts = {
    slots: ctx.slots,
    inject: gateInject(ctx, settings, "launchScripts", (deps, apply2) => ctx.inject(deps, apply2))
  };
  registerTerminalEntry(terminal);
  const worktree = {
    inject: gateInject(ctx, settings, "worktree", (deps, apply2) => ctx.inject(deps, apply2))
  };
  registerFilesDefault(files);
  const fetchFn = (input, init) => window.fetch(input, init);
  registerWorktree(worktree, fetchFn, BROWSER_STORAGE);
  registerLaunchScripts(scripts, ctx.sessions.list, BROWSER_STORAGE, () => crypto.randomUUID());
  ctx.effect(
    () => whileEnabled(settings, "compactTabs", () => installCompactTabs(document)),
    "vyra-agent-cli-manager: compact tabs"
  );
}
var inject = ["slots", "modelDirectories", "sessions"];
function registerComposerSlots(ctx, cliPrefs) {
  ctx.slots.inject(
    SLOT3,
    () => ctx.slots.register(
      {
        name: SLOT3,
        id: "vyra-agent-cli-manager.switcher",
        inject: (sessionId) => ({ ...directoryFace(ctx, sessionId), prefs: cliPrefs })
      },
      CliSwitcher
    )
  );
  ctx.slots.inject(
    MODEL_SLOT,
    () => ctx.slots.register(
      {
        name: MODEL_SLOT,
        id: "vyra-agent-cli-manager.model-menu",
        order: MODEL_MENU_ORDER,
        inject: (sessionId) => ({
          ...directoryFace(ctx, sessionId),
          available: ctx.sessions.subagentAddress(sessionId) === void 0
        })
      },
      CliModelMenu
    )
  );
  ctx.slots.inject(
    SESSION_ROW_SLOT,
    () => ctx.slots.register(
      {
        name: SESSION_ROW_SLOT,
        id: "vyra-agent-cli-manager.session-mark",
        order: SESSION_MARK_ORDER,
        inject: () => ({ list: ctx.sessions.list })
      },
      SessionMark
    )
  );
}
function registerModeSeat(ctx) {
  ctx.slots.inject(
    MODE_SLOT,
    () => ctx.slots.register(
      {
        name: MODE_SLOT,
        id: "vyra-agent-cli-manager.mode-seat",
        order: MODE_SEAT_ORDER,
        inject: (sessionId) => ({
          ...directoryFace(ctx, sessionId),
          // `window.fetch` needs its receiver, so it is wrapped rather than passed bare.
          modes: modeApiFor((input, init) => window.fetch(input, init), sessionId)
        })
      },
      CliModeSeat
    )
  );
}
function registerSessionMarks(ctx) {
  ctx.slots.inject(
    SESSION_STATUS_SLOT,
    () => ctx.slots.register(
      {
        name: SESSION_STATUS_SLOT,
        id: "vyra-agent-cli-manager.session-status-mark",
        inject: () => ({ list: ctx.sessions.list })
      },
      SessionStatusMark
    )
  );
}
function apply(ctx) {
  ctx.effect(installStyles, "vyra-agent-cli-manager: styles");
  const cliPrefs = createCliPrefs(BROWSER_STORAGE);
  registerComposerSlots(ctx, cliPrefs);
  registerModeSeat(ctx);
  registerSessionMarks(ctx);
  const settings = createFeatureSettings(BROWSER_STORAGE);
  registerSettingsPage(ctx, settings, cliPrefs);
  registerSwitchableFeatures(ctx, settings);
  registerAddToChat(ctx);
}
return module.exports; } });

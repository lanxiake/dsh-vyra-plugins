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
var import_react29 = require("react");
var import_dsh_client_ui_primitives20 = require("@deepseek-ai/dsh-client-ui-primitives");

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

// src/client/changes/changes-panel.tsx
var import_react13 = require("react");
var import_dsh_client_ui_primitives8 = require("@deepseek-ai/dsh-client-ui-primitives");

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

// src/client/changes/changes-api.ts
function createGitApi(fetchFn, cwd) {
  const post2 = gitPost(fetchFn, cwd);
  return {
    status: () => post2("status"),
    branches: () => post2("branches"),
    diff: (target) => post2("diff", target),
    stage: (paths) => post2("stage", { paths }),
    unstage: (paths) => post2("unstage", { paths }),
    discard: (target) => post2("discard", target),
    commit: (change) => post2("commit", change),
    push: () => post2("push"),
    pull: () => post2("pull"),
    checkout: (branch) => post2("checkout", branch),
    createBranch: (branch) => post2("create-branch", { branch })
  };
}

// src/client/changes/changes-diff.tsx
var import_react9 = require("react");

// src/client/changes/changes-icons.tsx
var import_jsx_runtime10 = require("react/jsx-runtime");
var DEFAULT_SIZE = 16;
function Stroke({
  size = DEFAULT_SIZE,
  className,
  children
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className,
      "aria-hidden": "true",
      children
    }
  );
}
function BranchIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(Stroke, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("circle", { cx: "6", cy: "5", r: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("circle", { cx: "6", cy: "19", r: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("circle", { cx: "18", cy: "7", r: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M6 7v10M18 9c0 5-6 4-11.4 8.6" })
  ] });
}
function RefreshIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(Stroke, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M20 11a8 8 0 0 0-14.3-4.9L4 8" }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M4 4v4h4" }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M4 13a8 8 0 0 0 14.3 4.9L20 16" }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M20 20v-4h-4" })
  ] });
}
function Cloud({ arrow, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(Stroke, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1 0 8.5" }),
    arrow
  ] });
}
function PullIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Cloud, { ...props, arrow: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M12 12v9M9 18l3 3 3-3" }) });
}
function PushIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Cloud, { ...props, arrow: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M12 21v-9M9 15l3-3 3 3" }) });
}
function ChevronIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Stroke, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M6 9l6 6 6-6" }) });
}
function UndoIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(Stroke, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M9 14L4 9l5-5" }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M4 9h10.5a5.5 5.5 0 0 1 0 11H11" })
  ] });
}
function PlusIcon2(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Stroke, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M12 5v14M5 12h14" }) });
}
function MinusIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Stroke, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M5 12h14" }) });
}
function BackIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Stroke, { ...props, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M19 12H5M11 18l-6-6 6-6" }) });
}
function ChangesIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(Stroke, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M12 8v6M9 11h6M9 17h6" })
  ] });
}
function SparkleIcon(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(Stroke, { ...props, children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M10 4l1.6 4.4L16 10l-4.4 1.6L10 16l-1.6-4.4L4 10l4.4-1.6z" }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("path", { d: "M17.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" })
  ] });
}

// src/client/changes/diff-rows.ts
var MAX_DIFF_ROWS = 2e3;
var HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
function rowOf(line, cursor) {
  const hunk = HUNK.exec(line);
  if (hunk !== null) {
    return {
      row: { kind: "hunk", text: line },
      next: { oldLine: Number(hunk[1]), newLine: Number(hunk[2]), inHunk: true }
    };
  }
  if (!cursor.inHunk) {
    const row = line.startsWith("Binary files") ? { kind: "note", text: "\u4E8C\u8FDB\u5236\u6587\u4EF6\uFF0C\u65E0\u6CD5\u663E\u793A\u5DEE\u5F02" } : void 0;
    return { row, next: cursor };
  }
  const text = line.slice(1);
  if (line.startsWith("+")) {
    return { row: { kind: "add", newLine: cursor.newLine, text }, next: { ...cursor, newLine: cursor.newLine + 1 } };
  }
  if (line.startsWith("-")) {
    return { row: { kind: "del", oldLine: cursor.oldLine, text }, next: { ...cursor, oldLine: cursor.oldLine + 1 } };
  }
  if (line.startsWith("\\")) return { row: { kind: "note", text: line.slice(2) }, next: cursor };
  if (line.startsWith("diff --git")) return { row: void 0, next: { ...cursor, inHunk: false } };
  return {
    row: { kind: "context", oldLine: cursor.oldLine, newLine: cursor.newLine, text },
    next: { ...cursor, oldLine: cursor.oldLine + 1, newLine: cursor.newLine + 1 }
  };
}
function diffRows(patch, maxRows = MAX_DIFF_ROWS) {
  const lines = patch.endsWith("\n") ? patch.slice(0, -1).split("\n") : patch.split("\n");
  const rows = [];
  let cursor = { oldLine: 0, newLine: 0, inHunk: false };
  for (const line of lines) {
    if (line === "" && !cursor.inHunk) continue;
    const { row, next } = rowOf(line, cursor);
    cursor = next;
    if (row === void 0) continue;
    if (rows.length >= maxRows) return { rows, truncated: true };
    rows.push(row);
  }
  return { rows, truncated: false };
}

// src/client/changes/changes-styles.ts
var P = "vyra-agent-cli-manager-changes";
var CLS = {
  panel: P,
  header: `${P}-header`,
  headerRow: `${P}-header-row`,
  title: `${P}-title`,
  distance: `${P}-distance`,
  headerButtons: `${P}-header-buttons`,
  headerButton: `${P}-header-button`,
  spinning: `${P}-spinning`,
  branchMenu: `${P}-branch-menu`,
  branchButton: `${P}-branch-button`,
  branchName: `${P}-branch-name`,
  branchForm: `${P}-branch-form`,
  branchInput: `${P}-branch-input`,
  remoteItem: `${P}-remote-item`,
  remoteTag: `${P}-remote-tag`,
  summary: `${P}-summary`,
  summaryTitle: `${P}-summary-title`,
  summarySelected: `${P}-summary-selected`,
  scroll: `${P}-scroll`,
  list: `${P}-list`,
  group: `${P}-group`,
  groupHeader: `${P}-group-header`,
  groupTitle: `${P}-group-title`,
  groupCount: `${P}-group-count`,
  groupActions: `${P}-group-actions`,
  groupAction: `${P}-group-action`,
  danger: `${P}-danger`,
  collapsed: `${P}-collapsed`,
  row: `${P}-row`,
  checkbox: `${P}-checkbox`,
  letter: `${P}-letter`,
  badge: `${P}-badge`,
  path: `${P}-path`,
  dir: `${P}-dir`,
  name: `${P}-name`,
  stats: `${P}-stats`,
  add: `${P}-add`,
  del: `${P}-del`,
  rowActions: `${P}-row-actions`,
  iconButton: `${P}-icon-button`,
  empty: `${P}-empty`,
  error: `${P}-error`,
  commit: `${P}-commit`,
  commitInput: `${P}-commit-input`,
  commitRow: `${P}-commit-row`,
  commitButton: `${P}-commit-button`,
  aiButton: `${P}-ai-button`,
  diff: `${P}-diff`,
  diffHeader: `${P}-diff-header`,
  diffPath: `${P}-diff-path`,
  diffSide: `${P}-diff-side`,
  diffBody: `${P}-diff-body`,
  diffHunk: `${P}-diff-hunk`,
  diffNote: `${P}-diff-note`,
  diffLine: `${P}-diff-line`,
  diffNumber: `${P}-diff-number`,
  diffText: `${P}-diff-text`
};
var DARK = "body[data-ds-dark-theme]";
var LAYOUT = `
.${CLS.panel} { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;
  color: var(--dsw-alias-label-primary); font-size: 14px; }
.${CLS.header} { display: flex; flex-direction: column; gap: 10px; padding: 10px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l2); }
.${CLS.headerRow} { display: flex; align-items: center; gap: 8px; }
.${CLS.title} { font-weight: 500; }
.${CLS.distance} { font-size: 12px; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }
.${CLS.headerButtons} { margin-left: auto; display: flex; gap: 6px; }
.${CLS.headerButton}, .${CLS.branchButton} { display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md); background: transparent;
  color: var(--dsw-alias-label-secondary); cursor: pointer; }
.${CLS.headerButton} { width: 30px; height: 30px; padding: 0; }
.${CLS.headerButton}:hover:not(:disabled), .${CLS.branchButton}:hover:not(:disabled),
.${CLS.iconButton}:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.${CLS.headerButton}:disabled, .${CLS.branchButton}:disabled { cursor: default; opacity: 0.5; }
.${CLS.spinning} { animation: ${P}-spin 0.8s linear infinite; }
@keyframes ${P}-spin { to { transform: rotate(360deg); } }
.${CLS.branchMenu} { display: block; }
.${CLS.branchButton} { width: 100%; height: 32px; gap: 8px; padding: 0 10px; justify-content: flex-start; }
.${CLS.branchName} { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  text-align: left; color: var(--dsw-alias-label-primary); }
.${CLS.branchForm} { display: flex; gap: 6px; }
.${CLS.branchInput} { flex: 1; min-width: 0; height: 30px; padding: 0 8px; border-radius: var(--dsw-radius-md);
  border: 1px solid var(--dsw-alias-border-l3); background: transparent; color: inherit; font: inherit; font-size: 13px; }
.${CLS.remoteItem} { display: inline-flex; gap: 6px; align-items: baseline; }
.${CLS.remoteTag} { font-size: 11px; color: var(--dsw-alias-label-tertiary); }
.${CLS.summary} { display: flex; align-items: baseline; gap: 6px; padding: 8px 12px; }
.${CLS.summaryTitle} { font-weight: 500; }
.${CLS.summarySelected} { margin-left: auto; font-size: 13px; color: var(--dsw-alias-label-tertiary); }
.${CLS.scroll} { flex: 1; min-height: 0; overflow-y: auto; }
.${CLS.groupHeader} { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: 6px;
  padding: 6px 12px 6px 8px; background: var(--dsw-alias-bg-layer-2); cursor: pointer; user-select: none; }
.${CLS.groupTitle} { font-weight: 500; }
.${CLS.groupCount} { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.${CLS.groupActions} { margin-left: auto; display: flex; gap: 8px; }
.${CLS.groupAction} { border: none; background: transparent; padding: 2px 4px; border-radius: var(--dsw-radius-sm);
  font-size: 12px; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.${CLS.groupAction}:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.${CLS.groupAction}:disabled { cursor: default; opacity: 0.5; }
.${CLS.danger} { color: var(--dsw-alias-state-error-primary); }
.${CLS.iconButton} { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px;
  padding: 0; border: none; border-radius: var(--dsw-radius-sm); background: transparent;
  color: var(--dsw-alias-label-secondary); cursor: pointer; }
.${CLS.collapsed} { transform: rotate(-90deg); }
.${CLS.checkbox} { width: 14px; height: 14px; margin: 0; flex: none; accent-color: var(--dsw-alias-state-business-primary); }
.${CLS.empty} { padding: 24px 12px; text-align: center; color: var(--dsw-alias-label-tertiary); font-size: 13px; }
.${CLS.error} { display: flex; align-items: flex-start; gap: 8px; margin: 8px 12px 0; padding: 6px 8px;
  border-radius: var(--dsw-radius-md); color: var(--dsw-alias-state-error-primary); font-size: 12px;
  white-space: pre-wrap; word-break: break-word; background: var(--dsw-alias-interactive-bg-hover); }
.${CLS.error} > span { flex: 1; }
.${CLS.commit} { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 12px;
  border-top: 1px solid var(--dsw-alias-border-l2); }
.${CLS.commitInput} { resize: vertical; min-height: 52px; padding: 8px 10px; border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l3); background: transparent; color: inherit; font: inherit; font-size: 14px; }
.${CLS.commitRow} { display: flex; gap: 8px; }
.${CLS.commitButton} { flex: 1; height: 34px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;
  background: var(--dsw-alias-state-business-primary); color: #fff; }
.${CLS.commitButton}:disabled { cursor: default; background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-tertiary); }
.${CLS.aiButton} { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 34px;
  height: 34px; padding: 0; border: 1px solid var(--dsw-alias-border-l3); border-radius: 8px;
  background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.${CLS.aiButton}:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
`;
var ROWS = `
.${CLS.row} { position: relative; display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px;
  font-size: 12px; }
.${CLS.row}:hover { background: var(--dsw-alias-interactive-bg-hover); }
.${CLS.letter} { width: 16px; flex: none; text-align: center; font-family: var(--dsw-font-mono, monospace); font-weight: 600; }
.${CLS.badge} { flex: none; display: inline-flex; align-items: center; justify-content: center; min-width: 16px;
  height: 14px; padding: 0 2px; border-radius: 3px; font-size: 8px; font-weight: 700; line-height: 1; color: #fff; }
.${CLS.badge}[data-tone="blue"] { background: #3178c6; }
.${CLS.badge}[data-tone="yellow"] { background: #c9a400; }
.${CLS.badge}[data-tone="dark"] { background: #555; }
.${CLS.badge}[data-tone="orange"] { background: transparent; color: #e44d26; font-size: 11px; }
.${CLS.badge}[data-tone="plain"] { background: transparent; color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.${CLS.path} { flex: 1; min-width: 0; display: flex; padding: 0; border: none; background: transparent; color: inherit;
  font-family: var(--dsw-font-mono, monospace); font-size: 12px; cursor: pointer; text-align: left; }
.${CLS.dir} { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;
  color: var(--dsw-alias-label-tertiary); }
.${CLS.name} { flex: none; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.${CLS.stats} { flex: none; display: flex; gap: 6px; font-variant-numeric: tabular-nums; }
.${CLS.add} { color: var(--dsw-alias-state-success-primary); }
.${CLS.del} { color: var(--dsw-alias-state-error-primary); }
.${CLS.rowActions} { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); display: none; gap: 2px;
  padding-left: 8px; background: var(--dsw-alias-bg-layer-1); }
.${CLS.row}:hover .${CLS.rowActions}, .${CLS.row}:focus-within .${CLS.rowActions} { display: flex; }
.${CLS.row}[data-status="M"], .${CLS.row}[data-status="C"], .${CLS.row}[data-status="T"] { --${P}-tone: #0088d2; }
.${CLS.row}[data-status="R"] { --${P}-tone: #0088d2; }
.${CLS.row}[data-status="A"] { --${P}-tone: #208a3c; }
.${CLS.row}[data-status="untracked"] { --${P}-tone: #b00020; }
.${CLS.row}[data-status="U"] { --${P}-tone: #e5534b; }
.${CLS.row}[data-status="D"] { --${P}-tone: var(--dsw-alias-label-tertiary); }
${DARK} .${CLS.row}[data-status="M"], ${DARK} .${CLS.row}[data-status="C"], ${DARK} .${CLS.row}[data-status="T"] { --${P}-tone: #589df6; }
${DARK} .${CLS.row}[data-status="R"] { --${P}-tone: #389fd6; }
${DARK} .${CLS.row}[data-status="A"] { --${P}-tone: #59a869; }
${DARK} .${CLS.row}[data-status="untracked"] { --${P}-tone: #e05555; }
.${CLS.letter}, .${CLS.name} { color: var(--${P}-tone); }
.${CLS.row}[data-status="D"] .${CLS.name} { text-decoration: line-through; opacity: 0.75; }
`;
var DIFF = `
.${CLS.diff} { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.${CLS.diffHeader} { display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l2); }
.${CLS.diffPath} { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: var(--dsw-font-mono, monospace); font-size: 12px; }
.${CLS.diffSide} { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.${CLS.diffBody} { flex: 1; min-height: 0; overflow: auto; font-family: var(--dsw-font-mono, monospace);
  font-size: 12px; line-height: 18px; }
.${CLS.diffHunk} { padding: 2px 8px; color: var(--dsw-alias-state-business-primary); background: var(--dsw-alias-bg-layer-2); }
.${CLS.diffNote} { padding: 4px 8px; color: var(--dsw-alias-label-tertiary); }
.${CLS.diffLine} { display: flex; min-width: max-content; }
.${CLS.diffLine}[data-kind="add"] { background: rgba(34, 197, 94, 0.1); }
.${CLS.diffLine}[data-kind="del"] { background: rgba(239, 68, 68, 0.1); }
.${CLS.diffNumber} { flex: none; width: 36px; padding-right: 6px; text-align: right; user-select: none;
  color: var(--dsw-alias-label-tertiary); }
.${CLS.diffText} { padding: 0 8px; white-space: pre; }
`;
var CHANGES_STYLES = `${LAYOUT}${ROWS}${DIFF}`;

// src/client/changes/changes-diff.tsx
var import_jsx_runtime11 = require("react/jsx-runtime");
var SIDE_LABELS = { staged: "\u5DF2\u6682\u5B58", unstaged: "\u672A\u6682\u5B58", untracked: "\u672A\u8DDF\u8E2A" };
var TRUNCATED = "Diff \u8FC7\u5927\uFF0C\u5DF2\u622A\u65AD";
var NO_CHANGES = "\u6CA1\u6709\u53EF\u663E\u793A\u7684\u5DEE\u5F02";
function Line({ row }) {
  if (row.kind === "hunk" || row.kind === "note") {
    return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: row.kind === "hunk" ? CLS.diffHunk : CLS.diffNote, children: row.text });
  }
  const oldLine = row.kind === "add" ? "" : String(row.oldLine);
  const newLine = row.kind === "del" ? "" : String(row.newLine);
  const sign = row.kind === "add" ? "+" : row.kind === "del" ? "-" : " ";
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: CLS.diffLine, "data-kind": row.kind, children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: CLS.diffNumber, children: oldLine }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: CLS.diffNumber, children: newLine }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: CLS.diffText, children: [
      sign,
      row.text
    ] })
  ] });
}
function useDiff(api, diff) {
  const [loaded, setLoaded] = (0, import_react9.useState)({ kind: "loading" });
  const { entry, side } = diff;
  (0, import_react9.useEffect)(() => {
    let live = true;
    setLoaded({ kind: "loading" });
    api.diff({ path: entry.path, side, origPath: entry.origPath }).then(
      (file) => {
        if (!live) return;
        setLoaded(
          file.truncated ? { kind: "rows", rows: [], truncated: true } : { kind: "rows", ...diffRows(file.patch) }
        );
      },
      (error) => {
        if (live) setLoaded({ kind: "error", message: error instanceof Error ? error.message : String(error) });
      }
    );
    return () => {
      live = false;
    };
  }, [api, entry.path, entry.origPath, side]);
  return loaded;
}
function Body({ loaded }) {
  if (loaded.kind === "loading") return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: CLS.empty, children: "\u52A0\u8F7D\u4E2D\u2026" });
  if (loaded.kind === "error") return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: CLS.error, children: loaded.message });
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: CLS.diffBody, children: [
    loaded.rows.length === 0 && !loaded.truncated ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: CLS.empty, children: NO_CHANGES }) : null,
    loaded.rows.map((row, index) => (
      // Rows have no identity of their own, and one patch's rows never reorder.
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Line, { row }, index)
    )),
    loaded.truncated ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: CLS.diffNote, children: TRUNCATED }) : null
  ] });
}
function ChangesDiff({
  api,
  diff,
  onBack
}) {
  const loaded = useDiff(api, diff);
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: CLS.diff, children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: CLS.diffHeader, children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", className: CLS.headerButton, title: "\u8FD4\u56DE", "aria-label": "\u8FD4\u56DE", onClick: onBack, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(BackIcon, { size: 16 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: CLS.diffPath, title: diff.entry.path, children: diff.entry.path }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: CLS.diffSide, children: SIDE_LABELS[diff.side] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Body, { loaded })
  ] });
}

// src/client/changes/changes-header.tsx
var import_react10 = require("react");
var import_dsh_client_ui_primitives7 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime12 = require("react/jsx-runtime");
var NEW_BRANCH_ID = "\0new";
var REMOTE_PREFIX = "remote:";
var LOCAL_PREFIX = "local:";
var DETACHED_LABEL = "\u6E38\u79BB HEAD";
var LOADING_ITEM = { id: "\0loading", label: "\u52A0\u8F7D\u4E2D\u2026" };
function HeaderButton({
  label,
  disabled,
  onClick,
  children
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
    "button",
    {
      type: "button",
      className: CLS.headerButton,
      title: label,
      "aria-label": label,
      disabled,
      onClick,
      children
    }
  );
}
function branchItems(list) {
  if (list === void 0) return [LOADING_ITEM];
  return [
    ...list.local.map((name) => ({ id: `${LOCAL_PREFIX}${name}`, label: name })),
    ...list.remote.map((name) => ({
      id: `${REMOTE_PREFIX}${name}`,
      label: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: CLS.remoteItem, children: [
        name,
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: CLS.remoteTag, children: "\u8FDC\u7A0B\u5206\u652F" })
      ] })
    })),
    { id: NEW_BRANCH_ID, label: "\u65B0\u5EFA\u5206\u652F\u2026" }
  ];
}
function NewBranchForm({
  onCreate,
  onCancel
}) {
  const [name, setName] = (0, import_react10.useState)("");
  const trimmed = name.trim();
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
    "form",
    {
      className: CLS.branchForm,
      onSubmit: (event) => {
        event.preventDefault();
        if (trimmed !== "") onCreate(trimmed);
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          "input",
          {
            className: CLS.branchInput,
            autoFocus: true,
            placeholder: "\u5206\u652F\u540D\u79F0",
            "aria-label": "\u5206\u652F\u540D\u79F0",
            value: name,
            onChange: (event) => {
              setName(event.target.value);
            },
            onKeyDown: (event) => {
              if (event.key === "Escape") onCancel();
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { type: "submit", className: CLS.groupAction, disabled: trimmed === "", children: "\u65B0\u5EFA" }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("button", { type: "button", className: CLS.groupAction, onClick: onCancel, children: "\u8FD4\u56DE" })
      ]
    }
  );
}
var NO_BRANCHES = { current: void 0, local: [], remote: [] };
function useBranchList(api) {
  const [list, setList] = (0, import_react10.useState)();
  const load = () => {
    setList(void 0);
    api.branches().then(
      (answer) => {
        setList("local" in answer ? answer : NO_BRANCHES);
      },
      () => {
        setList(NO_BRANCHES);
      }
    );
  };
  return { list, load };
}
function pickBranch(id, actions, startCreating) {
  if (id === NEW_BRANCH_ID) startCreating();
  else if (id.startsWith(LOCAL_PREFIX)) actions.checkout(id.slice(LOCAL_PREFIX.length), false);
  else if (id.startsWith(REMOTE_PREFIX)) actions.checkout(id.slice(REMOTE_PREFIX.length), true);
}
function BranchButton({
  branch,
  busy,
  onClick
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("button", { type: "button", className: CLS.branchButton, "aria-label": "\u5206\u652F", disabled: busy, onClick, children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(BranchIcon, { size: 16 }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: CLS.branchName, children: branch ?? DETACHED_LABEL }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ChevronIcon, { size: 16 })
  ] });
}
function BranchPicker({ status, api, busy, actions }) {
  const [open, setOpen] = (0, import_react10.useState)(false);
  const [creating, setCreating] = (0, import_react10.useState)(false);
  const { list, load } = useBranchList(api);
  if (creating) {
    const finish = (name) => {
      setCreating(false);
      if (name !== void 0) actions.createBranch(name);
    };
    return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
      NewBranchForm,
      {
        onCreate: finish,
        onCancel: () => {
          finish();
        }
      }
    );
  }
  const anchor = /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
    BranchButton,
    {
      branch: status.branch,
      busy,
      onClick: () => {
        if (!open) load();
        setOpen(!open);
      }
    }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
    import_dsh_client_ui_primitives7.Menu,
    {
      open,
      className: CLS.branchMenu,
      items: branchItems(list),
      selectedId: status.branch === void 0 ? void 0 : `${LOCAL_PREFIX}${status.branch}`,
      onSelect: (id) => {
        setOpen(false);
        pickBranch(id, actions, () => {
          setCreating(true);
        });
      },
      onClose: () => {
        setOpen(false);
      },
      portal: true,
      anchor
    }
  );
}
function ChangesHeader({ status, api, busy, refreshing, actions }) {
  const tracked = status.ahead !== void 0 && status.behind !== void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: CLS.header, children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: CLS.headerRow, children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: CLS.title, children: "\u53D8\u66F4" }),
      tracked ? /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: CLS.distance, title: "\u9886\u5148 / \u843D\u540E\u4E0A\u6E38\u7684\u63D0\u4EA4\u6570", children: [
        "\u2191",
        status.ahead,
        " \u2193",
        status.behind
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: CLS.headerButtons, children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(HeaderButton, { label: "\u5237\u65B0", disabled: refreshing, onClick: actions.refresh, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(RefreshIcon, { size: 16, className: refreshing ? CLS.spinning : void 0 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(HeaderButton, { label: "\u62C9\u53D6", disabled: busy, onClick: actions.pull, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(PullIcon, { size: 16 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(HeaderButton, { label: "\u63A8\u9001", disabled: busy, onClick: actions.push, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(PushIcon, { size: 16 }) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(BranchPicker, { status, api, busy, actions })
  ] });
}

// src/client/changes/changes-list.tsx
var import_react11 = require("react");

// src/client/changes/changes-model.ts
var GROUP_IDS = ["staged", "unstaged", "untracked"];
var GROUP_TITLES = {
  staged: "\u5DF2\u6682\u5B58",
  unstaged: "\u672A\u6682\u5B58",
  untracked: "\u672A\u8DDF\u8E2A"
};
function sum(entries, key) {
  return entries.reduce((total, entry) => total + (entry[key] ?? 0), 0);
}
function changedPaths(status) {
  return new Set(GROUP_IDS.flatMap((group) => status[group].map((entry) => entry.path)));
}
function summarize(status) {
  const entries = GROUP_IDS.flatMap((group) => status[group]);
  return {
    files: changedPaths(status).size,
    additions: sum(entries, "additions"),
    deletions: sum(entries, "deletions")
  };
}
function reconcileSelection(selection, before, after) {
  const present = changedPaths(after);
  const wasStaged = new Set(before?.staged.map((entry) => entry.path) ?? []);
  const kept = [...selection].filter((path) => present.has(path));
  const newlyStaged = after.staged.map((entry) => entry.path).filter((path) => !wasStaged.has(path));
  return /* @__PURE__ */ new Set([...kept, ...newlyStaged]);
}
function toggleSelection(selection, paths, selected) {
  if (selected) return /* @__PURE__ */ new Set([...selection, ...paths]);
  const removed = new Set(paths);
  return new Set([...selection].filter((path) => !removed.has(path)));
}
function commitPaths(selection, status) {
  const present = changedPaths(status);
  return [...selection].filter((path) => present.has(path));
}
function groupCheck(selection, entries) {
  const count = entries.filter((entry) => selection.has(entry.path)).length;
  if (count === 0) return "none";
  return count === entries.length ? "all" : "some";
}
function splitPath(path) {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return { dir: path.slice(0, cut + 1), name: path.slice(cut + 1) };
}
var STATUS_LABELS = {
  M: "\u5DF2\u4FEE\u6539",
  A: "\u65B0\u6587\u4EF6",
  D: "\u5DF2\u5220\u9664",
  R: "\u5DF2\u91CD\u547D\u540D",
  C: "\u5DF2\u590D\u5236",
  T: "\u7C7B\u578B\u5DF2\u53D8",
  U: "\u6709\u51B2\u7A81",
  "?": "\u672A\u8DDF\u8E2A"
};

// src/client/changes/changes-row.tsx
var import_jsx_runtime13 = require("react/jsx-runtime");
var BADGES = {
  ts: { text: "TS", tone: "blue" },
  tsx: { text: "TSX", tone: "blue" },
  js: { text: "JS", tone: "yellow" },
  jsx: { text: "JSX", tone: "yellow" },
  mjs: { text: "JS", tone: "yellow" },
  json: { text: "{}", tone: "yellow" },
  md: { text: "M\u2193", tone: "dark" },
  html: { text: "<>", tone: "orange" },
  css: { text: "#", tone: "blue" },
  py: { text: "PY", tone: "blue" },
  rs: { text: "RS", tone: "orange" },
  go: { text: "GO", tone: "blue" }
};
var DEFAULT_BADGE = { text: "\xB7", tone: "plain" };
var SIDE_OF = { staged: "staged", unstaged: "unstaged", untracked: "untracked" };
function badgeOf(path) {
  const name = splitPath(path).name;
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? DEFAULT_BADGE : BADGES[name.slice(dot + 1).toLowerCase()] ?? DEFAULT_BADGE;
}
function RowActions({ group, entry, busy, actions }) {
  const staged = group === "staged";
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("span", { className: CLS.rowActions, children: [
    staged ? null : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
      "button",
      {
        type: "button",
        className: CLS.iconButton,
        title: "\u64A4\u9500\u66F4\u6539",
        "aria-label": "\u64A4\u9500\u66F4\u6539",
        disabled: busy,
        onClick: () => {
          actions.discard(group, [entry]);
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(UndoIcon, { size: 14 })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
      "button",
      {
        type: "button",
        className: CLS.iconButton,
        title: staged ? "\u53D6\u6D88\u6682\u5B58" : "\u6682\u5B58",
        "aria-label": staged ? "\u53D6\u6D88\u6682\u5B58" : "\u6682\u5B58",
        disabled: busy,
        onClick: () => {
          if (staged) actions.unstage([entry.path]);
          else actions.stage([entry.path]);
        },
        children: staged ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(MinusIcon, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(PlusIcon2, { size: 14 })
      }
    )
  ] });
}
function PathButton({ group, entry, actions }) {
  const { dir, name } = splitPath(entry.path);
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(
    "button",
    {
      type: "button",
      className: CLS.path,
      title: entry.origPath === void 0 ? entry.path : `${entry.origPath} \u2192 ${entry.path}`,
      onClick: () => {
        actions.open(entry, SIDE_OF[group]);
      },
      children: [
        dir === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: CLS.dir, dir: "rtl", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("bdo", { dir: "ltr", children: dir }) }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: CLS.name, children: name })
      ]
    }
  );
}
function LineStats({ entry }) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("span", { className: CLS.stats, children: [
    entry.additions === void 0 || entry.additions === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("span", { className: CLS.add, children: [
      "+",
      entry.additions
    ] }),
    entry.deletions === void 0 || entry.deletions === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("span", { className: CLS.del, children: [
      "\u2212",
      entry.deletions
    ] })
  ] });
}
function FileRow(props) {
  const { entry, selected, actions } = props;
  const badge = badgeOf(entry.path);
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: CLS.row, "data-status": entry.status === "?" ? "untracked" : entry.status, children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
      "input",
      {
        type: "checkbox",
        className: CLS.checkbox,
        checked: selected,
        "aria-label": `\u9009\u62E9 ${entry.path}`,
        onChange: (event) => {
          actions.select([entry.path], event.target.checked);
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: CLS.letter, title: STATUS_LABELS[entry.status], children: entry.status }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: CLS.badge, "data-tone": badge.tone, children: badge.text }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(PathButton, { ...props }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(LineStats, { entry }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(RowActions, { ...props })
  ] });
}

// src/client/changes/changes-list.tsx
var import_jsx_runtime14 = require("react/jsx-runtime");
function SummaryRow({
  status,
  selected
}) {
  const { files, additions, deletions } = summarize(status);
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: CLS.summary, children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: CLS.summaryTitle, children: [
      files,
      " \u4E2A\u672A\u63D0\u4EA4\u53D8\u66F4"
    ] }),
    additions > 0 ? /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: CLS.add, children: [
      "+",
      additions
    ] }) : null,
    deletions > 0 ? /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: CLS.del, children: [
      "\u2212",
      deletions
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: CLS.summarySelected, children: [
      "\u5DF2\u9009 ",
      selected,
      " \u9879"
    ] })
  ] });
}
function GroupCheckbox({
  entries,
  selection,
  onChange
}) {
  const ref = (0, import_react11.useRef)(null);
  const check = groupCheck(selection, entries);
  (0, import_react11.useEffect)(() => {
    if (ref.current !== null) ref.current.indeterminate = check === "some";
  }, [check]);
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
    "input",
    {
      ref,
      type: "checkbox",
      className: CLS.checkbox,
      checked: check === "all",
      "aria-label": "\u5168\u9009\u672C\u7EC4",
      onChange: (event) => {
        onChange(event.target.checked);
      }
    }
  );
}
function TextAction({
  label,
  danger = false,
  busy,
  onClick
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
    "button",
    {
      type: "button",
      className: danger ? `${CLS.groupAction} ${CLS.danger}` : CLS.groupAction,
      disabled: busy,
      onClick,
      children: label
    }
  );
}
function GroupActions({
  group,
  entries,
  busy,
  actions
}) {
  const paths = entries.map((entry) => entry.path);
  if (group === "staged")
    return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      TextAction,
      {
        label: "\u5168\u90E8\u53D6\u6D88\u6682\u5B58",
        busy,
        onClick: () => {
          actions.unstage(paths);
        }
      }
    );
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(import_jsx_runtime14.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      TextAction,
      {
        label: "\u5168\u90E8\u64A4\u9500",
        danger: true,
        busy,
        onClick: () => {
          actions.discard(group, entries);
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      TextAction,
      {
        label: "\u5168\u90E8\u6682\u5B58",
        busy,
        onClick: () => {
          actions.stage(paths);
        }
      }
    )
  ] });
}
function GroupHeader({
  open,
  onToggle,
  ...props
}) {
  const { group, entries, selection, actions } = props;
  const title = GROUP_TITLES[group];
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(
    "div",
    {
      className: CLS.groupHeader,
      onClick: (event) => {
        if (!(event.target instanceof Element)) return;
        if (event.target.closest("button, input, label, a") !== null) return;
        onToggle();
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
          "button",
          {
            type: "button",
            className: CLS.iconButton,
            "aria-expanded": open,
            "aria-label": `${open ? "\u6298\u53E0" : "\u5C55\u5F00"}${title}`,
            onClick: onToggle,
            children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(ChevronIcon, { size: 14, className: open ? void 0 : CLS.collapsed })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
          GroupCheckbox,
          {
            entries,
            selection,
            onChange: (selected) => {
              actions.select(
                entries.map((entry) => entry.path),
                selected
              );
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: CLS.groupTitle, children: title }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: CLS.groupCount, children: entries.length }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: CLS.groupActions, children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(GroupActions, { ...props }) })
      ]
    }
  );
}
function Group(props) {
  const [open, setOpen] = (0, import_react11.useState)(true);
  const { group, entries, selection, busy, actions } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("section", { className: CLS.group, "aria-label": GROUP_TITLES[group], children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      GroupHeader,
      {
        ...props,
        open,
        onToggle: () => {
          setOpen((value) => !value);
        }
      }
    ),
    open ? entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      FileRow,
      {
        group,
        entry,
        selected: selection.has(entry.path),
        busy,
        actions
      },
      `${group}:${entry.path}`
    )) : null
  ] });
}
function ChangesList({ status, selection, busy, actions }) {
  const groups = GROUP_IDS.filter((group) => status[group].length > 0);
  if (groups.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: CLS.empty, children: "\u6CA1\u6709\u53D8\u66F4" });
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: CLS.list, children: groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Group, { group, entries: status[group], selection, busy, actions }, group)) });
}

// src/client/changes/use-changes.ts
var import_react12 = require("react");
var REFRESH_INTERVAL_MS = 15e3;
var INITIAL = {
  answer: void 0,
  selection: /* @__PURE__ */ new Set(),
  message: "",
  busy: void 0,
  refreshing: false,
  error: void 0,
  diff: void 0
};
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
function applyAnswer(state, answer) {
  if (!answer.repo) return { ...state, answer, selection: /* @__PURE__ */ new Set() };
  const before = state.answer?.repo === true ? state.answer : void 0;
  return { ...state, answer, selection: reconcileSelection(state.selection, before, answer) };
}
function createRun(api, setState, refs) {
  return (busy, operation, after) => {
    if (refs.current.current.busy !== void 0) return;
    refs.bump();
    setState((previous) => ({ ...previous, busy, error: void 0 }));
    operation(api).then(
      (answer) => {
        setState((previous) => {
          const next = { ...applyAnswer(previous, answer), busy: void 0 };
          return after === void 0 ? next : after(next);
        });
      },
      (error) => {
        setState((previous) => ({ ...previous, busy: void 0, error: messageOf(error) }));
      }
    );
  };
}
function createRefresh(api, setState, refs) {
  return () => {
    const { busy, refreshing } = refs.current.current;
    if (busy !== void 0 || refreshing) return;
    const started = refs.generation();
    setState((previous) => ({ ...previous, refreshing: true }));
    api.status().then(
      (answer) => {
        setState(
          (previous) => refs.generation() === started ? { ...applyAnswer(previous, answer), refreshing: false } : { ...previous, refreshing: false }
        );
      },
      (error) => {
        setState((previous) => ({ ...previous, refreshing: false, error: messageOf(error) }));
      }
    );
  };
}
function writeActions(run, current) {
  return {
    stage: (paths) => {
      run(
        "stage",
        (api) => api.stage(paths),
        (next) => ({ ...next, selection: toggleSelection(next.selection, paths, true) })
      );
    },
    unstage: (paths) => {
      run(
        "unstage",
        (api) => api.unstage(paths),
        (next) => ({ ...next, selection: toggleSelection(next.selection, paths, false) })
      );
    },
    discard: (target) => {
      run(
        "discard",
        (api) => api.discard(target),
        (next) => ({ ...next, diff: void 0 })
      );
    },
    commit: () => {
      const { answer, selection, message: message2 } = current.current;
      if (answer?.repo !== true) return;
      const paths = commitPaths(selection, answer);
      run(
        "commit",
        (api) => api.commit({ message: message2, paths }),
        (next) => ({ ...next, message: "" })
      );
    },
    push: () => {
      run("push", (api) => api.push());
    },
    pull: () => {
      run("pull", (api) => api.pull());
    },
    checkout: (branch, remote) => {
      run("checkout", (api) => api.checkout({ branch, remote }));
    },
    createBranch: (branch) => {
      run("checkout", (api) => api.createBranch(branch));
    }
  };
}
function localActions(setState) {
  return {
    setMessage: (message2) => {
      setState((previous) => ({ ...previous, message: message2 }));
    },
    select: (paths, selected) => {
      setState((previous) => ({ ...previous, selection: toggleSelection(previous.selection, paths, selected) }));
    },
    openDiff: (diff) => {
      setState((previous) => ({ ...previous, diff }));
    },
    dismissError: () => {
      setState((previous) => ({ ...previous, error: void 0 }));
    }
  };
}
function useChanges(api) {
  const [state, setState] = (0, import_react12.useState)(INITIAL);
  const current = (0, import_react12.useRef)(state);
  const generation = (0, import_react12.useRef)(0);
  (0, import_react12.useEffect)(() => {
    current.current = state;
  }, [state]);
  const { run, refresh } = (0, import_react12.useMemo)(() => {
    const refs = {
      current,
      generation: () => generation.current,
      bump: () => {
        generation.current += 1;
      }
    };
    return { run: createRun(api, setState, refs), refresh: createRefresh(api, setState, refs) };
  }, [api]);
  useAutoRefresh(refresh);
  const actions = (0, import_react12.useMemo)(() => ({ refresh, ...localActions(setState), ...writeActions(run, current) }), [refresh, run]);
  return { state, actions };
}
function useAutoRefresh(refresh) {
  (0, import_react12.useEffect)(() => {
    const whenVisible = () => {
      if (document.visibilityState !== "hidden") refresh();
    };
    refresh();
    const timer = window.setInterval(whenVisible, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", whenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", whenVisible);
    };
  }, [refresh]);
}
function canCommit(state) {
  if (state.answer?.repo !== true || state.busy !== void 0 || state.message.trim() === "") return false;
  return commitPaths(state.selection, state.answer).length > 0;
}
function selectedCount(state) {
  return state.answer?.repo === true ? commitPaths(state.selection, state.answer).length : 0;
}

// src/client/changes/changes-panel.tsx
var import_jsx_runtime15 = require("react/jsx-runtime");
var NO_DIRECTORY = "\u8FD9\u4E2A\u4F1A\u8BDD\u8FD8\u6CA1\u6709\u5DE5\u4F5C\u76EE\u5F55";
var NOT_A_REPO = "\u5F53\u524D\u5DE5\u4F5C\u533A\u4E0D\u662F Git \u4ED3\u5E93";
var AI_LABEL = "AI \u751F\u6210\u63D0\u4EA4\u4FE1\u606F";
var AI_UNAVAILABLE = "\u6682\u672A\u5F00\u653E\uFF0C\u656C\u8BF7\u671F\u5F85";
function useCwd(list, sessionId) {
  const subscribe = (0, import_react13.useCallback)((listener) => list.subscribe(listener), [list]);
  return (0, import_react13.useSyncExternalStore)(subscribe, () => list.getSnapshot().byId[sessionId]?.cwd);
}
function discardText({ entries }) {
  const [only] = entries;
  return entries.length === 1 && only !== void 0 ? `\u786E\u5B9A\u8981\u64A4\u9500\u5BF9\u201C${only.path}\u201D\u7684\u66F4\u6539\u5417\uFF1F\u66F4\u6539\u5C06\u65E0\u6CD5\u6062\u590D\u3002` : `\u786E\u5B9A\u8981\u64A4\u9500\u8FD9 ${String(entries.length)} \u4E2A\u6587\u4EF6\u7684\u5168\u90E8\u66F4\u6539\u5417\uFF1F\u66F4\u6539\u5C06\u65E0\u6CD5\u6062\u590D\u3002`;
}
function DiscardDialog({
  pending,
  onConfirm,
  onClose
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    import_dsh_client_ui_primitives8.Modal,
    {
      open: pending !== void 0,
      onClose,
      title: "\u64A4\u9500\u66F4\u6539",
      closeLabel: "\u5173\u95ED",
      description: pending === void 0 ? void 0 : discardText(pending),
      footer: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_dsh_client_ui_primitives8.Button, { variant: "ghost", onClick: onClose, children: "\u53D6\u6D88" }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          import_dsh_client_ui_primitives8.Button,
          {
            variant: "primary",
            onClick: () => {
              if (pending !== void 0) onConfirm(pending);
            },
            children: "\u786E\u5B9A"
          }
        )
      ] })
    }
  );
}
function AiCommitButton({ anchor }) {
  const [showTip, setShowTip] = (0, import_react13.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      "button",
      {
        type: "button",
        className: CLS.aiButton,
        title: AI_LABEL,
        "aria-label": AI_LABEL,
        onClick: () => {
          setShowTip(true);
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(SparkleIcon, {})
      }
    ),
    showTip ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      import_dsh_client_ui_primitives8.Toast,
      {
        text: AI_UNAVAILABLE,
        anchor,
        onDone: () => {
          setShowTip(false);
        }
      }
    ) : null
  ] });
}
function CommitBox({
  state,
  actions
}) {
  const count = selectedCount(state);
  const [box, setBox] = (0, import_react13.useState)(null);
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: CLS.commit, ref: setBox, children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      "textarea",
      {
        className: CLS.commitInput,
        rows: 2,
        placeholder: "\u63D0\u4EA4\u4FE1\u606F\u2026",
        "aria-label": "\u63D0\u4EA4\u4FE1\u606F",
        value: state.message,
        onChange: (event) => {
          actions.setMessage(event.target.value);
        },
        onKeyDown: (event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canCommit(state)) actions.commit();
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: CLS.commitRow, children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("button", { type: "button", className: CLS.commitButton, disabled: !canCommit(state), onClick: actions.commit, children: state.busy === "commit" ? "\u63D0\u4EA4\u4E2D\u2026" : `\u63D0\u4EA4 (${String(count)})` }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(AiCommitButton, { anchor: box })
    ] })
  ] });
}
function ErrorBanner({
  error,
  onDismiss
}) {
  if (error === void 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: CLS.error, role: "alert", children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: error }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("button", { type: "button", className: CLS.groupAction, onClick: onDismiss, children: "\u5173\u95ED" })
  ] });
}
function toDiscard({ group, entries }) {
  const paths = entries.map((entry) => entry.path);
  return group === "untracked" ? { tracked: [], untracked: paths } : { tracked: paths, untracked: [] };
}
function RepoView({ api, state, actions, status }) {
  const [pending, setPending] = (0, import_react13.useState)();
  const busy = state.busy !== void 0;
  const listActions = {
    select: (paths, selected) => {
      actions.select(paths, selected);
    },
    stage: (paths) => {
      actions.stage(paths);
    },
    unstage: (paths) => {
      actions.unstage(paths);
    },
    discard: (group, entries) => {
      setPending({ group, entries });
    },
    open: (entry, side) => {
      actions.openDiff({ entry, side });
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ChangesHeader, { status, api, busy, refreshing: state.refreshing, actions }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      ErrorBanner,
      {
        error: state.error,
        onDismiss: () => {
          actions.dismissError();
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(SummaryRow, { status, selected: selectedCount(state) }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: CLS.scroll, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ChangesList, { status, selection: state.selection, busy, actions: listActions }) }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CommitBox, { state, actions }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      DiscardDialog,
      {
        pending,
        onClose: () => {
          setPending(void 0);
        },
        onConfirm: (confirmed) => {
          setPending(void 0);
          actions.discard(toDiscard(confirmed));
        }
      }
    )
  ] });
}
function Loaded({ api, state, actions }) {
  const { answer, diff } = state;
  if (answer === void 0) {
    return state.error === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: CLS.empty, children: "\u52A0\u8F7D\u4E2D\u2026" }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: CLS.error, children: state.error });
  }
  if (!answer.repo) return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: CLS.empty, children: NOT_A_REPO });
  if (diff !== void 0)
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      ChangesDiff,
      {
        api,
        diff,
        onBack: () => {
          actions.openDiff(void 0);
        }
      }
    );
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(RepoView, { api, state, actions, status: answer });
}
function Panel({ cwd, fetch: fetch2 }) {
  const api = (0, import_react13.useMemo)(() => createGitApi(fetch2, cwd), [fetch2, cwd]);
  const { state, actions } = useChanges(api);
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: CLS.panel, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Loaded, { api, state, actions }) });
}
function ChangesPanel({ sessionId, list, fetch: fetch2 }) {
  const cwd = useCwd(list, sessionId);
  if (cwd === void 0 || cwd === "") return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: `${CLS.panel} ${CLS.empty}`, children: NO_DIRECTORY });
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Panel, { cwd, fetch: fetch2 }, cwd);
}

// src/client/changes/changes-title.tsx
var import_jsx_runtime16 = require("react/jsx-runtime");
var CHANGES_TITLE = "\u53D8\u66F4";
var GLYPH_SIZE = 16;
function ChangesTitle() {
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_jsx_runtime16.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(ChangesIcon, { size: GLYPH_SIZE }),
    CHANGES_TITLE
  ] });
}

// src/client/changes/changes-register.ts
var CHANGES_ID = "vyra-agent-cli-manager.changes";
var TAB_SLOT = "sidebar.right.pane.tab";
var TITLE_SLOT = "sidebar.right.pane.tab.title";
var TITLE = CHANGES_TITLE;
var DESCRIPTION = "\u67E5\u770B\u3001\u6682\u5B58\u5E76\u63D0\u4EA4\u5DE5\u4F5C\u533A\u7684 Git \u53D8\u66F4";
var GUIDE_ORDER = 70;
function registerChanges(ctx, list, fetchFn) {
  ctx.inject(["sidebarRightTabs", "slots"], (child) => {
    child.effect(
      () => child.sidebarRightTabs.register({
        id: CHANGES_ID,
        kind: CHANGES_KIND,
        title: () => TITLE,
        guide: [{ id: "open", order: GUIDE_ORDER, title: () => TITLE, description: () => DESCRIPTION }]
      }),
      "vyra-agent-cli-manager: changes tab type"
    );
    child.slots.inject(
      TAB_SLOT,
      () => child.slots.register(
        { name: TAB_SLOT, key: CHANGES_ID, inject: (sessionId) => ({ sessionId, list, fetch: fetchFn }) },
        ChangesPanel
      )
    );
    child.slots.inject(TITLE_SLOT, () => child.slots.register({ name: TITLE_SLOT, key: CHANGES_ID }, ChangesTitle));
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
var import_react16 = require("react");
var import_dsh_client_ui_primitives12 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/launch-script-dialog.tsx
var import_dsh_client_ui_primitives11 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/launch-script-form.tsx
var import_react14 = require("react");
var import_dsh_client_ui_primitives9 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime17 = require("react/jsx-runtime");
var NAME_LABEL = "\u540D\u79F0";
var NAME_PLACEHOLDER = "\u4F8B\u5982\uFF1A\u5F00\u53D1\u670D\u52A1\u5668\uFF08\u53EF\u7559\u7A7A\uFF09";
var COMMAND_LABEL = "\u547D\u4EE4";
var COMMAND_PLACEHOLDER = "npm run dev";
var COMMAND_HINT = "\u5728\u4F1A\u8BDD\u7684\u5DE5\u4F5C\u76EE\u5F55\u4E0B\u6267\u884C\u3002\u591A\u884C\u547D\u4EE4\u4F1A\u9010\u884C\u6267\u884C\u3002\u2318/Ctrl + Enter \u4FDD\u5B58\u3002";
function useScriptForm(initial) {
  const [draft, setDraft] = (0, import_react14.useState)(initial);
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
  const commandId = (0, import_react14.useId)();
  const hintId = (0, import_react14.useId)();
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: LS.field, children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("label", { className: LS.label, htmlFor: commandId, children: COMMAND_LABEL }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { id: hintId, className: LS.hint, children: COMMAND_HINT })
  ] });
}
function LaunchScriptForm(props) {
  const { form, error, onSubmit } = props;
  const nameId = (0, import_react14.useId)();
  const submitOnShortcut = (event) => {
    if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey) || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onSubmit();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: LS.form, onKeyDown: submitOnShortcut, children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: LS.field, children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("label", { className: LS.label, htmlFor: nameId, children: NAME_LABEL }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
        import_dsh_client_ui_primitives9.Input,
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
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(CommandField, { command: form.draft.command, onChange: form.setCommand }),
    error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { role: "alert", className: LS.error, children: error })
  ] });
}

// src/client/launch-script-list.tsx
var import_react15 = require("react");
var import_dsh_client_ui_primitives10 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime18 = require("react/jsx-runtime");
var DEFAULT_BADGE2 = "\u9ED8\u8BA4";
var RUN = "\u8FD0\u884C";
var EDIT = "\u7F16\u8F91";
var MAKE_DEFAULT = "\u8BBE\u4E3A\u9ED8\u8BA4";
var DELETE = "\u5220\u9664";
var CONFIRM_DELETE = "\u518D\u70B9\u4E00\u6B21\u5220\u9664";
var EMPTY_TEXT = "\u8FD8\u6CA1\u6709\u542F\u52A8\u811A\u672C\u3002\u6DFB\u52A0\u4E00\u6761\u5E38\u7528\u547D\u4EE4\uFF0C\u4F8B\u5982\u542F\u52A8\u5F00\u53D1\u670D\u52A1\u5668\uFF0C\u4E4B\u540E\u5728\u6807\u9898\u680F\u4E00\u952E\u8FD0\u884C\u3002";
var TOOLTIP_DELAY_MS2 = 500;
function RowButton(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_dsh_client_ui_primitives10.Tooltip, { label: props.label, side: "top", delayMs: TOOLTIP_DELAY_MS2, children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
    import_dsh_client_ui_primitives10.Button,
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
function RowActions2(props) {
  const { script, first, actions, confirming, onConfirm } = props;
  const label = scriptLabel(script);
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: LS.rowActions, children: [
    first ? null : /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
      import_dsh_client_ui_primitives10.Button,
      {
        size: "sm",
        onClick: () => {
          actions.onPromote(script);
        },
        children: MAKE_DEFAULT
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(RowButton, { label: `${RUN} ${label}`, onClick: () => actions.onRun(script), children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_dsh_client_ui_primitives10.IconPlayOutlineRegular, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(RowButton, { label: `${EDIT} ${label}`, onClick: () => actions.onEdit(script), children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_dsh_client_ui_primitives10.IconEditOutlineRegular, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
      RowButton,
      {
        label: confirming ? CONFIRM_DELETE : `${DELETE} ${label}`,
        danger: confirming,
        onClick: () => {
          if (confirming) actions.onRemove(script);
          else onConfirm();
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_dsh_client_ui_primitives10.IconTrashOutlineRegular, {})
      }
    )
  ] });
}
function ScriptRow(props) {
  const { script, first } = props;
  const [confirming, setConfirming] = (0, import_react15.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(
    "li",
    {
      className: LS.row,
      onMouseLeave: () => {
        setConfirming(false);
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: LS.rowText, children: [
          /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("span", { className: LS.rowName, children: [
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { children: scriptLabel(script) }),
            first ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: LS.badge, children: DEFAULT_BADGE2 }) : null
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: LS.rowCommand, title: script.command, children: script.command })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          RowActions2,
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
  if (props.scripts.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("p", { className: LS.empty, children: EMPTY_TEXT });
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("ul", { className: LS.list, children: props.scripts.map((script, index) => /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ScriptRow, { script, first: index === 0, actions: props.actions }, script.id)) });
}

// src/client/launch-script-dialog.tsx
var import_jsx_runtime19 = require("react/jsx-runtime");
var TITLE2 = "\u542F\u52A8\u811A\u672C";
var ADD_TITLE = "\u6DFB\u52A0\u542F\u52A8\u811A\u672C";
var EDIT_TITLE = "\u7F16\u8F91\u542F\u52A8\u811A\u672C";
var DESCRIPTION2 = "\u4FDD\u5B58\u5728\u5F53\u524D\u5DE5\u4F5C\u76EE\u5F55\u4E0B\uFF0C\u6240\u6709\u4F1A\u8BDD\u5171\u7528\u3002\u6BCF\u4E2A\u811A\u672C\u5728\u72EC\u7ACB\u7684\u7EC8\u7AEF\u6807\u7B7E\u91CC\u8FD0\u884C\uFF0C\u518D\u6B21\u8FD0\u884C\u4F1A\u5148\u7ED3\u675F\u4E0A\u4E00\u6B21\u3002";
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
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
    import_dsh_client_ui_primitives11.Modal,
    {
      open: true,
      title: draft.id === void 0 ? ADD_TITLE : EDIT_TITLE,
      closeLabel: CLOSE,
      className: LS.dialog,
      onClose,
      footer: /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: LS.footer, children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_dsh_client_ui_primitives11.Button, { variant: "ghost", onClick: backToList ? () => onPage(LIST_PAGE) : onClose, children: backToList ? BACK : CANCEL }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_dsh_client_ui_primitives11.Button, { variant: "primary", disabled: form.problem !== void 0, onClick: submit, children: SAVE })
      ] }),
      children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(LaunchScriptForm, { form, error: shown, onSubmit: submit })
    }
  );
}
function ListPage(props) {
  const { scripts, error, onPage, onChange, onRun, onClose } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(
    import_dsh_client_ui_primitives11.Modal,
    {
      open: true,
      title: TITLE2,
      description: DESCRIPTION2,
      closeLabel: CLOSE,
      className: LS.dialog,
      onClose,
      footer: /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: LS.footer, children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          import_dsh_client_ui_primitives11.Button,
          {
            "data-leading": "",
            variant: "outline",
            icon: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_dsh_client_ui_primitives11.IconPlusOutlineRegular, { size: 14 }),
            onClick: () => onPage(NEW_SCRIPT_PAGE),
            children: ADD
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_dsh_client_ui_primitives11.Button, { variant: "primary", onClick: onClose, children: DONE })
      ] }),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
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
        error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { role: "alert", className: LS.error, children: error })
      ]
    }
  );
}
function LaunchScriptDialog(props) {
  const { page } = props;
  if (page.kind === "list") return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(ListPage, { ...props });
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(FormPage, { ...props, draft: page.draft }, page.draft.id ?? "new");
}

// src/client/launch-script-entry.tsx
var import_jsx_runtime20 = require("react/jsx-runtime");
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
  const subscribeList = (0, import_react16.useCallback)((listener) => list.subscribe(listener), [list]);
  const cwd = (0, import_react16.useSyncExternalStore)(subscribeList, () => list.getSnapshot().byId[sessionId]?.cwd);
  const subscribeBook = (0, import_react16.useCallback)((listener) => book.subscribe(listener), [book]);
  const scripts = (0, import_react16.useSyncExternalStore)(subscribeBook, () => book.read(cwd));
  return { cwd, scripts };
}
function MenuRow({ script }) {
  const label = scriptLabel(script);
  const command = script.command.trim();
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("span", { className: LS.menuRow, children: [
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: LS.menuName, children: label }),
    command === label ? null : /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: LS.menuCommand, children: command })
  ] });
}
function menuItems(scripts) {
  return [
    ...scripts.map((script) => ({
      id: script.id,
      label: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(MenuRow, { script }),
      icon: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_dsh_client_ui_primitives12.IconPlayOutlineRegular, { size: 14 })
    })),
    { id: MANAGE_ID, label: MANAGE, icon: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_dsh_client_ui_primitives12.IconSettingsOutlineRegular, { size: 14 }) }
  ];
}
function useLaunchActions({ sessionId, list, book, runner }) {
  const { cwd, scripts } = useWorkspaceScripts(list, book, sessionId);
  const [page, setPage] = (0, import_react16.useState)();
  const [toast, setToast] = (0, import_react16.useState)();
  const [saveError, setSaveError] = (0, import_react16.useState)();
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
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_dsh_client_ui_primitives12.Tooltip, { label, side: "bottom", delayMs: TOOLTIP_DELAY_MS3, children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
    import_dsh_client_ui_primitives12.Button,
    {
      size: "sm",
      className: LS.run,
      "aria-label": label,
      "data-has-more": props.primary === void 0 ? void 0 : "",
      onClick: props.onClick,
      children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_dsh_client_ui_primitives12.IconPlayOutlineRegular, {})
    }
  ) });
}
function ScriptMenu(props) {
  const [open, setOpen] = (0, import_react16.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
    import_dsh_client_ui_primitives12.Menu,
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
      anchor: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        import_dsh_client_ui_primitives12.Button,
        {
          size: "sm",
          className: LS.more,
          "aria-label": MORE,
          "aria-haspopup": "menu",
          "aria-expanded": open,
          onClick: () => {
            setOpen((value) => !value);
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_dsh_client_ui_primitives12.IconChevronDownOutlineRegular, {})
        }
      )
    }
  );
}
function LaunchScriptEntry(props) {
  const { scripts, page, toast, saveError, openPage, run, change, clearToast } = useLaunchActions(props);
  const [anchor, setAnchor] = (0, import_react16.useState)(null);
  const primary = scripts[0];
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: LS.group, ref: setAnchor, children: [
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
      RunButton,
      {
        primary,
        onClick: () => {
          if (primary === void 0) openPage(NEW_SCRIPT_PAGE);
          else run(primary);
        }
      }
    ),
    primary === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(ScriptMenu, { scripts, onRun: run, onManage: () => openPage(LIST_PAGE) }),
    page === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
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
    toast === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_dsh_client_ui_primitives12.Toast, { text: toast, anchor, onDone: clearToast })
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
var TITLE3 = "[data-dockkit-tab-title]";
var CLOSE2 = "[data-dockkit-tab-close]";
var SIDEBAR_TITLE = `${TITLE3} > [data-sidebar-right-tab]`;
var TIP_ATTR = "data-vyra-agent-cli-manager-tab-tip";
var CLOSE_ROOM_PX = 28;
var GLYPH_PX = 16;
var TIP_GAP_PX = 8;
var TIP_MARGIN_PX = 12;
var SIDEBAR_CHIP = `${CHIP}:has(> ${SIDEBAR_TITLE})`;
var ICON_CHIP = `${SIDEBAR_CHIP}:has(${TITLE3} :is(svg, img)):not(:has(${TITLE3} input))`;
var COMPACT_TABS_STYLES = `
${SIDEBAR_CHIP} { min-width: 0; max-width: 128px; padding: 0 8px; }
${ICON_CHIP} { flex: none; max-width: none; padding: 0 6px; }
${ICON_CHIP}[aria-selected="true"]:has(${CLOSE2}) { padding-right: ${String(CLOSE_ROOM_PX)}px; }
${ICON_CHIP} > ${TITLE3} {
  flex: none;
  width: ${String(GLYPH_PX)}px;
  overflow: hidden;
  white-space: nowrap;
  mask-image: none;
}
${ICON_CHIP} > ${TITLE3} :is(svg, img) { flex: none; }
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
    const name = chip.querySelector(TITLE3)?.textContent.trim() ?? "";
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
var import_dsh_client_ui_primitives15 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/cli-prefs-section.tsx
var import_dsh_client_ui_primitives13 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime21 = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: `${SECTION_CLASS}-moves`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
      import_dsh_client_ui_primitives13.Button,
      {
        size: "sm",
        "aria-label": `\u4E0A\u79FB ${entry.label}`,
        disabled: first,
        icon: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_dsh_client_ui_primitives13.IconChevronUpOutlineRegular, { size: ARROW_SIZE }),
        onClick: () => {
          prefs.move(entry.id, -1);
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
      import_dsh_client_ui_primitives13.Button,
      {
        size: "sm",
        "aria-label": `\u4E0B\u79FB ${entry.label}`,
        disabled: last,
        icon: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_dsh_client_ui_primitives13.IconChevronDownOutlineRegular, { size: ARROW_SIZE }),
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
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("li", { className: `${SECTION_CLASS}-row`, "aria-label": entry.label, children: [
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: `${SECTION_CLASS}-name`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(ProviderMark, { provider: entry.id, size: MARK_SIZE2 }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { children: entry.label }),
      entry.enabled ? null : /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: `${SECTION_CLASS}-off`, role: "status", children: OFF_HINT })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MoveButtons, { entry, first, last, prefs }),
    locked ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: `${SECTION_CLASS}-locked`, children: LOCKED_HINT }) : /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
      import_dsh_client_ui_primitives13.Switch,
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
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("section", { className: SECTION_CLASS, children: [
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("p", { className: "vyra-agent-cli-manager-settings-intro", children: entries.length === 0 ? EMPTY_HINT : SECTION_INTRO }),
    entries.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("ul", { className: "vyra-agent-cli-manager-settings-list", children: entries.map((entry, index) => /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
      CliRow,
      {
        entry,
        first: index === 0,
        last: index === entries.length - 1,
        prefs
      },
      entry.id
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("p", { className: `${SECTION_CLASS}-more`, children: MORE_CLIS_HINT })
  ] });
}

// src/client/cli-status-section.tsx
var import_react17 = require("react");

// src/client/cli-asset-panels.tsx
var import_jsx_runtime22 = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("p", { className: `${CLASS}-meta`, children: text });
}
function Problem({ text }) {
  return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("p", { className: `${CLASS}-error`, children: text });
}
function SkillsPanel({ state }) {
  if (state === void 0) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Note, { text: LABELS.skillsLoading });
  if (state.error !== void 0) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Problem, { text: `${LABELS.skillsFailed}\uFF1A${state.error}` });
  const from = `${LABELS.skillsFrom}${state.directories.join("\u3001")}`;
  if (state.skills.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(import_jsx_runtime22.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Note, { text: from }),
      /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Note, { text: LABELS.skillsEmpty })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(import_jsx_runtime22.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Note, { text: from }),
    /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: `${CLASS}-mcp-row`, children: state.skills.map((skill) => /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("span", { className: skill.loadable ? `${CLASS}-mcp-name` : void 0, children: skill.loadable ? skill.name : `${skill.name}${LABELS.skillsBlocked}` }, skill.name)) })
  ] });
}
function PromptPanel({ state }) {
  if (state === void 0) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Note, { text: LABELS.promptLoading });
  if (state.error !== void 0) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Problem, { text: `${LABELS.promptFailed}\uFF1A${state.error}` });
  if (state.text === "") {
    return /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(import_jsx_runtime22.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Note, { text: `${LABELS.promptFrom}${state.path}` }),
      /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Note, { text: LABELS.promptEmpty })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(import_jsx_runtime22.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(Note, { text: `${LABELS.promptFrom}${state.path}\uFF08${String(state.text.length)} \u5B57\uFF09` }),
    /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("pre", { className: `${CLASS}-raw`, children: state.text })
  ] });
}

// src/client/cli-api.ts
var MCP_MATRIX_URL = "/vyra-agent-cli-manager/cli/mcp-matrix";
var MCP_ADD_URL = "/vyra-agent-cli-manager/cli/mcp-add";
var MCP_COPY_URL = "/vyra-agent-cli-manager/cli/mcp-copy";
var MCP_REMOVE_URL = "/vyra-agent-cli-manager/cli/mcp-remove";
var SKILLS_URL = "/vyra-agent-cli-manager/cli/skills";
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
var import_jsx_runtime23 = require("react/jsx-runtime");
var STATUS_URL = "/vyra-agent-cli-manager/cli/status";
var UPGRADE_URL = "/vyra-agent-cli-manager/cli/upgrade";
var SECTION_CLASS2 = "vyra-agent-cli-manager-clis";
var LABELS2 = {
  intro: "\u8FD9\u91CC\u5217\u51FA\u672C\u63D2\u4EF6\u63A5\u5165\u7684 Agent CLI\u3002\u7248\u672C\u7531 Host \u5728\u672C\u673A\u63A2\u6D4B\uFF0C\u6700\u65B0\u7248\u67E5\u81EA npm\uFF1B\u5347\u7EA7\u4EA4\u7ED9\u5404 CLI \u81EA\u5DF1\u7684\u66F4\u65B0\u547D\u4EE4\uFF0C\u672C\u63D2\u4EF6\u4E0D\u731C\u5B83\u7684\u5B89\u88C5\u65B9\u5F0F\u3002",
  loading: "\u6B63\u5728\u8BFB\u53D6\u2026",
  empty: "\u6CA1\u6709\u53EF\u663E\u793A\u7684 CLI\u3002",
  missing: "\u672A\u5B89\u88C5",
  outdated: "\u6709\u65B0\u7248\u672C",
  current: "\u5DF2\u662F\u6700\u65B0",
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
.${SECTION_CLASS2} { display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; max-width: 720px; color: var(--dsw-alias-label-primary); }
.${SECTION_CLASS2}-intro { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.${SECTION_CLASS2}-list { margin: 0; padding: 0; list-style: none; }
.${SECTION_CLASS2}-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; }
.${SECTION_CLASS2}-row + .${SECTION_CLASS2}-row { border-top: 0.5px solid var(--dsw-alias-border-l2); }
.${SECTION_CLASS2}-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.${SECTION_CLASS2}-name { font-size: 13px; font-weight: 500; line-height: 20px; }
.${SECTION_CLASS2}-vendor { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.${SECTION_CLASS2}-meta { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.${SECTION_CLASS2}-badge { display: inline-flex; align-items: center; height: 20px; padding: 0 6px; border-radius: 6px; font-size: 11px; line-height: 18px; }
.${SECTION_CLASS2}-badge[data-tone="ok"] { background: var(--dsw-alias-state-success-secondary, rgba(45, 164, 78, 0.16)); color: var(--dsw-alias-state-success-primary, #2da44e); }
.${SECTION_CLASS2}-badge[data-tone="warn"] { background: var(--dsw-alias-state-warning-secondary, rgba(229, 160, 58, 0.16)); color: var(--dsw-alias-state-warning-primary, #e5a03a); }
.${SECTION_CLASS2}-badge[data-tone="muted"] { background: var(--dsw-alias-bg-secondary, rgba(127, 127, 127, 0.12)); color: var(--dsw-alias-label-secondary); }
.${SECTION_CLASS2}-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
.${SECTION_CLASS2}-button { height: 28px; padding: 0 12px; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; cursor: pointer; }
.${SECTION_CLASS2}-button:hover:not(:disabled) { border-color: var(--dsw-alias-border-l3, var(--dsw-alias-border-l2)); background: var(--dsw-alias-interactive-bg-hover); }
.${SECTION_CLASS2}-button:disabled { color: var(--dsw-alias-label-secondary); cursor: default; }
.${SECTION_CLASS2}-button[aria-expanded="true"] { border-color: var(--dsw-alias-border-l3, var(--dsw-alias-border-l2)); }
.${SECTION_CLASS2}-error { margin: 0; color: var(--dsw-alias-state-error-primary, #d1383d); font-size: 12px; line-height: 18px; }
.${SECTION_CLASS2}-fold { margin: 6px 0 0; padding: 8px 0 0; border-top: 0.5px dashed var(--dsw-alias-border-l2); display: flex; flex-direction: column; gap: 2px; }
.${SECTION_CLASS2}-mcp-row { display: flex; gap: 8px; flex-wrap: wrap; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.${SECTION_CLASS2}-mcp-name { color: var(--dsw-alias-label-primary); }
.${SECTION_CLASS2}-raw { margin: 6px 0 0; padding: 8px; max-height: 220px; overflow: auto; border-radius: 8px; background: var(--dsw-alias-bg-secondary, rgba(127, 127, 127, 0.08)); color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px; white-space: pre-wrap; word-break: break-all; }
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
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: `${SECTION_CLASS2}-badge`, "data-tone": tone, children: text });
}
function RowFacts({ row }) {
  if (!row.installed) {
    return /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: `${SECTION_CLASS2}-meta`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Badge, { tone: "muted", text: LABELS2.missing }),
      row.latestVersion === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("span", { children: [
        " ",
        LABELS2.latest,
        " ",
        row.latestVersion
      ] })
    ] });
  }
  const version = row.version ?? LABELS2.unknown;
  const state = row.updateAvailable === true ? /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Badge, { tone: "warn", text: LABELS2.outdated }) : /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Badge, { tone: "ok", text: LABELS2.current });
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: `${SECTION_CLASS2}-meta`, children: [
    state,
    /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("span", { children: [
      " ",
      LABELS2.local,
      " ",
      version,
      row.latestVersion === void 0 ? "" : ` \xB7 ${LABELS2.latest} ${row.latestVersion}`
    ] })
  ] });
}
function RowActions3({
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
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: `${SECTION_CLASS2}-actions`, children: [
    row.installed && row.updateAvailable === true ? /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
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
    folds.map((fold) => /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
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
  if (kind === "skills") return /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(SkillsPanel, { state: data.skills });
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(PromptPanel, { state: data.prompt });
}
function Row({
  row,
  busy,
  fold,
  onUpgrade,
  onToggle
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("li", { className: `${SECTION_CLASS2}-row`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: `${SECTION_CLASS2}-head`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: `${SECTION_CLASS2}-name`, children: row.name }),
        row.vendor === row.name ? null : /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: `${SECTION_CLASS2}-vendor`, children: row.vendor }),
        row.verified ? null : /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Badge, { tone: "muted", text: LABELS2.unverified })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(RowFacts, { row }),
      fold === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { className: `${SECTION_CLASS2}-fold`, children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(FoldBody, { kind: fold.kind, data: fold.data }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(RowActions3, { row, busy, openKind: fold?.kind, onUpgrade, onToggle })
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
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(import_jsx_runtime23.Fragment, { children: [
    loading && rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("p", { className: quiet, children: LABELS2.loading }) : null,
    error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("p", { className: `${SECTION_CLASS2}-error`, children: error }),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("button", { type: "button", className: `${SECTION_CLASS2}-button`, onClick: onRetry, children: LABELS2.retry })
    ] }),
    upgradeError === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("p", { className: `${SECTION_CLASS2}-error`, children: upgradeError }),
    error === void 0 && !loading && rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("p", { className: quiet, children: LABELS2.empty }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("ul", { className: `${SECTION_CLASS2}-list`, children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
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
  const [fold, setFold] = (0, import_react17.useState)(void 0);
  const load = (0, import_react17.useCallback)((id, kind) => {
    const key = `${id}:${kind}`;
    const keep = (data) => {
      setFold((current) => current?.key === key ? { key, data } : current);
    };
    void readFold(kind, id).then(keep).catch((error) => {
      keep(dataOfFailure(kind, error instanceof Error ? error.message : String(error)));
    });
  }, []);
  const toggle = (0, import_react17.useCallback)(
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
  const foldOf = (0, import_react17.useCallback)(
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
  const [busyId, setBusyId] = (0, import_react17.useState)(void 0);
  const [error, setError] = (0, import_react17.useState)(void 0);
  const upgrade = (0, import_react17.useCallback)(
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
  const [state, setState] = (0, import_react17.useState)({ rows: [], error: void 0, loading: true });
  const folds = useFold();
  const load = (0, import_react17.useCallback)(async () => {
    setState((previous) => ({ ...previous, loading: true }));
    try {
      setState({ rows: await fetchStatuses(), error: void 0, loading: false });
    } catch (error) {
      setState({ rows: [], error: error instanceof Error ? error.message : String(error), loading: false });
    }
  }, []);
  (0, import_react17.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: SECTION_CLASS2, children: [
    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("p", { className: `${SECTION_CLASS2}-intro`, children: LABELS2.intro }),
    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
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
var import_react19 = require("react");

// src/client/cli-mcp-add.tsx
var import_react18 = require("react");

// src/client/mcp-tab-styles.ts
var MCP_TAB_CLASS = "vyra-agent-cli-manager-mcp";
var MCP_TAB_STYLES = `
.${MCP_TAB_CLASS} { display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; max-width: 720px; color: var(--dsw-alias-label-primary); }
.${MCP_TAB_CLASS}-intro { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.${MCP_TAB_CLASS}-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.${MCP_TAB_CLASS}-input { height: 28px; padding: 0 8px; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; box-sizing: border-box; }
.${MCP_TAB_CLASS}-count { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.${MCP_TAB_CLASS}-table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
.${MCP_TAB_CLASS}-table th { padding: 6px 4px; border-bottom: 0.5px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); font-weight: 500; text-align: left; font-size: 11px; }
.${MCP_TAB_CLASS}-table td { padding: 6px 4px; border-bottom: 0.5px solid var(--dsw-alias-border-l2); vertical-align: top; }
.${MCP_TAB_CLASS}-table th:first-child, .${MCP_TAB_CLASS}-table td:first-child { width: auto; }
.${MCP_TAB_CLASS}-table th:not(:first-child), .${MCP_TAB_CLASS}-table td:not(:first-child) { width: 44px; }
.${MCP_TAB_CLASS}-cell { text-align: center; }
.${MCP_TAB_CLASS}-name { display: block; color: var(--dsw-alias-label-primary); font-size: 12px; line-height: 18px; }
.${MCP_TAB_CLASS}-detail { display: block; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px; word-break: break-all; }
.${MCP_TAB_CLASS}-check { cursor: pointer; }
.${MCP_TAB_CLASS}-check:disabled { cursor: default; opacity: 0.45; }
.${MCP_TAB_CLASS}-error { margin: 0; color: var(--dsw-alias-state-error-primary, #d1383d); font-size: 12px; line-height: 18px; }
.${MCP_TAB_CLASS}-form { display: flex; flex-direction: column; gap: 8px; padding: 10px 0 0; border-top: 0.5px dashed var(--dsw-alias-border-l2); }
.${MCP_TAB_CLASS}-button { height: 28px; padding: 0 12px; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; cursor: pointer; }
.${MCP_TAB_CLASS}-button:disabled { color: var(--dsw-alias-label-secondary); cursor: default; }
`;

// src/client/cli-mcp-add.tsx
var import_jsx_runtime24 = require("react/jsx-runtime");
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
  const [name, setName] = (0, import_react18.useState)("");
  const [targetId, setTargetId] = (0, import_react18.useState)(defaultTargetId);
  const [transport, setTransport] = (0, import_react18.useState)("stdio");
  const [value, setValue] = (0, import_react18.useState)("");
  const [env, setEnv] = (0, import_react18.useState)("");
  return { name, setName, targetId, setTargetId, transport, setTransport, value, setValue, env, setEnv };
}
function envPairsOf(text) {
  return text.split("\n").map((line) => line.trim()).filter((line) => line !== "");
}
function useSubmit(fields, onDone) {
  const [busy, setBusy] = (0, import_react18.useState)(false);
  const [problem, setProblem] = (0, import_react18.useState)(void 0);
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
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(import_jsx_runtime24.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { children: LABELS3.target }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
      "select",
      {
        className: `${MCP_TAB_CLASS}-input`,
        value: form.targetId,
        onChange: (event) => {
          form.setTargetId(event.target.value);
        },
        children: targets.map((target) => /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("option", { value: target.id, children: target.name }, target.id))
      }
    )
  ] });
}
function NameRow({
  form,
  targets
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: `${MCP_TAB_CLASS}-bar`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { children: LABELS3.name }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(TargetSelect, { form, targets })
  ] });
}
function ValueRow({ form }) {
  const remote = form.transport === "http";
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: `${MCP_TAB_CLASS}-bar`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { children: LABELS3.transport }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(
      "select",
      {
        className: `${MCP_TAB_CLASS}-input`,
        value: form.transport,
        onChange: (event) => {
          form.setTransport(event.target.value === "http" ? "http" : "stdio");
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("option", { value: "stdio", children: "stdio" }),
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("option", { value: "http", children: "http" })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { children: remote ? LABELS3.url : LABELS3.command }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
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
  if (targets.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("p", { className: `${MCP_TAB_CLASS}-count`, children: LABELS3.noTarget });
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: `${MCP_TAB_CLASS}-form`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(NameRow, { form, targets }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(ValueRow, { form }),
    form.transport === "http" ? null : /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: `${MCP_TAB_CLASS}-bar`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { children: LABELS3.env }),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("div", { className: `${MCP_TAB_CLASS}-bar`, children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("button", { type: "button", className: `${MCP_TAB_CLASS}-button`, disabled: form.busy, onClick: form.submit, children: form.busy ? LABELS3.adding : LABELS3.add }) }),
    form.problem === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("p", { className: `${MCP_TAB_CLASS}-error`, children: form.problem })
  ] });
}

// src/client/cli-mcp-table.tsx
var import_jsx_runtime25 = require("react/jsx-runtime");
function shortNameOf(name) {
  return name.split(" ")[0] ?? name;
}
function CellView({
  cell,
  label,
  onToggle
}) {
  const reason = cell.blocked ?? (cell.state === "unknown" ? "\u8FD9\u4E00\u5217\u8BFB\u4E0D\u51FA\u6765" : void 0);
  return /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
    "input",
    {
      type: "checkbox",
      className: `${MCP_TAB_CLASS}-check`,
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
  busy,
  onToggle
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)("tr", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)("td", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("span", { className: `${MCP_TAB_CLASS}-name`, children: row.name }),
      /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)("span", { className: `${MCP_TAB_CLASS}-detail`, children: [
        row.transport,
        " \xB7 ",
        row.detail
      ] })
    ] }),
    row.cells.map((cell) => /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("td", { className: `${MCP_TAB_CLASS}-cell`, children: /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
      CellView,
      {
        cell,
        label: `${row.name} \u5728 ${columns.find((column) => column.id === cell.id)?.name ?? cell.id}`,
        onToggle: () => {
          if (!busy) onToggle(cell, row);
        }
      }
    ) }, cell.id))
  ] });
}
function MatrixTable({
  columns,
  rows,
  busy,
  onToggle
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)("table", { className: `${MCP_TAB_CLASS}-table`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)("tr", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("th", { children: "\u540D\u79F0" }),
      columns.map((column) => /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("th", { className: `${MCP_TAB_CLASS}-cell`, title: column.problem ?? column.name, children: shortNameOf(column.name) }, column.id))
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("tbody", { children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(RowView, { row, columns, busy, onToggle }, row.name)) })
  ] });
}

// src/client/cli-mcp-tab.tsx
var import_jsx_runtime26 = require("react/jsx-runtime");
var LABELS4 = {
  intro: "\u8FD9\u91CC\u628A\u6BCF\u4E2A CLI \u81EA\u5DF1\u914D\u7F6E\u91CC\u7684 MCP \u6C47\u603B\u6210\u4E00\u5F20\u8868\uFF1A\u52FE\u4E0A\u5373\u5728\u90A3\u4E2A CLI \u91CC\u6DFB\u52A0\uFF0C\u53D6\u6D88\u5373\u5728\u90A3\u4E2A CLI \u91CC\u5220\u9664\u3002\u63D2\u4EF6\u4E0D\u5B58\u526F\u672C\uFF0C\u6240\u4EE5\u4E0D\u5B58\u5728\u300C\u6539\u5E94\u7528\u914D\u7F6E\u4F1A\u88AB\u8986\u76D6\u300D\u7684\u95EE\u9898\uFF1B\u7070\u6389\u7684\u683C\u5B50\u5199\u7740\u4E3A\u4EC0\u4E48\u6539\u4E0D\u4E86\u3002",
  search: "\u641C\u7D22\u540D\u79F0\u3001\u547D\u4EE4\u6216\u5730\u5740",
  loading: "\u6B63\u5728\u8BFB\u53D6\u5404 CLI \u7684\u914D\u7F6E\u2026",
  empty: "\u6CA1\u6709\u5339\u914D\u7684 MCP \u670D\u52A1\u5668\u3002",
  none: "\u6CA1\u6709\u4EFB\u4F55 CLI \u914D\u7F6E MCP \u670D\u52A1\u5668\u3002",
  refresh: "\u91CD\u65B0\u8BFB\u53D6",
  count: (shown, total, columns) => `${String(total)} \u4E2A MCP \xB7 \u5339\u914D ${String(shown)} \xB7 ${String(columns)} \u4E2A CLI`,
  failed: "\u64CD\u4F5C\u5931\u8D25",
  noSource: "\u8FD9\u4E00\u884C\u6CA1\u6709\u4EFB\u4F55 CLI \u6301\u6709\u5B83\uFF0C\u65E0\u6CD5\u590D\u5236"
};
function useMatrix() {
  const [query, setQuery] = (0, import_react19.useState)({
    columns: [],
    rows: [],
    loading: true,
    busy: false,
    error: void 0
  });
  const load = (0, import_react19.useCallback)(async () => {
    setQuery((previous) => ({ ...previous, loading: true }));
    try {
      const { columns, rows } = await fetchMcpMatrix();
      setQuery({ columns, rows, loading: false, busy: false, error: void 0 });
    } catch (error) {
      const message2 = error instanceof Error ? error.message : String(error);
      setQuery({ columns: [], rows: [], loading: false, busy: false, error: message2 });
    }
  }, []);
  (0, import_react19.useEffect)(() => {
    void load();
  }, [load]);
  const toggle = (0, import_react19.useCallback)(
    (cell, row) => {
      const source = row.cells.find((candidate) => candidate.state === "on");
      setQuery((previous) => ({ ...previous, busy: true, error: void 0 }));
      const change = cell.state === "on" ? removeMcp(cell.id, row.name) : source === void 0 ? Promise.reject(new Error(LABELS4.noSource)) : copyMcp(source.id, cell.id, row.name);
      void change.then(() => load()).catch((error) => {
        const message2 = error instanceof Error ? error.message : String(error);
        setQuery((previous) => ({ ...previous, busy: false, error: `${LABELS4.failed}\uFF1A${message2}` }));
      });
    },
    [load]
  );
  return { ...query, reload: () => void load(), toggle };
}
function filterRows(rows, text) {
  const needle = text.trim().toLowerCase();
  if (needle === "") return rows;
  return rows.filter((row) => row.name.toLowerCase().includes(needle) || row.detail.toLowerCase().includes(needle));
}
function McpTab() {
  const matrix = useMatrix();
  const [query, setQuery] = (0, import_react19.useState)("");
  const rows = filterRows(matrix.rows, query);
  const targets = matrix.columns.filter((column) => column.readable);
  return /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: MCP_TAB_CLASS, children: [
    /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("p", { className: `${MCP_TAB_CLASS}-intro`, children: LABELS4.intro }),
    /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: `${MCP_TAB_CLASS}-bar`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
        "input",
        {
          className: `${MCP_TAB_CLASS}-input`,
          value: query,
          placeholder: LABELS4.search,
          onChange: (event) => {
            setQuery(event.target.value);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("span", { className: `${MCP_TAB_CLASS}-count`, children: LABELS4.count(rows.length, matrix.rows.length, matrix.columns.length) }),
      /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("button", { type: "button", className: `${MCP_TAB_CLASS}-button`, onClick: matrix.reload, children: LABELS4.refresh })
    ] }),
    matrix.error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("p", { className: `${MCP_TAB_CLASS}-error`, children: matrix.error }),
    matrix.loading ? /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("p", { className: `${MCP_TAB_CLASS}-intro`, children: LABELS4.loading }) : null,
    !matrix.loading && matrix.rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("p", { className: `${MCP_TAB_CLASS}-intro`, children: LABELS4.none }) : null,
    rows.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(MatrixTable, { columns: matrix.columns, rows, busy: matrix.busy, onToggle: matrix.toggle }),
    !matrix.loading && matrix.rows.length > 0 && rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("p", { className: `${MCP_TAB_CLASS}-intro`, children: LABELS4.empty }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(AddServer, { targets, onDone: matrix.reload }),
    /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("p", { className: `${MCP_TAB_CLASS}-count`, children: [
      "\u5217\uFF1A",
      matrix.columns.map((column) => shortNameOf(column.name)).join(" \xB7 ")
    ] })
  ] });
}

// src/client/features-section.tsx
var import_dsh_client_ui_primitives14 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime27 = require("react/jsx-runtime");
var FEATURES_INTRO = "Agent CLI Manager \u5728 DeepSeek Harness \u4E0A\u52A0\u5165\u7684\u4EA4\u4E92\u3002\u5173\u95ED\u67D0\u4E00\u9879\u5373\u6062\u590D\u539F\u6765\u7684\u4EA4\u4E92\uFF0C\u7ACB\u5373\u751F\u6548\u3002";
var PAGE_CLASS = "vyra-agent-cli-manager-settings";
function FeatureRow({
  feature,
  enabled,
  settings
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("li", { className: `${PAGE_CLASS}-row`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("div", { className: `${PAGE_CLASS}-title`, children: feature.title }),
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("div", { className: `${PAGE_CLASS}-desc`, children: feature.description })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
      import_dsh_client_ui_primitives14.Switch,
      {
        checked: enabled,
        label: feature.title,
        onChange: (next) => {
          settings.set(feature.id, next);
        }
      }
    )
  ] });
}
function FeaturesSection({ settings }) {
  const flags = useStore(settings);
  return /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("section", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("p", { className: `${PAGE_CLASS}-intro`, children: FEATURES_INTRO }),
    /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("ul", { className: `${PAGE_CLASS}-list`, children: FEATURES.map((feature) => /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(FeatureRow, { feature, enabled: flags[feature.id], settings }, feature.id)) })
  ] });
}

// src/client/more-section.tsx
var import_jsx_runtime28 = require("react/jsx-runtime");
var INTRO = "\u6B63\u5728\u5F00\u53D1\u7684\u529F\u80FD\uFF0C\u4F1A\u9646\u7EED\u5728\u8FD9\u91CC\u5F00\u653E\u3002";
var SOON_LABEL = "\u5373\u5C06\u5F00\u653E\u2026";
var SOON_CLASS = "vyra-agent-cli-manager-more-soon";
var UPCOMING_FEATURES = [
  { id: "autoRename", title: "\u4F1A\u8BDD\u81EA\u52A8\u547D\u540D", description: "\u6839\u636E\u5BF9\u8BDD\u5185\u5BB9\u81EA\u52A8\u751F\u6210\u4F1A\u8BDD\u6807\u9898\uFF0C\u4E0D\u7528\u624B\u52A8\u6539\u540D\u3002" },
  { id: "worktree", title: "WorkTree", description: "\u4E3A\u6BCF\u4E2A\u4F1A\u8BDD\u5EFA\u7ACB\u72EC\u7ACB\u7684 Git \u5DE5\u4F5C\u6811\uFF0C\u591A\u4E2A\u4EFB\u52A1\u4E92\u4E0D\u5E72\u6270\u3002" },
  { id: "gitInfo", title: "Git \u4FE1\u606F\u81EA\u52A8\u751F\u6210", description: "\u6839\u636E\u6539\u52A8\u81EA\u52A8\u751F\u6210\u63D0\u4EA4\u4FE1\u606F\u548C\u53D8\u66F4\u8BF4\u660E\u3002" },
  { id: "promptBoost", title: "\u589E\u5F3A\u63D0\u793A\u8BCD", description: "\u628A\u4E00\u53E5\u8BDD\u6269\u5199\u6210\u5B8C\u6574\u7684\u63D0\u793A\u8BCD\uFF0C\u51CF\u5C11\u6765\u56DE\u8865\u5145\u80CC\u666F\u3002" },
  {
    id: "accountQuota",
    title: "AI \u8D26\u53F7\u9650\u989D\u63D0\u793A",
    description: "\u663E\u793A\u5404 AI \u8D26\u53F7\u7684\u5269\u4F59\u989D\u5EA6\u548C\u91CD\u7F6E\u65F6\u95F4\uFF0C\u5FEB\u7528\u5B8C\u65F6\u63D0\u524D\u63D0\u9192\u3002"
  }
];
var MORE_SECTION_STYLES = `
.${SOON_CLASS} { flex: 0 0 auto; padding: 2px 8px; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 999px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); font-size: 12px; line-height: 18px; }
`;
function MoreSection() {
  return /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)("section", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("p", { className: "vyra-agent-cli-manager-settings-intro", children: INTRO }),
    /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("ul", { className: "vyra-agent-cli-manager-settings-list", children: UPCOMING_FEATURES.map((feature) => /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)("li", { className: "vyra-agent-cli-manager-settings-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime28.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("div", { className: "vyra-agent-cli-manager-settings-title", children: feature.title }),
        /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("div", { className: "vyra-agent-cli-manager-settings-desc", children: feature.description })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime28.jsx)("span", { className: SOON_CLASS, children: SOON_LABEL })
    ] }, feature.id)) })
  ] });
}

// src/client/release-notes-section.tsx
var import_react21 = require("react");

// src/client/release-notes.ts
var RELEASE_NOTES = [
  {
    version: "1.0.6",
    date: "2026-11-12",
    sections: [
      {
        heading: "\u2728 \u65B0\u529F\u80FD",
        items: [
          {
            title: "CLI \u81EA\u5DF1\u7684\u6A21\u5F0F",
            text: "CLI \u540D\u5B57\u53F3\u8FB9\u65B0\u589E\u300CCLI \u6A21\u5F0F\u300D\u6309\u94AE\uFF0C\u5217\u7684\u662F\u8BE5 CLI \u901A\u8FC7 ACP \u62A5\u544A\u7684\u6A21\u5F0F\uFF0Cid \u548C\u540D\u5B57\u539F\u6837\u53D1\u9001\uFF0C\u4E0D\u6620\u5C04\u6210 DSH \u7684\u6743\u9650\u9884\u8BBE\uFF1B\u8FDB\u7A0B\u5728\u8FD0\u884C\u65F6\u9009\u4E2D\u5F53\u573A\u751F\u6548\uFF0C\u8FD8\u6CA1\u8D77\u6765\u65F6\u968F\u4E0B\u4E00\u6761\u6D88\u606F\u53D1\u51FA\uFF0C\u6309\u94AE\u4E0A\u6709\u6807\u6CE8\u3002CLI \u4E0D\u63A5\u53D7\u65F6\u6D88\u606F\u7167\u5E38\u53D1\u51FA\uFF0C\u56DE\u590D\u4F1A\u8BF4\u660E\u6309\u54EA\u4E2A\u6A21\u5F0F\u8FD0\u884C\u3002"
          },
          {
            title: "\u300CEXP \u81EA\u52A8\u5BA1\u67E5\u300D\u53EF\u4EE5\u5728 CLI \u4F1A\u8BDD\u91CC\u7528",
            text: "\u5BA1\u67E5\u8BF7\u6C42\u8F6C\u7ED9\u4E00\u4E2A\u72EC\u7ACB\u3001\u65E0\u72B6\u6001\u7684\u6A21\u578B\u63D0\u4F9B\u65B9\uFF0C\u4E0D\u8FDB\u5165 CLI \u7684\u4F1A\u8BDD\u5386\u53F2\u3002\u9700\u8981\u5728\u63D2\u4EF6\u914D\u7F6E\u91CC\u6307\u5B9A `reviewProvider`\uFF08\u4E0D\u80FD\u662F CLI\uFF09\u548C\u53EF\u9009\u7684 `reviewModel`\uFF1B\u63D2\u4EF6\u4E0D\u4F1A\u66FF\u4F60\u6311\u9009\uFF0C\u6CA1\u914D\u7F6E\u65F6\u4F1A\u63D0\u793A\u3002"
          },
          {
            title: "\u6A21\u578B\u56FE\u6807\u6309\u5382\u5546\u663E\u793A",
            text: "\u65B0\u8BA4 Hunyuan\u3001\u667A\u8C31\u3001MiniMax\u3001\u9636\u8DC3 StepFun \u548C\u5C0F\u7C73 MiMo\uFF1B\u805A\u5408 CLI \u91CC\u4E0D\u518D\u8BA9\u6240\u6709\u6A21\u578B\u90FD\u663E\u793A CLI \u81EA\u5DF1\u7684 logo\uFF0C\u8BA4\u4E0D\u51FA\u5382\u5546\u7684\u7528\u4E2D\u6027\u95EE\u53F7\u5360\u4F4D\u3002"
          },
          {
            title: "\u6A21\u578B\u500D\u7387\u5199\u5728\u540D\u5B57\u53F3\u8FB9",
            text: "\u6A21\u578B\u540D\u4FDD\u6301 CLI \u7ED9\u7684\u539F\u6837\uFF0C\u53F3\u4FA7\u5C0F\u5B57\u663E\u793A\u5B83\u62A5\u7684\u7B80\u77ED\u63CF\u8FF0\uFF0C\u6BD4\u5982 CodeBuddy \u7684 `x0.29 credits`\uFF1B\u540C\u540D\u7684\u514D\u8D39\u6863\u548C\u4ED8\u8D39\u6863\u9760\u5B83\u533A\u5206\uFF0C\u5BA3\u4F20\u8BED\u4E00\u7C7B\u7684\u957F\u53E5\u4E0D\u4E0A\u5C4F\u3002"
          },
          {
            title: "\u539F\u751F\u4F1A\u8BDD\u4FDD\u7559\u81EA\u5DF1\u7684\u6A21\u578B\u83DC\u5355",
            text: "\u975E CLI \u4F1A\u8BDD\u4E0D\u518D\u6362\u6389 DSH \u81EA\u5DF1\u7684\u6A21\u578B\u5EA7\u4F4D\uFF0C\u63A8\u7406\u7B49\u7EA7\u548C\u667A\u80FD\u4F53\u56E2\u961F\u534F\u4F5C\u5F00\u5173\u7559\u5728\u539F\u4F4D\uFF1B\u63D2\u4EF6\u53EA\u9690\u85CF\u539F\u751F\u83DC\u5355\u91CC\u5207\u4E0D\u8FC7\u53BB\u7684 CLI \u5206\u7EC4\u3002"
          }
        ]
      },
      {
        heading: "\u{1F41B} \u95EE\u9898\u4FEE\u590D",
        items: [
          {
            title: "CLI \u62D2\u7EDD\u65F6\u8BF4\u660E\u539F\u56E0",
            text: "\u6309\u987A\u5E8F\u4ECE\u672C\u8F6E\u8F93\u51FA\u3001\u56DE\u7B54 `_meta` \u91CC\u7684\u5177\u540D\u5B57\u6BB5\uFF08\u5982 CodeBuddy \u7684 `codebuddy.ai/errorMessage`\uFF09\u548C\u8FD9\u4E00\u8F6E stderr \u7684\u6700\u540E\u4E24\u884C\u91CC\u627E\u539F\u56E0\uFF1B\u8BCA\u65AD JSON\u3001trace \u5934\u4E0D\u663E\u793A\uFF0C\u90FD\u6CA1\u6709\u65F6\u5199\u300C\u672A\u8BF4\u660E\u539F\u56E0\u300D\u3002"
          },
          {
            title: "\u5B8C\u5168\u6743\u9650\u4E0B CLI \u63D0\u95EE\u4E0D\u518D\u88AB\u9759\u9ED8\u62D2\u7EDD",
            text: "\u53EA\u5728 CLI \u63D0\u95EE\u671F\u95F4\u628A\u4F1A\u8BDD\u4E34\u65F6\u5207\u5230\u300C\u8BE2\u95EE\u300D\uFF0C\u95EE\u5B8C\u6062\u590D\uFF1B\u6539\u52A8\u4E0D\u518D\u51ED\u7A7A\u6D88\u5931\uFF0C\u5C4F\u5E55\u4E0A\u4F1A\u51FA\u73B0\u5BA1\u6279\u5361\u7247\u3002"
          },
          {
            title: "\u6A21\u5F0F\u6309\u94AE\u7684\u63D0\u793A\u4F1A\u81EA\u5DF1\u6D88\u5931",
            text: "CLI \u6536\u4E0B\u6A21\u5F0F\u540E\uFF0C\u6309\u94AE\u4E0A\u7684\u300C\u4E0B\u4E00\u6761\u6D88\u606F\u53D1\u9001\u65F6\u751F\u6548\u300D\u81EA\u52A8\u53BB\u6389\uFF0C\u4E0D\u7528\u91CD\u5F00\u83DC\u5355\u3002"
          }
        ]
      },
      {
        heading: "\u{1F4C4} \u6587\u6863",
        items: [
          { text: "README \u8865\u5145 CLI \u6A21\u5F0F\u3001\u81EA\u52A8\u5BA1\u67E5\u914D\u7F6E\u3001\u62D2\u7EDD\u539F\u56E0\u548C\u6A21\u578B\u56FE\u6807\u4E0E\u500D\u7387\u5C0F\u5B57\u7684\u8BF4\u660E\u3002" },
          { text: "`THIRD_PARTY_NOTICES.md` \u8865\u65B0\u56FE\u6807\u7684\u6765\u6E90\uFF0C\u5F00\u53D1\u4E00\u8282\u4E0E AGENTS.md \u5BF9\u9F50\u3002" }
        ]
      },
      {
        heading: "\u{1F527} \u7EF4\u62A4",
        items: [
          {
            text: "\u65B0\u589E CLI \u6A21\u5F0F\u7684\u72B6\u6001\u3001\u8DEF\u7531\u548C\u754C\u9762\uFF0C\u4EE5\u53CA\u53EA\u5728 CLI \u63D0\u95EE\u671F\u95F4\u751F\u6548\u7684\u5BA1\u6279\u7B56\u7565\uFF1Be2e \u6539\u4E3A\u9010\u5E27\u8BFB\u53D6\u4F1A\u8BDD\u65E5\u5FD7\u3002\u7248\u672C\u53F7\u5347\u5230 1.0.6\u3002"
          }
        ]
      }
    ]
  },
  {
    version: "1.0.5",
    date: "2026-11-09",
    sections: [
      {
        heading: "\u2728 \u65B0\u529F\u80FD",
        items: [
          {
            title: "\u9879\u76EE\u53F3\u952E\u65B0\u5EFA Worktree",
            text: "\u5DE6\u4FA7\u680F\u9879\u76EE\u53F3\u952E\u300C\u65B0\u5EFA Worktree\u2026\u300D\uFF0C\u53EF\u4EE5\u4ECE\u65B0\u5206\u652F\u3001\u5DF2\u6709\u5206\u652F\u6216 PR \u521B\u5EFA Git worktree\uFF1B\u9ED8\u8BA4\u653E\u5728\u4ED3\u5E93\u540C\u7EA7\u7684 `<\u4ED3\u5E93\u540D>-worktrees/<\u5206\u652F\u540D>`\uFF0C\u521B\u5EFA\u540E\u52A0\u5165\u4FA7\u8FB9\u680F\uFF0C\u4E5F\u53EF\u4EE5\u7ACB\u523B\u5728\u91CC\u9762\u6253\u5F00\u65B0\u4F1A\u8BDD\u3002"
          },
          {
            title: "\u4ECE PR \u521B\u5EFA\u4E0D\u9700\u8981 gh",
            text: "\u63A5\u53D7 `123`\u3001`#123` \u6216 PR \u94FE\u63A5\uFF0C\u4ECE `refs/pull/<\u7F16\u53F7>/head` \u62C9\u53D6\uFF1B\u6709 `upstream` \u65F6\u4F18\u5148\u7528\u5B83\uFF0C\u586B\u94FE\u63A5\u65F6\u6309\u94FE\u63A5\u91CC\u7684\u4ED3\u5E93\u5339\u914D\u8FDC\u7A0B\u3002"
          },
          {
            title: "worktree \u6536\u8FDB\u4ED3\u5E93\u5206\u7EC4",
            text: "\u4FA7\u8FB9\u680F\u628A worktree \u6536\u8FDB\u6240\u5C5E\u4ED3\u5E93\u7684\u300CWorktrees \xB7 N\u300D\u5206\u7EC4\uFF0C\u5C55\u5F00\u72B6\u6001\u4F1A\u8BB0\u4F4F\uFF1B\u53F3\u952E worktree \u6216\u4F1A\u8BDD\u4ECD\u662F DSH \u81EA\u5DF1\u7684\u83DC\u5355\u3002\u5206\u7EC4\u4F9D\u8D56\u4FA7\u8FB9\u680F\u7ED3\u6784\uFF0CDSH \u6539\u7ED3\u6784\u65F6 worktree \u9000\u56DE\u9876\u5C42\u663E\u793A\u3002"
          },
          {
            title: "\u53EF\u4EE5\u5173\u6389",
            text: "\u8BBE\u7F6E\u9875\u65B0\u589E\u300C\u9879\u76EE\u53F3\u952E\u65B0\u5EFA Worktree\u300D\u5F00\u5173\uFF0C\u9ED8\u8BA4\u5F00\u542F\u3002"
          }
        ]
      },
      {
        heading: "\u{1F41B} \u95EE\u9898\u4FEE\u590D",
        items: [
          {
            title: "CLI \u4F1A\u8BDD\u4E0D\u518D\u663E\u793A\u9519\u8BEF\u7684 token \u6570\u5B57",
            text: "ACP \u6BCF\u8F6E\u53EA\u7ED9\u4E00\u4E2A\u7D2F\u8BA1\u7528\u91CF\uFF0CDSH \u5374\u6309\u5355\u6B21\u8BF7\u6C42\u7406\u89E3\uFF0C\u901F\u5EA6\u548C\u4E0A\u4E0B\u6587\u5360\u7528\u90FD\u4F1A\u88AB\u7B97\u9519\u3002\u73B0\u5728\u4E0D\u518D\u4E0A\u62A5\uFF0CCLI \u4F1A\u8BDD\u4E0D\u663E\u793A tok/s\u3001token \u7528\u91CF\u548C\u7F13\u5B58\u547D\u4E2D\u3002"
          },
          {
            title: "CLI \u542F\u52A8\u5931\u8D25\u65F6\u8BF4\u660E\u539F\u56E0",
            text: "\u6536\u96C6 CLI \u7684 stderr \u672B\u5C3E\uFF0C\u5931\u8D25\u4FE1\u606F\u9644\u5E26\u6700\u540E 800 \u4E2A\u5B57\u7B26\u548C\u9000\u51FA\u7801\uFF1BWindows \u7684\u65E0\u7B26\u53F7\u9000\u51FA\u7801\u540C\u65F6\u7ED9\u51FA\u6709\u7B26\u53F7\u503C\u3002npm \u7684 `Could not read package.json` \u4F1A\u88AB\u8BA4\u6210\u5B89\u88C5\u4E0D\u5B8C\u6574\uFF0C\u5E76\u7ED9\u51FA\u8981\u5220\u9664\u7684 `_npx/<hash>` \u76EE\u5F55\u3002"
          }
        ]
      },
      {
        heading: "\u{1F4C4} \u6587\u6863",
        items: [
          {
            text: "README \u8865\u5145 Worktree \u7684\u8BF4\u660E\uFF0C\u4EE5\u53CA DSH \u4FA7\u4E0A\u4E0B\u6587\u538B\u7F29\u5BF9 CLI \u4F1A\u8BDD\u4E0D\u751F\u6548\u7684\u539F\u56E0\u548C\u66FF\u4EE3\u505A\u6CD5\u3002"
          },
          { text: "\u7248\u672C\u8BB0\u5F55\u6587\u4EF6\u7EDF\u4E00\u653E\u5230 `docs/release-notes/`\u3002" }
        ]
      },
      {
        heading: "\u{1F527} \u7EF4\u62A4",
        items: [
          {
            text: "\u65B0\u589E Git worktree \u7684\u8BFB\u53D6\u4E0E\u521B\u5EFA\u3001\u4FA7\u8FB9\u680F\u5206\u7EC4\u548C\u5171\u4EAB\u7684 git POST\uFF1B\u5220\u9664\u8F6C\u53D1 token \u7528\u91CF\u7684\u6A21\u5757\uFF0C\u5404\u81EA\u5E26\u6D4B\u8BD5\u548C e2e\u3002\u7248\u672C\u53F7\u5347\u5230 1.0.5\u3002"
          }
        ]
      }
    ]
  },
  {
    version: "1.0.4",
    date: "2026-11-09",
    sections: [
      {
        heading: "\u2728 \u65B0\u529F\u80FD",
        items: [
          {
            title: "\u6BCF\u4E2A\u6A21\u578B\u72EC\u7ACB\u7684\u601D\u8003\u5F3A\u5EA6",
            text: "\u8BFB\u53D6 CLI \u62A5\u51FA\u7684 `thought_level`\uFF0C\u6309\u6A21\u578B\u8BB0\u4F4F\u53EF\u7528\u7B49\u7EA7\uFF0C\u9009\u4E2D\u540E\u968F\u4E0B\u4E00\u6761\u6D88\u606F\u53D1\u9001\u3002\u6CA1\u89C1\u8FC7\u7684\u6A21\u578B\u5148\u7528\u9ED8\u8BA4\u6A21\u578B\u7684\u7B49\u7EA7\uFF0C\u5B9E\u9645\u7528\u5230\u540E\u518D\u4EE5 CLI \u62A5\u7684\u4E3A\u51C6\uFF0C\u5E76\u5199\u5165\u6A21\u578B\u7F13\u5B58\u3002"
          },
          {
            title: "\u6A21\u578B\u83DC\u5355\u663E\u793A\u5382\u5546\u56FE\u6807",
            text: "\u4ECE\u6A21\u578B id \u548C\u540D\u5B57\u8BC6\u522B DeepSeek\u3001Kimi\u3001Claude\u3001OpenAI\uFF0C\u8BA4\u4E0D\u51FA\u65F6\u7528 CLI \u81EA\u5DF1\u7684\u56FE\u6807\uFF0C\u90FD\u6CA1\u6709\u5C31\u7559\u7A7A\u4F4D\u8BA9\u540D\u5B57\u4FDD\u6301\u5BF9\u9F50\u3002"
          },
          {
            title: "\u591A\u5382\u5546\u6A21\u578B\u6309\u5382\u5546\u5206\u7EC4",
            text: "OMP\u3001PI\u3001OpenCode \u7684\u6A21\u578B id \u5E26 `vendor/` \u524D\u7F00\uFF0C\u51FA\u73B0\u4E24\u4E2A\u53CA\u4EE5\u4E0A\u5382\u5546\u65F6\u6BCF\u4E2A\u5382\u5546\u4E00\u4E2A\u5206\u7EC4\uFF1B\u65E0\u524D\u7F00\u7684\u884C\uFF08\u542B\u9ED8\u8BA4\u9879\uFF09\u7559\u5728\u6700\u4E0A\u65B9\uFF0C\u9009\u4E2D\u540E\u4ECD\u53D1\u9001\u5B8C\u6574 id\u3002"
          },
          {
            title: "PTC \u6A21\u5F0F\u53EF\u4EE5\u7528 CLI \u4E86",
            text: "CLI \u7684\u5DE5\u5177\u8C03\u7528\u5305\u6210 `run_code` \u7A0B\u5E8F\u6267\u884C\uFF0C\u5DE5\u5177\u5361\u7247\u663E\u793A\u4E3A `run_code`\u3002\u5355\u6B21\u8C03\u7528\uFF08\u542B\u7B49\u5F85\u5BA1\u6279\uFF09\u53D7 PTC \u8FD0\u884C\u65F6\u8D85\u65F6\u4E0A\u9650\u7EA6\u675F\uFF0C\u957F\u4EFB\u52A1\u5EFA\u8BAE\u5207\u56DE\u6807\u51C6\u6A21\u5F0F\uFF1B\u8FD0\u884C\u65F6\u4E0D\u517C\u5BB9\u65F6\u4F1A\u5728\u542F\u52A8 CLI \u524D\u63D0\u793A\u3002"
          }
        ]
      },
      {
        heading: "\u{1F527} \u6539\u8FDB",
        items: [
          {
            title: "\u6A21\u578B\u83DC\u5355\u66F4\u5E72\u51C0",
            text: "\u4E0D\u518D\u5217\u51FA\u4E0E\u9ED8\u8BA4\u9879\u540C\u540D\u7684\u884C\uFF0C\u4E5F\u4E0D\u518D\u5217\u51FA\u540C\u4E00\u5BB6\u65CF\u91CC\u5DF2\u88AB\u65B0\u7248\u672C\u53D6\u4EE3\u7684\u65E7\u7248\u672C\uFF1B\u5DF2\u7ECF\u7528\u7740\u8FD9\u4E9B\u6A21\u578B\u7684\u4F1A\u8BDD\u4E0D\u53D7\u5F71\u54CD\u3002"
          },
          {
            title: "\u601D\u8003\u5F3A\u5EA6\u4E0D\u652F\u6301\u65F6\u7ED9\u51FA\u63D0\u793A",
            text: "\u5207\u6362\u6A21\u578B\u540E\u5982\u679C\u65B0\u6A21\u578B\u4E0D\u652F\u6301\u4E4B\u524D\u9009\u7684\u7B49\u7EA7\uFF0C\u6CBF\u7528 CLI \u5F53\u524D\u7684\u7B49\u7EA7\uFF0C\u5E76\u63D0\u793A\u5728\u83DC\u5355\u91CC\u91CD\u65B0\u9009\u62E9\uFF0C\u800C\u4E0D\u662F\u8BA9\u8FD9\u6761\u6D88\u606F\u5931\u8D25\u3002"
          }
        ]
      },
      {
        heading: "\u{1F4C4} \u6587\u6863",
        items: [{ text: "README \u7684\u6807\u9898\u3001\u5173\u952E\u8BCD\u548C\u622A\u56FE\u52A0\u5165 Kimi CLI\uFF0CPTC \u6A21\u5F0F\u8BF4\u660E\u6539\u4E3A\u5DF2\u652F\u6301\u53CA\u5176\u9650\u5236\u3002" }]
      },
      {
        heading: "\u{1F527} \u7EF4\u62A4",
        items: [{ text: "\u7248\u672C\u53F7\u5347\u5230 1.0.4\uFF1B\u65B0\u589E\u601D\u8003\u5F3A\u5EA6\u3001\u65E7\u7248\u672C\u8BC6\u522B\u3001PTC \u5305\u88C5\u548C\u6A21\u578B\u56FE\u6807\u6A21\u5757\uFF0C\u5404\u81EA\u5E26\u76F4\u63A5\u6D4B\u8BD5\u3002" }]
      }
    ]
  },
  {
    version: "1.0.3",
    date: "2026-11-09",
    sections: [
      {
        heading: "\u{1F41B} \u95EE\u9898\u4FEE\u590D",
        items: [
          {
            title: "Windows \u4E0A npx \u7CFB CLI \u8D77\u4E0D\u6765",
            text: "Node.js \u5B89\u88C5\u5305\u81EA\u5E26\u7684 `npx.cmd` \u628A\u8DEF\u5F84\u5B58\u5728\u53D8\u91CF\u91CC\uFF0C\u63D2\u4EF6\u4E4B\u524D\u89E3\u6790\u4E0D\u51FA\u6765\uFF0CClaude Code\u3001Codex\u3001Kimi\u3001PI \u90FD\u62A5\u300C\u65E0\u6CD5\u5728\u4E0D\u7ECF\u8FC7\u547D\u4EE4\u884C\u7684\u60C5\u51B5\u4E0B\u542F\u52A8 npx.cmd\u300D\u3002\u73B0\u5728\u80FD\u8BA4\u51FA\u8FD9\u79CD\u5199\u6CD5\uFF0C\u7528\u65C1\u8FB9\u7684 `node.exe`\uFF08\u6216 `PATH` \u91CC\u7684 node\uFF09\u76F4\u63A5\u8FD0\u884C `npx-cli.js`\u3002"
          },
          {
            title: "\u5347\u7EA7\u63D0\u793A",
            text: "\u4E4B\u524D\u4E3A\u4E86\u7ED5\u8FC7\u8FD9\u4E2A\u95EE\u9898\u5728 `cordis.patch.yml` \u91CC\u6539\u6210 `cmd /c npx ...` \u7684\uFF0C\u5347\u7EA7\u540E\u53EF\u4EE5\u5220\u6389\u90A3\u6BB5\u914D\u7F6E\u3001\u6062\u590D\u9ED8\u8BA4\uFF0C\u5426\u5219\u6536\u4E0D\u5230\u4EE5\u540E\u7684\u9002\u914D\u5668\u7248\u672C\u66F4\u65B0\u3002"
          }
        ]
      }
    ]
  },
  {
    version: "1.0.2",
    date: "2026-11-08",
    sections: [
      {
        heading: "\u2728 \u65B0\u529F\u80FD",
        items: [
          {
            title: "\u8BBE\u7F6E\u9875\u7248\u672C\u8BB0\u5F55",
            text: "Agent CLI Manager \u8BBE\u7F6E\u65B0\u589E\u300C\u7248\u672C\u8BB0\u5F55\u300D\u9875\u7B7E\uFF1A\u4E00\u4E2A\u7248\u672C\u4E00\u9875\uFF0C\u7528\u5DE6\u53F3\u7BAD\u5934\u6216\u5706\u70B9\u7FFB\u770B\u6BCF\u4E2A\u7248\u672C\u7684\u66F4\u65B0\u8BF4\u660E\uFF0C\u5F53\u524D\u8FD0\u884C\u7684\u7248\u672C\u4F1A\u6807\u51FA\u6765\u3002"
          },
          {
            title: "\u6253\u5305 Kimi CLI",
            text: "Kimi Code \u81EA\u5E26 `acp` \u5B50\u547D\u4EE4\uFF0C\u7528\u56FA\u5B9A\u7248\u672C `npx -y @moonshot-ai/kimi-code@2.5.2 acp` \u542F\u52A8\uFF0C\u4E0D\u9700\u8981\u9002\u914D\u5668\uFF1B\u771F\u5B9E\u8D26\u53F7\u5DF2\u9A8C\u8BC1\u3002"
          },
          {
            title: "\u6A21\u578B\u5EA7\u4F4D\u63A5\u7BA1\u6BCF\u4E2A\u4F1A\u8BDD",
            text: "CLI \u4F1A\u8BDD\u5217 CLI \u81EA\u5DF1\u7684\u6A21\u578B\uFF0C\u5176\u4ED6\u4F1A\u8BDD\u53EA\u5217 DSH \u81EA\u5DF1\u8FD0\u884C\u7684\u63D0\u4F9B\u65B9\uFF0C\u65C1\u8FB9\u662F\u63A8\u7406\u7B49\u7EA7\u83DC\u5355\uFF1B\u540C\u540D\u7684\u6A21\u578B\u7528\u8BF4\u660E\u6216 id \u533A\u5206\u3002"
          },
          {
            title: "CLI \u4F1A\u8BDD\u4E0A\u62A5 token \u7528\u91CF",
            text: "\u628A ACP \u6BCF\u6B21\u54CD\u5E94\u91CC\u7684 usage \u6620\u5C04\u6210 DSH \u7684 TokenUsage\uFF0CCLI \u4F1A\u8BDD\u4E5F\u80FD\u663E\u793A\u901F\u5EA6\u548C\u7F13\u5B58\u547D\u4E2D\u3002"
          },
          {
            title: "\u8BBE\u7F6E\u9875\u63D0\u793A\u65B0\u7248\u672C",
            text: "\u6709\u66F4\u65B0\u7684 Release \u65F6\uFF0C\u7248\u672C\u80F6\u56CA\u53D8\u6210\u6307\u5411\u8BE5 Release \u8BF4\u660E\u7684\u94FE\u63A5\u3002"
          },
          {
            title: "\u5207\u6362\u5668\u91CC harness \u53EA\u5217\u4E00\u6761",
            text: "\u6240\u6709\u975E CLI \u63D0\u4F9B\u65B9\u5408\u5E76\u6210\u4E00\u6761\u300CDeepSeek\u300D\uFF0C\u4E0D\u518D\u9010\u4E2A\u5217\u51FA\u3002"
          }
        ]
      },
      {
        heading: "\u{1F41B} \u95EE\u9898\u4FEE\u590D",
        items: [
          {
            title: "Windows \u4E0A `.cmd` \u542F\u52A8\u5668\u8D77\u4E0D\u6765",
            text: "\u8BFB\u51FA shim \u91CC\u7684\u811A\u672C\u548C\u89E3\u91CA\u5668\u76F4\u63A5\u8FD0\u884C\uFF1B\u89E3\u91CA\u5668\u4E0D\u4E00\u5B9A\u662F node\uFF0C\u4F1A\u6CBF `PATH` \u6700\u591A\u8FFD 4 \u5C42\u3002"
          },
          {
            title: "macOS / Linux \u4ECE Dock \u542F\u52A8\u65F6\u627E\u4E0D\u5230 node",
            text: "\u542F\u52A8\u65F6\u5411\u767B\u5F55 shell \u8BFB\u4E00\u6B21 `PATH`\uFF0C\u8BFB\u5230\u4E4B\u524D\u8865\u4E0A\u5E38\u89C1\u5B89\u88C5\u76EE\u5F55\uFF0C`npx` \u7CFB CLI \u4E0D\u518D\u4EE5\u9000\u51FA\u7801 127 \u5931\u8D25\u3002"
          },
          {
            title: "npx \u7F13\u5B58\u4E0D\u5B8C\u6574\u65F6\u7ED9\u51FA\u6B63\u786E\u63D0\u793A",
            text: "\u8BA4\u51FA `_npx` \u7F13\u5B58\u76EE\u5F55\u5E76\u63D0\u793A\u5220\u9664\u540E\u91CD\u8BD5\uFF0C\u800C\u4E0D\u662F\u8BA9\u7528\u6237\u91CD\u88C5\u3002"
          }
        ]
      },
      {
        heading: "\u{1F527} \u91CD\u6784",
        items: [
          { text: "\u6A21\u578B\u83DC\u5355\u62C6\u51FA `menu-models.ts` \u548C `effort-menu.tsx`\uFF0C\u6E32\u67D3\u884C\u4E3A\u4E0D\u53D8\u3002" },
          { text: "\u5207\u6362\u5668\u7684\u5185\u7F6E\u9879\u5224\u65AD\u6539\u4E3A `isBuiltInChoice`\uFF0C\u8BBE\u7F6E\u9875\u9501\u5B9A\u4E0E\u504F\u597D\u6E05\u7406\u5171\u7528\u540C\u4E00\u5957\u89C4\u5219\u3002" }
        ]
      },
      {
        heading: "\u{1F4C4} \u6587\u6863",
        items: [
          { text: "\u53D1\u7248\u7EA6\u5B9A\u5199\u8FDB AGENTS.md \u4E0E README\u3002" },
          { text: "README \u8865\u5145 Kimi CLI \u7684 Node.js 22.19 \u8981\u6C42\u4E0E\u767B\u5F55\u6B65\u9AA4\u3002" }
        ]
      }
    ]
  },
  {
    version: "1.0.1",
    date: "2026-11-08",
    sections: [
      {
        heading: "\u{1F41B} \u95EE\u9898\u4FEE\u590D",
        items: [
          {
            title: "\u8BBE\u7F6E\u9875 GitHub \u94FE\u63A5\u6307\u5411\u9519\u8BEF\u7684\u4ED3\u5E93",
            text: "GitHub \u80F6\u56CA\u539F\u672C\u6253\u5F00 desktop-cc-gui\uFF0C\u73B0\u5728\u6307\u5411\u672C\u63D2\u4EF6\u4ED3\u5E93\uFF1B\u6D4B\u8BD5\u6539\u4E3A\u4ECE `package.json` \u8BFB\u4ED3\u5E93\u5730\u5740\uFF0C\u907F\u514D\u518D\u6B21\u6F02\u79FB\u3002"
          }
        ]
      },
      {
        heading: "\u{1F527} \u7EF4\u62A4",
        items: [{ text: "\u53D1\u5E03\u6539\u7528 npm Trusted Publishing\uFF0C\u9760 `release.yml` \u7684 OIDC \u8EAB\u4EFD\u53D1\u5E03\uFF0C\u4E0D\u518D\u4FDD\u5B58\u4EE4\u724C\u3002" }]
      },
      {
        heading: "\u{1F4C4} \u6587\u6863",
        items: [{ text: "README \u8C03\u6574\u529F\u80FD\u8868\u4F4D\u7F6E\u5E76\u66F4\u65B0\u5305\u63CF\u8FF0\u3002" }]
      }
    ]
  },
  {
    version: "1.0.0",
    date: "2026-11-08",
    sections: [
      {
        heading: "\u2728 \u65B0\u529F\u80FD",
        items: [
          {
            title: "\u63A5\u5165 Agent CLI",
            text: "Claude Code\u3001Codex CLI\u3001PI CLI\u3001OMP CLI\u3001OpenCode\u3001CodeBuddy CLI \u7ECF ACP \u6CE8\u518C\u6210 DSH \u7684\u6A21\u578B\u63D0\u4F9B\u65B9\uFF0C\u5DE5\u5177\u8C03\u7528\u3001\u5BA1\u6279\u548C\u6539\u52A8\u90FD\u8D70 DSH \u539F\u751F\u754C\u9762\u3002"
          },
          {
            title: "CLI \u4E0E\u6A21\u578B\u83DC\u5355",
            text: "\u8F93\u5165\u6846\u65C1\u5207\u6362 CLI\uFF1B\u6A21\u578B\u83DC\u5355\u5217\u51FA CLI \u771F\u5B9E\u53EF\u7528\u7684\u6A21\u578B\uFF0C\u4F1A\u8BDD\u4E2D\u9014\u6362\u6A21\u578B\u4E0B\u4E00\u6761\u6D88\u606F\u751F\u6548\u3002"
          },
          {
            title: "\u53D8\u66F4\u9762\u677F",
            text: "\u53F3\u4FA7\u680F\u628A\u6539\u52A8\u5206\u6210\u5DF2\u6682\u5B58\u3001\u672A\u6682\u5B58\u3001\u672A\u8DDF\u8E2A\uFF0C\u53EF\u4EE5\u6682\u5B58\u3001\u64A4\u9500\u3001\u63D0\u4EA4\u3001\u63A8\u62C9\u3001\u5207\u6362\u5206\u652F\uFF0C\u70B9\u5F00\u6587\u4EF6\u770B\u884C\u5185 diff\u3002"
          },
          {
            title: "\u542F\u52A8\u811A\u672C\u4E0E\u7EC8\u7AEF",
            text: "\u4F1A\u8BDD\u6807\u9898\u680F\u4FDD\u5B58\u5E38\u7528\u547D\u4EE4\uFF0C\u4E00\u952E\u5728\u7EC8\u7AEF\u6807\u7B7E\u91CC\u8FD0\u884C\uFF1B\u6807\u9898\u680F\u7684\u7EC8\u7AEF\u6309\u94AE\u5F00\u5173\u53F3\u4FA7\u680F\u7EC8\u7AEF\u3002"
          },
          {
            title: "\u6587\u4EF6\u548C\u4F1A\u8BDD\u72B6\u6001",
            text: "\u5DE5\u4F5C\u533A\u6587\u4EF6\u53F3\u952E\u300C\u6DFB\u52A0\u5230\u5BF9\u8BDD\u300D\u63D2\u5165 `@\u8DEF\u5F84`\uFF1B\u4F1A\u8BDD\u5217\u8868\u663E\u793A\u6240\u7528 CLI \u7684\u56FE\u6807\u548C\u8FD0\u884C\u4E2D\u7684\u84DD\u70B9\u3002"
          },
          {
            title: "Agent CLI Manager \u8BBE\u7F6E",
            text: "CLI \u83DC\u5355\u7684\u987A\u5E8F\u548C\u5F00\u5173\u3001\u754C\u9762\u4EA4\u4E92\u5F00\u5173\u3001\u66F4\u591A\u529F\u80FD\u9884\u544A\u90FD\u96C6\u4E2D\u5728\u4E00\u4E2A\u8BBE\u7F6E\u9875\u91CC\u3002"
          }
        ]
      }
    ]
  }
];

// src/client/settings-about.tsx
var import_react20 = require("react");

// src/client/assets/wechat-group.png
var wechat_group_default = "data:image/png;base64,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";

// src/client/settings-about.tsx
var import_jsx_runtime29 = require("react/jsx-runtime");
var PLUGIN_VERSION = true ? "1.0.0" : "\u5F00\u53D1\u7248";
var REPO_URL = "https://github.com/lanxiake/dsh-vyra-plugins";
var VERSION_LABEL = "\u7248\u672C";
var VERSION_VALUE = /^\d/.test(PLUGIN_VERSION) ? `v${PLUGIN_VERSION}` : PLUGIN_VERSION;
var WECHAT_LABEL = "\u5FAE\u4FE1\u4EA4\u6D41\u7FA4";
var WECHAT_DESC = "\u626B\u63CF\u4F5C\u8005\u4E2A\u4EBA\u516C\u4F17\u53F7\u4E8C\u7EF4\u7801\uFF0C\u83B7\u53D6\u5FAE\u4FE1\u4EA4\u6D41\u7FA4\u4E8C\u7EF4\u7801\uFF0C\u52A0\u7FA4\u83B7\u5F97\u6700\u65B0\u8D44\u8BAF\u548C\u6280\u672F\u652F\u6301";
var WECHAT_TIP = "\u4F7F\u7528\u5FAE\u4FE1\u626B\u4E00\u626B";
var WECHAT_QR_ALT = "\u5B98\u65B9\u5FAE\u4FE1\u4EA4\u6D41\u7FA4\u4E8C\u7EF4\u7801";
var QR_SIZE = 160;
var ABOUT_CLASS = "vyra-agent-cli-manager-about";
var SETTINGS_ABOUT_STYLES = `
.${ABOUT_CLASS} { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 0; }
.${ABOUT_CLASS}-pill { position: relative; display: inline-flex; align-items: center; gap: 6px; box-sizing: border-box; height: 28px; padding: 0 10px; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-secondary, rgba(127, 127, 127, 0.08)); color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; line-height: 18px; text-decoration: none; white-space: nowrap; }
.${ABOUT_CLASS}-value { color: var(--dsw-alias-label-primary); font-weight: 500; }
button.${ABOUT_CLASS}-pill, a.${ABOUT_CLASS}-pill { cursor: pointer; }
button.${ABOUT_CLASS}-pill:hover, a.${ABOUT_CLASS}-pill:hover, .${ABOUT_CLASS}-pill[aria-expanded="true"] { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l3, var(--dsw-alias-border-l2)); }
.${ABOUT_CLASS}-anchor { position: relative; }
.${ABOUT_CLASS}-qr { position: absolute; top: calc(100% + 8px); left: 0; z-index: 10; width: 240px; padding: 16px; border: 0; border-radius: 12px; background: var(--dsw-alias-bg-layer-1); --dsw-elevation-stroke-color: var(--dsw-alias-border-l1); box-shadow: var(--dsw-elevation-panel); color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; text-align: center; }
.${ABOUT_CLASS}-qr p { margin: 0; }
.${ABOUT_CLASS}-qr img { display: block; margin: 12px auto 8px; padding: 8px; border-radius: 8px; background: #fff; }
`;
function useEscape(active, close) {
  (0, import_react20.useEffect)(() => {
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
function WechatGroup() {
  const [open, setOpen] = (0, import_react20.useState)(false);
  useEscape(open, () => {
    setOpen(false);
  });
  return /* @__PURE__ */ (0, import_jsx_runtime29.jsxs)("span", { className: `${ABOUT_CLASS}-anchor`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(
      "button",
      {
        type: "button",
        className: `${ABOUT_CLASS}-pill`,
        "aria-expanded": open,
        onClick: () => {
          setOpen((value) => !value);
        },
        children: WECHAT_LABEL
      }
    ),
    open ? /* @__PURE__ */ (0, import_jsx_runtime29.jsxs)("div", { className: `${ABOUT_CLASS}-qr`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime29.jsx)("p", { children: WECHAT_DESC }),
      /* @__PURE__ */ (0, import_jsx_runtime29.jsx)("img", { src: wechat_group_default, alt: WECHAT_QR_ALT, width: QR_SIZE, height: QR_SIZE }),
      /* @__PURE__ */ (0, import_jsx_runtime29.jsx)("p", { children: WECHAT_TIP })
    ] }) : null
  ] });
}
function VersionPill() {
  return /* @__PURE__ */ (0, import_jsx_runtime29.jsxs)("span", { className: `${ABOUT_CLASS}-pill`, children: [
    VERSION_LABEL,
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)("span", { className: `${ABOUT_CLASS}-value`, children: VERSION_VALUE })
  ] });
}
function SettingsAbout() {
  return /* @__PURE__ */ (0, import_jsx_runtime29.jsxs)("div", { className: ABOUT_CLASS, children: [
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(VersionPill, {}),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(WechatGroup, {}),
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)("a", { className: `${ABOUT_CLASS}-pill`, href: REPO_URL, target: "_blank", rel: "noreferrer", children: "GitHub" })
  ] });
}

// src/client/release-notes-section.tsx
var import_jsx_runtime30 = require("react/jsx-runtime");
var INTRO2 = "\u6BCF\u4E2A\u7248\u672C\u4E00\u9875\uFF0C\u7FFB\u9875\u67E5\u770B\u5386\u53F2\u66F4\u65B0\u3002";
var CURRENT_LABEL = "\u5F53\u524D\u7248\u672C";
var EMPTY_TEXT2 = "\u8FD8\u6CA1\u6709\u7248\u672C\u8BB0\u5F55\u3002";
var PREV_LABEL = "\u4E0A\u4E00\u9875";
var NEXT_LABEL = "\u4E0B\u4E00\u9875";
var DOTS_LABEL = "\u9009\u62E9\u7248\u672C";
var NOTES_CLASS = "vyra-agent-cli-manager-notes";
var pageName = (version) => `v${version} \u7248\u672C\u8BB0\u5F55`;
var pagePosition = (index, count) => `\u7B2C ${index + 1} / ${count} \u9875`;
var RELEASE_NOTES_STYLES = `
.${NOTES_CLASS} { display: flex; flex-direction: column; gap: 12px; }
.${NOTES_CLASS}-page { display: flex; flex-direction: column; gap: 14px; padding: 16px; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 12px; background: var(--dsw-alias-bg-secondary, rgba(127, 127, 127, 0.04)); }
.${NOTES_CLASS}-head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.${NOTES_CLASS}-version { color: var(--dsw-alias-label-primary); font-size: 15px; line-height: 22px; font-weight: 600; }
.${NOTES_CLASS}-current { padding: 0 8px; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 999px; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 18px; }
.${NOTES_CLASS}-date { color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); font-size: 12px; line-height: 18px; }
.${NOTES_CLASS}-pager { display: flex; align-items: center; gap: 2px; margin-left: auto; }
.${NOTES_CLASS}-step { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; padding: 0; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 6px; background: none; color: var(--dsw-alias-label-secondary); font-size: 16px; line-height: 1; cursor: pointer; }
.${NOTES_CLASS}-step:hover:not(:disabled) { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l3, var(--dsw-alias-border-l2)); }
.${NOTES_CLASS}-step:disabled { opacity: 0.35; cursor: default; }
.${NOTES_CLASS}-count { min-width: 44px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); font-size: 12px; line-height: 18px; text-align: center; }
.${NOTES_CLASS}-body { display: flex; flex-direction: column; gap: 14px; }
.${NOTES_CLASS}-section { display: flex; flex-direction: column; gap: 6px; }
.${NOTES_CLASS}-heading { color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; font-weight: 500; }
.${NOTES_CLASS}-list { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.${NOTES_CLASS}-item { position: relative; padding-left: 12px; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.${NOTES_CLASS}-item::before { content: '\xB7'; position: absolute; left: 0; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); }
.${NOTES_CLASS}-item strong { color: var(--dsw-alias-label-primary); font-weight: 500; }
.${NOTES_CLASS}-item code { padding: 1px 4px; border-radius: 4px; background: var(--dsw-alias-bg-tertiary, rgba(127, 127, 127, 0.14)); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.${NOTES_CLASS}-dots { display: flex; justify-content: center; gap: 2px; }
.${NOTES_CLASS}-dot { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; padding: 0; border: none; background: none; cursor: pointer; }
.${NOTES_CLASS}-dot::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-border-l3, #8a8a8a); }
.${NOTES_CLASS}-dot[aria-current="page"]::before { background: var(--dsw-alias-label-primary); }
.${NOTES_CLASS}-step:focus-visible, .${NOTES_CLASS}-dot:focus-visible { outline: 2px solid var(--dsw-alias-border-focus, currentColor); outline-offset: 2px; }
.${NOTES_CLASS}-empty { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
`;
function InlineText({ text }) {
  return /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(import_jsx_runtime30.Fragment, { children: text.split("`").map((part, index) => index % 2 === 0 ? part : /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("code", { children: part }, index)) });
}
function ItemRow({ item }) {
  return /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("li", { className: `${NOTES_CLASS}-item`, children: [
    item.title === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("strong", { children: [
      item.title,
      "\uFF1A"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(InlineText, { text: item.text })
  ] });
}
function SectionBlock({ section }) {
  return /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("div", { className: `${NOTES_CLASS}-section`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("div", { className: `${NOTES_CLASS}-heading`, children: section.heading }),
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("ul", { className: `${NOTES_CLASS}-list`, children: section.items.map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(ItemRow, { item }, index)) })
  ] });
}
function NotesBody({ note }) {
  return /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("div", { className: `${NOTES_CLASS}-body`, children: note.sections.map((section) => /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(SectionBlock, { section }, section.heading)) });
}
function Pager({
  index,
  count,
  onSelect
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("div", { className: `${NOTES_CLASS}-pager`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(
      "button",
      {
        type: "button",
        className: `${NOTES_CLASS}-step`,
        "aria-label": PREV_LABEL,
        disabled: index === 0,
        onClick: () => {
          onSelect(index - 1);
        },
        children: "\u2039"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: `${NOTES_CLASS}-count`, "aria-live": "polite", children: pagePosition(index, count) }),
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(
      "button",
      {
        type: "button",
        className: `${NOTES_CLASS}-step`,
        "aria-label": NEXT_LABEL,
        disabled: index === count - 1,
        onClick: () => {
          onSelect(index + 1);
        },
        children: "\u203A"
      }
    )
  ] });
}
function Dots({
  index,
  notes,
  onSelect
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("div", { className: `${NOTES_CLASS}-dots`, role: "group", "aria-label": DOTS_LABEL, children: notes.map((note, position) => /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(
    "button",
    {
      type: "button",
      className: `${NOTES_CLASS}-dot`,
      "aria-label": `v${note.version}`,
      "aria-current": position === index ? "page" : void 0,
      onClick: () => {
        onSelect(position);
      }
    },
    note.version
  )) });
}
function ReleaseNotesSection({
  notes = RELEASE_NOTES,
  currentVersion = PLUGIN_VERSION
}) {
  const [index, setIndex] = (0, import_react21.useState)(0);
  const select = (next) => {
    setIndex(Math.min(Math.max(next, 0), notes.length - 1));
  };
  const position = Math.min(Math.max(index, 0), notes.length - 1);
  const note = notes[position];
  if (note === void 0) return /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("p", { className: `${NOTES_CLASS}-empty`, children: EMPTY_TEXT2 });
  return /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("section", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("p", { className: "vyra-agent-cli-manager-settings-intro", children: INTRO2 }),
    /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("div", { className: NOTES_CLASS, children: [
      /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("div", { className: `${NOTES_CLASS}-page`, role: "group", "aria-label": pageName(note.version), children: [
        /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("div", { className: `${NOTES_CLASS}-head`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)("span", { className: `${NOTES_CLASS}-version`, children: [
            "v",
            note.version
          ] }),
          note.version === currentVersion ? /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: `${NOTES_CLASS}-current`, children: CURRENT_LABEL }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime30.jsx)("span", { className: `${NOTES_CLASS}-date`, children: note.date }),
          /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(Pager, { index: position, count: notes.length, onSelect: select })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(NotesBody, { note })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(Dots, { index: position, notes, onSelect: select })
    ] })
  ] });
}

// src/client/settings-tabs.tsx
var import_react22 = require("react");
var import_jsx_runtime31 = require("react/jsx-runtime");
var TABS_CLASS = "vyra-agent-cli-manager-tabs";
var SETTINGS_TABS_STYLES = `
.${TABS_CLASS} { display: flex; gap: 24px; margin: 4px 0 8px; border-bottom: 0.5px solid var(--dsw-alias-border-l2); }
.${TABS_CLASS}-tab { position: relative; margin: 0 0 -0.5px; padding: 8px 0; border: none; background: none; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 13px; line-height: 20px; cursor: pointer; }
.${TABS_CLASS}-tab:hover { color: var(--dsw-alias-label-primary); }
.${TABS_CLASS}-tab[aria-selected="true"] { color: var(--dsw-alias-label-primary); font-weight: 500; }
.${TABS_CLASS}-tab[aria-selected="true"]::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; border-radius: 1px; background: var(--dsw-alias-label-primary); }
.${TABS_CLASS}-tab:focus-visible { outline: 2px solid var(--dsw-alias-border-focus, currentColor); outline-offset: 2px; border-radius: 4px; }
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
  return /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(
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
  const [selected, setSelected] = (0, import_react22.useState)(tabs[0]?.id);
  const strip = (0, import_react22.useRef)(null);
  const prefix = (0, import_react22.useId)();
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
  return /* @__PURE__ */ (0, import_jsx_runtime31.jsxs)(import_jsx_runtime31.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime31.jsx)("div", { ref: strip, className: TABS_CLASS, role: "tablist", "aria-label": label, onKeyDown, children: tabs.map((tab) => /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(
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
    current === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime31.jsx)("div", { role: "tabpanel", id: `${prefix}-${current.id}-panel`, "aria-labelledby": `${prefix}-${current.id}-tab`, children: current.render() })
  ] });
}

// src/client/settings-page.tsx
var import_jsx_runtime32 = require("react/jsx-runtime");
var SETTINGS_TITLE = "Agent CLI Manager \u8BBE\u7F6E";
var CLI_STATUS_TAB_LABEL = "Agent CLI";
var MCP_TAB_LABEL = "MCP";
var CLI_TAB_LABEL = "CLI \u5217\u8868";
var FEATURES_TAB_LABEL = "\u754C\u9762\u4EA4\u4E92";
var MORE_TAB_LABEL = "\u66F4\u591A\u529F\u80FD";
var NOTES_TAB_LABEL = "\u7248\u672C\u8BB0\u5F55";
var PAGE_CLASS2 = "vyra-agent-cli-manager-settings";
var SETTINGS_PAGE_STYLES = `
.${PAGE_CLASS2} { display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; max-width: 720px; color: var(--dsw-alias-label-primary); }
.${PAGE_CLASS2}-header { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; }
.${PAGE_CLASS2} h1 { margin: 0; color: var(--dsw-alias-label-primary); font-size: 16px; line-height: 24px; font-weight: 500; }
.${PAGE_CLASS2}-intro { margin: 0 0 12px; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.${PAGE_CLASS2}-list { margin: 0; padding: 0; list-style: none; }
/* The host paints an on switch with the brand color, which is near-white in the dark theme;
   a green track (with a white thumb) reads as "on" at a glance in both themes. */
.${PAGE_CLASS2} [role="switch"][aria-checked="true"] { background: var(--dsw-alias-state-success-primary, #2da44e); }
.${PAGE_CLASS2} [role="switch"][aria-checked="true"] > span { background: #fff; }
.${PAGE_CLASS2}-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; }
.${PAGE_CLASS2}-row + .${PAGE_CLASS2}-row { border-top: 0.5px solid var(--dsw-alias-border-l2); }
.${PAGE_CLASS2}-title { color: var(--dsw-alias-label-primary); font-size: 13px; font-weight: 500; line-height: 20px; }
.${PAGE_CLASS2}-desc { margin-top: 2px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
${SETTINGS_TABS_STYLES}${CLI_STATUS_STYLES}${MCP_TAB_STYLES}${CLI_PREFS_STYLES}${SETTINGS_ABOUT_STYLES}${MORE_SECTION_STYLES}${RELEASE_NOTES_STYLES}`;
function SettingsPage({
  settings,
  cliPrefs
}) {
  const tabs = [
    { id: "clis", label: CLI_STATUS_TAB_LABEL, render: () => /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(CliStatusSection, {}) },
    { id: "mcp", label: MCP_TAB_LABEL, render: () => /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(McpTab, {}) },
    { id: "cli", label: CLI_TAB_LABEL, render: () => /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(CliPrefsSection, { prefs: cliPrefs }) },
    { id: "features", label: FEATURES_TAB_LABEL, render: () => /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(FeaturesSection, { settings }) },
    { id: "more", label: MORE_TAB_LABEL, render: () => /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(MoreSection, {}) },
    { id: "notes", label: NOTES_TAB_LABEL, render: () => /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(ReleaseNotesSection, {}) }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: PAGE_CLASS2, children: [
    /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)("div", { className: `${PAGE_CLASS2}-header`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime32.jsx)("h1", { children: SETTINGS_TITLE }),
      /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(SettingsAbout, {})
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(SettingsTabs, { tabs, label: SETTINGS_TITLE })
  ] });
}
function SettingsIcon({ size }) {
  return /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(import_dsh_client_ui_primitives15.IconSlidersTwoOutlineRegular, { size });
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
var import_react28 = require("react");

// src/client/worktree/worktree-api.ts
function createWorktreeApi(fetchFn, cwd) {
  const post2 = gitPost(fetchFn, cwd);
  return {
    info: () => post2("worktree-info"),
    create: (request) => post2("worktree-add", request)
  };
}

// src/client/worktree/worktree-dialog.tsx
var import_react25 = require("react");
var import_dsh_client_ui_primitives18 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/worktree/worktree-fields.tsx
var import_react24 = require("react");
var import_dsh_client_ui_primitives17 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/worktree/branch-picker.tsx
var import_react23 = require("react");
var import_dsh_client_ui_primitives16 = require("@deepseek-ai/dsh-client-ui-primitives");

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
var import_jsx_runtime33 = require("react/jsx-runtime");
var MAX_OPTIONS = 100;
function matchingBranches(options, query) {
  const needle = query.trim().toLowerCase();
  const listed = needle === "" || options.includes(query.trim()) ? options : options.filter((name) => name.toLowerCase().includes(needle));
  return listed.slice(0, MAX_OPTIONS);
}
function usePickerKeys(matches, choose) {
  const [open, setOpen] = (0, import_react23.useState)(false);
  const [active, setActive] = (0, import_react23.useState)(0);
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
  return /* @__PURE__ */ (0, import_jsx_runtime33.jsx)(import_dsh_client_ui_primitives16.MenuSurface, { id: props.id, role: "listbox", className: WT.options, children: props.matches.map((name, index) => /* @__PURE__ */ (0, import_jsx_runtime33.jsx)(
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
function BranchPicker2(props) {
  const { id, value, options, placeholder, disabled, onChange } = props;
  const listId = (0, import_react23.useId)();
  const matches = matchingBranches(options, value);
  const keys = usePickerKeys(matches, onChange);
  const shown = keys.open && matches.length > 0;
  return /* @__PURE__ */ (0, import_jsx_runtime33.jsxs)("div", { className: WT.picker, children: [
    /* @__PURE__ */ (0, import_jsx_runtime33.jsx)(
      import_dsh_client_ui_primitives16.Input,
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
    shown ? /* @__PURE__ */ (0, import_jsx_runtime33.jsx)(
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
var import_jsx_runtime34 = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime34.jsx)("div", { role: "tablist", "aria-label": "Worktree \u6765\u6E90", className: WT.tabs, children: MODES.map((mode) => /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(
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
  return /* @__PURE__ */ (0, import_jsx_runtime34.jsxs)("div", { className: WT.field, children: [
    /* @__PURE__ */ (0, import_jsx_runtime34.jsx)("label", { htmlFor: props.id, className: WT.label, children: props.label }),
    props.children,
    props.hint === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime34.jsx)("span", { className: WT.hint, children: props.hint })
  ] });
}
function TextField(props) {
  const id = (0, import_react24.useId)();
  return /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(Field, { id, label: props.label, ...props.hint === void 0 ? {} : { hint: props.hint }, children: /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(
    import_dsh_client_ui_primitives17.Input,
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
  const id = (0, import_react24.useId)();
  return /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(Field, { id, label: props.label, hint: props.hint, children: /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(BranchPicker2, { ...props, id }) });
}
function SourceFields({ form, info, disabled, onChange }) {
  const branches = [...info.local, ...info.remote];
  if (form.mode === "new") {
    return /* @__PURE__ */ (0, import_jsx_runtime34.jsxs)(import_jsx_runtime34.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(
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
      /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(
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
    return /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(
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
  return /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(PrFields, { form, disabled, onChange });
}
function PrFields({ form, disabled, onChange }) {
  return /* @__PURE__ */ (0, import_jsx_runtime34.jsxs)(import_jsx_runtime34.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(
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
  return /* @__PURE__ */ (0, import_jsx_runtime34.jsxs)("div", { className: WT.body, children: [
    /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(ModeTabs, { form, disabled, onChange }),
    /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(SourceFields, { ...props }),
    /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime34.jsxs)("div", { className: WT.toggle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(
        import_dsh_client_ui_primitives17.Switch,
        {
          checked: form.openSession,
          label: OPEN_SESSION,
          disabled,
          onChange: (openSession) => {
            onChange({ ...form, openSession });
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime34.jsx)("span", { "aria-hidden": "true", children: OPEN_SESSION })
    ] })
  ] });
}

// src/client/worktree/worktree-dialog.tsx
var import_jsx_runtime35 = require("react/jsx-runtime");
var TITLE4 = "\u65B0\u5EFA Worktree";
var CLOSE3 = "\u5173\u95ED";
var CANCEL2 = "\u53D6\u6D88";
var CREATE = "\u521B\u5EFA Worktree";
var CREATING = "\u6B63\u5728\u521B\u5EFA\u2026";
var LOADING = "\u6B63\u5728\u8BFB\u53D6\u4ED3\u5E93\u4FE1\u606F\u2026";
var NOT_A_REPO2 = "\u8FD9\u4E2A\u5DE5\u4F5C\u533A\u4E0D\u5728 Git \u4ED3\u5E93\u91CC\uFF0C\u65E0\u6CD5\u521B\u5EFA worktree\u3002";
var NOT_READY = "\u8FD8\u6CA1\u6709\u8BFB\u5230\u4ED3\u5E93\u4FE1\u606F";
function messageOf2(error) {
  return error instanceof Error ? error.message : String(error);
}
function useRepoInfo(api) {
  const [state, setState] = (0, import_react25.useState)({ phase: "loading" });
  (0, import_react25.useEffect)(() => {
    let live = true;
    api.info().then(
      (answer) => {
        if (live) setState(answer.repo ? { phase: "ready", info: answer } : { phase: "failed", message: NOT_A_REPO2 });
      },
      (error) => {
        if (live) setState({ phase: "failed", message: messageOf2(error) });
      }
    );
    return () => {
      live = false;
    };
  }, [api]);
  return state;
}
function useCreate(props) {
  const [busy, setBusy] = (0, import_react25.useState)(false);
  const [error, setError] = (0, import_react25.useState)();
  const create = async (form, info) => {
    setBusy(true);
    setError(void 0);
    try {
      const created = await props.api.create(requestOf(form, info));
      if (!("path" in created)) throw new Error(NOT_A_REPO2);
      const title = workspaceTitle(info, created.branch);
      await props.onCreated({ ...created, title, openSession: form.openSession });
      props.onClose();
    } catch (reason) {
      setError(messageOf2(reason));
      setBusy(false);
    }
  };
  return { busy, error, create };
}
function Footer(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime35.jsxs)("div", { className: WT.footer, children: [
    /* @__PURE__ */ (0, import_jsx_runtime35.jsx)(import_dsh_client_ui_primitives18.Button, { variant: "ghost", disabled: props.busy, onClick: props.onCancel, children: CANCEL2 }),
    /* @__PURE__ */ (0, import_jsx_runtime35.jsx)(
      import_dsh_client_ui_primitives18.Button,
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
  return /* @__PURE__ */ (0, import_jsx_runtime35.jsx)("p", { className: WT.status, role: state.phase === "failed" ? "alert" : "status", children: state.phase === "loading" ? LOADING : state.message });
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
  const [edited, setForm] = (0, import_react25.useState)();
  const form = edited ?? (info === void 0 ? void 0 : initialForm(info));
  const { busy, error, create } = useCreate(props);
  const problem = info === void 0 || form === void 0 ? NOT_READY : formProblem(form, info);
  const submit = () => {
    if (info !== void 0 && form !== void 0 && problem === void 0 && !busy) void create(form, info);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime35.jsx)(
    import_dsh_client_ui_primitives18.Modal,
    {
      open: true,
      title: TITLE4,
      ...info === void 0 ? {} : { description: `\u57FA\u4E8E\u4ED3\u5E93 ${info.name}` },
      closeLabel: CLOSE3,
      className: WT.dialog,
      onClose: busy ? () => void 0 : props.onClose,
      footer: /* @__PURE__ */ (0, import_jsx_runtime35.jsx)(Footer, { busy, problem, onCancel: props.onClose, onCreate: submit }),
      children: state.phase !== "ready" || form === void 0 ? state.phase !== "ready" && /* @__PURE__ */ (0, import_jsx_runtime35.jsx)(StatusLine, { state }) : /* @__PURE__ */ (0, import_jsx_runtime35.jsxs)("div", { onKeyDown: onEnter(submit), children: [
        /* @__PURE__ */ (0, import_jsx_runtime35.jsx)(WorktreeFields, { form, info: state.info, disabled: busy, onChange: setForm }),
        error === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime35.jsx)("p", { role: "alert", className: WT.error, children: error })
      ] })
    }
  );
}

// src/client/worktree/worktree-icons.tsx
var import_jsx_runtime36 = require("react/jsx-runtime");
var STROKE = { stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round" };
function NewWorktreeIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime36.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime36.jsx)("circle", { cx: "4.5", cy: "3.5", r: "1.5", ...STROKE }),
    /* @__PURE__ */ (0, import_jsx_runtime36.jsx)("circle", { cx: "4.5", cy: "12.5", r: "1.5", ...STROKE }),
    /* @__PURE__ */ (0, import_jsx_runtime36.jsx)("circle", { cx: "11.5", cy: "5", r: "1.5", ...STROKE }),
    /* @__PURE__ */ (0, import_jsx_runtime36.jsx)("path", { d: "M4.5 5v6M11.5 6.5c0 2.5-3 2.5-6.2 4.6", ...STROKE }),
    /* @__PURE__ */ (0, import_jsx_runtime36.jsx)("path", { d: "M12.5 10.5v4M10.5 12.5h4", ...STROKE })
  ] });
}
function BranchIcon2() {
  return /* @__PURE__ */ (0, import_jsx_runtime36.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime36.jsx)("circle", { cx: "5", cy: "3.5", r: "1.5", ...STROKE }),
    /* @__PURE__ */ (0, import_jsx_runtime36.jsx)("circle", { cx: "5", cy: "12.5", r: "1.5", ...STROKE }),
    /* @__PURE__ */ (0, import_jsx_runtime36.jsx)("circle", { cx: "11.5", cy: "5", r: "1.5", ...STROKE }),
    /* @__PURE__ */ (0, import_jsx_runtime36.jsx)("path", { d: "M5 5v6M11.5 6.5c0 2.5-3 2.5-5.8 4.6", ...STROKE })
  ] });
}
function ChevronIcon2() {
  return /* @__PURE__ */ (0, import_jsx_runtime36.jsx)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime36.jsx)("path", { d: "M6.5 4.5 10 8l-3.5 3.5", ...STROKE }) });
}
function NewSessionIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime36.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime36.jsx)("path", { d: "M8 2.5a5.5 5.5 0 1 0 2.6 10.35L13.5 13.5l-.65-2.9A5.5 5.5 0 0 0 8 2.5Z", ...STROKE }),
    /* @__PURE__ */ (0, import_jsx_runtime36.jsx)("path", { d: "M8 5.75v4.5M5.75 8h4.5", ...STROKE })
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
var import_react27 = require("react");
var import_react_dom3 = require("react-dom");

// src/client/worktree/worktree-anchors.ts
var import_react26 = require("react");
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
  const [anchors, setAnchors] = (0, import_react26.useState)(/* @__PURE__ */ new Map());
  const key = ids.join("\n");
  (0, import_react26.useEffect)(() => {
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
  (0, import_react26.useEffect)(() => {
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
var import_dsh_client_ui_primitives19 = require("@deepseek-ai/dsh-client-ui-primitives");

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
var import_jsx_runtime37 = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime37.jsxs)(
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
        /* @__PURE__ */ (0, import_jsx_runtime37.jsx)("span", { className: WG.label, children: row.title }),
        row.running ? /* @__PURE__ */ (0, import_jsx_runtime37.jsx)(import_dsh_client_ui_primitives19.StateDot, { state: "ongoing" }) : /* @__PURE__ */ (0, import_jsx_runtime37.jsx)("span", { className: WG.time, children: relativeTime(row.updatedAt, now) })
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
  return /* @__PURE__ */ (0, import_jsx_runtime37.jsxs)(
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
        /* @__PURE__ */ (0, import_jsx_runtime37.jsx)("span", { className: WG.chevron, children: /* @__PURE__ */ (0, import_jsx_runtime37.jsx)(ChevronIcon2, {}) }),
        /* @__PURE__ */ (0, import_jsx_runtime37.jsx)("span", { className: WG.glyph, children: /* @__PURE__ */ (0, import_jsx_runtime37.jsx)(BranchIcon2, {}) }),
        /* @__PURE__ */ (0, import_jsx_runtime37.jsx)("span", { className: WG.label, children: entry.branch }),
        /* @__PURE__ */ (0, import_jsx_runtime37.jsx)(
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
            children: /* @__PURE__ */ (0, import_jsx_runtime37.jsx)(NewSessionIcon, {})
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
  return /* @__PURE__ */ (0, import_jsx_runtime37.jsxs)(import_jsx_runtime37.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime37.jsx)(WorktreeRow, { entry, open, actions }),
    open ? /* @__PURE__ */ (0, import_jsx_runtime37.jsxs)("div", { role: "group", children: [
      rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime37.jsx)("div", { className: WG.empty, children: NO_SESSIONS }) : null,
      rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime37.jsx)(SessionItem, { row, actions, now }, row.id))
    ] }) : null
  ] });
}
function WorktreeGroup(props) {
  const { parent, entries, actions } = props;
  const holdsCurrent = entries.some(
    (entry) => sessionRows(entry, props.sessions, props.archived).some((row) => row.current)
  );
  const open = isOpen(props.expansion, "groups", parent.workspaceId, holdsCurrent);
  return /* @__PURE__ */ (0, import_jsx_runtime37.jsxs)("div", { className: WG.group, children: [
    /* @__PURE__ */ (0, import_jsx_runtime37.jsxs)("div", { className: WG.header, children: [
      /* @__PURE__ */ (0, import_jsx_runtime37.jsxs)(
        "button",
        {
          type: "button",
          className: WG.toggle,
          "aria-expanded": open,
          onClick: () => {
            actions.setOpen("groups", parent.workspaceId, !open);
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime37.jsx)("span", { className: WG.chevron, children: /* @__PURE__ */ (0, import_jsx_runtime37.jsx)(ChevronIcon2, {}) }),
            `${GROUP_LABEL} \xB7 ${String(entries.length)}`
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime37.jsx)(
        "button",
        {
          type: "button",
          className: WG.iconButton,
          "aria-label": NEW_WORKTREE,
          title: NEW_WORKTREE,
          onClick: () => {
            actions.newWorktree(parent);
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime37.jsx)(NewWorktreeIcon, {})
        }
      )
    ] }),
    open ? /* @__PURE__ */ (0, import_jsx_runtime37.jsx)("div", { role: "group", "aria-label": GROUP_LABEL, children: entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime37.jsx)(WorktreeItem, { ...props, entry }, entry.workspaceId)) }) : null
  ] });
}

// src/client/worktree/worktree-tree.tsx
var import_jsx_runtime38 = require("react/jsx-runtime");
var NO_ITEMS = [];
var CLOCK_MS = 6e4;
function useNow() {
  const [now, setNow] = (0, import_react27.useState)(() => Date.now());
  (0, import_react27.useEffect)(() => {
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
  (0, import_react27.useEffect)(() => {
    checkouts.track(items.map((item) => item.path));
  }, [checkouts, items]);
  const layout = (0, import_react27.useMemo)(() => layoutWorktrees(items, known), [items, known]);
  const archived = (0, import_react27.useMemo)(() => new Set(workspaces.archivedSessionIds), [workspaces.archivedSessionIds]);
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
    const group = /* @__PURE__ */ (0, import_jsx_runtime38.jsx)(
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
    return [/* @__PURE__ */ (0, import_jsx_runtime38.jsx)(import_react27.Fragment, { children: (0, import_react_dom3.createPortal)(group, anchor) }, parentId)];
  });
  return /* @__PURE__ */ (0, import_jsx_runtime38.jsx)(import_jsx_runtime38.Fragment, { children: groups });
}

// src/client/worktree/worktree-register.tsx
var import_jsx_runtime39 = require("react/jsx-runtime");
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
function messageOf3(error) {
  return error instanceof Error ? error.message : String(error);
}
function finisher(services) {
  return async (created) => {
    let workspaceId;
    try {
      workspaceId = (await services.workspaces.create({ path: created.path })).workspaceId;
    } catch (error) {
      throw new Error(`Worktree \u5DF2\u521B\u5EFA\u5728 ${created.path}\uFF0C\u4F46\u6CA1\u80FD\u52A0\u5165\u4FA7\u8FB9\u680F\uFF1A${messageOf3(error)}`, { cause: error });
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
  const api = (0, import_react28.useMemo)(
    () => target === void 0 ? void 0 : createWorktreeApi(fetchFn, target.path),
    [fetchFn, target]
  );
  if (target === void 0 || api === void 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime39.jsx)(WorktreeDialog, { api, onCreated: finish, onClose: requests.close }, target.workspaceId);
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
var import_jsx_runtime40 = require("react/jsx-runtime");
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
  tag.textContent = `${STYLES}${MODEL_MENU_STYLES}${TERMINAL_ENTRY_STYLES}${LAUNCH_SCRIPT_STYLES}${SESSION_TREE_STYLES}${SESSION_STATUS_STYLES}${SETTINGS_PAGE_STYLES}${CHANGES_STYLES}${WORKTREE_STYLES}${WORKTREE_GROUP_STYLES}`;
  document.head.append(tag);
  return () => {
    tag.remove();
  };
}
function useStarted2(session) {
  const snapshot = (0, import_react29.useSyncExternalStore)(
    (listener) => session?.subscribe(listener) ?? (() => {
    }),
    () => session?.getSnapshot() ?? NOT_STARTED
  );
  return snapshot.blank === false;
}
function useChoose(state, select) {
  const [error, setError] = (0, import_react29.useState)();
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
  const [open, setOpen] = (0, import_react29.useState)(false);
  const { error, choose } = useChoose(state, select);
  (0, import_react29.useEffect)(load, [load]);
  const { visible, items: listed, currentId, currentLabel } = cliChoices(state);
  (0, import_react29.useEffect)(() => {
    prefs.remember(listed);
  }, [prefs, listed]);
  if (!visible) return null;
  const items = arrangeChoices(listed, prefsSnapshot);
  const hint = started ? "\u8981\u6362 CLI\uFF0C\u8BF7\u65B0\u5EFA\u4F1A\u8BDD" : error ?? "\u5207\u6362 CLI";
  const label = error === void 0 ? currentLabel ?? NO_CHOICE_LABEL : SWITCH_FAILED_LABEL;
  return /* @__PURE__ */ (0, import_jsx_runtime40.jsx)(
    import_dsh_client_ui_primitives20.Menu,
    {
      open: open && !started,
      className: WRAP_CLASS,
      items: items.map((item) => ({ ...item, icon: /* @__PURE__ */ (0, import_jsx_runtime40.jsx)(ProviderMark, { provider: item.id, size: 14 }) })),
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
      anchor: /* @__PURE__ */ (0, import_jsx_runtime40.jsxs)(
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
            currentId === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime40.jsx)(ProviderMark, { provider: currentId, size: 14 }),
            label,
            started ? null : /* @__PURE__ */ (0, import_jsx_runtime40.jsx)(import_dsh_client_ui_primitives20.IconChevronDownOutlineRegular, { size: 14 })
          ]
        }
      )
    }
  );
}
function SessionMark({ sessionId, list }) {
  const provider = useSessionProvider(list, sessionId);
  if (provider === void 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime40.jsx)("span", { className: SESSION_MARK_CLASS, children: /* @__PURE__ */ (0, import_jsx_runtime40.jsx)(ProviderMark, { provider, size: 14 }) });
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
  const changes = {
    inject: gateInject(ctx, settings, "gitChanges", (deps, apply2) => ctx.inject(deps, apply2))
  };
  const worktree = {
    inject: gateInject(ctx, settings, "worktree", (deps, apply2) => ctx.inject(deps, apply2))
  };
  registerFilesDefault(files);
  const fetchFn = (input, init) => window.fetch(input, init);
  registerChanges(changes, ctx.sessions.list, fetchFn);
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

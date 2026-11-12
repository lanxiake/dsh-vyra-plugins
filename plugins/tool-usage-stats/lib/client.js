window.__ModuleLoader__.load({ id: "vyra-tool-usage-stats", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
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

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var ENDPOINT = "/api/vyra/tool-usage";
var REFRESH_MS = 5e3;
async function fetchStats() {
  try {
    const response = await globalThis.fetch(ENDPOINT, { credentials: "include" });
    if (!response.ok) return void 0;
    return await response.json();
  } catch {
    return void 0;
  }
}
function relativeAge(at, now) {
  if (at === 0) return "\u2014";
  const seconds = Math.max(0, Math.round((now - at) / 1e3));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}
function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}
var COLUMNS = [
  { key: "tool", label: "Tool", numeric: false },
  { key: "count", label: "Calls", numeric: true },
  { key: "errorRate", label: "Failures", numeric: true },
  { key: "lastUsedAt", label: "Last used", numeric: false }
];
function createSection(React, ctx) {
  const h = React.createElement;
  return function ToolUsageSection() {
    const [data, setData] = React.useState(void 0);
    const [now, setNow] = React.useState(() => Date.now());
    const [sortKey, setSortKey] = React.useState("count");
    const [ascending, setAscending] = React.useState(false);
    React.useEffect(() => {
      let cancelled = false;
      const refresh = () => {
        void fetchStats().then((next) => {
          if (cancelled) return;
          setData(next);
          setNow(Date.now());
        });
      };
      refresh();
      const timer = setInterval(refresh, REFRESH_MS);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }, []);
    const rows = React.useMemo(() => {
      if (data === void 0) return [];
      const sorted = [...data.global.rows];
      sorted.sort((left, right) => {
        const delta = sortKey === "tool" ? left.tool.localeCompare(right.tool) : left[sortKey] - right[sortKey];
        return ascending ? delta : -delta;
      });
      return sorted;
    }, [data, sortKey, ascending]);
    const sortBy = (key) => {
      if (key === sortKey) {
        setAscending((value) => !value);
        return;
      }
      setSortKey(key);
      setAscending(false);
    };
    if (data === void 0) {
      return h("p", { style: { opacity: 0.7 } }, "Reading tool usage\u2026");
    }
    if (data.global.tools === 0) {
      return h("p", { style: { opacity: 0.7 } }, "No tool calls recorded yet.");
    }
    const header = COLUMNS.map((column) => h("th", {
      key: column.key,
      onClick: () => {
        sortBy(column.key);
      },
      style: {
        textAlign: column.numeric ? "right" : "left",
        cursor: "pointer",
        userSelect: "none",
        paddingBottom: "4px"
      }
    }, `${column.label}${column.key === sortKey ? ascending ? " \u2191" : " \u2193" : ""}`));
    const body = rows.map((row) => h(
      "tr",
      { key: row.tool },
      h("td", { style: { padding: "3px 0" } }, row.tool),
      h("td", { style: { textAlign: "right" } }, String(row.count)),
      h(
        "td",
        { style: { textAlign: "right" } },
        row.errorCount === 0 ? "\u2014" : `${row.errorCount} (${percent(row.errorRate)})`
      ),
      h("td", null, relativeAge(row.lastUsedAt, now))
    ));
    return h(
      "div",
      { style: { padding: "16px" } },
      h(
        "p",
        { style: { opacity: 0.7, marginTop: 0 } },
        `${data.global.tools} tool${data.global.tools === 1 ? "" : "s"} \xB7 ${data.global.calls} call${data.global.calls === 1 ? "" : "s"} \xB7 ${data.global.failures} failure${data.global.failures === 1 ? "" : "s"}`
      ),
      h(
        "table",
        { style: { width: "100%", borderCollapse: "collapse", fontSize: "0.9em" } },
        h("thead", null, h("tr", null, header)),
        h("tbody", null, body)
      )
    );
  };
}
function apply(ctx) {
  const React = require("react");
  const Section = createSection(React, ctx);
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "vyra-tool-usage",
    order: 50,
    label: () => "Tool usage"
  }, Section));
}
var inject = ["slots"];
return module.exports; } });

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
var EXPORT_ENDPOINT = "/api/vyra/tool-usage/export";
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
function formatTime(at, withYear = false) {
  if (at === 0) return "\u2014";
  const date = new Date(at);
  const pad = (value) => String(value).padStart(2, "0");
  const md = `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return withYear || date.getFullYear() !== (/* @__PURE__ */ new Date()).getFullYear() ? `${date.getFullYear()}-${md}` : md;
}
var WINDOWS = [
  { value: "0", label: "\u7D2F\u8BA1" },
  { value: "7", label: "\u6700\u8FD1 7 \u5929" },
  { value: "30", label: "\u6700\u8FD1 30 \u5929" }
];
var COLUMNS = [
  { key: "tool", label: "\u5DE5\u5177", numeric: false },
  { key: "count", label: "\u8C03\u7528\u6B21\u6570", numeric: true },
  { key: "errorCount", label: "\u5931\u8D25", numeric: true },
  { key: "lastUsedAt", label: "\u6700\u540E\u4F7F\u7528", numeric: false }
];
var CELL = {
  padding: "4px 0",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};
var NUMERIC_CELL = { ...CELL, textAlign: "right", paddingRight: "14px" };
function createPanel(React) {
  const h = React.createElement;
  return function ToolUsagePanel() {
    const [data, setData] = React.useState(void 0);
    const [windowDays, setWindowDays] = React.useState(0);
    const [sortKey, setSortKey] = React.useState("count");
    const [ascending, setAscending] = React.useState(false);
    const [expanded, setExpanded] = React.useState(void 0);
    React.useEffect(() => {
      let cancelled = false;
      const refresh = () => {
        void fetchStats().then((next) => {
          if (cancelled) return;
          setData(next);
        });
      };
      refresh();
      const timer = setInterval(refresh, REFRESH_MS);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }, []);
    const report = data === void 0 ? void 0 : windowDays === 0 ? data.global : data.windows[String(windowDays)];
    const rows = React.useMemo(() => {
      if (report === void 0) return [];
      const sorted = [...report.rows];
      sorted.sort((left, right) => {
        const delta = sortKey === "tool" ? left.tool.localeCompare(right.tool) : left[sortKey] - right[sortKey];
        return ascending ? delta : -delta;
      });
      return sorted;
    }, [report, sortKey, ascending]);
    const sortBy = (key) => {
      if (key === sortKey) {
        setAscending((value) => !value);
        return;
      }
      setSortKey(key);
      setAscending(false);
    };
    if (data === void 0) return h("p", { style: { opacity: 0.7 } }, "\u6B63\u5728\u8BFB\u53D6\u5DE5\u5177\u7528\u91CF\u2026");
    const windowLabel = WINDOWS.find((option) => Number(option.value) === windowDays)?.label ?? "\u7D2F\u8BA1";
    const toolbar = h(
      "div",
      {
        style: { display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "10px" }
      },
      h(
        "label",
        { style: { display: "flex", gap: "6px", alignItems: "center" } },
        "\u7EDF\u8BA1\u8303\u56F4",
        h("select", {
          value: String(windowDays),
          onChange: (event) => {
            setWindowDays(Number(event.target.value));
          },
          style: { padding: "3px 6px" }
        }, WINDOWS.map((option) => h("option", { key: option.value, value: option.value }, option.label)))
      ),
      h("a", {
        href: EXPORT_ENDPOINT,
        download: "",
        style: { marginLeft: "auto", fontSize: "0.9em" }
      }, "\u5BFC\u51FA JSON")
    );
    const coverageNote = data.coverage.since === null ? null : h(
      "p",
      { style: { opacity: 0.6, fontSize: "0.85em", margin: "0 0 10px" } },
      `\u6309\u65E5\u6570\u636E\u8986\u76D6 ${data.coverage.since} \u81F3 ${data.coverage.until}\uFF08\u4FDD\u7559 ${data.coverage.retentionDays} \u5929\uFF09`
    );
    if (report === void 0 || report.tools === 0) {
      return h(
        "div",
        { style: { padding: "16px" } },
        toolbar,
        coverageNote,
        h("p", { style: { opacity: 0.7 } }, emptyText(windowDays, data.coverage))
      );
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
        paddingBottom: "4px",
        whiteSpace: "nowrap",
        ...column.numeric ? { paddingRight: "14px" } : {}
      }
    }, `${column.label}${column.key === sortKey ? ascending ? " \u2191" : " \u2193" : ""}`));
    const body = rows.flatMap((row) => {
      const samples = data.failures[row.tool] ?? [];
      const open = expanded === row.tool;
      const cells = h(
        "tr",
        { key: row.tool },
        h("td", { style: { ...CELL, fontFamily: "monospace" } }, row.tool),
        h("td", { style: NUMERIC_CELL }, String(row.count)),
        h(
          "td",
          { style: NUMERIC_CELL },
          row.errorCount === 0 ? "\u2014" : h("button", {
            type: "button",
            onClick: () => {
              setExpanded(open ? void 0 : row.tool);
            },
            disabled: samples.length === 0,
            title: samples.length === 0 ? "\u6CA1\u6709\u4FDD\u7559\u7684\u5931\u8D25\u8BB0\u5F55" : "\u5C55\u5F00\u67E5\u770B\u5931\u8D25\u539F\u56E0",
            style: {
              background: "none",
              border: "none",
              padding: 0,
              cursor: samples.length === 0 ? "default" : "pointer",
              color: "inherit",
              textDecoration: samples.length === 0 ? "none" : "underline dotted"
            }
          }, `${row.errorCount}${open ? " \u25BE" : " \u25B8"}`)
        ),
        h("td", { style: CELL }, formatTime(row.lastUsedAt))
      );
      if (!open || samples.length === 0) return [cells];
      const detail = h(
        "tr",
        { key: `${row.tool}-detail` },
        h(
          "td",
          { colSpan: COLUMNS.length, style: { padding: "6px 0 10px 16px" } },
          h(
            "div",
            { style: { fontSize: "0.85em", opacity: 0.85, display: "grid", gap: "5px" } },
            samples.map((sample, index) => h(
              "div",
              {
                key: `${sample.at}-${index}`,
                style: { display: "grid", gridTemplateColumns: "auto auto 1fr", gap: "8px", alignItems: "baseline" }
              },
              h("span", { style: { opacity: 0.7, whiteSpace: "nowrap" } }, formatTime(sample.at, true)),
              sample.code === void 0 ? h("span") : h("code", { style: { opacity: 0.75, fontSize: "0.95em" } }, sample.code),
              h("span", { style: { wordBreak: "break-word" } }, sample.summary)
            ))
          )
        )
      );
      return [cells, detail];
    });
    return h(
      "div",
      { style: { padding: "16px" } },
      toolbar,
      coverageNote,
      h(
        "p",
        { style: { opacity: 0.7, margin: "0 0 8px" } },
        `${report.tools} \u4E2A\u5DE5\u5177 \xB7 ${windowLabel}\u5171 ${report.calls} \u6B21\u8C03\u7528` + (report.failures > 0 ? ` \xB7 ${report.failures} \u6B21\u5931\u8D25` : "")
      ),
      // Fixed layout with explicit widths: without them the browser sizes
      // columns to content, and a wide failure cell pushes the last-used column
      // into it so the two read as one run of text.
      h(
        "table",
        {
          style: {
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.9em",
            tableLayout: "fixed"
          }
        },
        h(
          "colgroup",
          null,
          h("col", { style: { width: "34%" } }),
          h("col", { style: { width: "16%" } }),
          h("col", { style: { width: "20%" } }),
          h("col", { style: { width: "30%" } })
        ),
        h("thead", null, h("tr", null, header)),
        h("tbody", null, body)
      )
    );
  };
}
function emptyText(windowDays, coverage) {
  if (windowDays === 0) return "\u8FD8\u6CA1\u6709\u4EFB\u4F55\u5DE5\u5177\u8C03\u7528\u8BB0\u5F55\u2014\u2014\u5148\u8BA9 Agent \u5E72\u70B9\u6D3B\u3002";
  if (coverage.since === null) {
    return `\u6700\u8FD1 ${windowDays} \u5929\u6CA1\u6709\u5DE5\u5177\u8C03\u7528\u8BB0\u5F55\u3002\u6309\u65E5\u7EDF\u8BA1\u9700\u8981\u5148\u6709\u8C03\u7528\u624D\u4F1A\u5F00\u59CB\u7D2F\u79EF\u3002`;
  }
  return `\u6700\u8FD1 ${windowDays} \u5929\u6CA1\u6709\u5DE5\u5177\u8C03\u7528\u8BB0\u5F55\u3002\u6309\u65E5\u6570\u636E\u6700\u65E9\u53EA\u5230 ${coverage.since}\uFF0C\u66F4\u65E9\u7684\u5386\u53F2\u5728\u300C\u7D2F\u8BA1\u300D\u91CC\u3002`;
}
function apply(ctx) {
  const React = require("react");
  const Panel = createPanel(React);
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "vyra-tool-usage",
    order: 50,
    label: () => "\u5DE5\u5177\u7528\u91CF"
  }, Panel));
}
var inject = ["slots"];
return module.exports; } });

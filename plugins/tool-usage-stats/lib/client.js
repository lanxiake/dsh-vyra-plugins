window.__ModuleLoader__.load({ id: "dsh-vyra-tool-usage-stats", factory: (require) => {
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
function token(name, fallback) {
  return `var(--dsw-alias-${name}, ${fallback})`;
}
var C = {
  text: token("label-primary", "#1f2328"),
  textSecondary: token("label-secondary", "#57606a"),
  textTertiary: token("label-tertiary", "#6e7781"),
  danger: token("state-error-primary", "#cf222e"),
  dangerSoft: token("state-error-secondary", "#fff1f0"),
  warn: token("state-warn-primary", "#9a6700"),
  submission: token("state-success-primary", "#1a7f37"),
  border: token("border-l2", "#d8dee4"),
  borderSoft: token("border-l1", "#eaeef2"),
  card: token("card-fill", "#ffffff"),
  cardHover: token("card-fill-hover", "#f6f8fa"),
  surface: token("bg-layer-2", "#f6f8fa"),
  accent: token("brand-primary", "#2f6feb"),
  onAccent: token("label-on-color", "#ffffff"),
  code: token("markdown-inline-code", "#f0f3f6")
};
var T = {
  caption: { fontSize: "11px", lineHeight: "16px" },
  body: { fontSize: "13px", lineHeight: "20px" },
  mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "12px" }
};
var CARD = {
  border: `1px solid ${C.borderSoft}`,
  borderRadius: "8px",
  background: C.card,
  padding: "12px 14px",
  marginBottom: "10px"
};
function textButton(color) {
  return {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    color,
    font: "inherit",
    textDecoration: "none"
  };
}
var PRIMARY_BUTTON = {
  border: "none",
  borderRadius: "6px",
  padding: "5px 14px",
  cursor: "pointer",
  background: C.accent,
  color: C.onAccent,
  fontSize: "12px",
  fontWeight: "600"
};
var GHOST_BUTTON = {
  border: `1px solid ${C.border}`,
  borderRadius: "6px",
  padding: "4px 12px",
  cursor: "pointer",
  background: "transparent",
  color: C.text,
  fontSize: "12px"
};
function formatTime(at) {
  if (at === 0) return "\u2014";
  const date = new Date(at);
  const pad = (value) => String(value).padStart(2, "0");
  const md = `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return date.getFullYear() !== (/* @__PURE__ */ new Date()).getFullYear() ? `${date.getFullYear()}-${md}` : md;
}
function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}
async function call(path, init) {
  try {
    const response = await globalThis.fetch(path, { credentials: "include", ...init });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { ok: false, detail: body.detail ?? `HTTP ${response.status}` };
    }
    return await response.json();
  } catch (error) {
    return { ok: false, detail: String(error) };
  }
}
var WINDOWS = [
  { value: "0", label: "\u6240\u6709" },
  { value: "30", label: "\u6700\u8FD1 30 \u5929" },
  { value: "7", label: "\u6700\u8FD1 7 \u5929" },
  { value: "3", label: "\u6700\u8FD1 3 \u5929" },
  { value: "1", label: "\u4ECA\u5929" }
];
// The host answers only the windows a request names, and its default is
// narrower than this selector. Asking for every window offered here is what
// keeps "\u6700\u8FD1 3 \u5929" and "\u4ECA\u5929" from being permanently empty.
var WINDOW_QUERY = WINDOWS.filter((option) => option.value !== "0").map((option) => `window=${option.value}`).join("&");
var COLUMNS = [
  { key: "tool", label: "\u5DE5\u5177", numeric: false, width: "34%" },
  { key: "count", label: "\u8C03\u7528", numeric: true, width: "16%" },
  { key: "errorCount", label: "\u5931\u8D25", numeric: true, width: "20%" },
  { key: "lastUsedAt", label: "\u6700\u540E\u4F7F\u7528", numeric: false, width: "30%" }
];
function createPanel(React) {
  const h = React.createElement;
  return function ToolAnalysisPanel() {
    const [data, setData] = React.useState(void 0);
    // The panel opens on the recent window: "what did my tools do lately" is
    // the question it exists to answer, and the cumulative totals are one
    // selection away.
    const [windowDays, setWindowDays] = React.useState(3);
    const [sortKey, setSortKey] = React.useState("count");
    const [ascending, setAscending] = React.useState(false);
    const [selected, setSelected] = React.useState(() => /* @__PURE__ */ new Set());
    const [expanded, setExpanded] = React.useState(void 0);
    const [notice, setNotice] = React.useState(void 0);
    const [copied, setCopied] = React.useState(false);
    const refresh = React.useCallback(() => {
      void call(`${ENDPOINT}?${WINDOW_QUERY}`).then((body2) => {
        if (body2 !== void 0 && typeof body2 === "object" && "global" in body2) {
          setData(body2);
        }
      });
    }, []);
    React.useEffect(() => {
      refresh();
      const timer = setInterval(refresh, REFRESH_MS);
      return () => clearInterval(timer);
    }, [refresh]);
    if (data === void 0) {
      return h("div", { style: { padding: "20px", color: C.textSecondary, ...T.body } }, "\u6B63\u5728\u8BFB\u53D6\u5DE5\u5177\u7528\u91CF\u2026");
    }
    const report = windowDays === 0 ? data.global : data.windows[String(windowDays)];
    const windowLabel = WINDOWS.find((option) => Number(option.value) === windowDays)?.label ?? "\u6240\u6709";
    const failuresFor = (tool) => data.failures[tool] ?? [];
    const rows = [...report?.rows ?? []].sort((left, right) => {
      const delta = sortKey === "tool" ? left.tool.localeCompare(right.tool) : left[sortKey] - right[sortKey];
      return ascending ? delta : -delta;
    });
    const sortBy = (key) => {
      if (key === sortKey) {
        setAscending((value) => !value);
        return;
      }
      setSortKey(key);
      setAscending(false);
    };
    const selectedRows = rows.filter((row) => selected.has(row.tool));
    const toggle = (tool) => {
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(tool)) next.delete(tool);
        else next.add(tool);
        return next;
      });
    };
    const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.tool));
    const toggleAll = () => {
      setSelected(allSelected ? /* @__PURE__ */ new Set() : new Set(rows.map((row) => row.tool)));
    };
    const buildCopyText = () => {
      const parts = [
        "\u8BF7\u5206\u6790\u4E0B\u9762\u8FD9\u4E9B\u5DE5\u5177\u8C03\u7528\u5931\u8D25\uFF0C\u627E\u51FA\u53CD\u590D\u51FA\u9519\u7684\u539F\u56E0\uFF0C\u5E76\u7ED9\u51FA\u5177\u4F53\u7684\u4FEE\u590D\u5EFA\u8BAE\u3002",
        "",
        `\u7EDF\u8BA1\u8303\u56F4\uFF1A${windowLabel}`
      ];
      for (const row of selectedRows) {
        parts.push(
          "",
          `## ${row.tool}`,
          `\u8C03\u7528 ${row.count} \u6B21\uFF0C\u5931\u8D25 ${row.errorCount} \u6B21\uFF08${percent(row.errorRate)}\uFF09\uFF0C\u6700\u540E\u4F7F\u7528 ${formatTime(row.lastUsedAt)}`
        );
        const samples = failuresFor(row.tool);
        if (samples.length === 0) {
          parts.push("\uFF08\u6CA1\u6709\u4FDD\u7559\u7684\u5931\u8D25\u8BB0\u5F55\uFF09");
          continue;
        }
        parts.push("\u6700\u8FD1\u7684\u5931\u8D25\uFF1A");
        for (const sample of samples) {
          const code = sample.code === void 0 ? "" : ` [${sample.code}]`;
          parts.push(`- ${formatTime(sample.at)}${code} ${sample.summary}`);
        }
      }
      return parts.join("\n");
    };
    const copySelected = () => {
      if (selectedRows.length === 0) return;
      const text = buildCopyText();
      setNotice(void 0);
      void globalThis.navigator?.clipboard?.writeText(text).then(
        () => {
          setCopied(true);
          setTimeout(() => {
            setCopied(false);
          }, 2e3);
        },
        () => {
          setNotice(`\u526A\u8D34\u677F\u4E0D\u53EF\u7528\uFF0C\u5DF2\u4E0B\u8F7D\u4E3A ${downloadText(text, "tool-usage-failures.txt")}`);
        }
      );
    };
    const toolbar = h(
      "div",
      {
        style: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" }
      },
      h(
        "label",
        { style: { display: "flex", gap: "6px", alignItems: "center", color: C.textSecondary, ...T.body } },
        "\u7EDF\u8BA1\u8303\u56F4",
        h("select", {
          value: String(windowDays),
          onChange: (event) => {
            setWindowDays(Number(event.target.value));
          },
          style: {
            padding: "3px 8px",
            borderRadius: "6px",
            border: `1px solid ${C.border}`,
            background: C.card,
            color: C.text,
            font: "inherit"
          }
        }, WINDOWS.map((option) => h("option", { key: option.value, value: option.value }, option.label)))
      ),
      h("a", {
        href: `${ENDPOINT}/export`,
        download: "",
        style: { marginLeft: "auto", color: C.accent, ...textButton(C.accent) }
      }, "\u5BFC\u51FA JSON")
    );
    const actionBar = h(
      "div",
      {
        style: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" }
      },
      h("button", {
        type: "button",
        disabled: selectedRows.length === 0,
        onClick: copySelected,
        style: { ...PRIMARY_BUTTON, opacity: selectedRows.length === 0 ? 0.5 : 1 }
      }, copied ? "\u5DF2\u590D\u5236" : `\u590D\u5236\u9519\u8BEF\u65E5\u5FD7\uFF08${selectedRows.length}\uFF09`),
      h(
        "span",
        { style: { color: C.textTertiary, ...T.caption } },
        selectedRows.length === 0 ? "\u52FE\u9009\u4E0B\u9762\u7684\u5DE5\u5177\uFF0C\u628A\u5B83\u4EEC\u7684\u5931\u8D25\u8BB0\u5F55\u548C\u5206\u6790\u63D0\u793A\u8BCD\u590D\u5236\u8D70\uFF0C\u7C98\u8D34\u5230\u5BF9\u8BDD\u91CC\u8BA9\u6A21\u578B\u5904\u7406\u3002" : "\u7C98\u8D34\u5230\u5BF9\u8BDD\u8F93\u5165\u6846\u5373\u53EF\u3002"
      )
    );
    const coverageNote = data.coverage.since === null ? null : h(
      "div",
      { style: { color: C.textTertiary, marginBottom: "10px", ...T.caption } },
      `\u6309\u65E5\u6570\u636E\u8986\u76D6 ${data.coverage.since} \u81F3 ${data.coverage.until}\uFF08\u4FDD\u7559 ${data.coverage.retentionDays} \u5929\uFF09`
    );
    const noticeBar = notice === void 0 ? null : h("div", {
      style: {
        marginBottom: "10px",
        padding: "8px 10px",
        borderRadius: "6px",
        background: C.surface,
        color: C.textSecondary,
        ...T.caption
      }
    }, notice);
    const header = COLUMNS.map((column) => h("th", {
      key: column.key,
      onClick: () => {
        sortBy(column.key);
      },
      style: {
        textAlign: column.numeric ? "right" : "left",
        cursor: "pointer",
        userSelect: "none",
        paddingBottom: "6px",
        paddingRight: column.numeric ? "14px" : 0,
        whiteSpace: "nowrap",
        color: C.textSecondary,
        fontWeight: "500",
        ...T.caption
      }
    }, `${column.label}${column.key === sortKey ? ascending ? " \u2191" : " \u2193" : ""}`));
    const body = rows.flatMap((row) => {
      const samples = failuresFor(row.tool);
      const open = expanded === row.tool;
      const cells = h(
        "tr",
        { key: row.tool },
        h(
          "td",
          {
            style: {
              padding: "5px 0 5px 2px",
              borderTop: `1px solid ${C.borderSoft}`,
              color: C.text,
              ...T.mono
            }
          },
          h("input", {
            type: "checkbox",
            checked: selected.has(row.tool),
            onChange: () => {
              toggle(row.tool);
            },
            style: { marginRight: "8px", cursor: "pointer", verticalAlign: "middle" },
            "aria-label": `\u9009\u62E9 ${row.tool}`
          }),
          row.tool
        ),
        h("td", {
          style: {
            padding: "5px 14px 5px 0",
            borderTop: `1px solid ${C.borderSoft}`,
            textAlign: "right",
            color: C.text,
            ...T.body
          }
        }, String(row.count)),
        h(
          "td",
          {
            style: {
              padding: "5px 14px 5px 0",
              borderTop: `1px solid ${C.borderSoft}`,
              textAlign: "right",
              ...T.body
            }
          },
          row.errorCount === 0 ? h("span", { style: { color: C.textTertiary } }, "\u2014") : h("button", {
            type: "button",
            onClick: () => {
              setExpanded(open ? void 0 : row.tool);
            },
            disabled: samples.length === 0,
            title: samples.length === 0 ? "\u6CA1\u6709\u4FDD\u7559\u7684\u5931\u8D25\u8BB0\u5F55" : "\u5C55\u5F00\u67E5\u770B\u5931\u8D25\u539F\u56E0",
            style: {
              ...textButton(C.danger),
              color: C.danger,
              cursor: samples.length === 0 ? "default" : "pointer"
            }
          }, `${row.errorCount} (${percent(row.errorRate)}) ${samples.length === 0 ? "" : open ? "\u25BE" : "\u25B8"}`)
        ),
        h("td", {
          style: {
            padding: "5px 0",
            borderTop: `1px solid ${C.borderSoft}`,
            color: C.textSecondary,
            ...T.body
          }
        }, formatTime(row.lastUsedAt))
      );
      if (!open || samples.length === 0) return [cells];
      const detail = h(
        "tr",
        { key: `${row.tool}-detail` },
        h(
          "td",
          {
            colSpan: COLUMNS.length + 1,
            style: { padding: "0 0 10px 16px", background: C.surface }
          },
          h(
            "div",
            { style: { display: "grid", gap: "5px", paddingTop: "8px" } },
            samples.map((sample, index) => h(
              "div",
              {
                key: `${sample.at}-${index}`,
                style: { display: "grid", gridTemplateColumns: "auto auto 1fr", gap: "10px", alignItems: "baseline" }
              },
              h("span", { style: { color: C.textTertiary, whiteSpace: "nowrap", ...T.caption } }, formatTime(sample.at)),
              sample.code === void 0 ? h("span") : h("code", { style: { color: C.warn, whiteSpace: "nowrap", ...T.mono } }, sample.code),
              h("span", { style: { color: C.textSecondary, wordBreak: "break-word", ...T.mono } }, sample.summary)
            ))
          )
        )
      );
      return [cells, detail];
    });
    if (report === void 0 || report.tools === 0) {
      return h(
        "div",
        { style: { padding: "20px" } },
        toolbar,
        actionBar,
        coverageNote,
        noticeBar,
        h(
          "div",
          { style: { color: C.textSecondary, marginBottom: "14px", ...T.body } },
          emptyText(windowDays, data.coverage)
        )
      );
    }
    return h(
      "div",
      { style: { padding: "20px" } },
      toolbar,
      actionBar,
      coverageNote,
      noticeBar,
      h(
        "div",
        { style: { display: "flex", gap: "10px", alignItems: "baseline", marginBottom: "8px" } },
        h(
          "label",
          { style: { display: "flex", gap: "6px", alignItems: "center", color: C.textTertiary, cursor: "pointer", ...T.caption } },
          h("input", {
            type: "checkbox",
            checked: allSelected,
            onChange: toggleAll,
            style: { cursor: "pointer" },
            "aria-label": "\u9009\u62E9\u5168\u90E8"
          }),
          "\u5168\u9009"
        ),
        h(
          "span",
          { style: { color: C.text, fontWeight: "600", ...T.body } },
          `${report.tools} \u4E2A\u5DE5\u5177`
        ),
        h(
          "span",
          { style: { color: C.textTertiary, ...T.caption } },
          `${windowLabel} \xB7 ${report.calls} \u6B21\u8C03\u7528` + (report.failures > 0 ? ` \xB7 ${report.failures} \u6B21\u5931\u8D25` : "")
        )
      ),
      h(
        "table",
        { style: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" } },
        h("colgroup", null, COLUMNS.map((column) => h("col", { key: column.key, style: { width: column.width } }))),
        h("thead", null, h("tr", null, header)),
        h("tbody", null, body)
      )
    );
  };
}
function downloadText(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
  return name;
}
function emptyText(windowDays, coverage) {
  if (windowDays === 0) return "\u8FD8\u6CA1\u6709\u4EFB\u4F55\u5DE5\u5177\u8C03\u7528\u8BB0\u5F55\u2014\u2014\u5148\u8BA9 Agent \u5E72\u70B9\u6D3B\u3002";
  if (coverage.since === null) {
    return `\u6700\u8FD1 ${windowDays} \u5929\u6CA1\u6709\u5DE5\u5177\u8C03\u7528\u8BB0\u5F55\u3002\u6309\u65E5\u7EDF\u8BA1\u9700\u8981\u5148\u6709\u8C03\u7528\u624D\u4F1A\u5F00\u59CB\u7D2F\u79EF\u3002`;
  }
  return `\u6700\u8FD1 ${windowDays} \u5929\u6CA1\u6709\u5DE5\u5177\u8C03\u7528\u8BB0\u5F55\u3002\u6309\u65E5\u6570\u636E\u6700\u65E9\u53EA\u5230 ${coverage.since}\uFF0C\u66F4\u65E9\u7684\u5386\u53F2\u5728\u300C\u6240\u6709\u300D\u91CC\u3002`;
}
function apply(ctx) {
  const React = require("react");
  const Panel = createPanel(React);
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "vyra-tool-usage",
    order: 50,
    label: () => "\u5DE5\u5177\u5206\u6790"
  }, Panel));
}
var inject = ["slots"];
return module.exports; } });

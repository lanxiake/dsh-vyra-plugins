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
function pill(background, color) {
  return {
    display: "inline-block",
    padding: "1px 7px",
    borderRadius: "999px",
    background,
    color,
    fontSize: "11px",
    lineHeight: "17px",
    fontWeight: "500"
  };
}
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
  { value: "0", label: "\u7D2F\u8BA1" },
  { value: "7", label: "\u6700\u8FD1 7 \u5929" },
  { value: "30", label: "\u6700\u8FD1 30 \u5929" }
];
var COLUMNS = [
  { key: "tool", label: "\u5DE5\u5177", numeric: false, width: "34%" },
  { key: "count", label: "\u8C03\u7528", numeric: true, width: "16%" },
  { key: "errorCount", label: "\u5931\u8D25", numeric: true, width: "20%" },
  { key: "lastUsedAt", label: "\u6700\u540E\u4F7F\u7528", numeric: false, width: "30%" }
];
function createPanel(React) {
  const h = React.createElement;
  return function ToolUsagePanel() {
    const [data, setData] = React.useState(void 0);
    const [windowDays, setWindowDays] = React.useState(0);
    const [sortKey, setSortKey] = React.useState("count");
    const [ascending, setAscending] = React.useState(false);
    const [expanded, setExpanded] = React.useState(void 0);
    const [busy, setBusy] = React.useState(void 0);
    const [notice, setNotice] = React.useState(void 0);
    const refresh = React.useCallback(() => {
      void call(ENDPOINT).then((body2) => {
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
    const analyze = (sessionId) => {
      setBusy("analyze");
      setNotice(void 0);
      void call(`${ENDPOINT}/diagnose`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId })
      }).then((result) => {
        const typed = result;
        setBusy(void 0);
        setNotice(typed.ok === true ? `\u5DF2\u8BF7\u6C42\u5206\u6790\uFF1A${(typed.targets ?? []).join("\u3001")}\u3002\u7ED3\u679C\u4F1A\u51FA\u73B0\u5728\u5F53\u524D\u4F1A\u8BDD\u91CC\u3002` : typed.detail ?? "\u8BF7\u6C42\u5931\u8D25");
        refresh();
      });
    };
    const apply2 = (tool) => {
      setBusy(tool);
      setNotice(void 0);
      void call(`${ENDPOINT}/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tool })
      }).then((result) => {
        const typed = result;
        setBusy(void 0);
        setNotice(typed.ok === true ? `\u5DF2\u5E94\u7528 ${tool} \u7684${typed.applied === "description" ? "\u63CF\u8FF0" : "\u53C2\u6570"}\u6539\u52A8` : typed.detail ?? "\u5E94\u7528\u5931\u8D25");
        refresh();
      });
    };
    const dismiss = (tool) => {
      setBusy(tool);
      void call(`${ENDPOINT}/dismiss`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tool })
      }).then(() => {
        setBusy(void 0);
        refresh();
      });
    };
    if (data === void 0) {
      return h("div", { style: { padding: "20px", color: C.textSecondary, ...T.body } }, "\u6B63\u5728\u8BFB\u53D6\u5DE5\u5177\u7528\u91CF\u2026");
    }
    const report = windowDays === 0 ? data.global : data.windows[String(windowDays)];
    const windowLabel = WINDOWS.find((option) => Number(option.value) === windowDays)?.label ?? "\u7D2F\u8BA1";
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
    const failuresFor = (tool) => data.failures[tool] ?? [];
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
    const coverageNote = data.coverage.since === null ? null : h(
      "div",
      { style: { color: C.textTertiary, marginBottom: "10px", ...T.caption } },
      `\u6309\u65E5\u6570\u636E\u8986\u76D6 ${data.coverage.since} \u81F3 ${data.coverage.until}\uFF08\u4FDD\u7559 ${data.coverage.retentionDays} \u5929\uFF09`
    );
    const proposals = () => {
      if (data.diagnosis.pending.length === 0) return null;
      return h(
        "div",
        { style: { marginBottom: "14px" } },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" } },
          h("span", { style: { fontWeight: "600", color: C.text, ...T.body } }, "\u6539\u8FDB\u5EFA\u8BAE"),
          h("span", { style: pill(C.dangerSoft, C.danger) }, `${data.diagnosis.pending.length} \u6761\u5F85\u5904\u7406`)
        ),
        data.diagnosis.pending.map((proposal) => proposalCard(proposal))
      );
    };
    const proposalCard = (proposal) => {
      const kindLabel = proposal.change.kind === "description" ? "\u6539\u63CF\u8FF0" : proposal.change.kind === "parameters" ? "\u6539\u53C2\u6570" : "\u6539\u5B9E\u73B0";
      const working = busy === proposal.tool;
      const diff = proposal.change.description === void 0 ? null : h(
        "div",
        {
          style: {
            background: C.surface,
            border: `1px solid ${C.borderSoft}`,
            borderRadius: "6px",
            padding: "8px 10px",
            marginBottom: "8px"
          }
        },
        h("div", { style: { color: C.textTertiary, marginBottom: "4px", ...T.caption } }, "\u5F53\u524D\u63CF\u8FF0"),
        h(
          "div",
          { style: { color: C.textSecondary, marginBottom: "8px", whiteSpace: "pre-wrap", ...T.mono } },
          proposal.previousDescription || "\uFF08\u7A7A\uFF09"
        ),
        h("div", { style: { color: C.textTertiary, marginBottom: "4px", ...T.caption } }, "\u5EFA\u8BAE\u6539\u4E3A"),
        h("div", { style: { color: C.text, whiteSpace: "pre-wrap", ...T.mono } }, proposal.change.description)
      );
      const needsHuman = proposal.change.kind === "implementation" ? h(
        "div",
        { style: { color: C.warn, marginBottom: "8px", ...T.caption } },
        `\u5B9E\u73B0\u6539\u52A8\u9700\u8981\u4EBA\u5DE5\u5B8C\u6210\uFF1A${proposal.change.note ?? ""}`
      ) : null;
      return h(
        "div",
        { key: proposal.tool, style: CARD },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" } },
          h("code", { style: { color: C.text, fontWeight: "600", ...T.mono } }, proposal.tool),
          h("span", { style: pill(C.surface, C.textSecondary) }, kindLabel)
        ),
        h("div", { style: { color: C.text, marginBottom: "6px", ...T.body } }, proposal.diagnosis),
        h("div", { style: { color: C.textTertiary, marginBottom: "8px", ...T.caption } }, `\u4F9D\u636E\uFF1A${proposal.evidence}`),
        needsHuman,
        diff,
        h(
          "div",
          { style: { display: "flex", gap: "8px" } },
          h("button", {
            type: "button",
            disabled: working || needsHuman !== null,
            onClick: () => {
              apply2(proposal.tool);
            },
            style: { ...PRIMARY_BUTTON, opacity: working ? 0.6 : 1 }
          }, working ? "\u5E94\u7528\u4E2D\u2026" : "\u5E94\u7528"),
          h("button", {
            type: "button",
            disabled: working,
            onClick: () => {
              dismiss(proposal.tool);
            },
            style: GHOST_BUTTON
          }, "\u5FFD\u7565")
        )
      );
    };
    const appliedList = () => {
      if (data.diagnosis.applied.length === 0) return null;
      return h(
        "div",
        { style: { marginBottom: "14px" } },
        h("div", { style: { color: C.textTertiary, marginBottom: "6px", ...T.caption } }, "\u5DF2\u5E94\u7528\u7684\u6539\u52A8"),
        data.diagnosis.applied.slice(0, 5).map((change) => h("div", {
          key: `${change.tool}-${change.appliedAt}`,
          style: { color: C.textSecondary, ...T.caption }
        }, `${formatTime(change.appliedAt)} \xB7 ${change.tool} \xB7 ${change.kind === "description" ? "\u63CF\u8FF0" : "\u53C2\u6570"}`))
      );
    };
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
        h("td", {
          style: {
            padding: "5px 0",
            borderTop: `1px solid ${C.borderSoft}`,
            color: C.text,
            ...T.mono
          }
        }, row.tool),
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
            colSpan: COLUMNS.length,
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
    const analysisBar = h(
      "div",
      {
        style: {
          display: "flex",
          gap: "10px",
          alignItems: "center",
          flexWrap: "wrap",
          marginTop: "4px",
          paddingTop: "12px",
          borderTop: `1px solid ${C.borderSoft}`
        }
      },
      h("button", {
        type: "button",
        disabled: busy === "analyze" || data.diagnosis.analyzing,
        onClick: () => {
          analyze(void 0);
        },
        style: { ...PRIMARY_BUTTON, opacity: busy === "analyze" ? 0.6 : 1 }
      }, busy === "analyze" || data.diagnosis.analyzing ? "\u5206\u6790\u4E2D\u2026" : "\u7ACB\u5373\u5206\u6790"),
      h(
        "span",
        { style: { color: C.textTertiary, ...T.caption } },
        data.diagnosis.lastRunAt === 0 ? "\u8FD8\u6CA1\u6709\u5206\u6790\u8FC7" : `\u4E0A\u6B21\u5206\u6790 ${formatTime(data.diagnosis.lastRunAt)}`
      )
    );
    const settingsCard = h(
      "div",
      { style: { ...CARD, marginTop: "12px" } },
      h("div", { style: { fontWeight: "600", color: C.text, marginBottom: "10px", ...T.body } }, "\u81EA\u52A8\u5206\u6790\u8BBE\u7F6E"),
      h(
        "div",
        { style: { display: "grid", gap: "10px" } },
        settingRow(
          "\u81EA\u52A8\u68C0\u67E5\u95F4\u9694",
          "analyzeEveryHours",
          data.diagnosis.settings.analyzeEveryHours,
          "\u5C0F\u65F6\u30020 = \u5173\u95ED\u81EA\u52A8\u5206\u6790\uFF0C\u53EA\u7528\u300C\u7ACB\u5373\u5206\u6790\u300D\u3002"
        ),
        settingRow(
          "\u89E6\u53D1\u95E8\u69DB",
          "minFailures",
          data.diagnosis.settings.minFailures,
          "\u65B0\u589E\u5931\u8D25\u8FBE\u5230\u51E0\u6B21\u624D\u503C\u5F97\u8BCA\u65AD\u3002"
        ),
        settingRow(
          "\u51B7\u5374\u5929\u6570",
          "cooldownDays",
          data.diagnosis.settings.cooldownDays,
          "\u540C\u4E00\u4E2A\u5DE5\u5177\u9694\u51E0\u5929\u624D\u80FD\u518D\u5206\u6790\u4E00\u6B21\u3002"
        )
      )
    );
    function settingRow(label, key, value, hint) {
      return h(
        "div",
        { style: { display: "grid", gridTemplateColumns: "auto 80px 1fr", gap: "10px", alignItems: "center" } },
        h("span", { style: { color: C.textSecondary, whiteSpace: "nowrap", ...T.body } }, label),
        h("input", {
          type: "number",
          defaultValue: String(value),
          min: key === "minFailures" ? "1" : "0",
          disabled: busy === "config",
          onBlur: (event) => {
            const next = Number(event.target.value);
            if (!Number.isFinite(next) || next === value) return;
            setBusy("config");
            setNotice(void 0);
            void call(`${ENDPOINT}/config`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ [key]: next })
            }).then((result) => {
              const typed = result;
              setBusy(void 0);
              setNotice(typed.ok === true ? "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u63D2\u4EF6\u4F1A\u91CD\u65B0\u52A0\u8F7D" : typed.detail ?? "\u4FDD\u5B58\u5931\u8D25");
              refresh();
            });
          },
          style: {
            padding: "4px 8px",
            borderRadius: "6px",
            border: `1px solid ${C.border}`,
            background: C.card,
            color: C.text,
            font: "inherit"
          }
        }),
        h("span", { style: { color: C.textTertiary, ...T.caption } }, hint)
      );
    }
    const noticeBar = notice === void 0 ? null : h("div", {
      style: {
        marginTop: "8px",
        padding: "8px 10px",
        borderRadius: "6px",
        background: C.surface,
        color: C.textSecondary,
        ...T.caption
      }
    }, notice);
    if (report === void 0 || report.tools === 0) {
      return h(
        "div",
        { style: { padding: "20px" } },
        toolbar,
        coverageNote,
        h(
          "div",
          { style: { color: C.textSecondary, marginBottom: "14px", ...T.body } },
          emptyText(windowDays, data.coverage)
        ),
        analysisBar,
        settingsCard,
        noticeBar
      );
    }
    return h(
      "div",
      { style: { padding: "20px" } },
      toolbar,
      coverageNote,
      proposals(),
      appliedList(),
      h(
        "div",
        { style: { display: "flex", gap: "10px", alignItems: "baseline", marginBottom: "8px" } },
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
      ),
      analysisBar,
      settingsCard,
      noticeBar
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

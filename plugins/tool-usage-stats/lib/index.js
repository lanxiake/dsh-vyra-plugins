// src/counters.ts
function dayKey(at) {
  const date = new Date(at);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
var FAILURE_SUMMARY_MAX_CHARS = 300;
var FAILURE_SAMPLES_PER_TOOL = 20;
function summarize(text, max = FAILURE_SUMMARY_MAX_CHARS) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max)}\u2026`;
}
function record(state, toolName, isError, at, retainDays) {
  const previous = state[toolName];
  const day = dayKey(at);
  const daily = { ...previous?.daily ?? {} };
  const dailyErrors = { ...previous?.dailyErrors ?? {} };
  daily[day] = (daily[day] ?? 0) + 1;
  if (isError) dailyErrors[day] = (dailyErrors[day] ?? 0) + 1;
  const days = Object.keys(daily).sort();
  while (days.length > retainDays) {
    const oldest = days.shift();
    delete daily[oldest];
    delete dailyErrors[oldest];
  }
  return {
    ...state,
    [toolName]: {
      count: (previous?.count ?? 0) + 1,
      errorCount: (previous?.errorCount ?? 0) + (isError ? 1 : 0),
      lastUsedAt: at,
      lastUsedDay: day,
      daily,
      dailyErrors
    }
  };
}
function recordFailure(log, sample, keep = FAILURE_SAMPLES_PER_TOOL) {
  const existing = log[sample.tool] ?? [];
  return { ...log, [sample.tool]: [sample, ...existing].slice(0, keep) };
}
function readResult(data) {
  if (typeof data !== "object" || data === null) return void 0;
  const message = data.message;
  if (typeof message !== "object" || message === null) return void 0;
  const callId = message.toolCallId;
  if (typeof callId !== "string") return void 0;
  return { callId, isError: message.isError === true };
}
function failureDetail(data, result) {
  if (!result.isError) return { summary: "" };
  const payload = data;
  const error = payload.error;
  const code = typeof error?.code === "string" ? error.code : void 0;
  const reason = typeof error?.reason === "string" ? error.reason : "";
  let fromContent = "";
  const content = payload.message?.content;
  if (Array.isArray(content)) {
    const text = content.filter((block) => typeof block === "object" && block !== null && block.type === "text" && typeof block.text === "string").map((block) => block.text).join(" ");
    fromContent = text;
  }
  const chosen = reason || fromContent;
  const summary = chosen === "" ? "\u5DE5\u5177\u8FD4\u56DE\u5931\u8D25\u7ED3\u679C\uFF08\u65E0\u6B63\u6587\uFF09" : summarize(chosen);
  return code === void 0 ? { summary } : { summary, code };
}
function takeName(names, callId) {
  const found = names.get(callId);
  names.delete(callId);
  return found;
}
function report(state) {
  const rows = Object.entries(state).map(([tool, entry]) => ({
    tool,
    count: entry.count,
    errorCount: entry.errorCount,
    errorRate: entry.count === 0 ? 0 : entry.errorCount / entry.count,
    lastUsedAt: entry.lastUsedAt
  })).sort((left, right) => right.count - left.count || left.tool.localeCompare(right.tool));
  return {
    rows,
    tools: rows.length,
    calls: rows.reduce((sum, row) => sum + row.count, 0),
    failures: rows.reduce((sum, row) => sum + row.errorCount, 0)
  };
}
function windowed(state, days, from) {
  if (days <= 0) return state;
  const dayMs = 24 * 60 * 60 * 1e3;
  const cutoff = dayKey(from - (days - 1) * dayMs);
  const out = {};
  for (const [tool, entry] of Object.entries(state)) {
    let count = 0;
    let errorCount = 0;
    let lastUsedAt = 0;
    for (const [day, calls] of Object.entries(entry.daily)) {
      if (day < cutoff) continue;
      count += calls;
      errorCount += entry.dailyErrors?.[day] ?? 0;
      if (entry.lastUsedAt > lastUsedAt) lastUsedAt = entry.lastUsedAt;
    }
    if (count === 0) continue;
    out[tool] = {
      count,
      errorCount,
      lastUsedAt,
      lastUsedDay: dayKey(lastUsedAt),
      daily: {},
      dailyErrors: {}
    };
  }
  return out;
}
function coverage(state, retentionDays) {
  let since = null;
  let until = null;
  for (const entry of Object.values(state)) {
    for (const day of Object.keys(entry.daily)) {
      if (since === null || day < since) since = day;
      if (until === null || day > until) until = day;
    }
  }
  return { since, until, retentionDays };
}

// src/storage.ts
var DOMAIN_NAME = "tool_usage";
var DOMAIN_VERSION = 1;
var TABLE_NAME = "usage";
var SNAPSHOT_KEY = "snapshot";
var LEGACY_KEY = "global";
function parseEntry(tool, entry) {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    throw new TypeError(`entry '${tool}' must be an object`);
  }
  const typed = entry;
  for (const field of ["count", "errorCount", "lastUsedAt"]) {
    const value = typed[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new TypeError(`entry '${tool}'.${field} must be a non-negative number`);
    }
  }
  if (typeof typed.lastUsedDay !== "string") {
    throw new TypeError(`entry '${tool}'.lastUsedDay must be a string`);
  }
  const daily = typed.daily;
  if (typeof daily !== "object" || daily === null || Array.isArray(daily)) {
    throw new TypeError(`entry '${tool}'.daily must be an object`);
  }
  for (const [day, calls] of Object.entries(daily)) {
    if (typeof calls !== "number" || !Number.isFinite(calls) || calls < 0) {
      throw new TypeError(`entry '${tool}'.daily['${day}'] must be a non-negative number`);
    }
  }
  const dailyErrorsRaw = typed.dailyErrors ?? {};
  if (typeof dailyErrorsRaw !== "object" || dailyErrorsRaw === null || Array.isArray(dailyErrorsRaw)) {
    throw new TypeError(`entry '${tool}'.dailyErrors must be an object`);
  }
  const dailyErrors = {};
  for (const [day, failures] of Object.entries(dailyErrorsRaw)) {
    if (typeof failures !== "number" || !Number.isFinite(failures) || failures < 0) {
      throw new TypeError(`entry '${tool}'.dailyErrors['${day}'] must be a non-negative number`);
    }
    dailyErrors[day] = failures;
  }
  return {
    count: typed.count,
    errorCount: typed.errorCount,
    lastUsedAt: typed.lastUsedAt,
    lastUsedDay: typed.lastUsedDay,
    daily: { ...daily },
    dailyErrors
  };
}
function parseSnapshot(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new TypeError("snapshot must be an object");
  }
  const typed = raw;
  const counterSource = typed.counters === void 0 ? typed : typed.counters;
  if (typeof counterSource !== "object" || counterSource === null || Array.isArray(counterSource)) {
    throw new TypeError("snapshot.counters must be an object");
  }
  const counters = {};
  for (const [tool, entry] of Object.entries(counterSource)) {
    counters[tool] = parseEntry(tool, entry);
  }
  const failuresRaw = typed.counters === void 0 ? {} : typed.failures ?? {};
  if (typeof failuresRaw !== "object" || failuresRaw === null || Array.isArray(failuresRaw)) {
    throw new TypeError("snapshot.failures must be an object");
  }
  const failures = {};
  for (const [tool, samples] of Object.entries(failuresRaw)) {
    if (!Array.isArray(samples)) throw new TypeError(`snapshot.failures['${tool}'] must be an array`);
    failures[tool] = samples.map((sample, index) => {
      if (typeof sample !== "object" || sample === null || Array.isArray(sample)) {
        throw new TypeError(`snapshot.failures['${tool}'][${index}] must be an object`);
      }
      const typedSample = sample;
      if (typeof typedSample.at !== "number" || typeof typedSample.summary !== "string") {
        throw new TypeError(`snapshot.failures['${tool}'][${index}] needs a numeric 'at' and a string 'summary'`);
      }
      return {
        at: typedSample.at,
        summary: typedSample.summary,
        ...typeof typedSample.code === "string" ? { code: typedSample.code } : {},
        tool
      };
    });
  }
  return { counters, failures };
}
var toolUsageDomain = {
  name: DOMAIN_NAME,
  version: DOMAIN_VERSION,
  invalidRecords: "backup-and-skip",
  tables: {
    [TABLE_NAME]: {
      valueSchema: { parse: parseSnapshot }
    }
  }
};

// src/index.ts
var name = "vyra-tool-usage-stats";
var inject = ["sessions"];
var ToolUsageStats = class {
  /**
   * @param retainDays - daily buckets kept per tool.
   * @param retainFailures - failure samples kept per tool.
   */
  constructor(retainDays, retainFailures) {
    this.retainDays = retainDays;
    this.retainFailures = retainFailures;
  }
  counters = {};
  failures = {};
  sessions = /* @__PURE__ */ new Map();
  /** @returns the snapshot to persist. */
  snapshot() {
    return { counters: this.counters, failures: this.failures };
  }
  /**
   * Adopt a snapshot loaded from durable storage.
   * @param loaded - the restored state.
   */
  restore(loaded) {
    this.counters = loaded.counters;
    this.failures = loaded.failures;
  }
  /**
   * Record one tool result.
   * @param sessionId - the session the call ran in.
   * @param toolName - the tool that ran.
   * @param isError - whether its result was a failure.
   * @param at - epoch milliseconds of the observation.
   * @param failure - the reason summary and code, when it failed.
   */
  observe(sessionId, toolName, isError, at, failure) {
    this.counters = record(this.counters, toolName, isError, at, this.retainDays);
    const current = this.sessions.get(sessionId) ?? {};
    this.sessions.set(sessionId, record(current, toolName, isError, at, this.retainDays));
    if (isError) {
      this.failures = recordFailure(this.failures, {
        at,
        summary: failure.summary,
        tool: toolName,
        ...failure.code === void 0 ? {} : { code: failure.code }
      }, this.retainFailures);
    }
  }
  /**
   * Build the response for one request.
   * @param windows - day counts to include, each 0 or less meaning cumulative.
   * @returns the report set.
   */
  view(windows) {
    const now = Date.now();
    return {
      global: report(this.counters),
      windows: Object.fromEntries(
        windows.filter((days) => days > 0).map((days) => [String(days), report(windowed(this.counters, days, now))])
      ),
      sessions: Object.fromEntries(
        [...this.sessions].map(([id, state]) => [id, report(state)])
      ),
      failures: this.failures,
      coverage: coverage(this.counters, this.retainDays)
    };
  }
};
var DEFAULT_WINDOWS = [7, 30];
var FLUSH_MS = 15e3;
function apply(ctx, config = {}) {
  const retainDays = config.retainDays ?? 90;
  const retainFailures = config.retainFailures ?? 20;
  const stats = new ToolUsageStats(retainDays, retainFailures);
  const logger = ctx.get("logger");
  const pendingNames = /* @__PURE__ */ new Map();
  let durable;
  const openDurable = (scoped) => {
    const storageDomain = scoped.get("storageDomain");
    if (storageDomain === void 0) return;
    void (async () => {
      try {
        const domain = await storageDomain.open(toolUsageDomain);
        const table = domain.table(TABLE_NAME);
        durable = table;
        const restored = table.get(SNAPSHOT_KEY) ?? table.get(LEGACY_KEY);
        if (restored !== void 0) stats.restore(restored);
        scoped.effect(() => () => {
          void domain.close();
        });
      } catch (error) {
        logger?.warn?.(`tool-usage-stats: storage unavailable, counters are in-memory only: ${String(error)}`);
      }
    })();
  };
  if (ctx.get("storageDomain") === void 0) ctx.inject(["storageDomain"], openDurable);
  else openDurable(ctx);
  let lastFlushed;
  const flushTimer = setInterval(() => {
    if (durable === void 0) return;
    const current = stats.snapshot();
    if (current.counters === lastFlushed?.counters && current.failures === lastFlushed?.failures) return;
    lastFlushed = current;
    void durable.put(SNAPSHOT_KEY, current).catch((error) => {
      logger?.warn?.(`tool-usage-stats: flush failed: ${String(error)}`);
    });
  }, FLUSH_MS);
  flushTimer.unref?.();
  ctx.effect(() => () => {
    clearInterval(flushTimer);
  });
  ctx.on("session/event", (session, event) => {
    if (event.type === "tool/call") {
      const data = event.data;
      if (typeof data.callId !== "string" || typeof data.name !== "string") return;
      let names2 = pendingNames.get(session.id);
      if (names2 === void 0) {
        names2 = /* @__PURE__ */ new Map();
        pendingNames.set(session.id, names2);
      }
      names2.set(data.callId, data.name);
      return;
    }
    if (event.type !== "tool/result") return;
    const result = readResult(event.data);
    if (result === void 0) return;
    const names = pendingNames.get(session.id);
    const toolName = names === void 0 ? void 0 : takeName(names, result.callId);
    if (toolName === void 0) return;
    try {
      const detail = failureDetail(event.data, result);
      stats.observe(session.id, toolName, result.isError, Date.now(), detail);
    } catch (error) {
      logger?.warn?.(`tool-usage-stats: ${String(error)}`);
    }
  });
  const registerRoutes = () => {
    const connection = ctx.get("connection");
    if (connection?.fetch === void 0) return false;
    const json = (body) => new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" }
    });
    try {
      const disposers = [
        connection.fetch.register({
          path: config.endpoint ?? "/api/vyra/tool-usage",
          methods: ["GET"],
          requestBody: "buffered",
          fetch: async (request) => {
            const requested = new URL(request.url).searchParams.getAll("window").map((value) => Number.parseInt(value, 10)).filter((value) => Number.isFinite(value));
            return json(stats.view(requested.length === 0 ? [...DEFAULT_WINDOWS] : requested));
          }
        }),
        // The audit export is a separate route because it is a download, not a
        // panel read: the Client hands it to the browser rather than rendering it.
        connection.fetch.register({
          path: config.endpoint === void 0 ? "/api/vyra/tool-usage/export" : `${config.endpoint}/export`,
          methods: ["GET"],
          requestBody: "buffered",
          fetch: async () => new Response(JSON.stringify(buildExport(stats), void 0, 2), {
            headers: {
              "content-type": "application/json",
              "content-disposition": `attachment; filename="tool-usage-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json"`
            }
          })
        })
      ];
      ctx.effect(() => () => {
        for (const dispose of disposers) void dispose();
      });
      return true;
    } catch (error) {
      logger?.warn?.(`tool-usage-stats: cannot register endpoints: ${String(error)}`);
      return true;
    }
  };
  if (!registerRoutes()) ctx.inject(["connection"], () => {
    registerRoutes();
  });
}
function buildExport(stats) {
  const view = stats.view([0]);
  const failures = Object.values(view.failures).flat().sort((left, right) => right.at - left.at).map((sample) => ({
    tool: sample.tool,
    at: sample.at,
    ...sample.code === void 0 ? {} : { code: sample.code },
    summary: sample.summary
  }));
  return {
    exportedAt: Date.now(),
    coverage: view.coverage,
    totals: view.global.rows.map((row) => ({
      tool: row.tool,
      count: row.count,
      errorCount: row.errorCount,
      lastUsedAt: row.lastUsedAt
    })),
    failures
  };
}
export {
  apply,
  inject,
  name,
  summarize
};

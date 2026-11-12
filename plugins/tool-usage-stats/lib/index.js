// src/counters.ts
function dayKey(at) {
  const date = new Date(at);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
function record(state, toolName, isError, at, retainDays) {
  const previous = state[toolName];
  const day = dayKey(at);
  const daily = { ...previous?.daily ?? {} };
  daily[day] = (daily[day] ?? 0) + 1;
  const days = Object.keys(daily).sort();
  while (days.length > retainDays) delete daily[days.shift()];
  return {
    ...state,
    [toolName]: {
      count: (previous?.count ?? 0) + 1,
      errorCount: (previous?.errorCount ?? 0) + (isError ? 1 : 0),
      lastUsedAt: at,
      lastUsedDay: day,
      daily
    }
  };
}
function resultIsError(data) {
  if (typeof data !== "object" || data === null) return false;
  const message = data.message;
  if (typeof message !== "object" || message === null) return false;
  return message.isError === true;
}
function takeName(names, callId) {
  const found = names.get(callId);
  names.delete(callId);
  return found;
}
function report(states) {
  const merged = /* @__PURE__ */ new Map();
  for (const state of states) {
    for (const [tool, entry] of Object.entries(state)) {
      const current = merged.get(tool);
      if (current === void 0) {
        merged.set(tool, { count: entry.count, errorCount: entry.errorCount, lastUsedAt: entry.lastUsedAt });
        continue;
      }
      current.count += entry.count;
      current.errorCount += entry.errorCount;
      current.lastUsedAt = Math.max(current.lastUsedAt, entry.lastUsedAt);
    }
  }
  const rows = [...merged].map(([tool, entry]) => ({
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

// src/storage.ts
var DOMAIN_NAME = "tool_usage";
var DOMAIN_VERSION = 1;
var TABLE_NAME = "usage";
var GLOBAL_KEY = "global";
function parseState(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new TypeError("tool usage state must be an object");
  }
  const state = {};
  for (const [tool, entry] of Object.entries(raw)) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new TypeError(`tool usage entry '${tool}' must be an object`);
    }
    const typed = entry;
    for (const field of ["count", "errorCount", "lastUsedAt"]) {
      const value = typed[field];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new TypeError(`tool usage entry '${tool}'.${field} must be a non-negative number`);
      }
    }
    if (typeof typed.lastUsedDay !== "string") {
      throw new TypeError(`tool usage entry '${tool}'.lastUsedDay must be a string`);
    }
    const daily = typed.daily;
    if (typeof daily !== "object" || daily === null || Array.isArray(daily)) {
      throw new TypeError(`tool usage entry '${tool}'.daily must be an object`);
    }
    for (const [day, count] of Object.entries(daily)) {
      if (typeof count !== "number" || !Number.isFinite(count) || count < 0) {
        throw new TypeError(`tool usage entry '${tool}'.daily['${day}'] must be a non-negative number`);
      }
    }
    state[tool] = {
      count: typed.count,
      errorCount: typed.errorCount,
      lastUsedAt: typed.lastUsedAt,
      lastUsedDay: typed.lastUsedDay,
      daily: { ...daily }
    };
  }
  return state;
}
var toolUsageDomain = {
  name: DOMAIN_NAME,
  version: DOMAIN_VERSION,
  invalidRecords: "backup-and-skip",
  tables: {
    [TABLE_NAME]: {
      valueSchema: { parse: parseState }
    }
  }
};

// src/index.ts
var name = "vyra-tool-usage-stats";
var inject = ["sessions"];
var ToolUsageStats = class {
  /**
   * @param retainDays - daily buckets kept per tool.
   */
  constructor(retainDays) {
    this.retainDays = retainDays;
  }
  global = {};
  sessions = /* @__PURE__ */ new Map();
  /** @returns the persistent counter set, replaced wholesale on each fold. */
  get globalState() {
    return this.global;
  }
  /**
   * Adopt a counter set loaded from durable storage.
   * @param state - the restored counters.
   */
  restore(state) {
    this.global = state;
  }
  /**
   * Record one tool result in both the global and the session set.
   * @param sessionId - the session the call ran in.
   * @param toolName - the tool that ran.
   * @param isError - whether its result was a failure.
   * @param at - epoch milliseconds of the observation.
   */
  observe(sessionId, toolName, isError, at) {
    this.global = record(this.global, toolName, isError, at, this.retainDays);
    const current = this.sessions.get(sessionId) ?? {};
    this.sessions.set(sessionId, record(current, toolName, isError, at, this.retainDays));
  }
  /** @returns the global and per-session reports the Client renders. */
  snapshot() {
    return {
      global: report([this.global]),
      sessions: Object.fromEntries(
        [...this.sessions].map(([id, state]) => [id, report([state])])
      )
    };
  }
};
function apply(ctx, config = {}) {
  const retainDays = config.retainDays ?? 90;
  const endpoint = config.endpoint ?? "/api/vyra/tool-usage";
  const stats = new ToolUsageStats(retainDays);
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
        const restored = table.get(GLOBAL_KEY);
        if (restored !== void 0) stats.restore(restored);
        scoped.effect(() => () => {
          void domain.close();
        });
      } catch (error) {
        logger?.warn?.(`tool-usage-stats: storage unavailable, counters are in-memory only: ${String(error)}`);
      }
    })();
  };
  const initialStorageDomain = ctx.get("storageDomain");
  if (initialStorageDomain === void 0) ctx.inject(["storageDomain"], openDurable);
  else openDurable(ctx);
  const flushMs = 15e3;
  let lastFlushed;
  const flushTimer = setInterval(() => {
    if (durable === void 0 || stats.globalState === lastFlushed) return;
    lastFlushed = stats.globalState;
    void durable.put(GLOBAL_KEY, stats.globalState).catch((error) => {
      logger?.warn?.(`tool-usage-stats: flush failed: ${String(error)}`);
    });
  }, flushMs);
  flushTimer.unref?.();
  ctx.effect(() => () => {
    clearInterval(flushTimer);
  });
  ctx.on("session/event", (session, event) => {
    if (event.type === "tool/call") {
      const data2 = event.data;
      if (typeof data2.callId !== "string" || typeof data2.name !== "string") return;
      let names2 = pendingNames.get(session.id);
      if (names2 === void 0) {
        names2 = /* @__PURE__ */ new Map();
        pendingNames.set(session.id, names2);
      }
      names2.set(data2.callId, data2.name);
      return;
    }
    if (event.type !== "tool/result") return;
    const data = event.data;
    const callId = data.message?.toolCallId;
    if (typeof callId !== "string") return;
    const names = pendingNames.get(session.id);
    const toolName = names === void 0 ? void 0 : takeName(names, callId);
    if (toolName === void 0) return;
    try {
      stats.observe(session.id, toolName, resultIsError(data), Date.now());
    } catch (error) {
      logger?.warn?.(`tool-usage-stats: ${String(error)}`);
    }
  });
  const registerRoute = () => {
    const connection = ctx.get("connection");
    if (connection?.fetch === void 0) return false;
    try {
      const dispose = connection.fetch.register({
        path: endpoint,
        methods: ["GET"],
        requestBody: "buffered",
        fetch: async () => new Response(JSON.stringify(stats.snapshot()), {
          headers: { "content-type": "application/json" }
        })
      });
      ctx.effect(() => () => {
        void dispose();
      });
      return true;
    } catch (error) {
      logger?.warn?.(`tool-usage-stats: cannot register ${endpoint}: ${String(error)}`);
      return true;
    }
  };
  if (!registerRoute()) {
    logger?.warn?.("tool-usage-stats: connection not ready, waiting");
    const ctxWithInject = ctx;
    ctxWithInject.inject?.(["connection"], () => {
      registerRoute();
    });
  }
}
export {
  apply,
  inject,
  name
};

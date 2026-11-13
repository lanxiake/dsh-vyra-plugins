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
  const flat = text.replace(/\s+/g, " ").trim().replace(/^Error:\s*/u, "");
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

// src/analysis.ts
var SAMPLES_PER_GROUP = 2;
var MAX_TARGETS = 8;
function groupFailures(samples) {
  const byCode = /* @__PURE__ */ new Map();
  for (const sample of samples) {
    const code = sample.code ?? "(none)";
    let group = byCode.get(code);
    if (group === void 0) {
      group = { count: 0, samples: [] };
      byCode.set(code, group);
    }
    group.count += 1;
    if (group.samples.length < SAMPLES_PER_GROUP && !group.samples.includes(sample.summary)) {
      group.samples.push(sample.summary);
    }
  }
  return [...byCode].map(([code, group]) => ({ code, count: group.count, samples: group.samples })).sort((left, right) => right.count - left.count || left.code.localeCompare(right.code));
}
var DEFAULT_POLICY = { minFailures: 5, cooldownDays: 7 };
function selectTargets(counters, failures, history, policy, now) {
  const cooldownMs = policy.cooldownDays * 24 * 60 * 60 * 1e3;
  const targets = [];
  for (const [tool, entry] of Object.entries(counters)) {
    if (entry.errorCount === 0) continue;
    const record2 = history[tool];
    const since = record2?.failuresAtAnalysis ?? 0;
    const newFailures = Math.max(0, entry.errorCount - since);
    if (newFailures < policy.minFailures) continue;
    if (record2 !== void 0 && now - record2.analyzedAt < cooldownMs) continue;
    targets.push({
      tool,
      calls: entry.count,
      failures: entry.errorCount,
      newFailures,
      groups: groupFailures(failures[tool] ?? [])
    });
  }
  return targets.sort((left, right) => right.newFailures - left.newFailures || left.tool.localeCompare(right.tool)).slice(0, MAX_TARGETS);
}
function buildPrompt(targets) {
  const blocks = targets.map((target) => {
    const rate = target.calls === 0 ? 0 : Math.round(target.failures / target.calls * 100);
    const groups = target.groups.map((group) => {
      const reasons = group.samples.map((sample) => `      - ${sample}`).join("\n");
      return `    ${group.code}\uFF1A${group.count} \u6B21${reasons === "" ? "" : `
${reasons}`}`;
    }).join("\n");
    return [
      `\u5DE5\u5177 ${target.tool}`,
      `  \u8C03\u7528 ${target.calls} \u6B21\uFF0C\u5931\u8D25 ${target.failures} \u6B21\uFF08\u5931\u8D25\u7387 ${rate}%\uFF09\uFF0C\u5176\u4E2D\u65B0\u589E ${target.newFailures} \u6B21`,
      "  \u6309\u9519\u8BEF\u7801\u5206\u7EC4\uFF1A",
      groups === "" ? "    \uFF08\u6CA1\u6709\u4FDD\u7559\u7684\u539F\u56E0\u6587\u672C\uFF09" : groups
    ].join("\n");
  }).join("\n\n");
  return [
    "\u4EE5\u4E0B\u5DE5\u5177\u5728\u6700\u8FD1\u7684\u4F7F\u7528\u4E2D\u53CD\u590D\u5931\u8D25\u3002\u8BF7\u8BCA\u65AD\u539F\u56E0\uFF0C\u5E76\u7ED9\u51FA\u53EF\u4EE5\u76F4\u63A5\u5E94\u7528\u7684\u6539\u8FDB\u65B9\u6848\u3002",
    "",
    blocks,
    "",
    "\u5BF9\u6BCF\u4E2A\u5DE5\u5177\uFF0C\u8F93\u51FA\u4E00\u4E2A JSON \u5BF9\u8C61\uFF0C\u653E\u5728 ```json \u4EE3\u7801\u5757\u91CC\uFF0C\u5F62\u5982\uFF1A",
    "[",
    "  {",
    '    "tool": "\u5DE5\u5177\u540D",',
    '    "diagnosis": "\u4E00\u53E5\u8BDD\u8BF4\u660E\u6839\u672C\u539F\u56E0",',
    '    "evidence": "\u54EA\u6761\u9519\u8BEF\u6587\u672C\u652F\u6301\u8FD9\u4E2A\u5224\u65AD",',
    '    "change": {',
    '      "kind": "description",',
    '      "description": "\u6539\u5199\u540E\u7684\u5B8C\u6574\u5DE5\u5177\u63CF\u8FF0\uFF08\u4FDD\u7559\u539F\u6709\u4FE1\u606F\uFF0C\u8865\u5145\u907F\u514D\u8BE5\u9519\u8BEF\u7684\u64CD\u4F5C\u6307\u5F15\uFF09"',
    "    }",
    "  }",
    "]",
    "",
    '`change.kind` \u53EA\u80FD\u662F "description"\u3001"parameters" \u6216 "implementation"\uFF1A',
    "- description\uFF1A\u6539\u5199\u5DE5\u5177\u63CF\u8FF0\uFF0C\u544A\u8BC9\u6A21\u578B\u600E\u4E48\u505A\u624D\u4E0D\u89E6\u53D1\u8FD9\u4E2A\u9519\u8BEF\u3002\u6700\u5B89\u5168\uFF0C\u4F18\u5148\u9009\u5B83\u3002",
    '- parameters\uFF1A\u7ED9\u51FA\u5B8C\u6574\u7684 "parameters" \u5BF9\u8C61\uFF08JSON Schema\uFF09\uFF0C\u7528\u4E8E\u4FEE\u6B63\u53C2\u6570\u5B9A\u4E49\u3002',
    '- implementation\uFF1A\u8BF4\u660E\u8981\u5B9E\u73B0\u4EC0\u4E48\u884C\u4E3A\uFF0C\u7528 "note" \u5B57\u6BB5\u63CF\u8FF0\uFF0C\u4E0D\u8981\u5199\u4EE3\u7801\u3002',
    "",
    "\u53EA\u8F93\u51FA JSON \u4EE3\u7801\u5757\uFF0C\u4E0D\u8981\u5176\u4ED6\u5185\u5BB9\u3002\u82E5\u67D0\u4E2A\u5DE5\u5177\u5176\u5B9E\u65E0\u6CD5\u4ECE\u8FD9\u4E9B\u4FE1\u606F\u5224\u65AD\u539F\u56E0\uFF0C\u5C31\u8DF3\u8FC7\u5B83\u3002"
  ].join("\n");
}
function parseDiagnoses(text) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  let parsed;
  try {
    parsed = JSON.parse(body.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const typed = entry;
    const tool = typed.tool;
    const change = typed.change;
    if (typeof tool !== "string" || tool === "") continue;
    if (typeof change !== "object" || change === null) continue;
    const typedChange = change;
    const kind = typedChange.kind;
    if (kind !== "description" && kind !== "parameters" && kind !== "implementation") continue;
    out.push({
      tool,
      diagnosis: typeof typed.diagnosis === "string" ? typed.diagnosis : "",
      evidence: typeof typed.evidence === "string" ? typed.evidence : "",
      change: {
        kind,
        ...typeof typedChange.description === "string" ? { description: typedChange.description } : {},
        ...typeof typedChange.parameters === "object" && typedChange.parameters !== null ? { parameters: typedChange.parameters } : {},
        ...typeof typedChange.note === "string" ? { note: typedChange.note } : {}
      }
    });
  }
  return out;
}

// src/diagnose.ts
var EMPTY_STATE = { history: {}, pending: [], lastRunAt: 0 };
function describeTool(definition) {
  const typed = definition;
  return {
    name: typeof typed?.name === "string" ? typed.name : "",
    description: typeof typed?.description === "string" ? typed.description : "",
    parameters: typed?.parameters ?? {}
  };
}
function prepareRun(counters, failures, state, policy, now) {
  const targets = selectTargets(counters, failures, state.history, policy, now);
  if (targets.length === 0) return void 0;
  return { prompt: buildPrompt(targets), targets };
}
function applyRun(state, counters, targets, answer, definitions, now) {
  const proposed = parseDiagnoses(answer);
  const history = { ...state.history };
  for (const target of targets) {
    history[target.tool] = {
      analyzedAt: now,
      failuresAtAnalysis: counters[target.tool]?.errorCount ?? 0
    };
  }
  const wanted = new Set(targets.map((target) => target.tool));
  const accepted = proposed.filter((diagnosis) => wanted.has(diagnosis.tool) && definitions.has(diagnosis.tool));
  const pending = [
    ...accepted.map((diagnosis) => ({
      ...diagnosis,
      proposedAt: now,
      previousDescription: definitions.get(diagnosis.tool)?.description ?? ""
    })),
    // Replace an earlier proposal for the same tool rather than stacking them.
    ...state.pending.filter((older) => !accepted.some((accepted2) => accepted2.tool === older.tool))
  ];
  return { history, pending, lastRunAt: now };
}
function dismiss(state, tool) {
  return { ...state, pending: state.pending.filter((entry) => entry.tool !== tool) };
}
function rejectParameters(parameters) {
  if (typeof parameters !== "object" || parameters === null || Array.isArray(parameters)) {
    return "\u53C2\u6570\u5B9A\u4E49\u5FC5\u987B\u662F\u4E00\u4E2A\u5BF9\u8C61";
  }
  const typed = parameters;
  if (typed.type !== "object") return '\u53C2\u6570\u5B9A\u4E49\u7684 type \u5FC5\u987B\u662F "object"';
  if (typed.properties !== void 0 && (typeof typed.properties !== "object" || typed.properties === null || Array.isArray(typed.properties))) {
    return "properties \u5FC5\u987B\u662F\u4E00\u4E2A\u5BF9\u8C61";
  }
  return void 0;
}
function resolveChange(change) {
  if (change.kind === "description") {
    if (change.description === void 0 || change.description.trim() === "") {
      return "\u5EFA\u8BAE\u91CC\u6CA1\u6709\u7ED9\u51FA\u65B0\u7684\u63CF\u8FF0";
    }
    return { description: change.description };
  }
  if (change.kind === "parameters") {
    const invalid = rejectParameters(change.parameters);
    if (invalid !== void 0) return invalid;
    return { parameters: change.parameters };
  }
  return "\u5B9E\u73B0\u6539\u52A8\u9700\u8981\u4EBA\u5DE5\u5B8C\u6210\uFF1A\u8BF7\u67E5\u770B\u5EFA\u8BAE\u91CC\u7684\u8BF4\u660E\u540E\u624B\u52A8\u4FEE\u6539\u5DE5\u5177";
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
  return { counters, failures, ...diagnosisOf(typed) };
}
function diagnosisOf(raw) {
  const block = raw.diagnosis;
  if (typeof block !== "object" || block === null || Array.isArray(block)) return {};
  const typed = block;
  const history = {};
  if (typeof typed.history === "object" && typed.history !== null && !Array.isArray(typed.history)) {
    for (const [tool, entry] of Object.entries(typed.history)) {
      if (typeof entry !== "object" || entry === null) continue;
      const record2 = entry;
      if (typeof record2.analyzedAt !== "number" || typeof record2.failuresAtAnalysis !== "number") continue;
      history[tool] = { analyzedAt: record2.analyzedAt, failuresAtAnalysis: record2.failuresAtAnalysis };
    }
  }
  const pending = [];
  if (Array.isArray(typed.pending)) {
    for (const entry of typed.pending) {
      if (typeof entry !== "object" || entry === null) continue;
      const record2 = entry;
      const change = record2.change;
      if (typeof record2.tool !== "string" || typeof change !== "object" || change === null) continue;
      const typedChange = change;
      if (typeof typedChange.kind !== "string") continue;
      pending.push({
        tool: record2.tool,
        diagnosis: typeof record2.diagnosis === "string" ? record2.diagnosis : "",
        evidence: typeof record2.evidence === "string" ? record2.evidence : "",
        change: {
          kind: typedChange.kind,
          ...typeof typedChange.description === "string" ? { description: typedChange.description } : {},
          ...typeof typedChange.parameters === "object" && typedChange.parameters !== null ? { parameters: typedChange.parameters } : {},
          ...typeof typedChange.note === "string" ? { note: typedChange.note } : {}
        },
        proposedAt: typeof record2.proposedAt === "number" ? record2.proposedAt : 0,
        previousDescription: typeof record2.previousDescription === "string" ? record2.previousDescription : ""
      });
    }
  }
  return {
    diagnosis: {
      history,
      pending,
      lastRunAt: typeof typed.lastRunAt === "number" ? typed.lastRunAt : 0
    }
  };
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
  diagnosis = EMPTY_STATE;
  applied = [];
  /** Set while a scheduled analysis is in flight, so one run is not stacked on another. */
  analyzing = false;
  sessions = /* @__PURE__ */ new Map();
  /** The diagnosis settings the panel shows and edits. */
  settings = { analyzeEveryHours: 24, minFailures: 5, cooldownDays: 7 };
  /** @returns the snapshot to persist. */
  snapshot() {
    return {
      counters: this.counters,
      failures: this.failures,
      diagnosis: {
        history: this.diagnosis.history,
        pending: this.diagnosis.pending,
        lastRunAt: this.diagnosis.lastRunAt
      }
    };
  }
  /**
   * Adopt a snapshot loaded from durable storage.
   * @param loaded - the restored state.
   */
  restore(loaded) {
    this.counters = loaded.counters;
    this.failures = loaded.failures;
    this.diagnosis = loaded.diagnosis === void 0 ? EMPTY_STATE : {
      history: loaded.diagnosis.history,
      pending: loaded.diagnosis.pending,
      lastRunAt: loaded.diagnosis.lastRunAt
    };
  }
  /** @returns the counters, for the analysis to read. */
  get currentCounters() {
    return this.counters;
  }
  /** @returns the failure audit, for the analysis to read. */
  get currentFailures() {
    return this.failures;
  }
  /** @returns the diagnosis state. */
  get diagnosisState() {
    return this.diagnosis;
  }
  /** @returns whether a prepared run is waiting for a step to carry it. */
  get isAnalyzing() {
    return this.analyzing;
  }
  /**
   * Record that a request is prepared and waiting to be delivered.
   *
   * Not a lock: a second request replaces the first, which is the honest
   * behaviour for "prepare the current diagnosis". A lock would strand the flag
   * whenever a user asked and then never sent a message.
   */
  beginAnalysis() {
    this.analyzing = true;
  }
  /** Record that the prepared request has been delivered and settled. */
  endAnalysis() {
    this.analyzing = false;
  }
  /**
   * Replace the diagnosis state.
   * @param next - the state to adopt.
   */
  setDiagnosis(next) {
    this.diagnosis = next;
  }
  /**
   * Drop one proposal and record nothing about it.
   * @param tool - the tool whose proposal to drop.
   */
  dismissProposal(tool) {
    this.diagnosis = dismiss(this.diagnosis, tool);
  }
  /**
   * Record that a tool's definition changed, so it can be reviewed later.
   * @param change - what changed.
   */
  recordApplied(change) {
    this.applied = [change, ...this.applied].slice(0, 50);
  }
  /** @returns the applied changes, newest first. */
  get appliedChanges() {
    return this.applied;
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
      coverage: coverage(this.counters, this.retainDays),
      diagnosis: {
        pending: this.diagnosis.pending,
        applied: this.applied,
        lastRunAt: this.diagnosis.lastRunAt,
        analyzing: this.analyzing,
        settings: this.settings
      }
    };
  }
};
var DEFAULT_WINDOWS = [7, 30];
function sameSnapshot(left, right) {
  if (left === void 0) return false;
  if (left.counters !== right.counters || left.failures !== right.failures) return false;
  return left.diagnosis?.lastRunAt === right.diagnosis?.lastRunAt && left.diagnosis?.pending === right.diagnosis?.pending && left.diagnosis?.history === right.diagnosis?.history;
}
var FLUSH_MS = 15e3;
function apply(ctx, config = {}) {
  const retainDays = config.retainDays ?? 90;
  const retainFailures = config.retainFailures ?? 20;
  const stats = new ToolUsageStats(retainDays, retainFailures);
  const logger = ctx.get("logger");
  const pendingNames = /* @__PURE__ */ new Map();
  const awaiting = /* @__PURE__ */ new Map();
  const requestedFrom = /* @__PURE__ */ new Map();
  const queued = [];
  function applyQueued(agent) {
    if (queued.length === 0) return;
    const tools = agent?.ctx?.tools;
    if (tools === void 0) return;
    for (const item of queued.splice(0, queued.length)) {
      const result = swapIn(tools, item.tool, item.change, swaps, stats, logger);
      if (!result.ok) {
        logger?.warn?.(`tool-usage-stats: cannot apply to ${item.tool}: ${result.detail}`);
      }
    }
  }
  const swaps = /* @__PURE__ */ new Map();
  const analyzeEveryHours = config.analyzeEveryHours ?? 24;
  if (analyzeEveryHours > 0) {
    const timer = setInterval(() => {
      try {
        if (requestedFrom.size > 0) return;
        const agents = ctx.get("agents");
        const live = agents?.list?.() ?? [];
        if (live.length === 0) return;
        const prepared = prepareRun(
          stats.currentCounters,
          stats.currentFailures,
          stats.diagnosisState,
          policy,
          Date.now()
        );
        if (prepared === void 0) return;
        for (const agent of live) {
          const id = agent?.session?.id;
          if (id !== void 0) requestedFrom.set(id, prepared);
        }
        stats.beginAnalysis();
        logger?.warn?.(`tool-usage-stats: scheduled diagnosis queued for ${live.length} session(s)`);
      } catch (error) {
        logger?.warn?.(`tool-usage-stats: scheduled analysis failed: ${String(error)}`);
      }
    }, analyzeEveryHours * 60 * 60 * 1e3);
    timer.unref?.();
    ctx.effect(() => () => {
      clearInterval(timer);
    });
  }
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
  const flush = () => {
    if (durable === void 0) return Promise.resolve();
    const current = stats.snapshot();
    if (sameSnapshot(lastFlushed, current)) return Promise.resolve();
    lastFlushed = current;
    return durable.put(SNAPSHOT_KEY, current).catch((error) => {
      logger?.warn?.(`tool-usage-stats: flush failed: ${String(error)}`);
    });
  };
  const flushTimer = setInterval(() => {
    void flush();
  }, FLUSH_MS);
  flushTimer.unref?.();
  ctx.effect(() => () => {
    clearInterval(flushTimer);
  });
  ctx.on("session/flush", (() => flush()));
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
    if (event.type !== "tool/result") {
      if (event.type === "assistant/message") readAnswer(session.id, event);
      return;
    }
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
  const policy = {
    minFailures: config.minFailures ?? DEFAULT_POLICY.minFailures,
    cooldownDays: config.cooldownDays ?? DEFAULT_POLICY.cooldownDays
  };
  stats.settings = {
    analyzeEveryHours: config.analyzeEveryHours ?? 24,
    minFailures: policy.minFailures,
    cooldownDays: policy.cooldownDays
  };
  const toolDefinitions = () => {
    const tools = ctx.get("tools");
    const definitions = tools?.definitions?.() ?? [];
    const out = /* @__PURE__ */ new Map();
    for (const definition of definitions) {
      const described = describeTool(definition);
      if (described.name !== "") out.set(described.name, described);
    }
    return out;
  };
  const askOnStep = async (payload, next) => {
    const decision = await next();
    const sessionId = payload?.agent?.session?.id;
    if (sessionId !== void 0) applyQueued(payload?.agent);
    try {
      if (decision.kind === "reject" || sessionId === void 0) return decision;
      const requested = requestedFrom.get(sessionId);
      const prepared = requested ?? prepareRun(stats.currentCounters, stats.currentFailures, stats.diagnosisState, policy, Date.now());
      if (prepared === void 0) return decision;
      awaiting.set(sessionId, prepared.targets);
      if (requested === void 0) {
        stats.setDiagnosis({ ...stats.diagnosisState, lastRunAt: Date.now() });
      }
      requestedFrom.delete(sessionId);
      stats.endAnalysis();
      const text = diagnosisMessage(prepared.prompt);
      return {
        ...decision,
        messages: [
          ...decision.messages ?? [],
          { role: "user", content: [{ type: "text", text }], source: { kind: "vyra-tool-usage-stats" } }
        ]
      };
    } catch (error) {
      process.stderr.write(`[vyra] pre-step failed: ${String(error)}
`);
      logger?.warn?.(`tool-usage-stats: diagnosis prompt failed: ${String(error)}`);
      return decision;
    }
  };
  ctx.on("agent/pre-step", askOnStep);
  const readAnswer = (sessionId, event) => {
    const targets = awaiting.get(sessionId);
    if (targets === void 0) return;
    try {
      const data = event.data;
      const content = data.message?.content;
      if (!Array.isArray(content)) return;
      const text = content.filter((block) => typeof block === "object" && block !== null && block.type === "text" && typeof block.text === "string").map((block) => block.text).join("\n");
      if (text === "") {
        return;
      }
      awaiting.delete(sessionId);
      requestedFrom.delete(sessionId);
      const definitions = toolDefinitions();
      const next = applyRun(
        stats.diagnosisState,
        stats.currentCounters,
        targets,
        text,
        definitions,
        Date.now()
      );
      stats.setDiagnosis(next);
      stats.endAnalysis();
    } catch (error) {
      awaiting.delete(sessionId);
      stats.endAnalysis();
      logger?.warn?.(`tool-usage-stats: reading a diagnosis failed: ${String(error)}`);
    }
  };
  const registerRoutes = () => {
    const connection = ctx.get("connection");
    if (connection?.fetch === void 0) return false;
    const json = (body, status = 200) => new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" }
    });
    const base = config.endpoint ?? "/api/vyra/tool-usage";
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
        }),
        // Requesting a diagnosis only queues it: the answer arrives on the next
        // step of a live session, which is the only place the model can be asked.
        connection.fetch.register({
          path: `${base}/diagnose`,
          methods: ["POST"],
          requestBody: "buffered",
          fetch: async (request) => {
            const body = await request.json().catch(() => ({}));
            const requested = typeof body.sessionId === "string" ? body.sessionId : void 0;
            const prepared = prepareRun(
              stats.currentCounters,
              stats.currentFailures,
              stats.diagnosisState,
              policy,
              Date.now()
            );
            if (prepared === void 0) {
              return json({
                ok: false,
                detail: `\u6CA1\u6709\u8FBE\u5230\u5206\u6790\u6761\u4EF6\u7684\u5DE5\u5177\uFF08\u9700\u8981\u65B0\u589E\u5931\u8D25 \u2265 ${policy.minFailures} \u6B21\uFF0C\u4E14\u8DDD\u4E0A\u6B21\u5206\u6790 \u2265 ${policy.cooldownDays} \u5929\uFF09`
              }, 409);
            }
            let sessionId = requested;
            let created = false;
            if (sessionId === void 0) {
              const agents = ctx.get("agents");
              if (agents?.create === void 0) {
                return json({ ok: false, detail: "\u65E0\u6CD5\u65B0\u5EFA\u4F1A\u8BDD\uFF1Aagents \u670D\u52A1\u4E0D\u53EF\u7528" }, 503);
              }
              try {
                sessionId = `vyra-diagnosis-${Date.now().toString(36)}`;
                const handle = await agents.create({ sessionId });
                created = true;
                const agent = handle?.agent;
                agent?.followup?.({
                  role: "user",
                  content: [{ type: "text", text: diagnosisMessage(prepared.prompt) }],
                  source: { kind: "user" }
                });
                stats.beginAnalysis();
                return json({
                  ok: true,
                  sessionId,
                  created,
                  targets: prepared.targets.map((target) => target.tool)
                });
              } catch (error) {
                return json({ ok: false, detail: `\u65B0\u5EFA\u4F1A\u8BDD\u5931\u8D25\uFF1A${String(error)}` }, 500);
              }
            }
            stats.beginAnalysis();
            requestedFrom.set(sessionId, prepared);
            return json({
              ok: true,
              sessionId,
              created,
              targets: prepared.targets.map((target) => target.tool)
            });
          }
        }),
        // Applying a proposal is the only path that changes a live tool.
        connection.fetch.register({
          path: `${base}/apply`,
          methods: ["POST"],
          requestBody: "buffered",
          fetch: async (request) => {
            const body = await request.json().catch(() => ({}));
            const toolName = typeof body.tool === "string" ? body.tool : void 0;
            if (toolName === void 0) return json({ ok: false, detail: "\u9700\u8981 tool" }, 400);
            const proposal = stats.diagnosisState.pending.find((entry) => entry.tool === toolName);
            if (proposal === void 0) return json({ ok: false, detail: `\u6CA1\u6709 ${toolName} \u7684\u5F85\u5904\u7406\u5EFA\u8BAE` }, 404);
            const resolved = resolveChange(proposal.change);
            if (typeof resolved === "string") return json({ ok: false, detail: resolved }, 422);
            queued.push({ tool: toolName, change: resolved });
            stats.dismissProposal(toolName);
            return json({
              ok: true,
              tool: toolName,
              applied: proposal.change.kind,
              note: "\u6539\u52A8\u4F1A\u5728\u8BE5\u4F1A\u8BDD\u7684\u4E0B\u4E00\u6B65\u751F\u6548"
            });
          }
        }),
        // Dismissing costs nothing, so it succeeds even when the proposal is gone.
        connection.fetch.register({
          path: `${base}/dismiss`,
          methods: ["POST"],
          requestBody: "buffered",
          fetch: async (request) => {
            const body = await request.json().catch(() => ({}));
            const toolName = typeof body.tool === "string" ? body.tool : void 0;
            if (toolName === void 0) return json({ ok: false, detail: "\u9700\u8981 tool" }, 400);
            stats.dismissProposal(toolName);
            return json({ ok: true });
          }
        }),
        // Configuration is edited through the Host's own config editor rather
        // than by writing the profile file: the editor owns the file lock, the
        // bundle reconciliation, and the reload that makes a change take effect.
        connection.fetch.register({
          path: `${base}/config`,
          methods: ["POST"],
          requestBody: "buffered",
          fetch: async (request) => {
            const body = await request.json().catch(() => ({}));
            const editor = ctx.get("configEditor");
            const entry = editor?.entries?.().find((candidate) => candidate.options.id === name);
            if (editor?.edit === void 0 || entry === void 0) {
              return json({ ok: false, detail: "\u8BE5 profile \u6CA1\u6709\u53EF\u7F16\u8F91\u7684\u672C\u63D2\u4EF6\u914D\u7F6E\u884C\uFF08\u9700\u8981 Web \u6216 Desktop \u5BA2\u6237\u7AEF\uFF09" }, 503);
            }
            const next = {};
            const num = (value, min) => typeof value === "number" && Number.isFinite(value) && value >= min ? value : void 0;
            const hours = num(body.analyzeEveryHours, 0);
            const minFailures = num(body.minFailures, 1);
            const cooldown = num(body.cooldownDays, 0);
            if (hours !== void 0) next.analyzeEveryHours = hours;
            if (minFailures !== void 0) next.minFailures = minFailures;
            if (cooldown !== void 0) next.cooldownDays = cooldown;
            if (Object.keys(next).length === 0) {
              return json({ ok: false, detail: "\u6CA1\u6709\u53EF\u5199\u5165\u7684\u914D\u7F6E\u9879" }, 400);
            }
            try {
              await editor.edit(entry, (current) => ({ ...current, ...next }));
              return json({ ok: true, config: next });
            } catch (error) {
              return json({ ok: false, detail: `\u5199\u5165\u914D\u7F6E\u5931\u8D25\uFF1A${String(error)}` }, 500);
            }
          }
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
function swapIn(tools, toolName, change, swaps, stats, logger) {
  const current = tools.get(toolName);
  if (current === void 0) return { ok: false, detail: "\u5DE5\u5177 " + toolName + " \u4E0D\u5728\u6CE8\u518C\u8868\u91CC" };
  if (typeof current.execute !== "function") {
    return { ok: false, detail: "\u5DE5\u5177 " + toolName + " \u6CA1\u6709\u53EF\u590D\u7528\u7684\u5B9E\u73B0\uFF0C\u65E0\u6CD5\u5B89\u5168\u66FF\u6362" };
  }
  const before = {
    description: typeof current.description === "string" ? current.description : "",
    parameters: current.parameters ?? {}
  };
  let dispose;
  try {
    dispose = tools.register({
      ...current,
      name: toolName,
      description: change.description ?? before.description,
      parameters: change.parameters ?? before.parameters,
      // Borrowed deliberately: the registry is documented to accept a readonly
      // definition without copying it, so the original body keeps working.
      execute: current.execute,
      output: current.output
    });
  } catch (error) {
    return { ok: false, detail: "\u6CE8\u518C\u66FF\u6362\u7248\u672C\u5931\u8D25\uFF1A" + String(error) };
  }
  swaps.get(toolName)?.();
  swaps.set(toolName, dispose);
  stats.recordApplied({
    tool: toolName,
    before,
    appliedAt: Date.now(),
    kind: change.description === void 0 ? "parameters" : "description"
  });
  logger?.warn?.("tool-usage-stats: replaced " + toolName);
  return { ok: true };
}
function diagnosisMessage(prompt) {
  return [
    "\u3010\u5DE5\u5177\u8BCA\u65AD\u8BF7\u6C42\u3011",
    "",
    prompt,
    "",
    "\uFF08\u8FD9\u662F vyra \u5DE5\u5177\u7528\u91CF\u63D2\u4EF6\u81EA\u52A8\u53D1\u51FA\u7684\u8BCA\u65AD\u8BF7\u6C42\u3002\u8BF7\u53EA\u56DE\u590D\u4E0A\u9762\u8981\u6C42\u7684\u5185\u5BB9\u3002\uFF09"
  ].join("\n");
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

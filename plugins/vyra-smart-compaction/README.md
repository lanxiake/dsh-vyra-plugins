# dsh-smart-compaction

Tiered, agent-decided context compaction for DeepSeek Harness.

The design is ported from the **lumii** agent runtime's `compact/` subsystem
(reverse-engineered in `docs/analysis/lumii-compaction-analysis.md`) and mapped
onto this harness's own services, so nothing is rebuilt that the harness already
owns: `@deepseek-ai/dsh-compaction-basic` keeps the summary, the retention
policy, the log-recorded transaction bracket and overflow recovery.

## What it adds

| Layer | What it does | Cost |
|---|---|---|
| Pressure ladder | Measures the session once per step with the singleton `ctx.tokenMeter` and classifies pressure against three ratios. | one `measure()` per step (O(surface)) |
| Deterministic prune | Inside the prune band, collapses duplicate tool results and replaces an oversized old result with a small clue-preserving micro-summary. Never touches user/assistant text, the newest `protectLastN` nodes, or tools whose output is not re-obtainable. | no model call |
| Reclaim gate + re-arm runway | A pass that would free less than `pruneMinReclaimTokens` is abandoned before writing; after a committed pass nothing is re-scanned until pressure climbs past `after + max(reclaimed, triggerTokens, minReclaim)`. | avoids prefix-invalidating churn |
| `context_report` tool | Tokens vs the usable window, the next threshold, what pruning could still free, the largest history items, and a recommendation. | one tool call, no model request |
| `compact_context` tool | The **agent decides**: it picks the span, how many recent turns stay verbatim, and when. Returns before/after tokens. | one summarization request |
| `/smart-compact` command | The same reduction on demand, human-initiated. | one summarization request |
| Pressure line | One runtime-context line once pressure leaves the calm band. | ~20 tokens, only when relevant |
| Composer chip | A live `Context 74.2% · trigger` chip; hidden while calm. | one poll every 5 s |

## Why the shape is this

- **Deterministic first, model second.** A summary call costs a full auxiliary
  request; dedup and micro-summaries cost nothing and often free enough that no
  summary is needed at all.
- **A reclaim gate, not just a trigger.** Rewriting a surface node invalidates
  the provider's warm prefix, so a marginal pass costs more in cache misses than
  it frees. Both the gate and the re-arm runway exist for that one reason.
- **The log stays the truth.** Every replacement is a new `tool/result` with
  `surfaceOp: replace` citing the node it shadows (`sourceEventSeqs`), preceded by
  a `compaction/prune` shadow-price record. The original text is still in the
  append-only log, and replay reproduces the same surface.
- **The model decides with facts.** `context_report` exists because a model
  cannot choose to compact something it cannot see. The tool descriptions state
  the trigger and the effect; the numbers come from the same resolved config the
  ladder uses.

## Configuration

Every field is optional and validated at activation; an unknown key refuses the
mount. Defaults follow lumii's numbers (`0.48` prune band, `4096` reclaim gate,
`3000` micro-summary floor, `200` dedup floor, `20` protected tail, `6` retained
turns).

| Field | Default | Meaning |
|---|---|---|
| `pruneRatio` | `0.48` | Usable-window fraction where deterministic pruning starts. |
| `triggerRatio` | `0.72` | Fraction where the report and prompt tell the model compaction is worthwhile. |
| `emergencyRatio` | `0.9` | Fraction where the advice becomes "compact now". |
| `pruneMinReclaimTokens` | `4096` | Skip a pass that would free fewer tokens than this. |
| `pruneMinResultChars` | `3000` | Only results at least this long become micro-summaries. |
| `dedupMinChars` | `200` | Minimum length for duplicate detection. |
| `pruneRearm` | `true` | Honour the re-arm runway. |
| `protectLastN` | `20` | Newest surface nodes never rewritten. |
| `keepRecentTurns` | `6` | User turns kept verbatim by a recommended-mode compaction. |
| `maxNodesPerPass` | `40` | Replacements per pass. |
| `headChars` / `tailChars` | `1500` / `600` | Head/tail budgets when `microSummary` is false. Must leave room below `pruneMinResultChars`. |
| `microSummary` | `true` | Clue-preserving summary instead of a head/tail slice. |
| `reobtainableTools` | `read, list_dir, glob, grep, bash, pwsh, web_search, web_fetch, cordis_inspect_query, team_task_list, team_task_get, list_mcp_resources, read_mcp_resource, memory_search, memory_read, memory_project` | Results that may be rewritten because re-running the tool is cheap. The trailing entries are read-only inspection and recall tools: calling them again returns the same answer. |
| `defaultContextWindow` | `128000` | Capacity used before the routed model declares one. |
| `reportTopNodes` | `8` | Largest items listed by `context_report`. |
| `pressureContextLine` | `true` | Emit the runtime-context pressure line. |

Reducing `triggerRatio` makes the agent compact **earlier and more often**;
raising it does the opposite. It only changes what the agent is advised to do and
when the pressure line appears — the shipped backend's own automatic trigger is
untouched.

## Composition

The bundle inserts one host-plane row and one client row. It reads
`tokenMeter`, `toolResultPruner`, `commands`, `connection` and `compaction`
through `ctx.get()` guards, so it mounts in any profile: absent peers degrade the
feature, they do not fail the mount.

## Limits and guarantees

Guarantees the self-test pins (`node test/selftest.mjs`, 21 checks; the threshold
and tool-call-argument cases are pinned separately by `node
test/prune-args.test.mjs`, 9 checks):

- **User and assistant text is never rewritten.** Only `tool/result` content changes.
- **The retained tail is a promise.** `compact_context` refuses (no model call, no
  log write) when the session holds no more user turns than the requested tail,
  and the result states the number of turns it actually kept.
- **No unbalanced span.** The compacted range always starts before and ends after
  a complete assistant-tool-call / tool-result pair.
- **Nothing is written when the reclaim gate refuses**, and a pass never rewrites
  its own output on a later pass.
- **The append-only log keeps the original text.** Every replacement cites the
  node it shadows through `sourceEventSeqs`, preceded by a `compaction/prune`
  shadow-price record.
- **A failing replacement never fails the step**: the surface keeps the original
  node and the failure is logged.

Known limits:

- Pruning is content-blind by design: it keeps the clue lines and says how to
  re-obtain the full output rather than guessing which middle lines mattered.
- **An oversized tool-call `arguments` cannot be pruned on this host.** The
  assistant message that carries it is the only place the text exists, and the
  session's surface contract forbids replacing an `assistant/message`:
  a positional replacement must cite every shadowed node through
  `sourceEventSeqs`, while `assistant/message` is rejected outright for carrying
  `sourceEventSeqs` (it "embeds its source stream"). Both rules are enforced in
  `@deepseek-ai/dsh-session`'s surface fold, so there is no legal append that
  shrinks those arguments. The deterministic tier therefore reclaims from
  `tool/result` nodes only; the summarizer remains the only tier that shrinks a
  large `write`/`edit` call, by compacting the whole span that contains it.
- The reclaim gate's saving is an estimate (the meter's own 4-character
  heuristic); the number reported after a pass is measured from the meter.
- The dedup rule keeps the oldest copy of an identical result verbatim and never
  also summarizes it, so a duplicated group always retains one readable original.
- The client chip polls `/api/smart-compaction/pressure`; if the route is
  unreachable it hides rather than renders an error.

## Verification status

- Host half: registered live and exercised in a real session — `context_report`
  appears in the tool catalog and returns measured pressure; the runtime-context
  pressure line appears once pressure leaves the calm band. The agent-decided
  path ran end to end in a live session: `compact_context {keepRecentTurns: 6}`
  compacted 536 surface items and freed 163837 tokens through the plugin's own
  `finishCompaction`, which also proves it reached the preset-scoped compaction
  backend (`agentPresets.serviceFor(agent, 'compaction')`) rather than reporting
  "no compaction backend".
- Tests: `node test/selftest.mjs` → 25 checks, exit 0; `node test/prune-args.test.mjs`
  → 9 checks, exit 0. The tail-split checks were proven non-vacuous by
  re-introducing the defect and watching them fail (`163 !== 6`).
- Retained tail: the promise is computed by one exported pure function,
  `tailPlan(userTurnCount, keepRecentTurns)`, and both the cut and the sentence in
  the tool result read the same value. A session at or below the requested tail
  has no span and is declined rather than compacted; the result then makes no
  "stay verbatim" claim.
- Client half: the slot row is registered in the live page
  (`conversation.composer.dock` → `smart-compaction-pressure`). The chip's own
  rendering was not visually confirmed; the client inspect channel timed out for
  the verifier, so treat the pixels as unverified while the registration is
  proven.
- The two analyses this design rests on are in `docs/analysis/`; the first
  independent verification round, including four defects that were then fixed, is
  in `docs/verification/smart-compaction-verification.md`; the round-2 re-check,
  including the new N1 defect (a printed turn count that was the complement of the
  promise) and its red test, is in `docs/verification/smart-compaction-reverification.md`.



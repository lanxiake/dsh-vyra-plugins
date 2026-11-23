---
name: vyra-dsh-console
description: Use when asked to change a DSH installation itself — switch the theme, layout or language, change the default model, read or write a setting, enable/disable/install/uninstall a plugin, restart or probe an MCP server, list skills, or inspect what a profile is configured with. Also use when a request would change the sandbox mode or approval policy, which this plugin refuses by design.
---

# DSH console

Two layers operate a DSH installation, with different powers:

| Layer | Use it for | Never for |
|---|---|---|
| `dsh_console` tool | Every change | — |
| `vyra-console` CLI | Reading current state when you need it without burning a tool call | Any change; it is read-only |

Read `dsh_console({ action: 'console.actions' })` first. It is the live list of what exists — this
document explains the shape and the boundary, not the catalogue.

## The boundary

Four actions are refused permanently, with the reason and the user-facing alternative in the
response: `sandbox.setMode`, `permission.setPreset`, `approval.answer`, `credentials.set`.
The refusal is checked before anything else, so no argument, `confirm`, or config makes them run.

**The rule behind them:** you may change how the harness looks and how it is configured; you may
never change how much authority you hold over the user's machine. An agent that widens its own
permissions — sandbox mode, approval policy, answering its own approval prompts — is the exact
failure this boundary exists to prevent.

When you get a `forbidden` result, that is the answer. Report it and name the alternative the
response gives (normally: the user changes it in Settings, or via `/permission`).

**Do not route around a refusal by editing files yourself.** Config files on disk —
`cordis.patch.yml`, `settings.yaml`, a profile's `package.json` — are the same knobs by another
route. Editing `permissionPresets` in YAML to set `approval: never` is the forbidden action with
extra steps. If a change is refused, it is refused; hand it back to the user.

## Appearance actions need the interface

`appearance.*` — theme, font size, sidebar, right sidebar, language — are Client-realm: they live
in the browser, so the Host asks the open interface to do them. With no DSH Web UI connected the
call returns `unavailable` with a reason. That is a real failure, not a slow success: **tell the
user the interface is not open** and to open it, rather than reporting the theme as changed.
`appearance.state` is the read-only one and is safe to call any time.

## Quick reference

```
dsh_console({ action: 'console.actions' })                    # what exists, and what is refused
dsh_console({ action: 'model.list' })                         # current default + providers
dsh_console({ action: 'model.select', args: { provider, model } })
dsh_console({ action: 'settings.list' })                      # namespaces
dsh_console({ action: 'settings.set', args: { ns, patch } })
dsh_console({ action: 'plugin.list' })                        # entries + bundles
dsh_console({ action: 'plugin.setEnabled', args: { id } })    # entry id; { name } for a bundle
dsh_console({ action: 'mcp.list' })                           # servers and their state
dsh_console({ action: 'appearance.setTheme', args: { id: 'dark' } })
dsh_console({ action: 'skill.list' })
```

Installed plugin, from a shell:

```sh
node "${DSH_PROFILE_DIR:-$HOME/.dsh/profiles/${DSH_PROFILE:-desktop}}/node_modules/vyra-dsh-console/cli.mjs" doctor --json
```

Developing in the repo, use `node plugins/vyra-dsh-console/cli.mjs …`. The CLI offers `doctor`
(one summary: bundles, model, appearance, MCP), `state`, `services`, `events`; all accept `--json`,
all are read-only, and `--help` lists them. Read its `caveats` — it says what it could not
determine rather than guessing.

## Common mistakes

- **Reporting an `unavailable` appearance call as success.** The interface is not open; say so.
- **Treating `plugin.setEnabled` as one identifier space.** `id` is a Loader entry id; `name` is an
  npm package name. Passing one where the other belongs silently matches nothing. `plugin.list`
  returns both — read the right column.
- **Inventing a field.** `plugin.list` rows are keyed `entryId`, not `id`; `settings.list` rows
  have no `title`. Every key the tool returns exists on the real service.
- **Inventing a settings namespace.** `settings.set` refuses an `ns` that `settings.list` does not
  return — it will not create one, so a typo cannot leave an unreachable config section behind.
- **Answering a `confirm-required` result by asking the user to approve.** Re-run with
  `confirm: true` when the action is genuinely what they asked for.
- **Using the CLI to change something.** It cannot, by construction. Changes go through the tool,
  which takes the same profile lock, activation and rollback path as the Web UI.
- **Trusting a config file over `console.actions` for which actions exist and which are refused.**
  Files drift; the live registry does not. This is about the action surface only — the CLI below is
  still the right way to read configuration, and it reports declared-not-running state as such.

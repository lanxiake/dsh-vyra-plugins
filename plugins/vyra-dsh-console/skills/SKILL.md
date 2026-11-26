---
name: vyra-dsh-console
description: Use when asked to change or inspect a DSH installation itself — read the whole inventory (plugins, bundles, MCP servers, skills, tools), open the settings page or a specific plugin's settings section, switch the main panel or the right drawer, change theme/layout/language, read or write a setting, or enable/install/remove a plugin. Also use when a request would change the sandbox mode or approval policy, which this plugin refuses by design.
---

# DSH console

You can operate the harness you are running in — and, just as important, you
know where the boundary is.

## First call: find out what exists

```
dsh_console({ action: 'console.map' })    # host side: plugins, bundles, MCP, skills, tools
dsh_console({ action: 'ui.list' })        # client side: settings pages, panels, drawer tabs, commands
dsh_console({ action: 'console.actions' })  # every action, and every refused one
```

Never invent an id. Ids come from those three answers:

- a **settings section** id is the row's `id` in `ui.list.settings.sections`, and
  its `registrant` is the package that contributed it. "The free-model settings
  page" is the row whose `registrant` is `dsh-vyra-free-model`;
- a **main panel** id is in `ui.list.main.panels`;
- a **right-drawer tab** kind is in `ui.list.rightbar.tabs`;
- a **command** id is in `ui.list.commands`.

`console.map.caveats` names anything it could not read and why. Read it before
concluding a service is absent.

## Opening an interface

```
dsh_console({ action: 'ui.open', args: { target: 'settings', section: 'dsh-vyra-free-model' } })
dsh_console({ action: 'ui.open', args: { target: 'main', id: 'plugins' } })
dsh_console({ action: 'ui.open', args: { target: 'rightbar', kind: 'browser', url: 'https://example.com' } })
dsh_console({ action: 'ui.close', args: { target: 'settings' } })
dsh_console({ action: 'ui.state' })
```

**`verified: true` is the only thing that means it happened.** A successful
`ui.open` carries `resolved` (what it actually found) and `how`
(`service` / `dom` / `noop`). If `status` is `ok` but `verified` is not true,
treat it as not done.

Three failure shapes, and they mean different things:

| `status` | meaning | what to tell the user |
|---|---|---|
| `unavailable` | no interface is connected, the tab is in the background, or the platform cannot do it | open the DSH window / bring it to the front / press the keys yourself |
| `error` | the request is wrong: no such id, another dialog is open | read `candidates` and retry with a real id |
| `forbidden` | the action changes your own authority | it is refused by design; name the alternative in the reply |

A misspelled id returns `candidates` — the nearest real ids. Retry with one of
them instead of guessing again.

## Commands

```
dsh_console({ action: 'ui.invoke', args: { id: 'settings.open' } })
```

On Web and Linux this synthesizes the bound key. On Windows and macOS desktop the
native keyboard layer owns the bindings and the page cannot dispatch one, so the
answer is `unavailable` **with the keys in `hint`** — pass that to the user
("press Ctrl+,"), do not retry and do not claim it ran.

## The boundary

Four actions are refused permanently, with the reason and the user-facing
alternative in the response: `sandbox.setMode`, `permission.setPreset`,
`approval.answer`, `credentials.set`. The refusal is checked before anything
else, so no argument, `confirm`, or config makes them run.

**The rule behind them:** you may change how the harness looks and how it is
configured; you may never change how much authority you hold. An agent that
widens its own permissions — sandbox mode, approval policy, answering its own
approval prompts — is the exact failure this boundary exists to prevent.

**Driving the interface does not widen it.** `ui.open` may take the user to a
settings page that contains a permission control. Take them there; do not press
the control. Opening the page is navigation, answering the control is the
forbidden action with a click in between.

Do not route around a refusal by editing files yourself. `cordis.patch.yml`,
`settings.yaml` and a profile's `package.json` are the same knobs by another
route: editing `permissionPresets` in YAML to set `approval: never` is the
forbidden action with extra steps.

## Everything else

```
dsh_console({ action: 'model.list' })
dsh_console({ action: 'model.select', args: { provider, model } })
dsh_console({ action: 'settings.list' })
dsh_console({ action: 'settings.set', args: { ns, patch } })
dsh_console({ action: 'plugin.list' })
dsh_console({ action: 'plugin.setEnabled', args: { id } })     # entry id; { name } for a bundle
dsh_console({ action: 'mcp.list' })
dsh_console({ action: 'appearance.setTheme', args: { id: 'dark' } })
dsh_console({ action: 'skill.list' })
```

## The CLI is read-only, on purpose

```sh
node "${DSH_PROFILE_DIR:-$HOME/.dsh/profiles/${DSH_PROFILE:-desktop}}/node_modules/dsh-vyra-dsh-console/cli.mjs" map --json
```

`doctor`, `map`, `state`, `services`, `events` — all read-only, all `--json`.
Changes go through the tool, which uses the same profile lock, activation and
rollback path as the Web UI. The CLI reports what the profile's files say and
marks live state as `unknown`; it says what it could not determine rather than
guessing.

## Common mistakes

- **Reporting an `ok` without `verified` as done.** It is not done.
- **Inventing a section id from a plugin name.** Use `ui.list`; the id and the
  package differ more often than not.
- **Treating `plugin.setEnabled` as one identifier space.** `id` is a Loader
  entry id; `name` is an npm package name.
- **Inventing a settings namespace.** `settings.set` refuses an `ns` that
  `settings.list` does not return.
- **Answering a `confirm-required` result by asking the user to approve.** Re-run
  with `confirm: true` when the action is genuinely what they asked for.
- **Retrying `unavailable`.** The interface is not there; tell the user to open
  it, or the platform cannot do it and the hint says what to press instead.

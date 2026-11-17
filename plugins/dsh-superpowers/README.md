# @anht3889/dsh-superpowers

DeepSeek Harness profile plugin that mounts [obra Superpowers](https://github.com/obra/superpowers) skills and injects `using-superpowers` methodology guidance at session start.

## What it does

On profile load, this plugin:

1. **Mounts skills** — resolves the installed Superpowers `skills/` directory and registers an isolated `dsh-skill-filesystem` provider (`providerName: superpowers`) so the agent can load skills with the `skill` tool.
2. **Registers bootstrap** — contributes a durable `superpowers:bootstrap` system-prompt section from `using-superpowers/SKILL.md` plus a short DeepSeek Harness note about using the `skill` tool (not Claude Code–only hooks). The section is present on the first model request.

No skill files are committed to this repository; they are copied from upstream when the npm tarball is built, as described below.

## Install

```sh
npx @deepseek-ai/dsh plugin --profile web add @anht3889/dsh-superpowers
npx @deepseek-ai/dsh plugin --profile headless add @anht3889/dsh-superpowers
```

## Where the skills come from

Superpowers is a **devDependency** here, pinned to the immutable commit behind the `v6.4.2` tag (a moving tag would let upstream silently change what a fixed `@anht3889/dsh-superpowers` version ships):

```json
"superpowers": "github:obra/superpowers#8ca22dba9a94f28898bbce59f2537ff4d87c747d"
```

The `prepack` step (`scripts/vendor-skills.mjs`) copies that checkout's `skills/` tree and its MIT `LICENSE` into `vendor/superpowers/`, which ships inside the published tarball (~140 kB packed). At runtime the plugin resolves `vendor/superpowers/skills` first and falls back to an installed `superpowers` package, which is what local development uses.

This indirection exists because pnpm 11 enables `blockExoticSubdeps` by default: a git-resolved **sub**dependency fails the install with `ERR_PNPM_EXOTIC_SUBDEP`, so a published plugin cannot depend on Superpowers by git URL. Shipping the skills in the tarball also means profile installs need only the npm registry — no `codeload.github.com` access.

To pick up a newer Superpowers release, bump the pinned commit in this package's `package.json` and publish a new version of `@anht3889/dsh-superpowers` — consumers upgrade the plugin, not Superpowers directly.

## Local development

Build this package, then add it to a profile with a local path:

```sh
pnpm install
pnpm run build
pnpm run vendor:skills   # optional; without it the plugin reads node_modules/superpowers
dsh plugin --profile <name> add /path/to/dsh-superpowers
```

## Configuration

In your profile's cordis config (or patch overlay), optional plugin config:

```yaml
- name: '@anht3889/dsh-superpowers'
  config:
    injectBootstrap: false   # default: true
```

When `injectBootstrap` is `false`, skills still mount but the bootstrap prompt section is skipped.

## Do not mount twice

Install this plugin **once** per profile. Do not also copy Superpowers skills into `~/.dsh/skills` or mount a second skill-filesystem provider for the same content — that duplicates skill names and confuses the catalog.

## 交流群

有问题、想提功能、或者想看看别人怎么用，欢迎加 QQ 群（群号 1121362543）。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/qq-group.png" />
  <img alt="QQ 交流群二维码，群号 1121362543" src="./assets/qq-group.png" width="220" />
</picture>

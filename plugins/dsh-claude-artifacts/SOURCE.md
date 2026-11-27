# Source

Vendored from <https://github.com/JimLiu/baoyu-design> at tag `v2.16.0`
(commit `ed5972b364f58c44fdc8777473ef038f5ca002c8`, upstream `2.16.0`).

- The runnable snapshot is the plugin root: `lib/`, `locale/`, `docs/`,
  `cordis.patch.yml`, `icon.svg`, `README.md`, `LICENSE` and `NOTICE.md`.
- **Not MIT in full, and the exception is recorded, not waved away.** Upstream's
  `LICENSE` covers the maintainer's own work; `NOTICE.md` lists what stays
  Anthropic's (the Artifact types' skill text, reference docs, the reconstructed
  editors, bundled engines and icon fonts) and the third-party open-source code
  it builds on. `NOTICE.md` ships with the package, which is what its terms ask
  for. Do not strip it.
- **Upstream publishes build output only.** `dsh-plugins/dsh-claude-artifacts/`
  in that repository holds `lib/` and never a `src/` — the build happens
  elsewhere, and the publish workflow says so in its own header. `lib/index.js`
  and `lib/client.js` are therefore the editable form: readable, unminified
  bundles rather than sources.
- The name is unchanged. It is one of the parts the baoyu-design plugins share,
  and each of them mounts it under its own row id; renaming it would break that
  arrangement for plugins installed from upstream.
- The README is upstream's, plus this repository's contact block.

Re-importing upstream later replaces this snapshot wholesale. A local change
here cannot be rebuilt from source, so it has to be reapplied by hand — and
upstream's own `lib/` is the only input the next import has.

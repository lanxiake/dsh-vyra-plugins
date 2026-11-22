# Source

Vendored from <https://github.com/Aliboder/dsh-music-panel> at commit
`624c8f6868cc665003bc02aa5fc18c779213fc49` (upstream `0.42.0`, AGPL-3.0-only).

- The runnable snapshot is the plugin root: `index.js`, `client.js`, `src/host/`, `locale/`,
  `docs/` and `cordis.patch.yml`.
- `source/` is the upstream development tree: `src/` (including `src/client/` and
  `src/folia/`), `scripts/`, `locale/` and its own `package.json`.
  `npm install && npm run build` there reproduces `client.js`.
- The published snapshot only ships `src/host/`; edit `source/src/` for development.

**License:** AGPL-3.0-only. Keep `LICENSE` and `THIRD_PARTY_NOTICES.md` with any fork, and
publish the source of modified versions as the license requires.

Re-importing upstream later replaces the root snapshot; keep local forks in a branch or rename
the package.

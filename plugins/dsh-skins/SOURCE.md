# Source

Vendored from <https://github.com/iasiv5/dsh-skins> at commit
`97322a27cb5e16fbff8a011d1aba52ad48a8f88e` (upstream `1.5.34`, MIT).

- The runnable snapshot is the plugin root: `lib/`, `assets/`, `locale/` and
  `cordis.patch.yml`.
- `source/` is the upstream source tree (`src/`, `scripts/`, `assets/`, `locale/`) with its own
  `package.json`, build script and lockfile-free dev setup. `npm install && npm run build`
  there reproduces `lib/client.js` and `lib/index.js`.
- The published snapshot only ships `lib/`; edit `source/src/` for development.

Re-importing upstream later replaces the root snapshot; keep local forks in a branch or rename
the package.

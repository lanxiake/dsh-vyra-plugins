# Source

Vendored from <https://github.com/STARDUSTLC666/dsh-ffmpeg> at commit
`c1b171963f7e43fd27fcb277a96063a94f7ce034` (upstream `0.7.20`, MIT).

- The runnable snapshot is the plugin root: `lib/`, `docs/`, `assets/`, `locale/` and
  `cordis.patch.yml`.
- `source/` is the upstream TypeScript source (`src/`), `scripts/`, `tsconfig.json` and its own
  `package.json`. `npm install && npm run build` there reproduces `lib/`.
- The published snapshot only ships `lib/`; edit `source/src/` for development.

Re-importing upstream later replaces the root snapshot; keep local forks in a branch or rename
the package.

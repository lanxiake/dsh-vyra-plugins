# Source

Vendored from <https://github.com/STARDUSTLC666/dsh-remotion> at tag `v0.13.3`
(commit `ddadabf5012a55dc81a0452e991c867b211910e0`, upstream `0.13.3`, MIT).

- The runnable snapshot is the plugin root: `lib/`, `skills/`, `templates/`,
  `docs/`, `assets/plugin-icon.webp` and `cordis.patch.yml`.
- Upstream commits its build output, so `lib/` is what runs. Its TypeScript
  source (`src/`, `tsconfig.json`, `scripts/`) is NOT shipped: it is not in the
  package's `files`, and the plugin is installed rather than developed here.
- Runtime dependencies are declared in `package.json` and resolved from the
  consumer's profile (`@stardustlc/dsh-updates`, `fflate`, `proper-lockfile`,
  `yaml`); `dsh-ffmpeg` from the same author is vendored the same way.
- The name is unchanged. The `remotion-*` skills under `skills/` come from
  <https://github.com/remotion-dev/skills> (`skills/UPSTREAM.json` records the
  version, commit and integrity hash they were synced from).

Re-importing upstream later replaces this snapshot wholesale; keep local
changes in a branch rather than editing `lib/` in place, since a rebuild from
our side has no source to rebuild from.

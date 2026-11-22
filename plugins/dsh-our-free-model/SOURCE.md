# Source

Vendored from <https://github.com/Ebony-Vinyl/dsh-our-free-model> at commit
`955917dd0d4546cb18e758f07b92a39d124e6226` (upstream `2.8.9`, MIT).

- The runnable snapshot is the plugin root: `index.js`, `client.js`, `src/`, `adapter/`,
  `vendor/`, `locale/` and `cordis.patch.yml`.
- The root `src/` is the plugin's source; it is shipped by the package as well, so there is no
  separate `source/` copy.
- The upstream repository is a larger monorepo with `packages/`, `catalog/`, `feed/`, `server/`
  and `worker/` trees (about 198 MB). Those are not vendored here; clone upstream when a change
  needs its build scripts or standalone workspace.

Re-importing upstream later replaces the root snapshot; keep local forks in a branch or rename
the package.

# Source

Vendored from <https://github.com/weibaohui/dsh-sync> at commit
`a27d46a72333bf9891d7e0dffafb38c21edd9163` (upstream `0.4.12`, MIT).

- The runnable snapshot is the plugin root: `src/` (host), `client/` (client bundle) and
  `cordis.patch.yml`.
- `source/` carries the upstream build script and its own `package.json` for development.
  The root `src/` and `client/` are the same source tree the published package installs.
- To rebuild the client bundle, run the upstream `scripts/build-client.mjs` from `source/`
  after installing its dev dependencies.

For a fork, edit the root `src/`/`client/` directly. Re-importing upstream later replaces the
root snapshot, so keep local forks in a branch or rename the package.

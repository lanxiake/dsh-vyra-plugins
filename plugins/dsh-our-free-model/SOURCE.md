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

## Gemini OAuth identifiers

Upstream publishes Gemini CLI's installed-app OAuth client ID/secret in
`src/subscriptions.js` and `vendor/channel-pack/pack.js`. GitHub push
protection treats those values as secrets, so this snapshot reads them from
`GEMINI_CLIENT_ID` / `GEMINI_CLIENT_SECRET` instead and defaults to an empty
string. Set both environment variables before starting DSH to use the Gemini
channel; other channels are unaffected.

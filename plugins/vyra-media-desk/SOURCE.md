# Source

Vendored from <https://github.com/woniuniuniu/dsh-media-desk> at tag `v2.7.2`
(commit `f183dd506548aa8056e7f75124736242d049246f`, upstream `2.7.2`, MIT),
then renamed and developed here.

- The runnable snapshot is the plugin root: `src/` (host half), `dist/client.js`
  (browser half), `assets/`, `docs/` (the README's illustrations) and
  `cordis.patch.yml`.
- `client/` is the browser half's source and is NOT shipped; `npm run build`
  (esbuild, declared in `devDependencies`) regenerates `dist/client.js` from it.
  Building at the same esbuild version from the same LF-normalized sources
  reproduces the upstream bundle byte for byte, so a rebuild is verifiable.
- The package was renamed `dsh-media-desk` → `dsh-vyra-media-desk` with our own
  repository pointers, because this is the plugin being developed further here
  rather than mirrored. Renaming is why the identity strings differ from
  upstream; everything else in this snapshot is upstream's.
- The rename deliberately leaves the DATA directory alone: the workspace lives
  at `$DSH_HOME/media-desk/`, which upstream's `src/store.js` derives from a
  literal, not from the package name. An existing install therefore keeps its
  ideas, drafts and schedule when it moves to this package.

Re-importing upstream later replaces the root snapshot and will undo the
rename; reapply it (see the diff of the commit that added this file) rather
than copying the upstream tree over it.

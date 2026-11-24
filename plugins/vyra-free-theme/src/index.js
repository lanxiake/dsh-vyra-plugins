import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPersonalizationStore } from "./host/personalization/store.js";
import { createOfficialRejection, mountPersonalizationRoutes } from "./host/personalization-routes.js";
import { createBuiltinAssetServer } from "./host/builtin-assets.js";
import { resolveTrustedHosts } from "./host/trusted-hosts.js";
import { createThemeRepository } from "./host/themes/repository.js";
import { readThemeAsset } from "./host/themes/assets.js";
import { readSelection, writeSelection } from "./host/themes/selection.js";
import { installSkillAndShims, packageRootFrom } from "./host/install-skill.js";
import { dataDirForProfile, dshHome, hostProfileFor } from "./host/paths.js";

export const name = "dsh-vyra-free-theme";

// Kept as re-exports: the delivery and upgrade scripts import these from the
// package entry, and they are the only supported way to learn where data lives.
export { dataDirForProfile, hostProfileFor } from "./host/paths.js";

export function apply(ctx) {
  ctx.inject(["webServer"], (hostContext) => {
    const root = dshHome();
    const profile = hostProfileFor(root);
    const dataDir = dataDirForProfile(root, profile);
    const personalization = createPersonalizationStore({ dataDir, profile });

    // Themes ship inside the package (builtin) and live in the data directory
    // (user). Registration into the shared catalog happens before any route is
    // used, so the store can validate a theme's overrides from its first write.
    const packageRoot = packageRootFrom(import.meta.url);
    const packageThemesDir = join(packageRoot, "themes");
    const themes = createThemeRepository({
      dirs: [
        { source: "builtin", dir: packageThemesDir },
        { source: "user", dir: join(dataDir, "themes") },
      ],
      profile,
    });
    themes.sync();

    // Skill document + CLI launchers, so an agent can drive this plugin without
    // the user copying commands. Best effort: a read-only DSH_HOME never breaks
    // theme loading.
    try {
      installSkillAndShims({ dshHome: root, packageRoot });
    } catch {}

    hostContext.effect(() => {
      // Builtin artwork delivery (ADR-0023): package assets served over the
      // same /dsh-vyra-free-theme/assets/ prefix as gallery uploads. src/ and lib/ both
      // sit one level below the package root, so "../assets" resolves in dev
      // and in the built bundle alike. Best-effort mount: a missing manifest
      // simply leaves serveBuiltinAsset undefined and b_ requests 404 —
      // fail-open (Decision 6), base colors + scrim still render.
      let serveBuiltinAsset;
      try {
        const assetsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
        const manifest = JSON.parse(readFileSync(join(assetsDir, "manifest.json"), "utf8"));
        serveBuiltinAsset = createBuiltinAssetServer({ assetsDir, manifest }).serveBuiltinAsset;
      } catch {
        // No manifest or unreadable assets: fail-open, see above.
      }
      return mountPersonalizationRoutes(hostContext, {
        store: personalization,
        trustedHosts: () => resolveTrustedHosts(ctx),
        rejection: createOfficialRejection(ctx),
        serveBuiltinAsset,
        themes: () => themes.sync(),
        themeAssets: (id, relativePath) => {
          const dir = themes.assetDirFor(id);
          return dir === null ? null : readThemeAsset(dir, relativePath);
        },
        selection: () => ({
          read: () => readSelection(dataDir),
          write: (skinId) => writeSelection(dataDir, skinId),
        }),
      });
    }, "dsh-vyra-free-theme: personalization routes");
  });
}

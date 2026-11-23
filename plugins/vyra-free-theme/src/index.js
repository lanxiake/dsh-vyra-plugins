import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPersonalizationStore } from "./host/personalization/store.js";
import { createOfficialRejection, mountPersonalizationRoutes } from "./host/personalization-routes.js";
import { createBuiltinAssetServer } from "./host/builtin-assets.js";
import { resolveTrustedHosts } from "./host/trusted-hosts.js";
import { dataDirForProfile, dshHome, hostProfileFor } from "./host/paths.js";

export const name = "vyra-free-theme";

// Kept as re-exports: the delivery and upgrade scripts import these from the
// package entry, and they are the only supported way to learn where data lives.
export { dataDirForProfile, hostProfileFor } from "./host/paths.js";

export function apply(ctx) {
  ctx.inject(["webServer"], (hostContext) => {
    const root = dshHome();
    const profile = hostProfileFor(root);
    const personalization = createPersonalizationStore({
      dataDir: dataDirForProfile(root, profile),
      profile,
    });
    hostContext.effect(() => {
      // Builtin artwork delivery (ADR-0023): package assets served over the
      // same /vyra-free-theme/assets/ prefix as gallery uploads. src/ and lib/ both
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
      });
    }, "vyra-free-theme: personalization routes");
  });
}

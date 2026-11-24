import { createSkinRuntime } from "./runtime.js";
import { installSidebarSwitcher } from "./sidebar-switcher.js";
import { installRemoteThemePersistence, readLocalThemePreference } from "./theme-persistence.js";
import { createConfigClient } from "./personalization/config-client.js";
import { installFileThemes } from "./themes.js";
import { adoptHostSelection, publishSelection } from "./selection-sync.js";
import { createMeirenzhiSkin } from "./skins/meirenzhi/index.js";

window.__ModuleLoader__.load({
  // MUST equal the package.json `name` (and the roster row `name` in
  // cordis.patch.yml): the boot page emits __DSH_BOOT__ entries keyed by the
  // package name, and dsh-client-modules rejects a bundle whose registration
  // does not match its graph-row id ("loaded without registering …").
  id: "dsh-vyra-free-theme",
  factory: (require) => {
    const jsxRuntime = require("react/jsx-runtime");
    const react = require("react");
    const reactDom = require("react-dom");

    // Desktop's privileged product renderer is dsh-app://app/ on both Windows
    // and macOS; a browser Web profile retains the original P=35 default.
    const profile = window.location?.protocol === "dsh-app:" && window.location?.hostname === "app"
      ? "desktop" : "web";
    const runtime = createSkinRuntime({ profile });
    const skinById = new Map();
    // Registration order IS the factory-default order: the first skin wins for
    // users with no stored choice. meirenzhi is the only compiled-in skin left
    // (openbmc / uefi-harness were retired together with the bundled themes).
    for (const factory of [createMeirenzhiSkin]) {
      const skin = factory(jsxRuntime); // 工厂自带 builtinAssets（ADR-0014/B15，合成补底已删）
      skinById.set(skin.id, skin);
      runtime.register(skin);
    }

    // Personalization plumbing (design §7.1): mount immediately on defaults,
    // then hot-update when the config syncs — never block first paint.
    const configClient = typeof fetch === "function"
      ? createConfigClient({ profile, contextActive: () => runtime.active() })
      : null;
    if (configClient !== null) {
      const assetResolver = (ref) => {
        if (ref.kind === "builtin") {
          const asset = skinById.get(ref.skinId)?.builtinAssets?.[ref.assetKey];
          return asset
            ? { url: asset.url, mime: asset.mime, darkUrl: asset.darkUrl, darkMime: asset.darkMime }
            : null;
        }
        const meta = configClient.findLibraryEntry(ref.id);
        return meta
          ? { url: configClient.assetUrl(meta), mime: meta.mime }
          : null;
      };
      const metaProvider = (id) => configClient.findLibraryEntry(id);
      runtime.setPersonalization({
        getOverrides: (skinId) => configClient.effectiveOverrides(skinId),
        assetResolver,
        metaProvider,
      });
      let lastOverridesKey = null;
      configClient.onStateChange(() => {
        const activeId = runtime.active();
        if (activeId === runtime.officialId) return;
        const key = JSON.stringify(configClient.effectiveOverrides(activeId));
        if (key === lastOverridesKey) return;
        lastOverridesKey = key;
        runtime.updateActive();
      });
      configClient.boot();
    }

    const inject = ["slots", "locale", "theme", "connection"];

    let fileThemesStarted = false;

    function apply(ctx) {
      installRemoteThemePersistence(ctx);
      ctx.effect(() => runtime.apply(ctx), "dsh-vyra-free-theme: active skin");
      if (configClient !== null) {
        ctx.effect(() => () => configClient.dispose(), "dsh-vyra-free-theme: config client");
      }
      // File-backed themes need one HTTP round-trip, so they land after the
      // first paint. Registering them is additive; refreshSelection() then
      // re-applies a stored theme id that was unknown during apply().
      ctx.effect(() => {
        if (fileThemesStarted) return;
        fileThemesStarted = true;
        publishSelection();
        installFileThemes({ runtime, jsx: jsxRuntime.jsx, profile })
          .then(({ installed, problems }) => {
            if (problems.length > 0) console.warn("[dsh-vyra-free-theme] theme problems:", problems);
            if (installed.length > 0) runtime.refreshSelection();
            // The Host owns the active theme once it has an opinion; adopting it
            // last means a file-backed id is already registered.
            return adoptHostSelection({ runtime });
          })
          .catch((error) => console.warn("[dsh-vyra-free-theme] file themes unavailable:", error));
      }, "dsh-vyra-free-theme: file themes");
      try {
        installSidebarSwitcher(ctx, {
          runtime,
          jsx: jsxRuntime.jsx,
          react,
          reactDom,
          configClient,
          skinsById: (id) => skinById.get(id) ?? null,
        });
      } catch (error) {
        console.warn("[dsh-vyra-free-theme] sidebar switcher registration failed:", error);
      }
    }

    window.__VFT__ = {
      list: runtime.list,
      select: runtime.select,
      active: runtime.active,
      themePreference: readLocalThemePreference,
      personalization: configClient,
      hotUpdate: runtime.updateActive,
    };

    return {
      apply,
      inject,
      selectSkin: runtime.select,
      listSkins: runtime.list,
    };
  },
});

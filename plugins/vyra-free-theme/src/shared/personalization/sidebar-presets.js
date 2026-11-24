/**
 * Sidebar presets and CSS compilation (pure).
 *
 * Why data attributes instead of upstream classes: the sidebar's css-module
 * local names (`_sidebarItem_…`) re-hash on every upstream build, so a rule
 * written against them is a rule that dies quietly at the next upgrade. The
 * runtime instead tags the sidebar's interactive elements with
 * `data-vft-sb-item` / `data-vft-sb-icon`; every rule below keys off those tags
 * plus the three structural hooks the package already pins
 * (`[class*="_sidebarCol"]`, `[class*="_root"]`, `[class*="_scrollFade"]`).
 *
 * A pack supplies values; a theme's own `sidebar` block overrides them field by
 * field. Anything not given is derived from the theme's own palette, so the
 * default ("inherit") never looks pasted-on.
 */

export const SIDEBAR_PACKS = Object.freeze({
  // Same tone as the rest of the theme: only radius/icon/states get touched.
  inherit: { surface: "inherit", blur: 0, density: "cozy", radius: { card: 14, item: 8 } },
  // Translucent panel floating over the wallpaper.
  frost: { surface: "frost", blur: 14, density: "cozy", radius: { card: 16, item: 10 } },
  // Paper-like: transparent fill, hairline separators.
  hairline: { surface: "wallpaper", blur: 0, density: "compact", radius: { card: 0, item: 0 } },
  // Deep solid card with a bright accent.
  obsidian: { surface: "solid", blur: 0, density: "comfortable", radius: { card: 14, item: 10 } },
  // Dark translucent with glowing edges.
  neon: { surface: "frost", blur: 18, density: "cozy", radius: { card: 16, item: 12 } },
});

export const SIDEBAR_SURFACES = ["inherit", "solid", "frost", "wallpaper", "custom"];
export const SIDEBAR_DENSITIES = ["compact", "cozy", "comfortable"];

const DENSITY_METRICS = {
  compact: { padY: 4, minHeight: 26, gap: 2 },
  cozy: { padY: 6, minHeight: 30, gap: 4 },
  comfortable: { padY: 9, minHeight: 34, gap: 6 },
};

function hexToRgbChannels(hex) {
  const value = /^#([0-9a-f]{6})$/i.exec(hex);
  if (value === null) return null;
  const int = parseInt(value[1], 16);
  return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`;
}

function withAlpha(color, alpha) {
  const channels = hexToRgbChannels(color);
  if (channels === null) return color;
  return `rgba(${channels}, ${alpha})`;
}

/**
 * Merge a theme's sidebar block over its pack and fill the gaps from the
 * theme's own palette. Returns a fully resolved spec (never null for a theme
 * that has colours).
 */
export function resolveSidebar(theme) {
  const explicit = theme.sidebar ?? {};
  const packName = SIDEBAR_PACKS[explicit.pack] !== undefined ? explicit.pack : "inherit";
  const pack = SIDEBAR_PACKS[packName];
  const surface = SIDEBAR_SURFACES.includes(explicit.surface) ? explicit.surface : pack.surface;
  const density = SIDEBAR_DENSITIES.includes(explicit.density) ? explicit.density : pack.density;
  const blur = Number.isInteger(explicit.blur) ? explicit.blur : pack.blur;
  const radius = {
    card: Number.isInteger(explicit.radius?.card) ? explicit.radius.card : pack.radius.card,
    item: Number.isInteger(explicit.radius?.item) ? explicit.radius.item : pack.radius.item,
  };

  const light = theme.colors.light;
  const dark = theme.colors.dark;
  const labelLight = light["--dsw-alias-label-secondary"] ?? light["--dsw-alias-label-primary"];
  const labelDark = dark["--dsw-alias-label-secondary"] ?? dark["--dsw-alias-label-primary"];
  const icon = explicit.icon ?? { light: labelLight, dark: labelDark };

  const brandLight = light["--dsw-alias-brand-primary"] ?? labelLight;
  const brandDark = dark["--dsw-alias-brand-primary"] ?? labelDark;
  const states = {
    hover: explicit.states?.hover ?? {
      bg: withAlpha(light["--dsw-alias-label-primary"] ?? "#000000", "0.05"),
      darkBg: withAlpha(dark["--dsw-alias-label-primary"] ?? "#ffffff", "0.07"),
      fg: null,
    },
    active: explicit.states?.active ?? {
      bg: withAlpha(light["--dsw-alias-label-primary"] ?? "#000000", "0.08"),
      darkBg: withAlpha(dark["--dsw-alias-label-primary"] ?? "#ffffff", "0.10"),
      fg: null,
    },
    selected: explicit.states?.selected ?? {
      bg: withAlpha(brandLight, "0.14"),
      darkBg: withAlpha(brandDark, "0.20"),
      fg: brandLight,
      darkFg: brandDark,
      indicator: brandLight,
      darkIndicator: brandDark,
    },
  };

  return {
    pack: packName,
    surface,
    blur,
    density,
    metrics: DENSITY_METRICS[density],
    radius,
    icon: { light: icon.light, dark: icon.dark },
    states,
    divider: explicit.divider ?? null,
    background: explicit.background ?? null,
  };
}

const HOOK = {
  col: '[class*="_sidebarCol"]',
  root: '[class*="_root"]',
  item: "[data-vft-sb-item]",
  icon: "[data-vft-sb-item] svg",
};

/**
 * Compile a resolved spec into scoped CSS for one theme.
 * `bodyAttribute` scopes every rule, so switching themes cannot leak styles.
 */
export function sidebarCss(spec, bodyAttribute) {
  const scope = `body[data-${bodyAttribute}]`;
  const dark = `${scope}[data-ds-dark-theme]`;
  const metrics = spec.metrics;
  const rules = [
    `/* dsh-vyra-free-theme sidebar pack: ${spec.pack} / ${spec.surface} / ${spec.density} */`,
    // The column never clips the wallpaper; the fill token decides opacity.
    `${scope} ${HOOK.col}{background:transparent}`,
    `${scope} ${HOOK.col} ${HOOK.root}{border-radius:${spec.radius.card}px}`,
  ];

  if (spec.surface === "frost" || spec.blur > 0) {
    const blur = spec.surface === "frost" ? Math.max(spec.blur, 8) : spec.blur;
    rules.push(
      `${scope} ${HOOK.col}{backdrop-filter:blur(${blur}px);-webkit-backdrop-filter:blur(${blur}px)}`,
      `${scope} [class*="_scrollFade"]{background:linear-gradient(transparent, rgba(0,0,0,0.04))}`,
    );
  }

  if (spec.surface === "solid" || spec.surface === "custom") {
    const fillLight = spec.background?.light ?? spec.states.selected.bg;
    if (spec.surface === "solid") {
      // The palette's own sidebar fill, at full opacity.
      rules.push(
        `${scope} ${HOOK.col}{background:var(--dsw-specific-sidebar-fill)}`,
        `${scope} ${HOOK.col} ${HOOK.root}{background:transparent}`,
      );
    } else if (spec.background !== null) {
      rules.push(
        `${scope} ${HOOK.col}{background:${spec.background.light ?? fillLight}}`,
        `${dark} ${HOOK.col}{background:${spec.background.dark ?? spec.background.light ?? fillLight}}`,
      );
    }
  }

  rules.push(
    // Compact/comfortable: item rhythm, never the layout's own spacing contract.
    `${scope} ${HOOK.item}{border-radius:${spec.radius.item}px;`
      + `padding-top:${metrics.padY}px;padding-bottom:${metrics.padY}px;`
      + `min-height:${metrics.minHeight}px;margin-bottom:${metrics.gap}px;`
      + `transition:background-color 120ms ease,color 120ms ease}`,
    // Icon tint: SVG inherits currentColor in the host, so colouring it here
    // reaches every glyph inside an item.
    `${scope} ${HOOK.icon}{color:${spec.icon.light}}`,
    `${dark} ${HOOK.icon}{color:${spec.icon.dark}}`,
    // Interactive states. `:hover` is the selector; the rest are attribute
    // markers the host (or the runtime tagger) may set on the active surface.
    `${scope} ${HOOK.item}:hover{background:${spec.states.hover.bg}}`,
    `${dark} ${HOOK.item}:hover{background:${spec.states.hover.darkBg}}`,
    `${scope} ${HOOK.item}:active{background:${spec.states.active.bg}}`,
    `${dark} ${HOOK.item}:active{background:${spec.states.active.darkBg}}`,
    `${scope} ${HOOK.item}[aria-current],${scope} ${HOOK.item}[data-active="true"],`
      + `${scope} ${HOOK.item}[data-selected="true"]{position:relative;background:${spec.states.selected.bg};`
      + `color:${spec.states.selected.fg ?? "inherit"}}`,
    `${dark} ${HOOK.item}[aria-current],${dark} ${HOOK.item}[data-active="true"],`
      + `${dark} ${HOOK.item}[data-selected="true"]{background:${spec.states.selected.darkBg};`
      + `color:${spec.states.selected.darkFg ?? "inherit"}}`,
    // Selected indicator: a 3px bar on the leading edge, drawn by pseudo-element
    // so no host layout is touched.
    `${scope} ${HOOK.item}[aria-current]::before,${scope} ${HOOK.item}[data-active="true"]::before,`
      + `${scope} ${HOOK.item}[data-selected="true"]::before{content:"";position:absolute;`
      + `inset-inline-start:0;top:20%;bottom:20%;width:3px;border-radius:999px;`
      + `background:${spec.states.selected.indicator}}`,
    `${dark} ${HOOK.item}[aria-current]::before,${dark} ${HOOK.item}[data-active="true"]::before,`
      + `${dark} ${HOOK.item}[data-selected="true"]::before{background:${spec.states.selected.darkIndicator}}`,
  );

  if (spec.divider !== null) {
    rules.push(
      `${scope} ${HOOK.item}{border-bottom:1px ${spec.divider.style ?? "solid"} ${spec.divider.color}}`,
    );
  }

  return rules.join("\n");
}

/** Spec for a theme that declares no sidebar block: derive from its palette. */
export function defaultSidebarSpec(theme) {
  return resolveSidebar(theme);
}
// Theme styles: swap the whole client's palette for a third-party theme.
//
// HOW IT WORKS. The shipped token sheet defines every `--dsw-alias-*` variable on
// `body`, each resolving through a `--dsw-static-*` primitive. Measured across the
// whole asar: the static primitives are read by the ui-theme package alone (its
// token sheet and the welcome screen) — every other client package reads only
// `--dsw-alias-*`. So overriding the alias layer recolors the entire client, and
// the static layer needs no override at all.
//
// WHY overrideTokens AND NOT register()+setTheme(). `ctx.theme.register` adds a
// theme id, but `setTheme('warm-organic')` cannot be persisted: the theme service
// writes the preference through the host settings scope only when
// `isThemePreference(id)` holds, and that predicate accepts `light`/`dark`/`system`
// alone. A registered id is therefore in-memory only — it reverts on the next
// `adopt()`, and again on every restart. Overriding tokens keeps the preference at
// a built-in value, so nothing fights us: the user's light/dark/system choice still
// drives which palette mode is active, and `overrideTokens` picks the matching
// member of each `{ light, dark }` pair.
//
// Persisted in localStorage under the page's own origin (`dsh-app://app`, stable
// across launches). No host half, no settings namespace, no RPC.
window.__ModuleLoader__.load({
  id: 'vyra-theme-styles',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const STORAGE_KEY = 'dsh-theme-styles:active'
    // One layer per source, so re-applying replaces rather than stacks.
    const SOURCE = 'dsh-theme-styles'

    /** One override value: the light-mode and dark-mode value for a token. */
    const t = (light, dark) => ({ light, dark })

    // ---------------------------------------------------------------------------
    // Warm Organic — unbleached paper, clay, terracotta, olive.
    // Its guide is light-first and forbids cool grays, so the dark mode is a warm
    // brown night from the same family rather than a desaturated inversion.
    // ---------------------------------------------------------------------------
    const warmOrganic = {
      '--dsw-alias-bg-base': t('#F5F0EB', '#211E19'),
      '--dsw-alias-bg-layer-1': t('#FAF6F1', '#2A2621'),
      '--dsw-alias-bg-layer-2': t('#E8DED1', '#332E28'),
      '--dsw-alias-bg-layer-3': t('#E0D5C6', '#3C362E'),
      '--dsw-alias-bg-overlay': t('#F1EAE2', '#2E2A24'),
      '--dsw-alias-bg-module-platform': t('#EDE4D9', '#2A2621'),
      '--dsw-alias-bg-multi-select': t('#EDE4D9', '#2A2621'),
      '--dsw-alias-bg-skeleton': t('rgba(45, 42, 36, 0.06)', 'rgba(212, 191, 165, 0.08)'),
      '--dsw-alias-bg-document-preview': t('#EDE4D9', '#2A2621'),
      '--dsw-alias-bg-mask-1': t('rgba(45, 42, 36, 0.24)', 'rgba(0, 0, 0, 0.5)'),
      '--dsw-alias-bg-mask-2': t('rgba(45, 42, 36, 0.12)', 'rgba(0, 0, 0, 0.2)'),
      '--dsw-alias-bg-mask-3': t('rgba(45, 42, 36, 0.48)', 'rgba(0, 0, 0, 0.48)'),
      '--dsw-alias-bg-mask-photo': t('rgba(45, 42, 36, 0.88)', 'rgba(0, 0, 0, 0.88)'),
      '--dsw-alias-bg-mask-drop': t('rgba(245, 240, 235, 0.7)', 'rgba(45, 42, 36, 0.7)'),
      '--dsw-alias-bg-document-selection': t('color-mix(in srgb, #C86A4A 30%, transparent)', 'color-mix(in srgb, #D97C5C 34%, transparent)'),

      // Hairlines: the guide's warm clay border, never a cool gray.
      '--dsw-alias-border-l1': t('rgba(212, 191, 165, 0.50)', 'rgba(212, 191, 165, 0.10)'),
      '--dsw-alias-border-l2': t('rgba(212, 191, 165, 0.66)', 'rgba(212, 191, 165, 0.16)'),
      '--dsw-alias-border-l2-darkmode-thin': t('rgba(212, 191, 165, 0.66)', 'rgba(212, 191, 165, 0.16)'),
      '--dsw-alias-border-l3': t('rgba(212, 191, 165, 0.80)', 'rgba(212, 191, 165, 0.22)'),
      '--dsw-alias-border-l4': t('#D4BFA5', 'rgba(212, 191, 165, 0.30)'),
      '--dsw-alias-border-selected': t('#C86A4A', '#D97C5C'),
      '--dsw-alias-border-inverted': t('rgba(45, 42, 36, 0)', 'rgba(212, 191, 165, 0.08)'),
      '--dsw-alias-border-inverted2': t('rgba(45, 42, 36, 0)', 'rgba(212, 191, 165, 0.12)'),

      // Text: deep warm brown, never pure black.
      '--dsw-alias-label-primary': t('#2D2A24', '#F0EAE1'),
      '--dsw-alias-label-primary-dimmed': t('rgba(45, 42, 36, 0.86)', '#DED5C8'),
      '--dsw-alias-label-primary-bluish': t('#2D2A24', '#F0EAE1'),
      '--dsw-alias-label-primary-foreground': t('#FFFFFF', '#FFFFFF'),
      '--dsw-alias-label-primary-inverted': t('#FFFFFF', '#211E19'),
      '--dsw-alias-label-secondary': t('rgba(45, 42, 36, 0.72)', 'rgba(240, 234, 225, 0.72)'),
      '--dsw-alias-label-tertiary': t('rgba(45, 42, 36, 0.55)', 'rgba(240, 234, 225, 0.55)'),
      '--dsw-alias-label-caption': t('rgba(45, 42, 36, 0.45)', 'rgba(240, 234, 225, 0.45)'),
      '--dsw-alias-label-dimmed': t('rgba(45, 42, 36, 0.25)', 'rgba(240, 234, 225, 0.25)'),
      '--dsw-alias-label-on-color': t('#FFFFFF', '#FFFFFF'),
      '--dsw-alias-label-document-preview': t('#2D2A24', '#DED5C8'),
      '--dsw-alias-label-shimmer': t('color-mix(in srgb, #2D2A24 30%, transparent)', 'color-mix(in srgb, #F0EAE1 45%, transparent)'),
      '--dsw-alias-label-deep-diving': t('#B55A3A', '#E09B7E'),
      '--dsw-alias-label-deep-diving-shimmer': t('color-mix(in srgb, #C86A4A 30%, transparent)', 'color-mix(in srgb, #E09B7E 40%, transparent)'),

      // Brand and links: terracotta is the one call-to-action color.
      '--dsw-alias-brand-primary': t('#C86A4A', '#D97C5C'),
      '--dsw-alias-brand-primary-invert': t('#2D2A24', '#F0EAE1'),
      '--dsw-alias-brand-primary-new-colorprimary-new-color': t('#C86A4A', '#D97C5C'),
      '--dsw-alias-brand-text': t('#2D2A24', '#F0EAE1'),
      '--dsw-alias-link': t('#C86A4A', '#E09B7E'),
      '--dsw-alias-trajectory-accent': t('#C86A4A', '#D97C5C'),

      // Buttons: fired clay, deepening on hover as the guide specifies.
      '--dsw-alias-button-primary-fill': t('#C86A4A', '#C86A4A'),
      '--dsw-alias-button-primary-hover': t('#B55A3A', '#D97C5C'),
      '--dsw-alias-button-primary-dimmed': t('rgba(200, 106, 74, 0.16)', 'rgba(217, 124, 92, 0.20)'),
      '--dsw-alias-button-floating-fill': t('#FAF6F1', '#332E28'),
      '--dsw-alias-button-floating-hover': t('#E8DED1', '#3C362E'),
      '--dsw-alias-button-elevated-fill': t('#FAF6F1', '#3C362E'),
      '--dsw-alias-button-contrast-fill': t('#2D2A24', '#F0EAE1'),
      '--dsw-alias-button-ghost-active-fill': t('#E8DED1', '#3C362E'),
      '--dsw-alias-button-ghost-active-hover': t('#E0D5C6', '#48423A'),
      '--dsw-alias-button-ghost-active-border': t('#D4BFA5', 'rgba(212, 191, 165, 0.4)'),
      '--dsw-alias-button-info-fill': t('#7A8B5E', '#93A674'),
      '--dsw-alias-button-info-hover': t('#6B7A52', '#A3B584'),
      '--dsw-alias-button-tool-bar-fill': t('rgba(232, 222, 209, 0.6)', 'rgba(60, 54, 46, 0.6)'),
      '--dsw-alias-button-tool-bar-fill-invisible': t('rgba(45, 42, 36, 0.3)', 'rgba(45, 42, 36, 0.36)'),
      '--dsw-alias-button-tool-bar-hover': t('rgba(212, 191, 165, 0.7)', 'rgba(72, 66, 58, 0.7)'),

      // States: olive carries "good", warm red "bad", amber "careful".
      '--dsw-alias-state-success-primary': t('#7A8B5E', '#93A674'),
      '--dsw-alias-state-success-secondary': t('#93A674', '#A3B584'),
      '--dsw-alias-state-success-tertiary': t('#E6EBDD', '#3A402E'),
      '--dsw-alias-state-error-primary': t('#B5533C', '#E08466'),
      '--dsw-alias-state-error-secondary': t('#C86A4A', '#D97C5C'),
      '--dsw-alias-state-warn-primary': t('#C98A3C', '#DFA657'),
      '--dsw-alias-state-warn-secondary': t('#D9A05C', '#E8B978'),
      '--dsw-alias-state-warn-tertiary': t('#F7EBD8', '#463A24'),
      '--dsw-alias-state-warn-label': t('#A66C28', '#DFA657'),
      '--dsw-alias-state-idle-primary': t('#D4BFA5', '#4A423A'),
      '--dsw-alias-state-done-primary': t('#7A8B5E', '#93A674'),
      '--dsw-alias-state-business-primary': t('#C86A4A', '#D97C5C'),
      '--dsw-alias-state-business-tertiary': t('#F2E0D7', '#463229'),

      // Interaction layers: warm translucent brown, matching the guide's overlays.
      '--dsw-alias-interactive-bg-hover': t('rgba(45, 42, 36, 0.05)', 'rgba(240, 234, 225, 0.07)'),
      '--dsw-alias-interactive-bg-active': t('rgba(45, 42, 36, 0.09)', 'rgba(240, 234, 225, 0.12)'),
      '--dsw-alias-interactive-bg-hover-solid': t('#EDE4D9', '#332E28'),
      '--dsw-alias-interactive-bg-hover-accent': t('rgba(200, 106, 74, 0.14)', 'rgba(217, 124, 92, 0.18)'),
      '--dsw-alias-interactive-bg-hover-danger': t('rgba(181, 83, 60, 0.08)', 'rgba(224, 132, 102, 0.14)'),

      // Cards: sand on paper, soft and warm.
      '--dsw-alias-card-fill': t('#FAF6F1', '#2A2621'),
      '--dsw-alias-card-fill-hover': t('#F1EAE2', '#332E28'),
      '--dsw-alias-card-tile-fill': t('color-mix(in srgb, #FFFFFF 50%, transparent)', 'color-mix(in srgb, #F0EAE1 5%, transparent)'),

      // Code and markdown: sand blocks, terracotta-tinted selection.
      '--dsw-alias-markdown-code-block': t('#EDE4D9', '#2A2621'),
      '--dsw-alias-markdown-code-block-banner': t('#E8DED1', '#332E28'),
      '--dsw-alias-markdown-inline-code': t('#EDE4D9', '#332E28'),
      '--dsw-alias-markdown-code-segment-selected': t('#FAF6F1', '#3C362E'),
      '--dsw-alias-markdown-code-segment-unselected': t('#E8DED1', '#2A2621'),
      '--dsw-alias-markdown-citation': t('#EDE4D9', '#332E28'),
      '--dsw-alias-markdown-placeholder': t('#E0D5C6', '#332E28'),
      '--dsw-alias-markdown-tag': t('#EDE4D9', '#332E28'),
      '--dsw-alias-code-diff-added': t('rgba(122, 139, 94, 0.12)', 'rgba(147, 166, 116, 0.16)'),
      '--dsw-alias-code-diff-deleted': t('rgba(181, 83, 60, 0.10)', 'rgba(224, 132, 102, 0.16)'),
      '--dsw-alias-file-diff-added-bg': t('#E9EFE0', '#2C3325'),
      '--dsw-alias-file-diff-added-gutter': t('#EFF3E8', '#252B1F'),
      '--dsw-alias-file-diff-added-marker': t('#7A8B5E', '#93A674'),
      '--dsw-alias-file-diff-deleted-bg': t('#F7E5DF', '#3A2823'),
      '--dsw-alias-file-diff-deleted-gutter': t('#FAEDE9', '#2F211D'),
      '--dsw-alias-file-diff-deleted-marker': t('#B5533C', '#E08466'),

      // Charts and the JSON tree, kept inside the two-accent budget.
      '--dsw-alias-chart-messages': t('#C86A4A', '#D97C5C'),
      '--dsw-alias-chart-tools': t('#7A8B5E', '#93A674'),
      '--dsw-alias-chart-system': t('#D4BFA5', '#6B6156'),
      '--dsw-alias-json-tree-keyword': t('#B55A3A', '#E09B7E'),
      '--dsw-alias-json-tree-number': t('#A66C28', '#DFA657'),
      '--dsw-alias-json-tree-string': t('#7A8B5E', '#A3B584'),
      '--dsw-alias-json-tree-property': t('#8A6A4A', '#D4BFA5'),
      '--dsw-alias-json-tree-punctuation': t('#2D2A24', '#F0EAE1'),
      '--dsw-alias-json-tree-icon': t('#8A7A66', '#9C8F7E'),
      '--dsw-alias-json-tree-hover': t('rgba(45, 42, 36, 0.04)', 'rgba(240, 234, 225, 0.05)'),

      // Overlays: menus and tooltips are always the deep end of the palette.
      '--dsw-menu-surface-fill': t('rgba(250, 246, 241, 0.72)', 'rgba(42, 38, 33, 0.68)'),
      '--dsw-specific-menu': t('rgba(250, 246, 241, 0.72)', 'rgba(42, 38, 33, 0.68)'),
      '--dsw-alias-menu-group-header-fill': t('rgba(241, 234, 226, 0.94)', 'rgba(42, 38, 33, 0.94)'),
      '--dsw-alias-menu-icon': t('#8A7A66', '#DED5C8'),
      '--dsw-alias-tooltip-bg': t('#3C362E', '#3C362E'),
      '--dsw-alias-tooltip-key-bg': t('color-mix(in srgb, #3C362E, white 18%)', 'color-mix(in srgb, #3C362E, white 18%)'),
      '--dsw-alias-tooltip-label': t('#F5F0EB', '#F5F0EB'),
      '--dsw-alias-toast-bg': t('#3C362E', '#332E28'),
      '--dsw-alias-toast-label': t('#F5F0EB', '#F0EAE1'),
      '--dsw-alias-toast-action': t('#E09B7E', '#E09B7E'),
      '--dsw-alias-hovercard-bg': t('#2D2A24', '#2D2A24'),
      '--dsw-alias-hovercard-label-primary': t('#F5F0EB', '#F5F0EB'),
      '--dsw-alias-hovercard-label-secondary': t('rgba(245, 240, 235, 0.72)', 'rgba(245, 240, 235, 0.72)'),
      '--dsw-alias-hovercard-label-tertiary': t('rgba(245, 240, 235, 0.55)', 'rgba(245, 240, 235, 0.55)'),
      '--dsw-alias-hovercard-state-done': t('#93A674', '#93A674'),
      '--dsw-alias-hovercard-state-error': t('#E08466', '#E08466'),

      // Chrome details.
      '--dsw-alias-scrollbar-bg-l1': t('#D4BFA5', '#4A423A'),
      '--dsw-alias-scrollbar-bg-l2': t('#D4BFA5', '#5A5048'),
      '--dsw-alias-scrollbar-hover-l1': t('#C0A98E', '#5A5048'),
      '--dsw-alias-scrollbar-hover-l2': t('#C0A98E', '#6B6156'),
      '--dsw-alias-switch-thumb': t('#FFFFFF', '#D4BFA5'),
      '--dsw-alias-turn-trigger-bg': t('#EDE4D9', 'rgba(240, 234, 225, 0.07)'),
      '--dsw-alias-turn-trigger-bg-hover': t('rgba(45, 42, 36, 0.05)', 'rgba(240, 234, 225, 0.12)'),

      // Illustrations and onboarding art.
      '--dsw-alias-illustration-background': t('#EFE8E0', '#2A2621'),
      '--dsw-alias-illustration-surface': t('#E8DED1', '#3C362E'),
      '--dsw-alias-illustration-backing': t('#D4BFA5', '#48423A'),
      '--dsw-alias-illustration-detail': t('#C0A98E', '#6B6156'),
      '--dsw-alias-illustration-inset': t('#E8DED1', '#48423A'),
      '--dsw-alias-illustration-shadow': t('#E8DED1', '#48423A'),
      '--dsw-specific-guide-hero': t('#D4BFA5', '#48423A'),

      // Sidebar, composer and the remaining named surfaces.
      '--dsw-specific-sidebar-fill': t('#EFE8E0', '#26221D'),
      '--dsw-specific-sidebar-nav-item-active': t('#E8DED1', '#332E28'),
      '--dsw-specific-sidebar-nav-item-active-accent': t('#F2E0D7', '#3C362E'),
      '--dsw-specific-sidebar-right-flash': t('#C86A4A', '#E09B7E'),
      '--dsw-specific-bubble': t('#EFE8E0', '#332E28'),
      '--dsw-specific-bubble-highlight': t('#E0D5C6', '#48423A'),
      '--dsw-specific-input-major': t('#FAF6F1', '#2A2621'),
      '--dsw-specific-login-input': t('#FAF6F1', '#2A2621'),
      '--dsw-specific-file-upload-track': t('rgba(45, 42, 36, 0.08)', 'rgba(0, 0, 0, 0.08)'),
      '--dsw-specific-selector': t('#EDE4D9', '#332E28'),
      '--dsw-specific-tip': t('#EDE4D9', '#332E28'),
    }

    // ---------------------------------------------------------------------------
    // macOS Vibrancy — the three-depth dark gray system, 1px hairlines, system blue.
    // Its guide is dark-first; the light mode follows the macOS light appearance
    // with the same structure (translucent sidebar, white content, hairlines).
    // ---------------------------------------------------------------------------
    const macosVibrancy = {
      '--dsw-alias-bg-base': t('#F2F2F7', '#1C1C1E'),
      '--dsw-alias-bg-layer-1': t('#FFFFFF', '#2C2C2E'),
      '--dsw-alias-bg-layer-2': t('#F7F7F9', '#3A3A3C'),
      '--dsw-alias-bg-layer-3': t('#EDEDF2', '#48484A'),
      '--dsw-alias-bg-overlay': t('#FFFFFF', '#2C2C2E'),
      '--dsw-alias-bg-module-platform': t('#E8E8ED', '#3A3A3C'),
      '--dsw-alias-bg-multi-select': t('#E8E8ED', '#3A3A3C'),
      '--dsw-alias-bg-skeleton': t('rgba(0, 0, 0, 0.05)', 'rgba(255, 255, 255, 0.08)'),
      '--dsw-alias-bg-document-preview': t('#FFFFFF', '#1C1C1E'),
      '--dsw-alias-bg-mask-1': t('rgba(0, 0, 0, 0.24)', 'rgba(0, 0, 0, 0.5)'),
      '--dsw-alias-bg-mask-2': t('rgba(0, 0, 0, 0.12)', 'rgba(0, 0, 0, 0.2)'),
      '--dsw-alias-bg-mask-3': t('rgba(0, 0, 0, 0.48)', 'rgba(0, 0, 0, 0.48)'),
      '--dsw-alias-bg-mask-photo': t('rgba(0, 0, 0, 0.88)', 'rgba(0, 0, 0, 0.88)'),
      '--dsw-alias-bg-mask-drop': t('rgba(255, 255, 255, 0.7)', 'rgba(28, 28, 30, 0.7)'),
      '--dsw-alias-bg-document-selection': t('color-mix(in srgb, #0A84FF 35%, transparent)', 'color-mix(in srgb, #0A84FF 40%, transparent)'),

      // 1px philosophy: white hairlines on dark, black hairlines on light.
      '--dsw-alias-border-l1': t('rgba(0, 0, 0, 0.06)', 'rgba(255, 255, 255, 0.06)'),
      '--dsw-alias-border-l2': t('rgba(0, 0, 0, 0.09)', 'rgba(255, 255, 255, 0.10)'),
      '--dsw-alias-border-l2-darkmode-thin': t('rgba(0, 0, 0, 0.09)', 'rgba(255, 255, 255, 0.08)'),
      '--dsw-alias-border-l3': t('rgba(0, 0, 0, 0.13)', 'rgba(255, 255, 255, 0.14)'),
      '--dsw-alias-border-l4': t('rgba(0, 0, 0, 0.18)', 'rgba(255, 255, 255, 0.18)'),
      '--dsw-alias-border-selected': t('#0A84FF', '#0A84FF'),
      '--dsw-alias-border-inverted': t('rgba(0, 0, 0, 0)', 'rgba(255, 255, 255, 0.06)'),
      '--dsw-alias-border-inverted2': t('rgba(0, 0, 0, 0)', 'rgba(255, 255, 255, 0.08)'),

      // Text: white at four opacities on dark, black at four on light.
      '--dsw-alias-label-primary': t('rgba(0, 0, 0, 0.92)', 'rgba(255, 255, 255, 0.95)'),
      '--dsw-alias-label-primary-dimmed': t('rgba(0, 0, 0, 0.78)', 'rgba(255, 255, 255, 0.85)'),
      '--dsw-alias-label-primary-bluish': t('rgba(0, 0, 0, 0.92)', 'rgba(255, 255, 255, 0.95)'),
      '--dsw-alias-label-primary-foreground': t('#FFFFFF', '#FFFFFF'),
      '--dsw-alias-label-primary-inverted': t('#FFFFFF', '#1C1C1E'),
      '--dsw-alias-label-secondary': t('rgba(0, 0, 0, 0.60)', 'rgba(255, 255, 255, 0.70)'),
      '--dsw-alias-label-tertiary': t('rgba(0, 0, 0, 0.45)', 'rgba(255, 255, 255, 0.55)'),
      '--dsw-alias-label-caption': t('rgba(0, 0, 0, 0.35)', 'rgba(255, 255, 255, 0.40)'),
      '--dsw-alias-label-dimmed': t('rgba(0, 0, 0, 0.20)', 'rgba(255, 255, 255, 0.25)'),
      '--dsw-alias-label-on-color': t('#FFFFFF', '#FFFFFF'),
      '--dsw-alias-label-document-preview': t('rgba(0, 0, 0, 0.60)', 'rgba(255, 255, 255, 0.70)'),
      '--dsw-alias-label-shimmer': t('color-mix(in srgb, #000000 30%, transparent)', 'color-mix(in srgb, #FFFFFF 45%, transparent)'),
      '--dsw-alias-label-deep-diving': t('#0A84FF', '#64B5FF'),
      '--dsw-alias-label-deep-diving-shimmer': t('color-mix(in srgb, #0A84FF 30%, transparent)', 'color-mix(in srgb, #64B5FF 40%, transparent)'),

      // Accent: the system blue, used for highlights rather than large fills.
      '--dsw-alias-brand-primary': t('#1C1C1E', '#3A3A3C'),
      '--dsw-alias-brand-primary-invert': t('#FFFFFF', '#F2F2F7'),
      '--dsw-alias-brand-primary-new-colorprimary-new-color': t('#0A84FF', '#0A84FF'),
      '--dsw-alias-brand-text': t('rgba(0, 0, 0, 0.92)', 'rgba(255, 255, 255, 0.95)'),
      '--dsw-alias-link': t('#0A84FF', '#0A84FF'),
      '--dsw-alias-trajectory-accent': t('#0A84FF', '#0A84FF'),

      // Buttons: the guide's restrained #3a3a3c fill, hovering one step lighter.
      '--dsw-alias-button-primary-fill': t('#1C1C1E', '#3A3A3C'),
      '--dsw-alias-button-primary-hover': t('#2C2C2E', '#48484A'),
      '--dsw-alias-button-primary-dimmed': t('rgba(0, 0, 0, 0.08)', 'rgba(255, 255, 255, 0.10)'),
      '--dsw-alias-button-floating-fill': t('#FFFFFF', '#3A3A3C'),
      '--dsw-alias-button-floating-hover': t('#F2F2F7', '#48484A'),
      '--dsw-alias-button-elevated-fill': t('#FFFFFF', '#3A3A3C'),
      '--dsw-alias-button-contrast-fill': t('#1C1C1E', 'rgba(255, 255, 255, 0.95)'),
      '--dsw-alias-button-ghost-active-fill': t('rgba(0, 0, 0, 0.06)', 'rgba(255, 255, 255, 0.10)'),
      '--dsw-alias-button-ghost-active-hover': t('rgba(0, 0, 0, 0.10)', 'rgba(255, 255, 255, 0.14)'),
      '--dsw-alias-button-ghost-active-border': t('rgba(0, 0, 0, 0.18)', 'rgba(255, 255, 255, 0.22)'),
      '--dsw-alias-button-info-fill': t('#0A84FF', '#0A84FF'),
      '--dsw-alias-button-info-hover': t('#0071E3', '#3D9BFF'),
      '--dsw-alias-button-tool-bar-fill': t('rgba(120, 120, 128, 0.16)', 'rgba(120, 120, 128, 0.32)'),
      '--dsw-alias-button-tool-bar-fill-invisible': t('rgba(120, 120, 128, 0.12)', 'rgba(31, 31, 31, 0.36)'),
      '--dsw-alias-button-tool-bar-hover': t('rgba(120, 120, 128, 0.24)', 'rgba(120, 120, 128, 0.40)'),

      // System semantic colors, verbatim from the macOS palette.
      '--dsw-alias-state-success-primary': t('#34C759', '#30D158'),
      '--dsw-alias-state-success-secondary': t('#30D158', '#34C759'),
      '--dsw-alias-state-success-tertiary': t('rgba(52, 199, 89, 0.12)', 'rgba(48, 209, 88, 0.16)'),
      '--dsw-alias-state-error-primary': t('#FF3B30', '#FF453A'),
      '--dsw-alias-state-error-secondary': t('#FF453A', '#FF6961'),
      '--dsw-alias-state-warn-primary': t('#FF9500', '#FF9F0A'),
      '--dsw-alias-state-warn-secondary': t('#FF9F0A', '#FFB340'),
      '--dsw-alias-state-warn-tertiary': t('rgba(255, 149, 0, 0.12)', 'rgba(255, 159, 10, 0.16)'),
      '--dsw-alias-state-warn-label': t('#C93400', '#FF9F0A'),
      '--dsw-alias-state-idle-primary': t('rgba(120, 120, 128, 0.24)', 'rgba(120, 120, 128, 0.40)'),
      '--dsw-alias-state-done-primary': t('#AF52DE', '#BF5AF2'),
      '--dsw-alias-state-business-primary': t('#0A84FF', '#0A84FF'),
      '--dsw-alias-state-business-tertiary': t('rgba(10, 132, 255, 0.12)', 'rgba(10, 132, 255, 0.18)'),

      // Hover: the guide's bg-white/5 -> bg-white/8 step, colors only.
      '--dsw-alias-interactive-bg-hover': t('rgba(0, 0, 0, 0.04)', 'rgba(255, 255, 255, 0.06)'),
      '--dsw-alias-interactive-bg-active': t('rgba(0, 0, 0, 0.08)', 'rgba(255, 255, 255, 0.10)'),
      '--dsw-alias-interactive-bg-hover-solid': t('#E8E8ED', '#48484A'),
      '--dsw-alias-interactive-bg-hover-accent': t('rgba(10, 132, 255, 0.14)', 'rgba(10, 132, 255, 0.20)'),
      '--dsw-alias-interactive-bg-hover-danger': t('rgba(255, 59, 48, 0.08)', 'rgba(255, 69, 58, 0.14)'),

      // Panels: 1px border, no shadow, no lift.
      '--dsw-alias-card-fill': t('#FFFFFF', '#2C2C2E'),
      '--dsw-alias-card-fill-hover': t('#F7F7F9', '#3A3A3C'),
      '--dsw-alias-card-tile-fill': t('color-mix(in srgb, #FFFFFF 50%, transparent)', 'color-mix(in srgb, #FFFFFF 5%, transparent)'),

      // Code: the deepest surface, monospace on it.
      '--dsw-alias-markdown-code-block': t('#F7F7F9', '#1C1C1E'),
      '--dsw-alias-markdown-code-block-banner': t('#EDEDF2', '#2C2C2E'),
      '--dsw-alias-markdown-inline-code': t('#EDEDF2', '#3A3A3C'),
      '--dsw-alias-markdown-code-segment-selected': t('#FFFFFF', '#3A3A3C'),
      '--dsw-alias-markdown-code-segment-unselected': t('#EDEDF2', '#2C2C2E'),
      '--dsw-alias-markdown-citation': t('#EDEDF2', '#3A3A3C'),
      '--dsw-alias-markdown-placeholder': t('#E8E8ED', '#3A3A3C'),
      '--dsw-alias-markdown-tag': t('#EDEDF2', '#3A3A3C'),
      '--dsw-alias-code-diff-added': t('rgba(52, 199, 89, 0.12)', 'rgba(48, 209, 88, 0.16)'),
      '--dsw-alias-code-diff-deleted': t('rgba(255, 59, 48, 0.10)', 'rgba(255, 69, 58, 0.16)'),
      '--dsw-alias-file-diff-added-bg': t('#E4F6E7', '#17301C'),
      '--dsw-alias-file-diff-added-gutter': t('#EDFAEF', '#122716'),
      '--dsw-alias-file-diff-added-marker': t('#34C759', '#30D158'),
      '--dsw-alias-file-diff-deleted-bg': t('#FDE7E5', '#331B19'),
      '--dsw-alias-file-diff-deleted-gutter': t('#FEF0EF', '#2A1513'),
      '--dsw-alias-file-diff-deleted-marker': t('#FF3B30', '#FF453A'),

      // Charts and the JSON tree on the system accent set.
      '--dsw-alias-chart-messages': t('#0A84FF', '#0A84FF'),
      '--dsw-alias-chart-tools': t('#AF52DE', '#BF5AF2'),
      '--dsw-alias-chart-system': t('rgba(120, 120, 128, 0.5)', 'rgba(120, 120, 128, 0.6)'),
      '--dsw-alias-json-tree-keyword': t('#0A84FF', '#99C8FF'),
      '--dsw-alias-json-tree-number': t('#0A84FF', '#99C8FF'),
      '--dsw-alias-json-tree-string': t('#FF3B30', '#FF8A80'),
      '--dsw-alias-json-tree-property': t('#AF52DE', '#5DB0D7'),
      '--dsw-alias-json-tree-punctuation': t('rgba(0, 0, 0, 0.85)', 'rgba(255, 255, 255, 0.90)'),
      '--dsw-alias-json-tree-icon': t('rgba(120, 120, 128, 0.9)', '#9AA0A6'),
      '--dsw-alias-json-tree-hover': t('rgba(0, 0, 0, 0.04)', 'rgba(255, 255, 255, 0.05)'),

      // Overlays: vibrancy is the sidebar's blur, everything else is opaque.
      '--dsw-menu-surface-fill': t('rgba(255, 255, 255, 0.72)', 'rgba(44, 44, 46, 0.72)'),
      '--dsw-specific-menu': t('rgba(255, 255, 255, 0.94)', 'rgba(44, 44, 46, 0.94)'),
      '--dsw-alias-menu-group-header-fill': t('rgba(247, 247, 249, 0.94)', 'rgba(44, 44, 46, 0.94)'),
      '--dsw-alias-menu-icon': t('rgba(0, 0, 0, 0.78)', 'rgba(255, 255, 255, 0.85)'),
      '--dsw-alias-tooltip-bg': t('#3A3A3C', '#3A3A3C'),
      '--dsw-alias-tooltip-key-bg': t('color-mix(in srgb, #3A3A3C, white 18%)', 'color-mix(in srgb, #3A3A3C, white 18%)'),
      '--dsw-alias-tooltip-label': t('#FFFFFF', '#FFFFFF'),
      '--dsw-alias-toast-bg': t('#3A3A3C', '#3A3A3C'),
      '--dsw-alias-toast-label': t('#FFFFFF', 'rgba(255, 255, 255, 0.95)'),
      '--dsw-alias-toast-action': t('#0A84FF', '#64B5FF'),
      '--dsw-alias-hovercard-bg': t('#2C2C2E', '#2C2C2E'),
      '--dsw-alias-hovercard-label-primary': t('#FFFFFF', 'rgba(255, 255, 255, 0.95)'),
      '--dsw-alias-hovercard-label-secondary': t('rgba(255, 255, 255, 0.70)', 'rgba(255, 255, 255, 0.70)'),
      '--dsw-alias-hovercard-label-tertiary': t('rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.45)'),
      '--dsw-alias-hovercard-state-done': t('#BF5AF2', '#BF5AF2'),
      '--dsw-alias-hovercard-state-error': t('#FF453A', '#FF453A'),

      // Chrome details.
      '--dsw-alias-scrollbar-bg-l1': t('rgba(0, 0, 0, 0.22)', 'rgba(255, 255, 255, 0.22)'),
      '--dsw-alias-scrollbar-bg-l2': t('rgba(0, 0, 0, 0.28)', 'rgba(255, 255, 255, 0.28)'),
      '--dsw-alias-scrollbar-hover-l1': t('rgba(0, 0, 0, 0.34)', 'rgba(255, 255, 255, 0.34)'),
      '--dsw-alias-scrollbar-hover-l2': t('rgba(0, 0, 0, 0.40)', 'rgba(255, 255, 255, 0.40)'),
      '--dsw-alias-switch-thumb': t('#FFFFFF', 'rgba(255, 255, 255, 0.90)'),
      '--dsw-alias-turn-trigger-bg': t('#F7F7F9', 'rgba(255, 255, 255, 0.06)'),
      '--dsw-alias-turn-trigger-bg-hover': t('rgba(0, 0, 0, 0.04)', 'rgba(255, 255, 255, 0.10)'),

      // Illustrations and onboarding art.
      '--dsw-alias-illustration-background': t('#F7F7F9', '#2C2C2E'),
      '--dsw-alias-illustration-surface': t('#EDEDF2', '#3A3A3C'),
      '--dsw-alias-illustration-backing': t('#D8D8DE', '#48484A'),
      '--dsw-alias-illustration-detail': t('rgba(120, 120, 128, 0.5)', 'rgba(120, 120, 128, 0.6)'),
      '--dsw-alias-illustration-inset': t('#EDEDF2', '#48484A'),
      '--dsw-alias-illustration-shadow': t('#EDEDF2', '#48484A'),
      '--dsw-specific-guide-hero': t('#E8E8ED', '#3A3A3C'),

      // Sidebar (the vibrancy column), composer and the remaining named surfaces.
      '--dsw-specific-sidebar-fill': t('rgba(242, 242, 247, 0.80)', 'rgba(28, 28, 30, 0.80)'),
      '--dsw-specific-sidebar-nav-item-active': t('rgba(0, 0, 0, 0.08)', 'rgba(255, 255, 255, 0.10)'),
      '--dsw-specific-sidebar-nav-item-active-accent': t('rgba(10, 132, 255, 0.16)', 'rgba(10, 132, 255, 0.20)'),
      '--dsw-specific-sidebar-right-flash': t('#0A84FF', '#0A84FF'),
      '--dsw-specific-bubble': t('#FFFFFF', '#3A3A3C'),
      '--dsw-specific-bubble-highlight': t('#E8E8ED', '#48484A'),
      '--dsw-specific-input-major': t('#FFFFFF', '#1C1C1E'),
      '--dsw-specific-login-input': t('#FFFFFF', '#1C1C1E'),
      '--dsw-specific-file-upload-track': t('rgba(0, 0, 0, 0.08)', 'rgba(0, 0, 0, 0.08)'),
      '--dsw-specific-selector': t('#EDEDF2', '#3A3A3C'),
      '--dsw-specific-tip': t('#EDEDF2', '#3A3A3C'),
    }

    /** The selectable themes, in menu order. `null` id = the shipped palette. */
    const THEMES = [
      { id: null, label: '默认', hint: 'DeepSeek 原始配色', tokens: null },
      { id: 'warm-organic', label: '暖感有机', hint: '陶土、黏土与橄榄绿，纸张质感', tokens: warmOrganic },
      { id: 'macos-vibrancy', label: 'macOS 毛玻璃', hint: '三级深灰、1px 细线、系统蓝', tokens: macosVibrancy },
    ]

    /** The theme a stored id names, or the default entry. */
    function themeById(id) {
      return THEMES.find((theme) => theme.id === id) || THEMES[0]
    }

    /** The stored theme id, tolerating a disabled or unavailable localStorage. */
    function readStored() {
      try {
        return window.localStorage.getItem(STORAGE_KEY)
      } catch {
        return null
      }
    }

    function writeStored(id) {
      try {
        if (id === null) window.localStorage.removeItem(STORAGE_KEY)
        else window.localStorage.setItem(STORAGE_KEY, id)
      } catch { /* private mode or a denied origin: the theme still applies for this session */ }
    }

    // Settings row styles. Inline, because a client bundle cannot import a CSS
    // module; the tokens are the same ones the shipped Appearance row reads, so the
    // row sits in the General section looking native in every theme.
    const S = {
      group: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px 0', borderBottom: '0.5px solid var(--dsw-alias-border-l2)' },
      title: { fontSize: '14px', fontWeight: 400, lineHeight: '22px', color: 'var(--dsw-alias-label-primary)' },
      cubeRow: { display: 'flex', alignItems: 'stretch', gap: '8px', flexWrap: 'wrap' },
      cube: {
        boxSizing: 'border-box', flex: '1 1 180px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '16px 20px',
        border: '0.5px solid var(--dsw-alias-border-l4)', borderRadius: 'var(--dsw-radius-xl, 20px)',
        background: 'transparent', font: 'inherit', fontSize: '14px', lineHeight: '22px',
        color: 'var(--dsw-alias-label-primary)', cursor: 'pointer', textAlign: 'center',
      },
      // The full shorthand, not just borderColor: overriding the colour alone leaves
      // React warning about mixing a shorthand with a longhand on rerender.
      cubeSelected: { background: 'var(--dsw-alias-bg-module-platform)', border: '0.5px solid var(--dsw-alias-border-selected)' },
      swatch: { display: 'flex', gap: '3px' },
      dot: { width: '14px', height: '14px', borderRadius: '999px', display: 'block' },
      hint: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' },
    }

    /** Three swatches per theme, so a cube previews the palette it switches to. */
    function Swatches({ colors }) {
      return h('span', { style: S.swatch },
        colors.map((color, index) => h('span', { key: index, style: { ...S.dot, background: color } })))
    }

    /** Menu order and preview colours (the theme's own primary, accent, surface). */
    const PREVIEW = {
      'default': ['#F5F5F5', '#1B1B1C', '#4176E6'],
      'warm-organic': ['#F5F0EB', '#C86A4A', '#7A8B5E'],
      'macos-vibrancy': ['#1C1C1E', '#2C2C2E', '#0A84FF'],
    }

    /**
     * The cube row: one cube per theme, the active one marked.
     * @param props - the active id plus the pick handler.
     */
    function ThemeStylesCubes({ activeId, onPick }) {
      // A cube's selected state follows the stored preference, never a resolved
      // palette: a theme supplies both modes, so light and dark pick the same cube.
      return h('div', { style: S.group },
        h('div', { style: S.title }, '主题风格'),
        h('div', { style: S.cubeRow }, THEMES.map((candidate) => {
          const id = candidate.id
          const selected = candidate.id === activeId
          return h('button', {
            key: id === null ? 'default' : id,
            type: 'button',
            'aria-pressed': selected,
            title: candidate.hint,
            style: selected ? { ...S.cube, ...S.cubeSelected } : S.cube,
            onClick: () => onPick(candidate.id),
          },
            h(Swatches, { colors: PREVIEW[id === null ? 'default' : id] }),
            h('span', null, candidate.label),
            h('span', { style: S.hint }, candidate.hint))
        })))
    }

    return {
      // `theme` is the override API; `slots` carries the settings row. No host
      // services and no locale: the row's copy is Chinese-only and inline.
      inject: ['slots', 'theme'],
      apply(ctx) {
        const { useState } = React
        const theme = ctx.theme
        let disposeLayer = null

        /**
         * Apply one theme's tokens, replacing any layer already applied.
         * Registering the source again would replace its whole layer anyway, but
         * the default theme carries no tokens and needs the layer removed outright.
         */
        function paint(id) {
          const candidate = themeById(id)
          if (disposeLayer !== null) {
            disposeLayer()
            disposeLayer = null
          }
          if (candidate.tokens !== null) {
            disposeLayer = theme.overrideTokens(SOURCE, candidate.tokens)
          }
        }

        const initial = themeById(readStored()).id
        // Applied here, not from the row: the row only mounts when the user opens
        // Settings, so a theme restored from storage would otherwise wait for a
        // visit to the settings panel before it took effect.
        paint(initial)

        /** The row: theme state lives here, so picking one re-renders it. */
        function ThemeStylesRow() {
          const [activeId, setActiveId] = useState(initial)
          return h(ThemeStylesCubes, {
            activeId,
            onPick: (id) => {
              const next = themeById(id).id
              if (next === activeId) return
              paint(next)
              writeStored(next)
              setActiveId(next)
            },
          })
        }

        ctx.effect(() => {
          const registration = ctx.slots.inject('settings.general.item', () => ctx.slots.register({
            name: 'settings.general.item',
            id: 'theme-styles',
            order: 12,
          }, ThemeStylesRow))
          return () => {
            registration?.()
            disposeLayer?.()
            disposeLayer = null
          }
        }, 'theme-styles: palette and settings row')
      },
      __internal: { THEMES, themeById },
    }
  },
})

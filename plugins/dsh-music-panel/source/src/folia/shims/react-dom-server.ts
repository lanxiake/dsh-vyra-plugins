// src/render/folia/shims/react-dom-server.ts
// Folia renders theme icons to SVG markup for Pixi textures. The plugin's themes carry
// no icon set, so the renderer gets an empty string and falls back to its default icon.

export const renderToStaticMarkup = (_element: unknown): string => '';

export default { renderToStaticMarkup };

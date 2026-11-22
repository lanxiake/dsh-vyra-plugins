// src/render/folia/shims/i18n.ts
// Folia uses react-i18next. The plugin's dictionary is the one that has these keys, so the
// ported renderers ask it through `MP_FOLIA_T` (set next to `MP_LOGIN_T` in 05-i18n).
// A key the dictionary does not know renders as nothing rather than as the raw key: those
// are settings-panel labels whose panels are stubbed out here, and the one label the
// renderers really do show — `ui.waitingForMusic` — is deliberately empty in Folia (the
// visualizer shows no placeholder while a song's lyrics are still loading).

interface PluginTranslate {
    (key: string, vars?: Record<string, unknown>): unknown;
}

const pluginTranslate = (key: string, vars?: Record<string, unknown>): string => {
    const translate = (globalThis as { MP_FOLIA_T?: PluginTranslate }).MP_FOLIA_T;
    if (typeof translate !== 'function') return '';
    try {
        const text = translate(key, vars);
        return typeof text === 'string' && text !== key ? text : '';
    } catch {
        return '';
    }
};

export const useTranslation = () => ({
    t: pluginTranslate,
    i18n: { language: 'zh', changeLanguage: async () => undefined },
});

export const Trans = (props: { children?: unknown }) => (props && props.children) || null;

export default { t: pluginTranslate, language: 'zh' };

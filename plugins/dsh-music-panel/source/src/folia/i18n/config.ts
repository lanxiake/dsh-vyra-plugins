// src/render/folia/i18n/config.ts
const i18n = {
    language: 'zh',
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
    changeLanguage: async () => undefined,
};

export default i18n;

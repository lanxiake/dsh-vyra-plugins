// src/render/folia/shims/ttml.ts
// The plugin's lyric pipeline parses LRC/embedded text; Folia's TTML branch is not
// reachable here. Keep the imports resolvable so the rest of parserCore is verbatim.

export class TTMLParser {
    constructor(_options?: unknown) {}
    parse(_text?: string): unknown {
        return { lyricLines: [] };
    }
}

export class DOMParser {
    parseFromString(_source?: string, _mimeType?: string): { documentElement: null } {
        return { documentElement: null };
    }
}

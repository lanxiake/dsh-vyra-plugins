/**
 * Starts a version-pinned `npx` package straight from the copy npx already cached. On every
 * start `npx` first asks the registry about the package, even with that copy at hand, which
 * measured 4 to 26 seconds here and holds up both the model menu and the first message.
 *
 * Its `--prefer-offline` flag skips the question but is not a fix: it fails on a version newer
 * than the cached metadata, and it reaches the CLI as `npm_config_prefer_offline`, so npm
 * commands the agent runs in the user's project would quietly see stale metadata.
 *
 * Everything here rests on npm's cache layout, so whatever is not plainly there goes to `npx`
 * as configured. A change on npm's side can only make a start slower, never wrong.
 * @module dsh-vyra-agent-cli-manager/npx-cache
 */
/** How to start one CLI. */
export interface CliCommand {
    readonly argv: readonly string[];
    readonly env: Readonly<Record<string, string>>;
}
/** Where to look, and what to build the child's path on. */
export interface NpxCacheOptions {
    /** npm's `_npx` directory, or undefined where this cannot work. */
    readonly npxCache: string | undefined;
    readonly path: string | undefined;
}
/**
 * Point a command at npx's cached copy of its package, when that is safe.
 * @param command - the command as configured.
 * @param options - where to look.
 * @returns the command to run: the same one unless a cached copy can stand in for it.
 */
export declare function startFromNpxCache(command: CliCommand, { npxCache, path }: NpxCacheOptions): CliCommand;
/**
 * Locate npx's cache. A cache moved by `.npmrc` is not found, which only means going by `npx`.
 * @param env - the process environment.
 * @param home - the user's home directory.
 * @param platform - the current platform.
 * @returns the `_npx` directory, or undefined on Windows, whose links need a shell to start.
 */
export declare function npxCacheDir(env: Readonly<Record<string, string | undefined>>, home: string, platform: NodeJS.Platform): string | undefined;

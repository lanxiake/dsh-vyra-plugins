/**
 * What each agent CLI is, where it keeps its configuration, and which of its own
 * subcommands manage it. DESIGN.md is the source of these facts, measured on this machine
 * on 2026-11-16; nothing here is inferred from a CLI's name or from habit.
 * @module dsh-vyra-agent-cli-manager/cli/catalog
 */
/**
 * How a CLI manages its MCP servers. Every CLI ships its own `mcp` subcommands and they
 * follow that CLI's own version, so this plugin delegates to them instead of rewriting
 * config files it would have to keep in step.
 */
interface McpCommands {
    /**
     * True when the CLI has `mcp` subcommands. False when only its TUI can edit them
     * (OMP's `/mcp`, Kimi's `/mcp-config`), where the config file is the only way in.
     */
    readonly viaSubcommands: boolean;
    /** `[mcp, list]` — the argv prefix that lists servers, after the binary. */
    readonly list?: readonly string[] | undefined;
    /**
     * `[mcp, remove]` — the argv prefix that takes a server name last. Absent when the CLI
     * cannot remove one at all: `opencode mcp` has add/list/auth/logout/debug and no remove.
     */
    readonly remove?: readonly string[] | undefined;
    /**
     * Flags that place a write in the store this plugin reads back. Claude needs them most:
     * its default scope is local, which records the server under `projects[<cwd>]`, so an add
     * without `-s user` would land somewhere the panel never looks.
     */
    readonly scope?: readonly string[] | undefined;
    /**
     * The measured shape of `mcp add`. Absent when it was never measured on this machine,
     * which is why such a CLI cannot be written to: guessing a flag would either fail late or
     * silently write something else.
     */
    readonly add?: McpAddCommands | undefined;
}
/** How one CLI's `mcp add` takes its arguments, as measured from its own `--help`. */
interface McpAddCommands {
    /** `[mcp, add]`, the argv prefix after the binary. */
    readonly argv: readonly string[];
    /**
     * How a stdio command is attached: after `--` for the CLIs that document it, `none` for
     * one whose help shows no way to pass a command at all (OpenCode's add takes only a URL).
     */
    readonly stdio: 'double-dash' | 'none';
    /**
     * How the transport is declared: `flag-t` emits `-t <transport>`; `inferred` means the CLI
     * decides from whether a URL or a command was given.
     */
    readonly transport: 'flag-t' | 'inferred';
    /** The flag taking one `KEY=VALUE`, absent when the CLI takes no environment. */
    readonly env?: string | undefined;
    /** The flag taking a URL, absent when the CLI takes the URL positionally. */
    readonly url?: string | undefined;
}
/** One agent CLI this plugin can install, upgrade, configure, and start. */
export interface CliCatalogEntry {
    /** Also the agent id in `cordis.patch.yml`, which names the provider route `cli-<id>`. */
    readonly id: string;
    /** Shown in menus and messages. */
    readonly name: string;
    /** From the CLI's npm scope, which is the one vendor fact that is machine-checkable. */
    readonly vendor: string;
    /** The name looked up in PATH. Not a path: the harness resolves it in its own world. */
    readonly binary: string;
    /** `<binary> <versionArgs>` prints the version. */
    readonly versionArgs: readonly string[];
    /** The npm package whose `latest` dist-tag answers "is there a newer one". */
    readonly npmPackage: string;
    /** `<binary> <upgradeArgs>` upgrades in place, so the CLI's own updater picks the layout. */
    readonly upgradeArgs: readonly string[];
    /**
     * Removes the installed copy, as its own argv. The safe default is a package manager,
     * because a native install has directories this plugin did not create and cannot verify.
     */
    readonly uninstallArgs: readonly string[];
    /** Config directory, relative to the user's home. */
    readonly configDir: string;
    readonly mcp: McpCommands;
    /**
     * The file holding this CLI's MCP servers, relative to the user's home, or undefined when
     * it keeps them somewhere a JSON reader cannot go (Codex writes TOML).
     */
    readonly mcpFile: string | undefined;
    /** Which key of that file holds the servers, matching how the CLI names them. */
    readonly mcpKey: 'mcpServers' | 'mcp' | undefined;
    /**
     * Every directory this CLI loads skills from, in its own precedence order, relative to
     * the user's home. Several CLIs also read the shared `~/.agents/skills`, so one string
     * would understate what the CLI would actually offer.
     */
    readonly skillsDirs: readonly string[];
    /** The global instruction file, relative to the user's home. */
    readonly promptFile: string;
    /**
     * False for the CLIs never measured on this machine. Their rows rest on vendor
     * documentation, so the UI must say so rather than present them as fact.
     */
    readonly verified: boolean;
}
/**
 * Every CLI, in the order `cordis.patch.yml` lists them. Codex and OpenCode also install
 * natively, but the npm package is still what answers "is there a newer version", so it is
 * recorded for all of them.
 */
export declare const CLI_CATALOG: readonly CliCatalogEntry[];
/**
 * Look one CLI up by the id the panel sends back.
 * @param id - a catalog id.
 * @returns its entry, or undefined for an id this plugin does not manage.
 */
export declare function catalogEntry(id: string): CliCatalogEntry | undefined;
export {};

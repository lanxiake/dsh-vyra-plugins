/**
 * Gives CLIs the PATH a terminal would give them. On macOS an app started from the Dock gets
 * launchd's PATH, `/usr/bin:/bin:/usr/sbin:/sbin`, and never reads the shell's rc files, so a
 * node installed through nvm, fnm or Volta is out of sight. Every npx-based CLI then dies
 * with exit code 127 from `/usr/bin/env node`, while the same CLI works in a terminal.
 *
 * The login shell is asked for its PATH once, in the background, since rc files can take
 * seconds. Until it answers, or when it fails, the usual install places are appended to the
 * inherited PATH, which already covers the common nvm and Homebrew setups.
 * @module dsh-vyra-agent-cli-manager/login-path
 */
/** What the lookup needs from the file system; separate so tests need not touch the disk. */
export interface DirProbe {
    readonly isDir: (path: string) => boolean;
    readonly list: (path: string) => readonly string[];
}
/** Runs a command and resolves with its stdout. */
export type ShellRunner = (argv: readonly string[], signal: AbortSignal) => Promise<string>;
export interface LoginPathOptions {
    readonly platform: NodeJS.Platform;
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly home: string;
    readonly dirs: DirProbe;
    readonly run: ShellRunner;
    readonly warn: (message: string) => void;
}
/**
 * Read the PATH out of the login shell's output.
 * @param stdout - everything the shell printed.
 * @returns the PATH, or undefined when the output does not hold one.
 */
export declare function parseShellPath(stdout: string): string | undefined;
/**
 * Join PATH values, keeping the first occurrence of each directory.
 * @param paths - PATH values, in order of precedence.
 * @returns one PATH value.
 */
export declare function mergePaths(...paths: readonly (string | undefined)[]): string;
/**
 * The usual install places for CLIs and node that exist on this machine.
 * @param home - the user's home directory.
 * @param dirs - the file system.
 * @returns existing directories, newest nvm node first since nvm's default is usually it.
 */
export declare function knownBinDirs(home: string, dirs: DirProbe): readonly string[];
/** The PATH handed to CLIs: the login shell's when known, the inherited one plus fallbacks otherwise. */
export declare class LoginPath {
    private readonly options;
    private login;
    constructor(options: LoginPathOptions);
    /**
     * Ask the login shell for its PATH. Never rejects: a failure only keeps the fallback.
     * @param signal - ends the shell when the plugin goes away.
     */
    load(signal: AbortSignal): Promise<void>;
    /**
     * Give a CLI's environment a full PATH, unless it is configured with one.
     * @param env - the environment configured for the CLI.
     * @returns the environment to start the CLI with.
     */
    apply(env: Readonly<Record<string, string>>): Readonly<Record<string, string>>;
}
/**
 * Run a command outside the harness's subprocess service: this is a fact about the machine
 * the plugin runs on, read once, like the npx cache next to it.
 * @param argv - program and arguments.
 * @param signal - ends the command.
 * @returns the command's stdout.
 */
export declare function runShell(argv: readonly string[], signal: AbortSignal): Promise<string>;
/** The real file system. */
export declare const diskDirs: DirProbe;

/**
 * Turns a configured command into one Windows can start without a shell. The harness spawns
 * with CreateProcess and never through `cmd.exe`, which finds only `.exe` and `.com` files by
 * bare name and, since Node's fix for CVE-2024-27980, refuses `.cmd` and `.bat` outright. Yet
 * `npx`, `codebuddy`, `opencode` and most CLIs installed through a package manager are `.cmd`
 * shims on Windows.
 *
 * Wrapping the shim in `cmd.exe /c` is not an option: the spawn seam has no verbatim-argument
 * switch, so Node's quoting of the command line would break cmd's own parsing. Instead, the
 * shim is read for the script it starts, and that script is run with the shim's interpreter
 * directly, the way the shim would have run it. The interpreter is often not node: npm writes
 * `bun` into the shim of a package whose bin has a bun shebang, such as OMP CLI.
 * @module dsh-vyra-agent-cli-manager/windows-command
 */
import type { CliCommand } from './npx-cache.ts';
/** What the lookup needs from the file system; separate so tests need not run on Windows. */
export interface FileProbe {
    readonly isFile: (path: string) => boolean;
    readonly read: (path: string) => string | undefined;
}
/** Where to look. */
export interface WindowsLookup {
    readonly path: string | undefined;
    readonly pathExt: string | undefined;
    readonly files: FileProbe;
}
/**
 * Resolve a command the way a Windows shell would, without the shell.
 * @param command - the command as configured.
 * @param lookup - where to look.
 * @returns the command with a program CreateProcess can start; unchanged when the program is
 *   not found, so the spawn reports it as missing.
 * @throws Error when the program is a batch file that only a shell could run.
 */
export declare function resolveWindowsCommand(command: CliCommand, lookup: WindowsLookup): CliCommand;
/**
 * On Windows, resolve the command against the real file system; elsewhere, leave it alone.
 * @param command - the command as configured.
 * @param platform - the current platform.
 * @param env - the process environment, for PATH and PATHEXT.
 * @returns the command to spawn.
 */
export declare function startOnWindows(command: CliCommand, platform: NodeJS.Platform, env: Readonly<Record<string, string | undefined>>): CliCommand;

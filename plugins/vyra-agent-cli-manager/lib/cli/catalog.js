/**
 * What each agent CLI is, where it keeps its configuration, and which of its own
 * subcommands manage it. DESIGN.md is the source of these facts, measured on this machine
 * on 2026-11-16; nothing here is inferred from a CLI's name or from habit.
 * @module vyra-agent-cli-manager/cli/catalog
 */
import { dirname, join } from 'node:path';
/**
 * Every CLI, in the order `cordis.patch.yml` lists them. Codex and OpenCode also install
 * natively, but the npm package is still what answers "is there a newer version", so it is
 * recorded for all of them.
 */
export const CLI_CATALOG = [
    {
        id: 'claude',
        name: 'Claude Code',
        vendor: 'Anthropic',
        binary: 'claude',
        versionArgs: ['--version'],
        npmPackage: '@anthropic-ai/claude-code',
        upgradeArgs: ['update'],
        uninstallArgs: ['npm', 'rm', '-g', '@anthropic-ai/claude-code'],
        configDir: '.claude',
        // Measured from `claude mcp --help` 2.1.276: add takes `-t <transport>`, `-e KEY=VALUE`,
        // and the command after `--`; the URL is positional. `-s user` is what puts a server in
        // the top-level `mcpServers` this plugin reads.
        mcp: {
            viaSubcommands: true,
            list: ['mcp', 'list'],
            remove: ['mcp', 'remove'],
            scope: ['-s', 'user'],
            add: { argv: ['mcp', 'add'], stdio: 'double-dash', transport: 'flag-t', env: '-e' },
        },
        mcpFile: '.claude.json',
        mcpKey: 'mcpServers',
        skillsDirs: ['.claude/skills'],
        promptFile: '.claude/CLAUDE.md',
        verified: true,
    },
    {
        id: 'codex',
        name: 'Codex CLI',
        vendor: 'OpenAI',
        binary: 'codex',
        versionArgs: ['--version'],
        npmPackage: '@openai/codex',
        upgradeArgs: ['update'],
        uninstallArgs: ['npm', 'rm', '-g', '@openai/codex'],
        configDir: '.codex',
        // Measured from `codex mcp add --help` 0.154.0: `add <NAME> (--url <URL> | -- <COMMAND>...)`,
        // with `--env` for environment. Codex infers the transport, and keeps its servers in TOML,
        // so there is no file for this plugin to edit and the CLI stays the only way in.
        mcp: {
            viaSubcommands: true,
            list: ['mcp', 'list'],
            remove: ['mcp', 'remove'],
            add: { argv: ['mcp', 'add'], stdio: 'double-dash', transport: 'inferred', env: '--env', url: '--url' },
        },
        mcpFile: undefined,
        mcpKey: undefined,
        skillsDirs: ['.codex/skills'],
        promptFile: '.codex/AGENTS.md',
        verified: true,
    },
    {
        id: 'opencode',
        name: 'OpenCode',
        vendor: 'SST',
        binary: 'opencode',
        versionArgs: ['--version'],
        npmPackage: 'opencode-ai',
        upgradeArgs: ['upgrade'],
        uninstallArgs: ['opencode', 'uninstall'],
        configDir: '.config/opencode',
        // Measured: `opencode mcp` offers add/list/auth/logout/debug, so removal has no
        // subcommand to delegate to and edits opencode.json instead. `mcp add` documents `--url`
        // and `--env` but no way to pass a stdio command, so only remote servers can be added.
        mcp: {
            viaSubcommands: true,
            list: ['mcp', 'list'],
            add: { argv: ['mcp', 'add'], stdio: 'none', transport: 'inferred', env: '--env', url: '--url' },
        },
        mcpFile: '.config/opencode/opencode.json',
        mcpKey: 'mcp',
        // Measured: the binary looks for `.config/opencode/skill`, singular.
        skillsDirs: ['.config/opencode/skill', '.claude/skills', '.agents/skills'],
        promptFile: '.config/opencode/AGENTS.md',
        verified: true,
    },
    {
        id: 'kimi',
        name: 'Kimi CLI',
        vendor: 'Moonshot AI',
        binary: 'kimi',
        versionArgs: ['--version'],
        npmPackage: '@moonshot-ai/kimi-code',
        upgradeArgs: ['upgrade'],
        uninstallArgs: ['npm', 'rm', '-g', '@moonshot-ai/kimi-code'],
        configDir: '.kimi-code',
        mcp: { viaSubcommands: false },
        mcpFile: '.kimi-code/mcp.json',
        mcpKey: 'mcpServers',
        skillsDirs: ['.kimi-code/skills', '.agents/skills'],
        promptFile: '.kimi-code/AGENTS.md',
        verified: false,
    },
    {
        id: 'pi',
        name: 'PI CLI',
        vendor: 'Earendil Works',
        binary: 'pi',
        versionArgs: ['--version'],
        npmPackage: '@earendil-works/pi-coding-agent',
        upgradeArgs: ['update'],
        uninstallArgs: ['npm', 'rm', '-g', '@earendil-works/pi-coding-agent'],
        configDir: '.pi/agent',
        mcp: { viaSubcommands: true, list: ['mcp', 'list'], remove: ['mcp', 'remove'] },
        mcpFile: '.pi/agent/mcp.json',
        mcpKey: 'mcpServers',
        skillsDirs: ['.pi/agent/skills'],
        promptFile: '.pi/agent/AGENTS.md',
        verified: false,
    },
    {
        id: 'omp',
        name: 'OMP CLI',
        vendor: 'Oh My Pi',
        binary: 'omp',
        versionArgs: ['--version'],
        npmPackage: '@oh-my-pi/pi-coding-agent',
        upgradeArgs: ['update'],
        // Installed through bun, so it is removed through bun.
        uninstallArgs: ['bun', 'rm', '-g', '@oh-my-pi/pi-coding-agent'],
        configDir: '.omp/agent',
        mcp: { viaSubcommands: false },
        mcpFile: '.omp/agent/mcp.json',
        mcpKey: 'mcpServers',
        skillsDirs: ['.omp/agent/skills'],
        promptFile: '.omp/agent/AGENTS.md',
        verified: false,
    },
    {
        id: 'codebuddy',
        name: 'CodeBuddy CLI',
        vendor: 'Tencent',
        binary: 'codebuddy',
        versionArgs: ['--version'],
        npmPackage: '@tencent-ai/codebuddy-code',
        upgradeArgs: ['update'],
        uninstallArgs: ['npm', 'rm', '-g', '@tencent-ai/codebuddy-code'],
        configDir: '.codebuddy',
        // Documentation only names `codebuddy mcp`; the list/remove shapes follow the CLIs
        // that were measured, so this row stays unverified until it can be checked.
        mcp: { viaSubcommands: true, list: ['mcp', 'list'], remove: ['mcp', 'remove'] },
        mcpFile: '.codebuddy/mcp.json',
        mcpKey: 'mcpServers',
        skillsDirs: ['.codebuddy/skills'],
        promptFile: '.codebuddy/CODEBUDDY.md',
        verified: false,
    },
    {
        id: 'dsh',
        name: 'DeepSeek Harness',
        vendor: 'DeepSeek',
        // The desktop application ships its own launcher rather than an npm bin, and puts it
        // beside the running executable instead of on PATH — measured on this machine as
        // `<app>/resources/runtime/cli/bin/dsh.cmd`. `process.execPath` is that executable
        // because this plugin runs inside the harness, so the candidates are derived from it.
        binary: 'dsh',
        binaryCandidates: dshLaunchers(),
        versionArgs: ['--version'],
        // Not an npm-installed CLI: it is the harness this plugin runs inside, so there is
        // nothing to upgrade or uninstall from here and no MCP syntax of its own to drive.
        npmPackage: undefined,
        upgradeArgs: undefined,
        uninstallArgs: undefined,
        configDir: '.dsh',
        mcp: { viaSubcommands: false },
        mcpFile: undefined,
        mcpKey: undefined,
        // Measured against skill-filesystem's roots (`packages/skill/skill-filesystem`): the
        // user-level directory is `~/.dsh/skills`, and `~/.agents/skills` is shared with the
        // other agent tools, which is why both are listed.
        skillsDirs: ['.dsh/skills', '.agents/skills'],
        // The harness ships no global instruction file, so this is a path to create rather
        // than one to read; the panel offers it as a new file.
        promptFile: '.dsh/AGENTS.md',
        verified: true,
    },
];
/**
 * The launcher paths a desktop installation of the harness uses, most specific first.
 * @returns absolute candidate paths, or none when this is not the desktop build.
 */
function dshLaunchers() {
    const execPath = process.execPath;
    if (typeof execPath !== 'string' || execPath === '')
        return [];
    const appDir = dirname(execPath);
    const launcher = process.platform === 'win32' ? 'dsh.cmd' : 'dsh';
    // `resources/runtime/cli/bin` is where the desktop build keeps it; a plain checkout keeps
    // it a level up. Both are cheap to try, and a miss costs one failed resolve.
    return [
        join(appDir, 'resources', 'runtime', 'cli', 'bin', launcher),
        join(appDir, 'resources', 'runtime', 'cli', launcher),
    ];
}
/**
 * Look one CLI up by the id the panel sends back.
 * @param id - a catalog id.
 * @returns its entry, or undefined for an id this plugin does not manage.
 */
export function catalogEntry(id) {
    return CLI_CATALOG.find((entry) => entry.id === id);
}

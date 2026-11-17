/**
 * The mirror tool. A CLI runs its tools itself, but the harness can only show and
 * log a call that goes through a registered tool. This tool's body runs nothing:
 * it waits for the CLI to report what happened.
 * @module vyra-agent-cli-manager/cli-tool
 */
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { ToolOutcome } from './tool-record.ts';
/** What the tool needs from the bridge. */
export interface CliToolDeps {
    waitForTool(exec: ToolRunContext): Promise<ToolOutcome>;
}
/**
 * Build the tool definition.
 * @param deps - the bridge.
 * @returns the `cli_tool` definition.
 */
export declare function createCliTool(deps: CliToolDeps): ToolDefinition;

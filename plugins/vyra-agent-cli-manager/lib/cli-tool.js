/**
 * The mirror tool. A CLI runs its tools itself, but the harness can only show and
 * log a call that goes through a registered tool. This tool's body runs nothing:
 * it waits for the CLI to report what happened.
 * @module dsh-vyra-agent-cli-manager/cli-tool
 */
import { HarnessError } from '@deepseek-ai/dsh-llm';
import { defineTool, TOOL_ABORTED } from '@deepseek-ai/dsh-tools';
import { CLI_TOOL_NAME } from "./constants.js";
const KNOWN_KINDS = new Set(['read', 'edit', 'delete', 'move', 'search', 'execute', 'fetch']);
const DIFF_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        path: { type: 'string', required: true },
        oldText: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
        newText: { type: 'string', required: true },
    },
};
function toLocations(paths) {
    return (paths ?? []).map((path) => ({ path }));
}
function presentCall(args) {
    const { title, kind, command, input, diffs, locations } = args;
    if (command !== undefined) {
        return { card: 'terminal', title: command, ...(title === command ? {} : { description: title }) };
    }
    if (diffs !== undefined && diffs.length > 0) {
        return { card: 'diff', title, diffs: [...diffs], locations: toLocations(locations) };
    }
    return {
        card: 'generic',
        title,
        kind: (KNOWN_KINDS.has(kind) ? kind : 'other'),
        ...(input === undefined ? {} : { rawInput: input }),
        ...(locations === undefined ? {} : { locations: toLocations(locations) }),
    };
}
function resultText(result) {
    return result.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('\n');
}
function presentResult(args, result) {
    if (result.isError)
        return undefined;
    if (args.command !== undefined)
        return { card: 'terminal', output: resultText(result) };
    const diffs = result.meta?.diffs;
    return diffs !== undefined && diffs.length > 0 ? { card: 'diff', diffs } : undefined;
}
/** The harness aborts with a plain object, which would be logged as `[object Object]`. */
async function waitForOutcome(deps, exec) {
    try {
        return await deps.waitForTool(exec);
    }
    catch (error) {
        if (!exec.signal.aborted)
            throw error;
        const aborted = new HarnessError('tool call aborted', TOOL_ABORTED, { cause: error });
        aborted.name = 'AbortError';
        throw aborted;
    }
}
/**
 * Build the tool definition.
 * @param deps - the bridge.
 * @returns the `cli_tool` definition.
 */
export function createCliTool(deps) {
    return defineTool({
        name: CLI_TOOL_NAME,
        description: 'Records a tool call made by an external CLI. It runs nothing itself.',
        parameters: {
            title: { type: 'string', required: true, description: 'What the CLI says this call does.' },
            kind: { type: 'string', required: true, description: 'The ACP tool kind.' },
            command: { type: 'string', description: 'The shell command, for an execute call.' },
            input: { type: 'json', description: 'The raw input the CLI reported.' },
            diffs: { type: 'array', items: DIFF_SCHEMA },
            locations: { type: 'array', items: { type: 'string' } },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    text: { type: 'string', required: true },
                    diffs: { type: 'array', items: DIFF_SCHEMA, required: true },
                },
            },
            render: (_args, value) => [{ type: 'text', text: value.text }],
            presentationMeta: (_args, value) => ({ diffs: value.diffs }),
        },
        async execute(_args, exec) {
            const outcome = await waitForOutcome(deps, exec);
            if (outcome.failed)
                throw new Error(outcome.text);
            return { text: outcome.text, diffs: outcome.diffs.map((diff) => ({ ...diff })) };
        },
        presentCall: (args) => presentCall(args),
        presentResult: (args, result) => presentResult(args, result),
    });
}

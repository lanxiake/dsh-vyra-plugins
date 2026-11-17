/**
 * Mirrored calls in a PTC session. That tool executor only accepts `run_code`, so a
 * mirrored call goes out as a `run_code` program that calls the mirror tool through
 * its SDK binding. The executor then runs the mirror tool under a nested call id,
 * `<outer call id>:ptc:<n>`, which leads back to the CLI call.
 * @module vyra-agent-cli-manager/session/ptc-call
 */
import { RUN_CODE_NAME } from '@deepseek-ai/dsh-tools';
import { CLI_TOOL_NAME } from "../constants.js";
import { commandOf, toCliToolArgs } from "../tool-record.js";
/** The only runtime shape whose program syntax `programFor` writes. */
const SUPPORTED_LANGUAGE = 'typescript';
const SUPPORTED_FORMAT = 'function-body';
/** The executor's nested call id: the outer id, this marker, then a dispatch counter. */
const NESTED_CALL_ID = /^(.+):ptc:\d+$/;
const UNTITLED_DESCRIPTION = 'CLI 工具调用';
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function longestTimeout(timeout) {
    if (!isRecord(timeout))
        return undefined;
    const { maxMs } = timeout;
    return typeof maxMs === 'number' && Number.isFinite(maxMs) && maxMs > 0 ? maxMs : undefined;
}
/**
 * Decide how mirrored calls go out under a PTC runtime.
 * @param runtime - the host's `ptcRuntime` service, read as untrusted input.
 * @returns the wrap, or undefined when the runtime cannot run the program written here.
 */
export function readPtcWrap(runtime) {
    if (!isRecord(runtime))
        return undefined;
    if (runtime.language !== SUPPORTED_LANGUAGE || runtime.programFormat !== SUPPORTED_FORMAT)
        return undefined;
    const timeoutMs = longestTimeout(runtime.timeout);
    return timeoutMs === undefined ? {} : { timeoutMs };
}
/**
 * Write the program. It returns the mirror tool's text and lets a failure propagate,
 * so a failed call shows as a failed `run_code`. JSON is valid source for the
 * arguments, quotes, newlines and line separators included.
 */
function programFor(record) {
    return `return (await tools.${CLI_TOOL_NAME}(${JSON.stringify(toCliToolArgs(record))})).text`;
}
function describe(record) {
    const label = commandOf(record) ?? record.title;
    return label.trim() === '' ? UNTITLED_DESCRIPTION : label;
}
/**
 * Dress a mirrored call as a `run_code` call. It keeps the call id, so the nested id
 * the executor derives from it leads back to the CLI call.
 * @param record - the CLI call.
 * @param wrap - the session's PTC settings.
 * @returns the call to put on the stream.
 */
export function ptcCall(record, wrap) {
    return {
        id: record.callId,
        name: RUN_CODE_NAME,
        arguments: JSON.stringify({
            code: programFor(record),
            description: describe(record),
            ...(wrap.timeoutMs === undefined ? {} : { timeoutMs: wrap.timeoutMs }),
        }),
    };
}
/**
 * Read the outer call id from the id of a call nested in `run_code`.
 * @param callId - a call id from a tool execution.
 * @returns the outer id, or undefined when the call is not nested.
 */
export function mirroredCallId(callId) {
    return NESTED_CALL_ID.exec(callId)?.[1];
}

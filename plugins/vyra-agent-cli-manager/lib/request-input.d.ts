/**
 * Reads what the CLI still needs from a harness model request. The CLI holds its
 * own conversation, so only new user input and the native session id matter.
 * @module dsh-vyra-agent-cli-manager/request-input
 */
import type { ReplayEnvelope, RequestMessage } from '@deepseek-ai/dsh-llm';
import type { InputBlock } from './prompt-images.ts';
/** User input the CLI has not received yet. */
export interface UserInput {
    readonly ids: readonly string[];
    /** Text and image references; images are read only when the prompt is sent. */
    readonly blocks: readonly InputBlock[];
}
/**
 * Collect the user input still owed to the CLI: messages after the last assistant or
 * tool message, from the current turn, not sent yet. A tail ending in a tool result
 * yields nothing, which is how a continuation step is told apart from a new prompt.
 * @param messages - the derived request history.
 * @param seen - ids of messages already sent to the CLI.
 * @param currentTurn - ids of the user messages in the open turn; omitted, all qualify.
 * @returns new message ids and their text and image blocks, in conversation order.
 */
export declare function unseenUserInput(messages: readonly RequestMessage[], seen: ReadonlySet<string>, currentTurn?: ReadonlySet<string>): UserInput;
/**
 * Build the replay state that ties a harness session to its CLI session.
 * @param acpSessionId - the CLI's session id.
 * @param dshSessionId - the harness session that owns it.
 * @returns the envelope carried by `finish` and stored on the assistant message.
 */
export declare function nativeReplayState(acpSessionId: string, dshSessionId: string): ReplayEnvelope;
/**
 * Find the CLI session to reattach to, from the latest assistant message.
 * The owner check keeps a fork, which inherits its parent's messages under a new
 * id, from writing into the parent's CLI session. The provider check is needed because
 * all CLIs share one adapter, so the harness does not strip another route's replay state,
 * and a session id means nothing to any other CLI.
 * @param messages - the derived request history.
 * @param dshSessionId - the harness session asking.
 * @param provider - the CLI route asking.
 * @returns the CLI session id, or undefined when there is none to reuse.
 */
export declare function readNativeSession(messages: readonly RequestMessage[], dshSessionId: string, provider: string): string | undefined;

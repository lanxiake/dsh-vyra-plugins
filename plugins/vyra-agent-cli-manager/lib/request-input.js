/**
 * Reads what the CLI still needs from a harness model request. The CLI holds its
 * own conversation, so only new user input and the native session id matter.
 * @module vyra-agent-cli-manager/request-input
 */
/**
 * Message sources written by a person. The harness also uses the user role for its
 * own reminders and instructions; those are meant for its own model, and forwarded
 * they would start CLI turns nobody asked for.
 */
const FORWARDED_KINDS = new Set(['user', 'schedule']);
/**
 * Starts the harness's note about a schedule edit. It has the same source kind as a
 * real reminder and says it needs no action, and this text is the only difference.
 */
const SCHEDULE_NOTICE_PREFIX = '[SCHEDULE CHANGE]';
function messagesAfterLastReply(messages) {
    const lastReply = messages.findLastIndex((message) => message.role === 'assistant' || message.role === 'tool');
    return messages.slice(lastReply + 1);
}
/**
 * The reference's type comes from a package this one does not depend on, so its shape
 * is checked here instead of trusted.
 */
function imageRefOf(block) {
    const { attachment } = block;
    if (typeof attachment !== 'object' || attachment === null)
        return undefined;
    const { attachmentId, mediaType } = attachment;
    return typeof attachmentId === 'string' && typeof mediaType === 'string' ? attachment : undefined;
}
/**
 * Text and images are what a person writes. Files arrive already turned into text by
 * the host, and the remaining block kinds belong to model or tool output.
 */
function inputBlocks(message) {
    return message.content.flatMap((block) => {
        if (block.type === 'text')
            return [{ type: 'text', text: block.text }];
        if (block.type === 'image') {
            const ref = imageRefOf(block);
            return ref === undefined ? [] : [{ type: 'image', ref, offloaded: block.offloaded === true }];
        }
        return [];
    });
}
function isScheduleNotice(message) {
    const [first] = message.content;
    return first?.type === 'text' && first.text.startsWith(SCHEDULE_NOTICE_PREFIX);
}
function isForwarded(message) {
    // The agent loop and other producers extend this union; compare it as a plain string.
    const kind = message.source?.kind;
    if (message.role !== 'user')
        return false;
    if (kind === 'schedule' && isScheduleNotice(message))
        return false;
    return kind === undefined || FORWARDED_KINDS.has(kind);
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
export function unseenUserInput(messages, seen, currentTurn) {
    const fresh = messagesAfterLastReply(messages).filter((message) => isForwarded(message) &&
        (message.id === undefined || (!seen.has(message.id) && (currentTurn?.has(message.id) ?? true))));
    return {
        ids: fresh.flatMap((message) => (message.id === undefined ? [] : [message.id])),
        blocks: fresh.flatMap(inputBlocks),
    };
}
/**
 * Build the replay state that ties a harness session to its CLI session.
 * @param acpSessionId - the CLI's session id.
 * @param dshSessionId - the harness session that owns it.
 * @returns the envelope carried by `finish` and stored on the assistant message.
 */
export function nativeReplayState(acpSessionId, dshSessionId) {
    return { response: { acpSessionId, dshSessionId } };
}
function parseReplayResponse(replayState) {
    const response = replayState?.response;
    if (typeof response !== 'object' || response === null)
        return undefined;
    const { acpSessionId, dshSessionId } = response;
    return typeof acpSessionId === 'string' && typeof dshSessionId === 'string'
        ? { acpSessionId, dshSessionId }
        : undefined;
}
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
export function readNativeSession(messages, dshSessionId, provider) {
    const latest = messages.findLast((message) => message.role === 'assistant');
    const source = latest?.source;
    if (source?.provider !== provider)
        return undefined;
    const replay = parseReplayResponse(source.replayState);
    return replay?.dshSessionId === dshSessionId ? replay.acpSessionId : undefined;
}

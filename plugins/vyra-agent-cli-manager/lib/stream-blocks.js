/**
 * Pure conversion from CLI output to the harness's indexed block stream.
 * @module dsh-vyra-agent-cli-manager/stream-blocks
 */
/**
 * Text with no letters or digits yet. Some CLIs (OMP on DeepSeek models) answer a
 * lone "." between two tool calls; shown, it splits the harness's tool group around
 * every call. Such text is held at the start of a text block and dropped if a tool
 * call or reasoning comes next, so it never opens a block of its own.
 */
const WORDLESS = /^[\s\p{P}\p{S}]*$/u;
/** The state at the start of every step. */
export const EMPTY_BLOCKS = { nextIndex: 0 };
/**
 * Close the open text or reasoning block, if any. Held text is emitted here: at the
 * end of a turn it may be the whole answer.
 * @param state - the current state.
 * @returns a state with no open block and its chunks.
 */
export function closeOpenBlock(state) {
    if (state.held !== undefined) {
        const opened = openBlock({ nextIndex: state.nextIndex }, 'text', state.held);
        return { state: opened.state, chunks: [...opened.chunks, ...closeOpenBlock(opened.state).chunks] };
    }
    if (state.open === undefined)
        return { state, chunks: [] };
    const { index, blockType, text } = state.open;
    return {
        state: { nextIndex: state.nextIndex },
        chunks: [{ type: 'block-end', index, block: { type: blockType, text } }],
    };
}
/**
 * Append one delta, opening a new block when the type changes.
 * @param state - the current state.
 * @param blockType - the kind of text this delta belongs to.
 * @param text - the delta.
 * @returns the next state and chunks.
 */
export function appendDelta(state, blockType, text) {
    if (state.open?.blockType === blockType) {
        const open = { ...state.open, text: state.open.text + text };
        return {
            state: { ...state, open },
            chunks: [{ type: deltaKind(blockType), index: open.index, text }],
        };
    }
    const closed = closeOpenBlock(dropHeld(state));
    const pending = blockType === 'text' ? (state.held ?? '') + text : text;
    if (blockType === 'text' && WORDLESS.test(pending)) {
        return { state: { ...closed.state, held: pending }, chunks: closed.chunks };
    }
    const opened = openBlock(closed.state, blockType, pending);
    return { state: opened.state, chunks: [...closed.chunks, ...opened.chunks] };
}
function deltaKind(blockType) {
    return blockType === 'text' ? 'text-delta' : 'reasoning-delta';
}
function openBlock(state, blockType, text) {
    const index = state.nextIndex;
    return {
        state: { nextIndex: index + 1, open: { index, blockType, text } },
        chunks: [
            { type: 'block-start', index, blockType },
            { type: deltaKind(blockType), index, text },
        ],
    };
}
function dropHeld(state) {
    return state.held === undefined ? state : { nextIndex: state.nextIndex };
}
/**
 * Emit one complete tool call after closing any open block.
 * @param state - the current state.
 * @param call - the call's id, name, and raw JSON arguments.
 * @returns the next state and chunks.
 */
export function toolCallChunks(state, call) {
    const closed = closeOpenBlock(dropHeld(state));
    const index = closed.state.nextIndex;
    const id = call.id;
    return {
        state: { nextIndex: index + 1 },
        chunks: [
            ...closed.chunks,
            { type: 'block-start', index, blockType: 'tool-call' },
            { type: 'tool-call-delta', index, id, name: call.name, argumentsDelta: call.arguments },
            {
                type: 'block-end',
                index,
                block: { type: 'tool-call', id, name: call.name, arguments: call.arguments },
            },
        ],
    };
}

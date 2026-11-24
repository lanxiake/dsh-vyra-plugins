/**
 * Pure conversion from CLI output to the harness's indexed block stream.
 * @module dsh-vyra-agent-cli-manager/stream-blocks
 */
import type { StreamChunk } from '@deepseek-ai/dsh-llm';
type DeltaBlockType = 'text' | 'reasoning';
interface OpenBlock {
    readonly index: number;
    readonly blockType: DeltaBlockType;
    readonly text: string;
}
/** Block assembly position within one model step. */
export interface BlockState {
    readonly nextIndex: number;
    readonly open?: OpenBlock;
    /** Wordless text waiting to see whether real text follows; see {@link WORDLESS}. */
    readonly held?: string;
}
/** Result of one transition: the next state and the chunks to emit. */
export interface BlockTransition {
    readonly state: BlockState;
    readonly chunks: readonly StreamChunk[];
}
/** The state at the start of every step. */
export declare const EMPTY_BLOCKS: BlockState;
/**
 * Close the open text or reasoning block, if any. Held text is emitted here: at the
 * end of a turn it may be the whole answer.
 * @param state - the current state.
 * @returns a state with no open block and its chunks.
 */
export declare function closeOpenBlock(state: BlockState): BlockTransition;
/**
 * Append one delta, opening a new block when the type changes.
 * @param state - the current state.
 * @param blockType - the kind of text this delta belongs to.
 * @param text - the delta.
 * @returns the next state and chunks.
 */
export declare function appendDelta(state: BlockState, blockType: DeltaBlockType, text: string): BlockTransition;
/**
 * Emit one complete tool call after closing any open block.
 * @param state - the current state.
 * @param call - the call's id, name, and raw JSON arguments.
 * @returns the next state and chunks.
 */
export declare function toolCallChunks(state: BlockState, call: {
    readonly id: string;
    readonly name: string;
    readonly arguments: string;
}): BlockTransition;
export {};

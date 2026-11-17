/**
 * How a CLI turn's ending reads to the harness, and the chunks that close a harness step.
 * @module vyra-agent-cli-manager/session/outcomes
 */
import type { StopReason } from '@agentclientprotocol/sdk';
import { LlmError } from '@deepseek-ai/dsh-llm';
import type { StreamChunk } from '@deepseek-ai/dsh-llm';
import type { BlockState, BlockTransition } from '../stream-blocks.ts';
import type { ToolRecord } from '../tool-record.ts';
import type { PtcWrap } from './ptc-call.ts';
/** Extra fields every `finish` chunk carries so the harness can resume the native session. */
export type ReplayFields = Partial<Pick<Extract<StreamChunk, {
    type: 'finish';
}>, 'replayState'>>;
/** One step of reading, and whether it ends the harness step. */
export interface StepResult extends BlockTransition {
    readonly done: boolean;
}
/** Why a CLI turn ended, plus what it said before ending. */
export interface TurnOutcome {
    readonly stopReason: StopReason;
    /**
     * Text the CLI emitted in this step. ACP's `PromptResponse` has no error field,
     * so a refusal's real reason only arrives as `session/update` content.
     */
    readonly text: string;
    /** What the CLI attached to its answer, or left on stderr, when it streamed nothing. */
    readonly diagnostics?: string;
}
/** @returns the error's message, or its string form for anything thrown that is not an Error. */
export declare function errorMessage(error: unknown): string;
/**
 * What the CLI left behind when it ended without saying why in the stream.
 * @param meta - the response's `_meta`, when the CLI attached one.
 * @param stderr - the CLI's stderr tail at the moment the turn ended.
 * @returns a one-line reason, or '' when there is nothing to show.
 */
export declare function turnDiagnostics(meta: Readonly<Record<string, unknown>> | null | undefined, stderr: string | undefined): string;
/**
 * End a harness step at a tool call the harness should run as the mirror tool.
 * @param ptc - set in a PTC session, where the call goes out wrapped in `run_code`.
 * @returns the tool-call chunks followed by a `tool-calls` finish.
 */
export declare function toolCallStep(blocks: BlockState, record: ToolRecord, replay: ReplayFields, ptc?: PtcWrap): StepResult;
/**
 * End a harness step at the end of the CLI turn.
 * @returns the closing chunks followed by the turn's finish.
 */
export declare function turnEndStep(blocks: BlockState, end: TurnOutcome, label: string, replay: ReplayFields): StepResult;
/** @returns the turn's failure as the error the harness reports. */
export declare function turnFailure(error: Error, label: string): LlmError;

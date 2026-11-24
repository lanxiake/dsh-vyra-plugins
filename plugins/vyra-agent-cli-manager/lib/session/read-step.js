/**
 * Reading one harness step out of a CLI turn: text and reasoning stream through, and the
 * step ends at the next tool call or at the end of the turn.
 * @module dsh-vyra-agent-cli-manager/session/read-step
 */
import { appendDelta, closeOpenBlock, EMPTY_BLOCKS } from "../stream-blocks.js";
import { toolCallStep, turnDiagnostics, turnEndStep, turnFailure } from "./outcomes.js";
/**
 * Read until the next tool call or the end of the CLI turn.
 * @param source - the session being read.
 * @param signal - cancellation; aborting abandons the turn.
 * @yields the step's stream chunks, ending with `finish`.
 */
export async function* readStep(source, signal) {
    let blocks = EMPTY_BLOCKS;
    // A refusal's reason arrives as ordinary text; keep it so the finish can name it. Thinking
    // is left out: it is the model's working, already shown, and no explanation of a refusal.
    // So are this plugin's own notices, which would hide the reason the CLI attached.
    let text = '';
    while (source.hasWork()) {
        const event = await source.nextEvent(signal);
        if (event.type === 'text' && event.notice !== true)
            text += event.text;
        if (source.owesInput() && event.type === 'turn-end')
            continue;
        const step = applyEvent(source, blocks, event, text);
        blocks = step.state;
        yield* step.chunks;
        if (step.done)
            return;
    }
    if (source.owesInput())
        throw source.failure();
    const { chunks } = closeOpenBlock(blocks);
    const finish = { type: 'finish', reason: { kind: 'stop' }, ...source.replay() };
    yield* [...chunks, finish];
}
function applyEvent(source, blocks, event, detail) {
    switch (event.type) {
        case 'text':
        case 'reasoning':
            return { ...appendDelta(blocks, event.type, event.text), done: false };
        case 'tool-ready': {
            const record = source.handOff(event.acpId);
            return record === undefined
                ? { state: blocks, chunks: [], done: false }
                : toolCallStep(blocks, record, source.replay(), source.ptc);
        }
        case 'turn-end':
            return applyTurnEnd(source, blocks, event, detail);
        case 'failure':
            throw turnFailure(event.error, source.label);
    }
}
/**
 * Queued steering runs as the next CLI turn inside the same harness turn.
 *
 * The turn's usage is deliberately not reported. ACP gives one cumulative figure per CLI
 * turn, while the harness reads each step's usage as a single model request: speed would
 * divide the whole turn's output by the last step's time, and context occupancy would add
 * up every request's prompt. Showing nothing beats showing wrong numbers.
 */
function applyTurnEnd(source, blocks, end, detail) {
    if (source.hasWork())
        return { state: blocks, chunks: [], done: false };
    const outcome = {
        stopReason: end.stopReason,
        text: detail,
        diagnostics: turnDiagnostics(end.meta, end.stderr),
    };
    return turnEndStep(blocks, outcome, source.label, source.replay());
}

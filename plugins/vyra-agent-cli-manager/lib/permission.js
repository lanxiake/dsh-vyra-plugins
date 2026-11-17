/**
 * Maps a harness approval decision onto the options a CLI offered.
 * @module vyra-agent-cli-manager/permission
 */
/** The answer for a request nobody will decide on. */
export const CANCELLED = { outcome: { outcome: 'cancelled' } };
function selectFirst(options, kinds) {
    for (const kind of kinds) {
        const match = options.find((option) => option.kind === kind);
        if (match !== undefined)
            return { outcome: { outcome: 'selected', optionId: match.optionId } };
    }
    return undefined;
}
/**
 * Answer a CLI permission request. A harness approval covers one operation, so it
 * never selects `allow_always`: with no one-time option on offer, the safe answer is
 * no. `unavailable` means nobody could answer and is also a no, which fails closed.
 * @param outcome - the harness approval decision.
 * @param options - the options the CLI offered.
 * @returns the ACP response.
 */
export function permissionResponse(outcome, options) {
    const reject = selectFirst(options, ['reject_once', 'reject_always']) ?? CANCELLED;
    switch (outcome) {
        case 'allowed-once':
            return selectFirst(options, ['allow_once']) ?? reject;
        case 'rejected':
        case 'unavailable':
            return reject;
        case 'cancelled':
            return CANCELLED;
    }
}

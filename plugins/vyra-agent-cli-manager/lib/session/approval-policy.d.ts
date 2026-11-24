/**
 * DSH's access mode is the harness's stance on sessions it runs itself. A CLI session decides
 * for itself whether to ask, and the question it asks has to reach a person: under the "never
 * ask" stance the approval service answers it with a rejection without asking anyone, which
 * turns the CLI's own `Always Ask` into a silent failure. The stance is the user's setting for
 * the session, so it is only lifted while a CLI question is open, then put back.
 * @module dsh-vyra-agent-cli-manager/session/approval-policy
 */
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ApprovalPolicy } from '@deepseek-ai/dsh-user-approval';
type Session = Agent['session'];
/** The part of the harness's approval service this needs. */
export interface PolicyHolder {
    /** The policy this agent's session carries right now, if it overrides the default. */
    overrideOf?(session: Session): ApprovalPolicy | undefined;
}
/** Lifts a session's "never ask" stance for the CLI questions in flight, and restores it. */
export declare class CliAskPolicy {
    private readonly warn;
    /** Questions in flight per session whose stance this lifted. */
    private open;
    /** @param warn - reports a stance that could not be put back. */
    constructor(warn: (message: string) => void);
    /**
     * Run one CLI question with the session on "ask". Nothing changes unless a "never ask"
     * override is in force (the access mode's 完全权限); an older harness that cannot report
     * one keeps its default. Questions that overlap share one lift, and the last to settle
     * restores the stance. Both switches are session events, the harness's own record of a
     * policy change, so the log shows them.
     * @param approval - the harness's approval service.
     * @param agent - the agent the CLI asks on behalf of.
     * @param ask - sends the question to the approval service.
     * @returns the answer to the question.
     */
    asking<T>(approval: PolicyHolder, agent: Agent, ask: () => Promise<T>): Promise<T>;
    /** @returns whether this question runs under a lift that must be released. */
    private lift;
    private release;
}
export {};

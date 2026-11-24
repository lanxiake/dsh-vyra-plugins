/**
 * What to tell the user after a CLI fails to start. The default asks them to
 * install and log in, but an adapter pulled by `npx` can fail because npm left
 * its cache half-installed (a skipped optional dependency, an interrupted
 * download). Reinstalling globally does not help there: npx keeps reusing the
 * broken cache until that directory is deleted.
 * @module dsh-vyra-agent-cli-manager/session/start-hint
 */
/**
 * @param message - the startup error's text.
 * @returns the sentence to append to the startup failure.
 */
export declare function startHint(message: string): string;

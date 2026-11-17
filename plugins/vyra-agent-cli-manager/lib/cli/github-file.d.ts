/**
 * Read one text file out of a public GitHub repository.
 *
 * The contents API rather than a clone: a skill is a single small text file, and cloning a
 * repository to reach one of them downloads everything else with it and leaves a checkout to
 * clean up afterwards.
 *
 * Unauthenticated, which is deliberate. The rate limit is per IP and far above what pressing a
 * button once can spend; adding a token would mean asking every user for a credential so that a
 * rare request could be a little more generous, and a failure here is reported rather than
 * retried.
 * @module vyra-agent-cli-manager/cli/github-file
 */
/**
 * Read one file's text from a public repository.
 *
 * Every failure answers `undefined` rather than throwing, and the caller turns that into the
 * message it already has for "not found": from the user's side a 404, a rate limit, an offline
 * machine and a directory where a file was named are the same event — the skill is not there —
 * and the install path's job is to say which paths it tried, not to enumerate why each failed.
 *
 * @param repository - `owner/repo`.
 * @param path - the file's path inside the repository, POSIX-separated.
 * @returns the file's text, or undefined when it could not be read.
 */
export declare function fetchRepositoryFile(repository: string, path: string): Promise<string | undefined>;

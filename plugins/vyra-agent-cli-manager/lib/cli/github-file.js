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
/** How long one read may take. A panel waiting on a button press, not a background job. */
const TIMEOUT_MS = 20_000;
/** Largest file this plugin will read through the API, in bytes. */
const MAX_BYTES = 512 * 1024;
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
export async function fetchRepositoryFile(repository, path) {
    // The API takes the path as URL segments, so each part is encoded on its own: a skill
    // directory may hold spaces or `#`, and encoding the whole path would turn its separators
    // into `%2F` and address a file named after the whole path instead.
    const encoded = path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
    const url = `https://api.github.com/repos/${repository}/contents/${encoded}`;
    try {
        const response = await fetch(url, {
            headers: {
                // The API refuses a request without one, and names this plugin so a repository owner
                // can tell where the traffic came from.
                'user-agent': 'vyra-agent-cli-manager',
                accept: 'application/vnd.github+json',
                'x-github-api-version': '2022-11-28',
            },
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok)
            return undefined;
        const body = await response.json();
        if (typeof body !== 'object' || body === null)
            return undefined;
        const file = body;
        // A directory answers with an array instead of an object, and a symlink or submodule has no
        // content of its own; both are "not the file this asked for".
        if (file.type !== 'file' || typeof file.content !== 'string')
            return undefined;
        if (typeof file.size === 'number' && file.size > MAX_BYTES)
            return undefined;
        // The API wraps base64 at 60 characters per line, which `Buffer` tolerates, unlike `atob`.
        const text = Buffer.from(file.content, 'base64').toString('utf8');
        // A binary file decodes to replacement characters rather than failing; a SKILL.md that is
        // not text would be written out as mojibake, so it is refused here instead.
        return text.includes('�') ? undefined : text;
    }
    catch {
        return undefined;
    }
}

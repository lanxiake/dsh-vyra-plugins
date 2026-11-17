/**
 * Finds the models in a CLI's list that a newer version of the same family replaces.
 * CLIs list pinned older versions next to their current ones, Claude Code's "Opus 5"
 * beside "Opus 5.5" among them, with descriptions that do not say which is older; rows
 * that differ by a digit alone read like a duplicated list, and the menu leaves them out.
 * @module vyra-agent-cli-manager/model-versions
 */
const VERSION_PATTERN = /\d+(?:\.\d+)*/;
/** Stands in for the version, so names that differ only there share a family. */
const VERSION_SLOT = '\u0000';
/** The first number in a name is taken as its version, wherever it sits: "6.1 Sol", "GLM-5.3". */
function versioned(name) {
    const match = VERSION_PATTERN.exec(name);
    if (match === null)
        return [];
    const family = `${name.slice(0, match.index)}${VERSION_SLOT}${name.slice(match.index + match[0].length)}`;
    return [{ name, family, version: match[0].split('.').map(Number) }];
}
/** Compared part by part as numbers, so 5.10 is newer than 5.9; a missing part counts as 0. */
function isNewer(candidate, than) {
    const length = Math.max(candidate.length, than.length);
    const parts = Array.from({ length }, (_, index) => (candidate[index] ?? 0) - (than[index] ?? 0));
    return (parts.find((difference) => difference !== 0) ?? 0) > 0;
}
/**
 * Compare two dotted versions.
 *
 * Only numeric parts count, so a prerelease such as `2.1.0-rc.1` compares equal to `2.1.0`.
 * npm's `latest` tag is a release, so an installed prerelease of the same number reads as up
 * to date — the answer that keeps the overview from nagging about a version it cannot beat.
 * @param candidate - the version to test.
 * @param than - the version to compare it against.
 * @returns true when `candidate` is newer.
 */
export function isNewerVersion(candidate, than) {
    const parts = (text) => (VERSION_PATTERN.exec(text)?.[0] ?? '').split('.').map(Number);
    return isNewer(parts(candidate), parts(than));
}
/**
 * Find the names a newer version of the same family also appears among.
 * @param names - the display names of a CLI's models.
 * @returns those that are older versions.
 */
export function olderVersions(names) {
    const all = names.flatMap(versioned);
    const older = all.filter((entry) => all.some((other) => other.family === entry.family && isNewer(other.version, entry.version)));
    return new Set(older.map(({ name }) => name));
}

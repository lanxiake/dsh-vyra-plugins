/**
 * Finds the models in a CLI's list that a newer version of the same family replaces.
 * CLIs list pinned older versions next to their current ones, Claude Code's "Opus 5"
 * beside "Opus 5.5" among them, with descriptions that do not say which is older; rows
 * that differ by a digit alone read like a duplicated list, and the menu leaves them out.
 * @module vyra-agent-cli-manager/model-versions
 */
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
export declare function isNewerVersion(candidate: string, than: string): boolean;
/**
 * Find the names a newer version of the same family also appears among.
 * @param names - the display names of a CLI's models.
 * @returns those that are older versions.
 */
export declare function olderVersions(names: readonly string[]): ReadonlySet<string>;

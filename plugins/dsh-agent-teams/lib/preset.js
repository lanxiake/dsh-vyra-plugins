/**
 * Locally added: resolve an optional member agent preset against the live
 * roster, so a team member can run one of the presets installed by the Agent
 * manager (or any other preset bundle) instead of only a name and a persona.
 *
 * Kept as its own module with no host imports so the rule is testable without
 * a running Harness.
 * @module dsh-agent-teams/preset
 */

/**
 * Resolve a requested preset id.
 * @param ctx - the plugin context (reads `agentPresets` when mounted).
 * @param value - the requested preset id, possibly blank or not a string.
 * @returns the trimmed preset id, or undefined for no preset.
 * @throws when the registry is missing, the id is unknown, or the preset is broken.
 */
export async function resolveMemberPreset(ctx, value) {
    const presetId = typeof value === 'string' ? value.trim() : '';
    if (presetId === '')
        return undefined;
    const presets = typeof ctx.get === 'function' ? ctx.get('agentPresets') : undefined;
    if (presets === undefined)
        throw new Error('agent_preset requires the agent-preset registry; mount @deepseek-ai/dsh-agent-preset-registry in this profile');
    const roster = await presets.list();
    const preset = roster.find((entry) => entry.id === presetId);
    if (preset === undefined) {
        throw new Error(`unknown agent_preset "${presetId}" (available: ${roster.map((entry) => entry.id).join(', ') || 'none'})`);
    }
    if (preset.broken !== undefined) {
        throw new Error(`agent_preset "${presetId}" cannot compose a session: ${preset.broken}`);
    }
    return presetId;
}

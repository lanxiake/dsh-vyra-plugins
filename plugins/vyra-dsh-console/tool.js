const DESCRIPTION = [
  'Operate this DeepSeek Harness installation: read and change models, settings, plugins, skills and MCP servers, and switch the theme, layout and language of the running interface.',
  'Call action=console.actions first to list every supported action and whether it mutates anything.',
  'Authority-changing actions (sandbox mode, permission presets, approvals, credentials) are refused: ask the user to change those in the UI instead.',
].join(' ')

export function createConsoleTool(console_) {
  return {
    name: 'dsh_console',
    description: DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action id from action=console.actions, e.g. plugin.list.' },
        args: { type: 'object', description: 'Action-specific arguments.', additionalProperties: true },
        confirm: { type: 'boolean', description: 'Required for destructive actions when confirmDestructive is on.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    async execute(input) {
      return console_.dispatch(input?.action ?? '', input?.args ?? {})
    },
  }
}

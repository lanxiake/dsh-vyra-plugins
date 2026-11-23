import { createConsole } from './core.js'
import { createConsoleTool } from './tool.js'
import { pluginDomain } from './domains/plugin.js'

export const name = 'vyra-dsh-console'
export const inject = ['tools']

export function apply(ctx) {
  const console_ = createConsole(ctx, { plugin: pluginDomain })
  ctx.tools.register(createConsoleTool(console_))
  ctx.logger?.info?.(`vyra-dsh-console: ${console_.listActions().length} actions`)
}

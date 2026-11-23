import { createConsole } from './core.js'
import { createConsoleTool } from './tool.js'
import { pluginDomain } from './domains/plugin.js'
import { modelDomain } from './domains/model.js'
import { settingsDomain } from './domains/settings.js'
import { catalogDomain } from './domains/catalog.js'

export const name = 'vyra-dsh-console'
export const inject = ['tools']

export function apply(ctx) {
  // Every domain that backs a registered action must be wired here: the
  // dispatcher reports `no handler for domain "x"` for a registered action
  // whose domain is absent, which reads as a broken action rather than as a
  // missing service.
  const console_ = createConsole(ctx, {
    plugin: pluginDomain,
    model: modelDomain,
    settings: settingsDomain,
    catalog: catalogDomain,
  })
  ctx.tools.register(createConsoleTool(console_))
  ctx.logger?.info?.(`vyra-dsh-console: ${console_.listActions().length} actions`)
}

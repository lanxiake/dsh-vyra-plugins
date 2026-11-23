import { createConsole } from './core.js'

export const name = 'vyra-dsh-console'
export const inject = ['tools']

export function apply(ctx) {
  const console_ = createConsole(ctx)
  ctx.logger?.info?.(`vyra-dsh-console: ${console_.listActions().length} actions`)
}

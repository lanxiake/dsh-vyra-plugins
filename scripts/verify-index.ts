/**
 * Validate the generated index with the same parser a DSH client uses.
 *
 * `parseMarketIndex` is loaded from the sibling `dsh-Veyra` checkout's built
 * `plugin-market-index` output rather than from npm, so this repository stays
 * dependency-free and validation always matches the fork's current source.
 * Override the location with `DSH_SOURCE` when the checkout lives elsewhere.
 *
 * @module vyra-plugins/verify-index
 */

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

interface MarketIndexError extends Error {
  readonly path?: string
  readonly reason?: string
}

interface ValidatedIndex {
  readonly plugins: readonly { readonly name: string; readonly versions: readonly unknown[]; readonly metadata: { readonly category?: string } }[]
  readonly metadata: { readonly categories: Readonly<Record<string, unknown>> }
}

const root = resolve(import.meta.dirname, '..')
const sourceRoot = process.env.DSH_SOURCE ?? resolve(root, '..', 'dsh-Veyra')
const validatorEntry = resolve(sourceRoot, 'packages/util/plugin-market-index/lib/index.js')

const require = createRequire(import.meta.url)
const { parseMarketIndex } = require(validatorEntry) as {
  parseMarketIndex: (value: unknown, indexUrl: string) => ValidatedIndex
}

const value: unknown = JSON.parse(readFileSync(resolve(root, 'index/index.json'), 'utf8'))

let index: ValidatedIndex
try {
  index = parseMarketIndex(value, 'https://example.invalid/index.json')
} catch (error) {
  const failure = error as MarketIndexError
  console.error(`verify-index failed at ${failure.path ?? '(root)'}: ${failure.reason ?? failure.message}`)
  process.exit(1)
}

const failures: string[] = []
const declaredCategories = new Set(Object.keys(index.metadata.categories))

for (const plugin of index.plugins) {
  if (plugin.versions.length === 0) failures.push(`${plugin.name}: no versions`)
  const category = plugin.metadata.category
  if (category !== undefined && !declaredCategories.has(category)) {
    failures.push(`${plugin.name}: undeclared category ${JSON.stringify(category)}`)
  }
}

if (failures.length > 0) {
  console.error('verify-index failed:')
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}

console.log(`verify-index: ${index.plugins.length} plugin(s), ${declaredCategories.size} categor${declaredCategories.size === 1 ? 'y' : 'ies'} valid.`)

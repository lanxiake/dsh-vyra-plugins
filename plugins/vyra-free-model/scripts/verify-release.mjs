// Check that the commit this plugin's index addresses really serves this
// version.
//
//   node scripts/verify-release.mjs
//
// The jsDelivr entries in client.js are pinned to a commit, because a branch
// ref is cached for twelve hours and hands readers the previous release. That
// pin has a trap: the obvious commit — the one that carries the plugin's files
// — contains an index written *before* this version was published. Pinning it
// makes the plugin announce itself to nobody.
//
// So: whatever commit is pinned must list the version in package.json. Reads the
// index at that commit from jsDelivr and, as a fallback, from raw GitHub.
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const version = packageJson.version
const name = packageJson.name
const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

const pinned = /const VEYRA_COMMIT = '([0-9a-f]{40})'/.exec(client)?.[1]
if (pinned === undefined) {
  console.error('verify-release: client.js has no exact VEYRA_COMMIT')
  process.exit(1)
}

const urls = [
  `https://fastly.jsdelivr.net/gh/lanxiake/dsh-vyra-plugins@${pinned}/docs/index-github.json`,
  `https://raw.githubusercontent.com/lanxiake/dsh-vyra-plugins/${pinned}/docs/index-github.json`,
]

let problem = `no source answered for ${pinned}`
for (const url of urls) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), cache: 'no-store' })
    if (!response.ok) { problem = `${url} answered ${response.status}`; continue }
    const document = await response.json()
    const entry = (document?.plugins ?? []).find(item => item?.name === name)
    if (entry === undefined) { problem = `${url} has no entry for ${name}`; continue }
    const versions = (entry.versions ?? []).map(item => item.version)
    if (!versions.includes(version)) {
      problem = `${url} lists ${versions[0] ?? '(none)'} as newest; ${version} is not there. Pin the publish commit, not the plugin commit.`
      continue
    }
    console.log(`verify-release: ${name}@${version} is listed at ${pinned}`)
    console.log(`  pinned index newest: ${versions[0]}`)
    process.exit(0)
  } catch (error) {
    problem = `${url}: ${error?.message ?? error}`
  }
}

console.error(`verify-release FAILED: ${problem}`)
process.exit(1)
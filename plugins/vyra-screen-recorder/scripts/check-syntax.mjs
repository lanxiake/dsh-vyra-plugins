import { execFileSync } from 'node:child_process'

execFileSync(process.execPath, ['--check', 'index.js'], { stdio: 'inherit' })
execFileSync(process.execPath, ['--check', 'client.js'], { stdio: 'inherit' })
execFileSync(process.execPath, ['--check', 'scripts/build-client.mjs'], { stdio: 'inherit' })
console.log('syntax ok')

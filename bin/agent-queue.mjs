#!/usr/bin/env node
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const tsxPath = resolve(__dirname, '../node_modules/.bin/tsx')

// Re-exec with tsx so TypeScript resolves correctly
const { execFileSync } = createRequire(import.meta.url)('child_process')
execFileSync(tsxPath, [resolve(__dirname, '../src/index.ts'), ...process.argv.slice(2)], {
  stdio: 'inherit'
})

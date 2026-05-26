#!/usr/bin/env node
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const tsxPath = resolve(__dirname, '../node_modules/.bin/tsx')
const envPath = resolve(__dirname, '../.env')
const indexPath = resolve(__dirname, '../src/index.ts')

// --env-file loads vars before any JS runs, solving ESM import hoisting issue
const result = spawnSync(
  process.execPath,
  [`--env-file=${envPath}`, tsxPath, indexPath, ...process.argv.slice(2)],
  { stdio: 'inherit' }
)
process.exit(result.status ?? 0)

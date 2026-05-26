import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import os from 'os'
import type { RunState } from './types.js'

const DEFAULT_STATE_DIR = path.join(os.homedir(), '.agent-queue')
const STATE_FILE = 'runs.jsonl'

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
}

function stateFile(dir: string): string {
  return path.join(dir, STATE_FILE)
}

export async function writeRun(run: RunState, dir = DEFAULT_STATE_DIR): Promise<void> {
  await ensureDir(dir)
  const line = JSON.stringify(run) + '\n'
  await writeFile(stateFile(dir), line, { flag: 'a' })
}

export async function readRuns(dir = DEFAULT_STATE_DIR): Promise<RunState[]> {
  const file = stateFile(dir)
  if (!existsSync(file)) return []
  const content = await readFile(file, 'utf8')
  return content.trim().split('\n').filter(Boolean).map(l => JSON.parse(l) as RunState)
}

export async function updateRun(ticket: string, patch: Partial<RunState>, dir = DEFAULT_STATE_DIR): Promise<void> {
  const runs = await readRuns(dir)
  const updated = runs.map(r => r.ticket === ticket ? { ...r, ...patch } : r)
  await writeFile(stateFile(dir), updated.map(r => JSON.stringify(r)).join('\n') + '\n')
}

export async function activeRuns(dir = DEFAULT_STATE_DIR): Promise<RunState[]> {
  const runs = await readRuns(dir)
  return runs.filter(r => r.status === 'running')
}

import { writeRun, readRuns, updateRun } from '../state.js'
import type { RunState } from '../types.js'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

let tmpDir: string
beforeEach(() => { tmpDir = mkdtempSync(path.join(tmpdir(), 'aq-')) })
afterEach(() => { rmSync(tmpDir, { recursive: true }) })

const run: RunState = {
  ticket: 'TOOL-1',
  runtime: 'claude-docker',
  model: 'claude-sonnet-4-6',
  status: 'running',
  worktree: '/tmp/TOOL-1',
  branch: 'agent/TOOL-1',
  startedAt: '2026-05-26T18:00:00Z'
}

test('writeRun then readRuns returns the run', async () => {
  await writeRun(run, tmpDir)
  const runs = await readRuns(tmpDir)
  expect(runs).toHaveLength(1)
  expect(runs[0].ticket).toBe('TOOL-1')
})

test('updateRun changes status and finishedAt', async () => {
  await writeRun(run, tmpDir)
  await updateRun('TOOL-1', { status: 'done', pr: 'https://github.com/pr/1' }, tmpDir)
  const runs = await readRuns(tmpDir)
  expect(runs[0].status).toBe('done')
  expect(runs[0].pr).toBe('https://github.com/pr/1')
})

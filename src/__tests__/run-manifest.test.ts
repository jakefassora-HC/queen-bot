import { mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  buildRunManifest,
  runManifestPath,
  writeRunManifest
} from '../run-manifest.js'
import type { ExecutionContract } from '../types.js'

const contract: ExecutionContract = {
  ticketKey: 'AISOL-592',
  repo: 'Codefied/human-road-warrior',
  branch: 'agent/AISOL-592',
  worktreePath: '/Users/jake/.agent-queue/repos/.agent-worktrees/AISOL-592',
  autonomyLevel: 2,
  approvedAt: '2026-05-29T12:00:00.000Z',
  engine: 'claude',
  plan: {
    ticketKey: 'AISOL-592',
    goal: 'Show Sankey details.',
    context: [],
    acceptanceCriteria: ['Reasons visible.'],
    implementationNotes: [],
    verification: ['Run tests.'],
    risks: [],
    forbiddenActions: ['Do not merge.'],
    autonomyLevel: 2,
    localPlanPath: '/tmp/plans/Codefied/human-road-warrior/AISOL-592/plan.md'
  }
}

test('runManifestPath stores one tiny manifest beside the single plan file', () => {
  expect(runManifestPath(contract.plan.localPlanPath!)).toBe('/tmp/plans/Codefied/human-road-warrior/AISOL-592/manifest.json')
})

test('buildRunManifest keeps only workflow state needed to avoid losing place', () => {
  expect(buildRunManifest(contract, { status: 'running' })).toEqual({
    ticketKey: 'AISOL-592',
    repo: 'Codefied/human-road-warrior',
    branch: 'agent/AISOL-592',
    worktreePath: '/Users/jake/.agent-queue/repos/.agent-worktrees/AISOL-592',
    engine: 'claude',
    status: 'running',
    planPath: '/tmp/plans/Codefied/human-road-warrior/AISOL-592/plan.md',
    allowedWrites: ['comment'],
    startedAt: '2026-05-29T12:00:00.000Z'
  })
})

test('writeRunManifest writes compact JSON beside the plan', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'agent-queue-manifest-'))
  const planPath = path.join(root, 'plan.md')
  const output = writeRunManifest({
    ...contract,
    plan: { ...contract.plan, localPlanPath: planPath }
  }, { status: 'running' })

  expect(output).toBe(path.join(root, 'manifest.json'))
  expect(JSON.parse(readFileSync(output, 'utf8'))).toMatchObject({
    ticketKey: 'AISOL-592',
    engine: 'claude',
    status: 'running',
    planPath
  })
})

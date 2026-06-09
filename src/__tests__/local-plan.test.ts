import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { buildPlanFromTicket } from '../plan-command.js'
import {
  localPlanPath,
  renderLocalPlan,
  renderWorkGraphContinuity,
  workGraphContinuityPath,
  writeLocalPlan,
  writeWorkGraphContinuity,
  storyBrainPath,
  writeStoryBrain
} from '../local-plan.js'
import type { JiraTicket, StoryBrain } from '../types.js'

const ticket: JiraTicket = {
  id: '1',
  key: 'aisol-592',
  summary: 'Update SanKey to include all details on flow',
  description: 'User story and acceptance criteria live in Jira.',
  storyPoints: 5,
  issueType: 'Story',
  project: { key: 'AISOL', name: 'AI Solutions' },
  labels: ['repo:Codefied/human-road-warrior'],
  status: 'In Progress',
  repo: 'Codefied/human-road-warrior'
}

test('localPlanPath stores plans under the repo project and ticket directory', () => {
  expect(localPlanPath(ticket, '/tmp/plans')).toBe('/tmp/plans/Codefied/human-road-warrior/AISOL-592/plan.md')
})

test('localPlanPath falls back to a Jira holding area when repo project is unavailable', () => {
  expect(localPlanPath('aisol-592', '/tmp/plans')).toBe('/tmp/plans/jira/AISOL/AISOL-592/plan.md')
})

test('localPlanPath rejects unsafe ticket keys', () => {
  expect(() => localPlanPath('../AISOL-592', '/tmp/plans')).toThrow('Invalid Jira ticket key')
})

test('renderLocalPlan creates a detailed local markdown plan without Jira comments', () => {
  const plan = buildPlanFromTicket(ticket)
  const markdown = renderLocalPlan(ticket, plan)

  expect(markdown).toContain('# AISOL-592 Agent Q Full Plan')
  expect(markdown).toContain('repo: Codefied/human-road-warrior')
  expect(markdown).toContain('## Super PRD')
  expect(markdown).toContain('## Execution Notes')
  expect(markdown).toContain('## Source Jira Context')
  expect(markdown).not.toContain('## Comments')
})

test('writeLocalPlan writes the local markdown plan and returns its path', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'agent-queue-plans-'))
  const plan = buildPlanFromTicket(ticket)

  const writtenPath = writeLocalPlan(ticket, plan, root)

  expect(writtenPath).toBe(path.join(root, 'Codefied', 'human-road-warrior', 'AISOL-592', 'plan.md'))
  expect(readFileSync(writtenPath, 'utf8')).toContain('# AISOL-592 Agent Q Full Plan')
})

describe('storyBrainPath', () => {
  it('returns story.md under the parent ticket key directory', () => {
    const testTicket = { key: 'AISOL-651', summary: 'Story', repo: 'Codefied/AI-Analysts' } as JiraTicket
    const p = storyBrainPath(testTicket, '/tmp/plans')
    expect(p).toBe('/tmp/plans/Codefied/AI-Analysts/AISOL-651/story.md')
  })

  it('accepts a plain string key', () => {
    const p = storyBrainPath('AISOL-651', '/tmp/plans')
    expect(p).toMatch(/AISOL-651\/story\.md$/)
  })
})

describe('writeStoryBrain', () => {
  it('writes a story.md file and returns the path', () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'aq-test-'))
    try {
      const testTicket = { key: 'AISOL-651', summary: 'Story', repo: 'Codefied/AI-Analysts' } as JiraTicket
      const brain: StoryBrain = {
        parentKey: 'AISOL-651',
        summary: 'Auto-sync AI Toolshed',
        goal: { why: 'Test why', constraints: [], nonGoals: [], successCriteria: [] },
        taskGraph: [{ key: 'AISOL-652', summary: 'DB schema', done: false }],
        planSections: [{ taskKey: 'AISOL-652', taskSummary: 'DB schema', content: 'Step 1.' }],
        worktrees: [],
        proof: [],
        status: 'pending',
      }
      const written = writeStoryBrain(testTicket, brain, tmpDir)
      expect(written).toMatch(/story\.md$/)
      expect(readFileSync(written, 'utf8')).toContain('# Story AISOL-651')
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('renderWorkGraphContinuity', () => {
  it('renders compact parent continuity with waves, lanes, blockers, and local plan paths', () => {
    const markdown = renderWorkGraphContinuity({
      parentKey: 'QUEEN-101',
      summary: 'Queen WorkGraph continuity',
      projectGoal: 'Coordinate the Queen rollout without stuffing every worker prompt.',
      globalConstraints: ['Keep one plan.md per ticket'],
      decisions: ['Workers read the shared workgraph before local implementation'],
      waves: [
        { name: 'Wave 0', goal: 'Foundation', lanes: ['backend', 'tests'] },
        { name: 'Wave 1', goal: 'Worker execution', lanes: ['worker'] }
      ],
      tasks: [
        {
          key: 'QUEEN-102',
          summary: 'Create continuity renderer',
          wave: 'Wave 0',
          lane: 'backend',
          blockers: ['QUEEN-103'],
          localPlanPath: '/tmp/plans/Codefied/agent-queue/QUEEN-102/plan.md'
        },
        {
          key: 'QUEEN-103',
          summary: 'Verify compact prompt handoff',
          wave: 'Wave 1',
          lane: 'worker',
          blockers: [],
          localPlanPath: '/tmp/plans/Codefied/agent-queue/QUEEN-103/plan.md'
        }
      ]
    })

    expect(markdown).toContain('# WorkGraph QUEEN-101: Queen WorkGraph continuity')
    expect(markdown).toContain('## Wave Map')
    expect(markdown).toContain('- Wave 0: Foundation (lanes: backend, tests)')
    expect(markdown).toContain('lane: backend')
    expect(markdown).toContain('blockers: QUEEN-103')
    expect(markdown).toContain('plan: /tmp/plans/Codefied/agent-queue/QUEEN-102/plan.md')
    expect(markdown).toContain('## Proof Summary')
    expect(markdown).toContain('- pending')
    expect(markdown.split(/\s+/).length).toBeLessThan(180)
  })
})

describe('writeWorkGraphContinuity', () => {
  it('writes one shared workgraph file under the parent directory', () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'aq-workgraph-'))
    try {
      const parent = { key: 'QUEEN-101', summary: 'Queen', repo: 'Codefied/agent-queue' } as JiraTicket
      const written = writeWorkGraphContinuity(parent, {
        parentKey: 'QUEEN-101',
        summary: 'Queen',
        projectGoal: 'Ship continuity',
        tasks: [
          {
            key: 'QUEEN-102',
            summary: 'Local plan',
            wave: 'Wave 0',
            lane: 'tests',
            localPlanPath: path.join(tmpDir, 'Codefied', 'agent-queue', 'QUEEN-102', 'plan.md')
          }
        ]
      }, tmpDir)

      expect(written).toBe(workGraphContinuityPath(parent, tmpDir))
      expect(written).toBe(path.join(tmpDir, 'Codefied', 'agent-queue', 'QUEEN-101', 'workgraph.md'))
      expect(readFileSync(written, 'utf8')).toContain('plan.md')
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

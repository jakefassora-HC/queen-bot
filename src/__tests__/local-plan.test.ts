import { mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { buildPlanFromTicket } from '../plan-command.js'
import { localPlanPath, renderLocalPlan, writeLocalPlan } from '../local-plan.js'
import type { JiraTicket } from '../types.js'

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

test('localPlanPath stores plans under a deterministic project and ticket directory', () => {
  expect(localPlanPath(ticket, '/tmp/plans')).toBe('/tmp/plans/AISOL/AISOL-592/plan.md')
})

test('localPlanPath falls back to the ticket key prefix when Jira project is unavailable', () => {
  expect(localPlanPath('aisol-592', '/tmp/plans')).toBe('/tmp/plans/AISOL/AISOL-592/plan.md')
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

  expect(writtenPath).toBe(path.join(root, 'AISOL', 'AISOL-592', 'plan.md'))
  expect(readFileSync(writtenPath, 'utf8')).toContain('# AISOL-592 Agent Q Full Plan')
})

import { mkdirSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { renderJiraPlan } from '../jira-plan.js'
import { localPlanPath } from '../local-plan.js'
import { preflightExecutionTicket } from '../preflight.js'
import type { JiraTicket } from '../types.js'

function plannedTicket(overrides: Partial<JiraTicket> = {}): JiraTicket {
  const ticket: JiraTicket = {
    id: '1',
    key: 'AISOL-465',
    summary: 'Handoff docs',
    description: '',
    storyPoints: 3,
    issueType: 'Story',
    labels: ['repo:jakefassora-HC/queen-bot'],
    status: 'In Progress',
    repo: 'jakefassora-HC/queen-bot',
    ...overrides
  }
  ticket.description = renderJiraPlan({
    ticketKey: ticket.key,
    goal: 'Create handoff docs.',
    context: ['Roadwarrior onboarding is scattered.'],
    acceptanceCriteria: ['A teammate can follow setup.'],
    implementationNotes: ['Use existing docs patterns.'],
    verification: ['Run markdown checks.'],
    risks: ['Docs can go stale.'],
    autonomyLevel: 2,
    forbiddenActions: ['Do not merge.', 'Do not deploy.'],
    localPlanPath: localPlanPath(ticket, '/tmp/plans')
  })
  return ticket
}

test('preflight blocks execution when the local full plan is missing', () => {
  const result = preflightExecutionTicket(plannedTicket(), { localPlanExists: () => false, repoExists: () => true })

  expect(result.ok).toBe(false)
  expect(result.blockers[0].message).toContain('local plan missing')
  expect(result.blockers[0].fix).toContain('agent-queue plan AISOL-465 --write')
})

test('preflight allows a small planned ticket when required files exist', () => {
  const result = preflightExecutionTicket(plannedTicket(), { localPlanExists: () => true, repoExists: () => true })

  expect(result.ok).toBe(true)
  expect(result.blockers).toEqual([])
})

test('preflight blocks 8 point work without linked child work', () => {
  const result = preflightExecutionTicket(plannedTicket({ storyPoints: 8 }), { localPlanExists: () => true, repoExists: () => true })

  expect(result.ok).toBe(false)
  expect(result.blockers[0].message).toContain('8+ point ticket needs linked child')
})

test('preflight blocks 13 point parent work from direct execution', () => {
  const result = preflightExecutionTicket(plannedTicket({
    storyPoints: 13,
    issueLinks: [{ key: 'AISOL-601', summary: 'Phase 1 child', type: 'relates', direction: 'outward' }]
  }), { localPlanExists: () => true, repoExists: () => true })

  expect(result.ok).toBe(false)
  expect(result.blockers[0].message).toContain('13+ point ticket should stay parent')
})

test('preflight marks repo checkout as warning, not blocker', () => {
  const result = preflightExecutionTicket(plannedTicket(), { localPlanExists: () => true, repoExists: () => false })

  expect(result.ok).toBe(true)
  expect(result.warnings[0].message).toContain('local repo checkout not found')
})

test('preflight detects local plan files by default', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'agent-queue-preflight-'))
  const ticket = plannedTicket()
  const planPath = localPlanPath(ticket, root)
  mkdirSync(path.dirname(planPath), { recursive: true })

  const result = preflightExecutionTicket({
    ...ticket,
    description: ticket.description.replace(localPlanPath(ticket, '/tmp/plans'), planPath)
  })

  expect(result.blockers.map(item => item.message).join('\n')).toContain('local plan missing')
})

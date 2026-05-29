import {
  EXECUTION_APPROVAL_PHRASE,
  buildExecutionBranch,
  buildExecutionContract,
  formatExecutionPreview,
  hasExecutionApproval,
  parseExecuteReadyArgs
} from '../execution-command.js'
import { renderJiraPlan } from '../jira-plan.js'
import { localPlanPath } from '../local-plan.js'
import type { JiraTicket } from '../types.js'

const plannedTicket: JiraTicket = {
  id: '1',
  key: 'AISOL-465',
  summary: 'Handoff docs',
  description: renderJiraPlan({
    ticketKey: 'AISOL-465',
    goal: 'Create handoff docs.',
    context: ['Roadwarrior onboarding is scattered.'],
    acceptanceCriteria: ['A teammate can follow setup.'],
    implementationNotes: ['Use existing docs patterns.'],
    verification: ['Run markdown checks.'],
    risks: ['Docs can go stale.'],
    autonomyLevel: 2,
    forbiddenActions: ['Do not merge.', 'Do not deploy.'],
    localPlanPath: localPlanPath({
      id: '1',
      key: 'AISOL-465',
      summary: 'Handoff docs',
      description: '',
      storyPoints: null,
      issueType: 'Story',
      labels: [],
      status: 'In Progress',
      repo: 'jakefassora-HC/queen-bot'
    })
  }),
  storyPoints: null,
  issueType: 'Story',
  labels: ['repo:jakefassora-HC/queen-bot'],
  status: 'In Progress',
  repo: 'jakefassora-HC/queen-bot'
}

test('buildExecutionBranch uses agent ticket branch', () => {
  expect(buildExecutionBranch('AISOL-465')).toBe('agent/AISOL-465')
})

test('parseExecuteReadyArgs supports preview and start modes', () => {
  expect(parseExecuteReadyArgs(['AISOL-465'])).toEqual({ selections: ['AISOL-465'], start: false, verbose: false })
  expect(parseExecuteReadyArgs(['AISOL-465', '--start'])).toEqual({ selections: ['AISOL-465'], start: true, verbose: false })
  expect(parseExecuteReadyArgs(['AISOL-465', '--verbose'])).toEqual({ selections: ['AISOL-465'], start: false, verbose: true })
})

test('execution approval requires exact phrase', () => {
  expect(EXECUTION_APPROVAL_PHRASE).toBe('APPROVE EXECUTION')
  expect(hasExecutionApproval('APPROVE EXECUTION')).toBe(true)
  expect(hasExecutionApproval('yes')).toBe(false)
})

test('buildExecutionContract requires a ready Agent Q plan and repo', () => {
  const result = buildExecutionContract(plannedTicket, { localPlanExists: () => true, repoExists: () => true })

  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.reason)
  expect(result.contract.ticketKey).toBe('AISOL-465')
  expect(result.contract.branch).toBe('agent/AISOL-465')
  expect(result.contract.repo).toBe('jakefassora-HC/queen-bot')
})

test('buildExecutionContract rejects missing plans', () => {
  const result = buildExecutionContract({ ...plannedTicket, description: '' }, { localPlanExists: () => true, repoExists: () => true })

  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('expected rejection')
  expect(result.reason).toContain('Agent Q Plan')
})

test('buildExecutionContract rejects plan key mismatches', () => {
  const result = buildExecutionContract({
    ...plannedTicket,
    description: plannedTicket.description.replace('Ticket: AISOL-465', 'Ticket: AISOL-999')
  }, { localPlanExists: () => true, repoExists: () => true })

  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('expected rejection')
  expect(result.reason).toContain('mismatch')
})

test('buildExecutionContract rejects non-executable autonomy levels', () => {
  const result = buildExecutionContract({
    ...plannedTicket,
    description: plannedTicket.description.replace('Autonomy Level: 2', 'Autonomy Level: 4')
  }, { localPlanExists: () => true, repoExists: () => true })

  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('expected rejection')
  expect(result.reason).toContain('autonomy level 4')
})

test('buildExecutionContract rejects missing plan sections even when headings exist', () => {
  const result = buildExecutionContract({
    ...plannedTicket,
    description: plannedTicket.description.replace('- A teammate can follow setup.', '- None')
  }, { localPlanExists: () => true, repoExists: () => true })

  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('expected rejection')
  expect(result.reason).toContain('acceptance criteria')
})

test('buildExecutionContract rejects missing local full plans', () => {
  const result = buildExecutionContract(plannedTicket, { localPlanExists: () => false, repoExists: () => true })

  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('expected rejection')
  expect(result.reason).toContain('local plan missing')
})

test('buildExecutionContract blocks broad 13+ point parent work', () => {
  const result = buildExecutionContract({
    ...plannedTicket,
    storyPoints: 13,
    issueLinks: [{ key: 'AISOL-601', summary: 'Phase 1 child', type: 'relates', direction: 'outward' }]
  }, { localPlanExists: () => true, repoExists: () => true })

  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('expected rejection')
  expect(result.reason).toContain('13+ point ticket should stay parent')
})

test('buildExecutionContract allows 8 point work when it has linked child work', () => {
  const result = buildExecutionContract({
    ...plannedTicket,
    storyPoints: 8,
    issueLinks: [{ key: 'AISOL-601', summary: 'Phase 1 child', type: 'relates', direction: 'outward' }]
  }, { localPlanExists: () => true, repoExists: () => true })

  expect(result.ok).toBe(true)
})

test('formatExecutionPreview is compact by default', () => {
  const ready = buildExecutionContract(plannedTicket, { localPlanExists: () => true, repoExists: () => false })
  if (!ready.ok) throw new Error(ready.reason)

  const output = formatExecutionPreview([ready.contract], [{ ticketKey: 'AISOL-999', reason: 'missing plan', fix: 'agent-queue plan AISOL-999 --write' }], { warnings: ready.warnings })

  expect(output).toContain('Queen Bot execution preview')
  expect(output).toContain('AISOL-465')
  expect(output).toContain('agent/AISOL-465')
  expect(output).toContain('AISOL-999')
  expect(output).toContain('missing plan')
  expect(output).toContain('fix: agent-queue plan AISOL-999 --write')
  expect(output).toContain('Warnings:')
  expect(output).toContain('local repo checkout not found')
  expect(output).toContain('Add --verbose to show the full cmux command')
  expect(output).not.toContain('claude --name')
})

test('formatExecutionPreview can show verbose cmux command when requested', () => {
  const ready = buildExecutionContract(plannedTicket, { localPlanExists: () => true, repoExists: () => true })
  if (!ready.ok) throw new Error(ready.reason)

  const output = formatExecutionPreview([ready.contract], [], { verbose: true })

  expect(output).toContain('cmux:')
  expect(output).toContain('claude --name')
})

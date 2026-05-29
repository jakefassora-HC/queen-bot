import {
  EXECUTION_APPROVAL_PHRASE,
  buildExecutionBranch,
  buildExecutionContract,
  formatExecutionPreview,
  hasExecutionApproval,
  parseExecuteReadyArgs
} from '../execution-command.js'
import { renderJiraPlan } from '../jira-plan.js'
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
    forbiddenActions: ['Do not merge.', 'Do not deploy.']
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
  const result = buildExecutionContract(plannedTicket)

  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.reason)
  expect(result.contract.ticketKey).toBe('AISOL-465')
  expect(result.contract.branch).toBe('agent/AISOL-465')
  expect(result.contract.repo).toBe('jakefassora-HC/queen-bot')
})

test('buildExecutionContract rejects missing plans', () => {
  const result = buildExecutionContract({ ...plannedTicket, description: '' })

  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('expected rejection')
  expect(result.reason).toContain('Agent Q Plan')
})

test('buildExecutionContract rejects plan key mismatches', () => {
  const result = buildExecutionContract({
    ...plannedTicket,
    description: plannedTicket.description.replace('Ticket: AISOL-465', 'Ticket: AISOL-999')
  })

  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('expected rejection')
  expect(result.reason).toContain('mismatch')
})

test('buildExecutionContract rejects non-executable autonomy levels', () => {
  const result = buildExecutionContract({
    ...plannedTicket,
    description: plannedTicket.description.replace('Autonomy Level: 2', 'Autonomy Level: 4')
  })

  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('expected rejection')
  expect(result.reason).toContain('autonomy level 4')
})

test('buildExecutionContract rejects missing plan sections even when headings exist', () => {
  const result = buildExecutionContract({
    ...plannedTicket,
    description: plannedTicket.description.replace('- A teammate can follow setup.', '- None')
  })

  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('expected rejection')
  expect(result.reason).toContain('acceptance criteria')
})

test('formatExecutionPreview is compact by default', () => {
  const ready = buildExecutionContract(plannedTicket)
  if (!ready.ok) throw new Error(ready.reason)

  const output = formatExecutionPreview([ready.contract], [{ ticketKey: 'AISOL-999', reason: 'missing plan' }])

  expect(output).toContain('Queen Bot execution preview')
  expect(output).toContain('AISOL-465')
  expect(output).toContain('agent/AISOL-465')
  expect(output).toContain('AISOL-999')
  expect(output).toContain('missing plan')
  expect(output).toContain('Add --verbose to show the full cmux command')
  expect(output).not.toContain('claude --name')
})

test('formatExecutionPreview can show verbose cmux command when requested', () => {
  const ready = buildExecutionContract(plannedTicket)
  if (!ready.ok) throw new Error(ready.reason)

  const output = formatExecutionPreview([ready.contract], [], { verbose: true })

  expect(output).toContain('cmux:')
  expect(output).toContain('claude --name')
})

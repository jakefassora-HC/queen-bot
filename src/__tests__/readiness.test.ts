import { scoreTicketReadiness } from '../readiness.js'
import type { JiraTicket } from '../types.js'

const baseTicket: JiraTicket = {
  id: '1',
  key: 'AISOL-465',
  summary: 'Handoff Documentation or Onboarding?',
  description: '',
  storyPoints: null,
  issueType: 'Story',
  labels: [],
  status: 'In Progress'
}

test('empty Jira ticket gets low readiness with missing plan reasons', () => {
  const readiness = scoreTicketReadiness(baseTicket)

  expect(readiness.ticketKey).toBe('AISOL-465')
  expect(readiness.score).toBeLessThan(40)
  expect(readiness.band).toBe('needs-planning')
  expect(readiness.missing).toContain('goal')
  expect(readiness.missing).toContain('acceptance criteria')
  expect(readiness.canExecute).toBe(false)
})

test('planned ticket with repo and verification is executable', () => {
  const ticket: JiraTicket = {
    ...baseTicket,
    description: [
      '## Agent Q Plan',
      'Ticket: AISOL-465',
      'Autonomy Level: 2',
      '',
      '### Goal',
      'Create onboarding handoff docs.',
      '',
      '### Context',
      '- Roadwarrior onboarding currently lives in scattered comments.',
      '',
      '### Acceptance Criteria',
      '- New teammate can follow setup steps.',
      '',
      '### Verification',
      '- Run markdown lint and check links.',
      '',
      '### Forbidden Actions',
      '- Do not merge or deploy.'
    ].join('\n'),
    labels: ['repo:jakefassora-HC/queen-bot'],
    repo: 'jakefassora-HC/queen-bot'
  }

  const readiness = scoreTicketReadiness(ticket)

  expect(readiness.score).toBeGreaterThanOrEqual(80)
  expect(readiness.band).toBe('ready')
  expect(readiness.canExecute).toBe(true)
  expect(readiness.missing).toEqual([])
})

test('loose planning words do not count as an approved Agent Q plan', () => {
  const readiness = scoreTicketReadiness({
    ...baseTicket,
    description: [
      'Goal: update docs',
      'Context: scattered',
      'Acceptance Criteria: docs exist',
      'Verification: check links',
      'Autonomy Level: 2',
      'Forbidden Actions: no deploy'
    ].join('\n'),
    repo: 'jakefassora-HC/queen-bot',
    labels: ['repo:jakefassora-HC/queen-bot']
  })

  expect(readiness.canExecute).toBe(false)
  expect(readiness.band).toBe('needs-planning')
  expect(readiness.missing).toContain('Agent Q Plan')
})

test('rich Jira description raises planning readiness even before Agent Q plan approval', () => {
  const readiness = scoreTicketReadiness({
    ...baseTicket,
    description: [
      'Goal: update the onboarding flow.',
      'Context: users cannot tell how to complete setup.',
      'Acceptance Criteria: new teammate can follow the ticket and complete setup.',
      'Verification: run tests and manually check the onboarding path.',
      'Autonomy Level: 2',
      'Forbidden Actions: do not merge or deploy.'
    ].join('\n'),
    repo: 'jakefassora-HC/queen-bot',
    parent: { key: 'AISOL-97', summary: 'Roadwarrior' },
    subtasks: [{ key: 'AISOL-601', summary: 'Document setup', status: 'To Do' }],
    issueLinks: [{ key: 'AISOL-602', summary: 'Related auth issue', type: 'relates', direction: 'outward' }],
    labels: ['repo:jakefassora-HC/queen-bot']
  })

  expect(readiness.score).toBeGreaterThanOrEqual(80)
  expect(readiness.canExecute).toBe(false)
  expect(readiness.missing).toContain('Agent Q Plan')
  expect(readiness.strengths).toContain('subtasks')
  expect(readiness.strengths).toContain('linked work items')
})

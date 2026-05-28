import { formatQueenDashboard, formatReadinessQueue } from '../readiness-command.js'
import type { JiraTicket } from '../types.js'

test('formatReadinessQueue shows score and execution guess', () => {
  const tickets: JiraTicket[] = [{
    id: '1',
    key: 'AISOL-465',
    summary: 'Handoff Documentation or Onboarding?',
    description: '',
    storyPoints: null,
    issueType: 'Story',
    labels: [],
    status: 'In Progress'
  }]

  const output = formatReadinessQueue(tickets)

  expect(output).toContain('AISOL-465')
  expect(output).toContain('%')
  expect(output).toContain('needs-planning')
  expect(output).toContain('Missing:')
})

test('formatQueenDashboard renders a human-friendly checkbox dashboard', () => {
  const tickets: JiraTicket[] = [{
    id: '1',
    key: 'AISOL-465',
    summary: 'Handoff Documentation or Onboarding?',
    description: '',
    storyPoints: null,
    issueType: 'Story',
    labels: [],
    status: 'In Progress',
    parent: { key: 'AISOL-97', summary: 'Roadwarrior' }
  }]

  const output = formatQueenDashboard(tickets)

  expect(output).toContain('# Queen Bot')
  expect(output).toContain('Roadwarrior: 1')
  expect(output).toContain('## Roadwarrior (1 shown, 0 ready)')
  expect(output).toContain('- [ ] 1. AISOL-465')
  expect(output).not.toContain('┌')
  expect(output).toContain('Reply with a number/key')
})

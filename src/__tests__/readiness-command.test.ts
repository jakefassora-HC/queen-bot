import { formatReadinessQueue } from '../readiness-command.js'
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

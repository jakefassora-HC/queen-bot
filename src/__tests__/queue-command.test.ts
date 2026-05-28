import { formatQueue, formatTicketDetails, resolveTicketSelection } from '../queue-command.js'
import type { JiraTicket } from '../types.js'

const tickets: JiraTicket[] = [
  {
    id: '1',
    key: 'AISOL-592',
    summary: 'Update SanKey to include all details on flow',
    description: 'Show the full lead flow.',
    storyPoints: null,
    issueType: 'Story',
    parent: { key: 'AISOL-97', summary: 'Roadwarrior' },
    labels: ['repo:Codefied/road-warrior'],
    status: 'In Progress',
    repo: 'Codefied/road-warrior'
  },
  {
    id: '2',
    key: 'AISOL-540',
    summary: 'Onboarding schema update broke sign in',
    description: '',
    storyPoints: 8,
    issueType: 'Bug',
    labels: [],
    status: 'To Do'
  }
]

test('formatQueue shows Jira metadata without invented sizes', () => {
  const output = formatQueue(tickets)

  expect(output).toContain('1. AISOL-592  Story  In Progress  points: none')
  expect(output).toContain('parent: AISOL-97 Roadwarrior')
  expect(output).toContain('2. AISOL-540  Bug  To Do  points: 8')
  expect(output).not.toContain('small')
})

test('resolveTicketSelection accepts one-based indexes', () => {
  expect(resolveTicketSelection(tickets, '1')?.key).toBe('AISOL-592')
  expect(resolveTicketSelection(tickets, '2')?.key).toBe('AISOL-540')
  expect(resolveTicketSelection(tickets, '0')).toBeNull()
})

test('resolveTicketSelection accepts issue keys case-insensitively', () => {
  expect(resolveTicketSelection(tickets, 'aisol-540')?.key).toBe('AISOL-540')
  expect(resolveTicketSelection(tickets, 'NOPE-1')).toBeNull()
})

test('formatTicketDetails provides Claude-ready context without spawning Claude', () => {
  const output = formatTicketDetails(tickets[0])

  expect(output).toContain('# AISOL-592 Update SanKey to include all details on flow')
  expect(output).toContain('- Parent: AISOL-97 Roadwarrior')
  expect(output).toContain('- Repo label: Codefied/road-warrior')
  expect(output).toContain('Show the full lead flow.')
  expect(output).toContain('Do not launch a nested Claude process')
})

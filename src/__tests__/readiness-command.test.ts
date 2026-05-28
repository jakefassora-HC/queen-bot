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
  expect(output).toContain('## Current Sprint (1 tickets, 0 ready)')
  expect(output).toContain('### Roadwarrior (1 ticket, 0 ready)')
  expect(output).toContain('- [ ] 1. AISOL-465')
  expect(output).not.toContain('┌')
  expect(output).toContain('Reply with a number/key')
})

test('formatQueenDashboard surfaces richer Jira details in ticket rows', () => {
  const tickets: JiraTicket[] = [{
    id: '1',
    key: 'AISOL-592',
    summary: 'Update SanKey to include all details on flow',
    description: 'User story\nAs a user, I want the Sankey to explain each stage.\n\nContext\nCurrent flow is too thin.\n\nAcceptance criteria\n- Include kicked out reasons.',
    storyPoints: null,
    issueType: 'Story',
    labels: [],
    status: 'In Progress',
    parent: { key: 'AISOL-97', summary: 'Roadwarrior' },
    components: ['Sankey'],
    fixVersions: ['v2'],
    priority: 'High'
  }]

  const output = formatQueenDashboard(tickets)

  expect(output).toContain('priority: High')
  expect(output).toContain('components: Sankey')
  expect(output).toContain('fix: v2')
})

test('formatQueenDashboard shows every ticket by default', () => {
  const tickets: JiraTicket[] = Array.from({ length: 9 }, (_, index) => ({
    id: String(index + 1),
    key: `AISOL-${index + 1}`,
    summary: `Ticket ${index + 1}`,
    description: '',
    storyPoints: null,
    issueType: 'Story',
    labels: [],
    status: 'To Do',
    parent: { key: 'AISOL-97', summary: 'Roadwarrior' }
  }))

  const output = formatQueenDashboard(tickets)

  expect(output).toContain('- [ ] 9. AISOL-9')
  expect(output).not.toContain('hidden')
})

test('formatQueenDashboard separates current sprint from backlog before epic groups', () => {
  const tickets: JiraTicket[] = [
    {
      id: '1',
      key: 'AISOL-1',
      summary: 'Active work',
      description: '',
      storyPoints: null,
      issueType: 'Story',
      labels: [],
      status: 'In Progress',
      sprint: { name: 'Sprint 15', state: 'active' },
      parent: { key: 'AISOL-97', summary: 'Roadwarrior' }
    },
    {
      id: '2',
      key: 'AISOL-2',
      summary: 'Later work',
      description: '',
      storyPoints: null,
      issueType: 'Story',
      labels: [],
      status: 'To Do',
      parent: { key: 'AISOL-263', summary: 'AI Toolshed' }
    }
  ]

  const output = formatQueenDashboard(tickets)

  expect(output.indexOf('## Current Sprint')).toBeLessThan(output.indexOf('## Backlog'))
  expect(output).toContain('### Roadwarrior (1 ticket, 0 ready)')
  expect(output).toContain('### AI Toolshed (1 ticket, 0 ready)')
})

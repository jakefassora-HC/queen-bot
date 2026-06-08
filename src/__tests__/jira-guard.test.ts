import {
  assertJiraWriteAllowedForTicket,
  isJiraWriteAllowedForTicket
} from '../jira-guard.js'
import type { JiraTicket } from '../types.js'

function ticket(overrides: Partial<JiraTicket> = {}): JiraTicket {
  return {
    id: '1',
    key: 'AISOL-592',
    summary: 'Update Sankey details',
    description: '',
    storyPoints: 3,
    issueType: 'Story',
    labels: [],
    status: 'To Do',
    ...overrides
  }
}

test('Jira write guard allows tickets assigned to the configured Jira email', () => {
  const allowed = isJiraWriteAllowedForTicket(ticket({
    assignee: { displayName: 'Jake Fassora', emailAddress: 'jake.fassora@housecallpro.com' }
  }), { email: 'JAKE.FASSORA@HOUSECALLPRO.COM' })

  expect(allowed).toBe(true)
})

test('Jira write guard allows Jake-owned tickets when Jira hides assignee email', () => {
  const allowed = isJiraWriteAllowedForTicket(ticket({
    assignee: { displayName: 'Jake Fassora' }
  }), { email: 'jake.fassora@housecallpro.com' })

  expect(allowed).toBe(true)
})

test('Jira write guard rejects reporter-only tickets assigned to someone else', () => {
  const otherTicket = ticket({
    assignee: { displayName: 'Someone Else', emailAddress: 'someone@example.com' },
    reporter: { displayName: 'Jake Fassora', emailAddress: 'jake.fassora@housecallpro.com' }
  })

  expect(isJiraWriteAllowedForTicket(otherTicket, { email: 'jake.fassora@housecallpro.com' })).toBe(false)
  expect(() => assertJiraWriteAllowedForTicket(otherTicket, { email: 'jake.fassora@housecallpro.com' }))
    .toThrow('Refusing Jira write for AISOL-592')
})

test('Jira write guard rejects unassigned tickets', () => {
  expect(isJiraWriteAllowedForTicket(ticket(), { email: 'jake.fassora@housecallpro.com' })).toBe(false)
})

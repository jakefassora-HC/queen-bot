import {
  assertJiraWritePolicy,
  evaluateJiraWritePolicy
} from '../jira-write-policy.js'
import type { JiraTicket } from '../types.js'

function ticket(overrides: Partial<JiraTicket> = {}): JiraTicket {
  return {
    id: '1',
    key: 'AISOL-592',
    summary: 'Sankey detail',
    description: '',
    storyPoints: 3,
    issueType: 'Story',
    labels: [],
    status: 'In Progress',
    assignee: { displayName: 'Jake Fassora', emailAddress: 'jake.fassora@housecallpro.com' },
    ...overrides
  }
}

test('Jira write policy allows Jake-owned tickets in the current queue', () => {
  const current = ticket()

  expect(evaluateJiraWritePolicy({
    action: 'comment',
    ticket: current,
    tickets: [current],
    email: 'jake.fassora@housecallpro.com'
  })).toEqual({ allowed: true })
})

test('Jira write policy rejects existing-ticket writes outside the current queue', () => {
  const current = ticket()

  const result = evaluateJiraWritePolicy({
    action: 'update-description',
    ticket: current,
    tickets: [],
    email: 'jake.fassora@housecallpro.com'
  })

  expect(result.allowed).toBe(false)
  expect(result.reason).toContain('not in the current Jira queue')
})

test('Jira write policy rejects non-Jake-owned existing tickets', () => {
  const current = ticket({
    assignee: { displayName: 'Someone Else', emailAddress: 'someone@example.com' }
  })

  expect(() => assertJiraWritePolicy({
    action: 'transition',
    ticket: current,
    tickets: [current],
    email: 'jake.fassora@housecallpro.com'
  })).toThrow('Refusing Jira transition')
})

test('Jira write policy keeps ticket creation explicit to a Jira project', () => {
  expect(evaluateJiraWritePolicy({
    action: 'create-ticket',
    projectKey: 'AISOL',
    configuredProject: 'AISOL',
    email: 'jake.fassora@housecallpro.com'
  })).toEqual({ allowed: true })

  expect(evaluateJiraWritePolicy({
    action: 'create-ticket',
    projectKey: 'OTHER',
    configuredProject: 'AISOL',
    email: 'jake.fassora@housecallpro.com'
  }).allowed).toBe(false)
})

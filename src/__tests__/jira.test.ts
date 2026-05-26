import { parseTicket } from '../jira.js'

const rawIssue = {
  id: '10001',
  key: 'TOOL-48',
  fields: {
    summary: 'Add rate limiting',
    description: { content: [{ content: [{ text: 'Rate limit the /api/ask endpoint.' }] }] },
    status: { name: 'To Do' },
    labels: ['ai-candidate'],
    story_points: 3,
    customfield_10016: 3
  }
}

test('parseTicket maps Jira API response to JiraTicket', () => {
  const ticket = parseTicket(rawIssue)
  expect(ticket.key).toBe('TOOL-48')
  expect(ticket.summary).toBe('Add rate limiting')
  expect(ticket.labels).toContain('ai-candidate')
  expect(ticket.status).toBe('To Do')
})

test('parseTicket sizes by story points', () => {
  expect(parseTicket({ ...rawIssue, fields: { ...rawIssue.fields, customfield_10016: 1 } }).size).toBe('small')
  expect(parseTicket({ ...rawIssue, fields: { ...rawIssue.fields, customfield_10016: 3 } }).size).toBe('medium')
  expect(parseTicket({ ...rawIssue, fields: { ...rawIssue.fields, customfield_10016: 8 } }).size).toBe('large')
})

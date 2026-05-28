import {
  adfToPlainText,
  appendTextToDescriptionAdf,
  buildCreateIssuePayload,
  buildQueueJql,
  buildQueueSearchUrl,
  buildUpdateDescriptionPayload,
  parseTicket,
  parseRepoLabel,
  verifyJiraAuth
} from '../jira.js'

const rawIssue = {
  id: '10001',
  key: 'TOOL-48',
  fields: {
    summary: 'Add rate limiting',
    description: { content: [{ content: [{ text: 'Rate limit the /api/ask endpoint.' }] }] },
    status: { name: 'To Do' },
    issuetype: { name: 'Story' },
    parent: { key: 'TOOL-1', fields: { summary: 'Parent epic' } },
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
  expect(ticket.issueType).toBe('Story')
  expect(ticket.parent?.key).toBe('TOOL-1')
  expect(ticket.parent?.summary).toBe('Parent epic')
})

test('parseTicket maps Jira sprint field when present', () => {
  const ticket = parseTicket({
    ...rawIssue,
    fields: {
      ...rawIssue.fields,
      customfield_10020: [{ name: 'Sprint 15', state: 'active' }]
    }
  })

  expect(ticket.sprint).toEqual({ name: 'Sprint 15', state: 'active' })
})

test('parseRepoLabel rejects unsafe repo labels', () => {
  expect(parseRepoLabel(['repo:jakefassora-HC/queen-bot'])).toBe('jakefassora-HC/queen-bot')
  expect(parseRepoLabel(['repo:jakefassora-HC/queen-bot;rm -rf /'])).toBeUndefined()
  expect(parseRepoLabel(['repo:../queen-bot'])).toBeUndefined()
})

test('adfToPlainText preserves headings and list lines for Agent Q plans', () => {
  const text = adfToPlainText({
    type: 'doc',
    version: 1,
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Agent Q Plan' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Ticket: AISOL-465' }] },
      {
        type: 'bulletList',
        content: [{
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Run tests' }] }]
        }]
      }
    ]
  })

  expect(text).toBe('## Agent Q Plan\nTicket: AISOL-465\n- Run tests')
})

test('parseTicket keeps story points nullable instead of inventing a size', () => {
  expect(parseTicket({ ...rawIssue, fields: { ...rawIssue.fields, customfield_10016: 3 } }).storyPoints).toBe(3)
  expect(parseTicket({ ...rawIssue, fields: { ...rawIssue.fields, customfield_10016: null } }).storyPoints).toBeNull()
})

test('buildQueueJql searches assigned non-done-category tickets without requiring a project', () => {
  expect(buildQueueJql()).toBe(
    'assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC'
  )
})

test('buildQueueJql can narrow to a configured project', () => {
  expect(buildQueueJql('TOOL')).toBe(
    'project = TOOL AND assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC'
  )
})

test('buildQueueSearchUrl explicitly requests fields needed by parseTicket', () => {
  const url = buildQueueSearchUrl('https://example.atlassian.net', buildQueueJql('TOOL'), 20)

  expect(url).toContain('/rest/api/3/search/jql?')
  expect(decodeURIComponent(url)).toContain('fields=summary,status,labels,description,assignee,project,issuetype,parent,customfield_10016,customfield_10014')
  expect(decodeURIComponent(url)).toContain('customfield_10020')
})

test('verifyJiraAuth throws a useful error on invalid credentials', async () => {
  const fetcher = async () => ({
    ok: false,
    status: 401,
    text: async () => 'Client must be authenticated to access this resource.'
  }) as Response

  await expect(verifyJiraAuth(
    { baseUrl: 'https://example.atlassian.net', email: 'jake@example.com', project: '' },
    'Basic abc',
    fetcher
  )).rejects.toThrow('Jira auth failed for jake@example.com at https://example.atlassian.net')
})

test('buildCreateIssuePayload turns a draft into Jira ADF fields', () => {
  const payload = buildCreateIssuePayload('TOOL', {
    summary: 'Draft Jira tickets from planning discussions',
    issueType: 'Task',
    problem: 'Ideas are not consistently captured in Jira.',
    goal: 'Turn discussion into Jira-ready tickets.',
    nonGoals: ['Execute agent swarms'],
    acceptanceCriteria: ['Shows 1-N drafts', 'Requires approval before Jira write'],
    researchNotes: ['Ruflo is adapter inspiration'],
    risks: ['Prompt injection from ticket text'],
    definitionOfDone: ['Approved tickets are created in Jira'],
    labels: ['agent-spec'],
    relatedRepos: ['jakefassora-HC/queen-bot']
  })

  expect(payload.fields.project.key).toBe('TOOL')
  expect(payload.fields.summary).toBe('Draft Jira tickets from planning discussions')
  expect(payload.fields.labels).toContain('agent-spec')
  expect(payload.fields.labels).toContain('agent-draft')
  expect(payload.fields.description.type).toBe('doc')
  expect(JSON.stringify(payload.fields.description)).toContain('Acceptance Criteria')
})

test('appendTextToDescriptionAdf preserves existing ADF nodes when adding Agent Q text', () => {
  const description = appendTextToDescriptionAdf({
    type: 'doc',
    version: 1,
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text: 'Existing rich context' }]
    }]
  }, '## Agent Q Plan\n\nTicket: AISOL-465')

  expect(description.content[0]).toEqual({
    type: 'paragraph',
    content: [{ type: 'text', text: 'Existing rich context' }]
  })
  expect(adfToPlainText(description)).toContain('## Agent Q Plan')
  expect(adfToPlainText(description)).toContain('Ticket: AISOL-465')
})

test('buildUpdateDescriptionPayload creates Jira ADF update body', () => {
  const description = appendTextToDescriptionAdf(null, 'Existing context\n\n## Agent Q Plan\nTicket: AISOL-465')
  const payload = buildUpdateDescriptionPayload(description)

  expect(payload.fields.description.type).toBe('doc')
  expect(payload.fields.description.content).toHaveLength(2)
  expect(JSON.stringify(payload)).toContain('Agent Q Plan')
})

import {
  adfToPlainText,
  appendTextToDescriptionAdf,
  buildCommentBodyAdf,
  buildCreateIssuePayload,
  buildQueueJql,
  buildQueueSearchUrl,
  buildUpdateDescriptionPayload,
  parseTicket,
  parseRepoLabel,
  upsertTextToDescriptionAdf,
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
  expect(ticket.subtasks).toEqual([])
  expect(ticket.issueLinks).toEqual([])
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

test('parseTicket maps subtasks and linked work items', () => {
  const ticket = parseTicket({
    ...rawIssue,
    fields: {
      ...rawIssue.fields,
      subtasks: [{
        key: 'TOOL-49',
        fields: { summary: 'Add tests', status: { name: 'To Do' } }
      }],
      issuelinks: [{
        type: { name: 'Relates' },
        outwardIssue: {
          key: 'TOOL-50',
          fields: { summary: 'Related API work' }
        }
      }]
    }
  })

  expect(ticket.subtasks).toEqual([{ key: 'TOOL-49', summary: 'Add tests', status: 'To Do' }])
  expect(ticket.issueLinks).toEqual([{ key: 'TOOL-50', summary: 'Related API work', type: 'Relates', direction: 'outward' }])
})

test('parseTicket maps Jira details exposed outside the description', () => {
  const ticket = parseTicket({
    ...rawIssue,
    fields: {
      ...rawIssue.fields,
      project: { key: 'TOOL', name: 'AI Toolshed' },
      priority: { name: 'High' },
      assignee: { displayName: 'Jake Fassora', emailAddress: 'jake@example.com' },
      reporter: { displayName: 'Reporter Person' },
      components: [{ name: 'Sankey' }, { name: 'Salesforce' }],
      fixVersions: [{ name: 'v2' }],
      versions: [{ name: 'v1' }],
      timetracking: { originalEstimate: '2h', remainingEstimate: '1h' },
      customfield_10001: { name: 'Growth Team' },
      comment: {
        comments: [{
          author: { displayName: 'Jake Fassora' },
          created: '2026-05-28T12:00:00.000-0600',
          body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Look at the Salesforce edge case.' }] }] }
        }]
      },
      attachment: [{
        filename: 'flow.png',
        content: 'https://example.atlassian.net/attachment/flow.png'
      }]
    }
  }, { customfield_10001: 'Team' })

  expect(ticket.project).toEqual({ key: 'TOOL', name: 'AI Toolshed' })
  expect(ticket.priority).toBe('High')
  expect(ticket.assignee?.displayName).toBe('Jake Fassora')
  expect(ticket.reporter?.displayName).toBe('Reporter Person')
  expect(ticket.components).toEqual(['Sankey', 'Salesforce'])
  expect(ticket.fixVersions).toEqual(['v2'])
  expect(ticket.affectsVersions).toEqual(['v1'])
  expect(ticket.timeTracking).toEqual({ originalEstimate: '2h', remainingEstimate: '1h' })
  expect(ticket.additionalFields).toContainEqual({ key: 'customfield_10001', name: 'Team', value: 'Growth Team' })
  expect(ticket.comments).toEqual([{ author: 'Jake Fassora', created: '2026-05-28T12:00:00.000-0600', body: 'Look at the Salesforce edge case.' }])
  expect(ticket.attachments).toEqual([{ filename: 'flow.png', url: 'https://example.atlassian.net/attachment/flow.png' }])
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

test('buildCommentBodyAdf preserves markdown headings and bullets', () => {
  const body = buildCommentBodyAdf([
    '## Agent Q Plan Revision',
    'Ticket: AISOL-465',
    '',
    '### Changes',
    '- Added verification.',
    '- Kept Super PRD unchanged.'
  ].join('\n'))

  expect(adfToPlainText(body)).toContain('## Agent Q Plan Revision')
  expect(adfToPlainText(body)).toContain('- Added verification.')
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
  expect(decodeURIComponent(url)).toContain('fields=*all')
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

test('upsertTextToDescriptionAdf replaces an existing Agent Q plan in the description', () => {
  const existing = appendTextToDescriptionAdf({
    type: 'doc',
    version: 1,
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text: 'Existing rich context' }]
    }]
  }, '## Agent Q Plan\n\nTicket: AISOL-465\n\n### Goal\nOld goal')

  const updated = upsertTextToDescriptionAdf(
    existing,
    '## Agent Q Plan\n\nTicket: AISOL-465\n\n### Goal\nNew goal',
    'Agent Q Plan'
  )
  const text = adfToPlainText(updated)

  expect(updated.content[0]).toEqual({
    type: 'paragraph',
    content: [{ type: 'text', text: 'Existing rich context' }]
  })
  expect(text.match(/## Agent Q Plan/g)).toHaveLength(1)
  expect(text).toContain('New goal')
  expect(text).not.toContain('Old goal')
})

test('buildUpdateDescriptionPayload creates Jira ADF update body', () => {
  const description = appendTextToDescriptionAdf(null, 'Existing context\n\n## Agent Q Plan\nTicket: AISOL-465')
  const payload = buildUpdateDescriptionPayload(description)

  expect(payload.fields.description.type).toBe('doc')
  expect(payload.fields.description.content).toHaveLength(2)
  expect(JSON.stringify(payload)).toContain('Agent Q Plan')
})

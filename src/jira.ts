import type { JiraAdfDocument, JiraAdfNode, JiraTicket } from './types.js'
import type { TicketDraft } from './types.js'
import type { JiraConfig } from './config.js'
import { getJiraKey, requireJiraConfig } from './config.js'

function authHeader(email: string): string {
  const creds = Buffer.from(`${email}:${getJiraKey()}`).toString('base64')
  return `Basic ${creds}`
}

type Fetcher = typeof fetch

const QUEUE_FIELDS = [
  'summary',
  'status',
  'labels',
  'description',
  'assignee',
  'project',
  'issuetype',
  'parent',
  'customfield_10016',
  'customfield_10014',
  'customfield_10020'
]

type JiraSprintField = {
  name?: string
  state?: string
} | string

function parseSprintField(value: unknown): JiraTicket['sprint'] {
  const sprint = Array.isArray(value) ? value[value.length - 1] as JiraSprintField | undefined : value as JiraSprintField | undefined
  if (!sprint) return undefined

  if (typeof sprint === 'string') {
    const name = sprint.match(/name=([^,\]]+)/)?.[1]
    const state = sprint.match(/state=([^,\]]+)/)?.[1]
    return name ? { name, state } : undefined
  }

  if (typeof sprint === 'object' && sprint.name) {
    return { name: sprint.name, state: sprint.state }
  }

  return undefined
}

export function parseRepoLabel(labels: string[]): string | undefined {
  const repoLabel = labels.find(l => l.startsWith('repo:'))
  const repo = repoLabel ? repoLabel.slice(5) : undefined
  if (!repo) return undefined
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return undefined
  const [owner, name] = repo.split('/')
  if (!owner || !name || owner.startsWith('.') || name.startsWith('.') || repo.includes('..')) return undefined
  return repo
}

export function parseTicket(issue: Record<string, unknown>): JiraTicket {
  const fields = issue.fields as Record<string, unknown>
  const points = typeof fields.customfield_10016 === 'number' ? fields.customfield_10016 : null

  const descriptionAdf = fields.description as JiraAdfDocument | undefined
  const description = adfToPlainText(descriptionAdf)

  const labels = (fields.labels as string[]) ?? []
  const repo = parseRepoLabel(labels)
  const issueType = ((fields.issuetype as Record<string, string> | undefined)?.name) ?? ''
  const parentIssue = fields.parent as { key?: string; fields?: { summary?: string } } | undefined
  const parent = parentIssue?.key ? {
    key: parentIssue.key,
    summary: parentIssue.fields?.summary ?? ''
  } : undefined
  const sprint = parseSprintField(fields.customfield_10020)

  return {
    id: issue.id as string,
    key: issue.key as string,
    summary: (fields.summary as string) ?? '',
    description,
    descriptionAdf,
    storyPoints: points,
    issueType,
    parent,
    labels,
    status: ((fields.status as Record<string, string>)?.name) ?? '',
    sprint,
    repo
  }
}

export async function fetchQueue(): Promise<JiraTicket[]> {
  const config = requireJiraConfig()
  const auth = authHeader(config.email)
  await verifyJiraAuth(config, auth)
  const url = buildQueueSearchUrl(config.baseUrl, buildQueueJql(config.project), 20)
  const res = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Jira error ${res.status}: ${await res.text()}`)
  const data = await res.json() as { issues: unknown[] }
  return data.issues.map(i => parseTicket(i as Record<string, unknown>))
}

export function buildQueueJql(project?: string): string {
  const scope = project ? `project = ${project} AND ` : ''
  return `${scope}assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC`
}

export function buildQueueSearchUrl(baseUrl: string, jql: string, maxResults: number): string {
  const params = new URLSearchParams({
    jql,
    maxResults: String(maxResults),
    fields: QUEUE_FIELDS.join(',')
  })
  return `${baseUrl}/rest/api/3/search/jql?${params.toString()}`
}

export async function verifyJiraAuth(
  config: JiraConfig,
  auth: string,
  fetcher: Fetcher = fetch
): Promise<void> {
  const res = await fetcher(`${config.baseUrl}/rest/api/3/myself`, {
    headers: { Authorization: auth, Accept: 'application/json' }
  })
  if (res.ok) return
  const body = await res.text()
  throw new Error(
    `Jira auth failed for ${config.email} at ${config.baseUrl}: HTTP ${res.status} ${body}\n` +
    'Check that JIRA_BASE_URL matches the site where the token was created, JIRA_EMAIL matches the Atlassian account, and the Keychain item agent-queue-jira contains a valid Jira API token.'
  )
}

type CreateIssuePayload = {
  fields: {
    project: { key: string }
    summary: string
    issuetype: { name: string }
    labels: string[]
    description: {
      type: 'doc'
      version: 1
      content: JiraAdfNode[]
    }
  }
}

function paragraph(text: string): JiraAdfNode {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function heading(text: string): JiraAdfNode {
  return { type: 'heading', attrs: { level: '2' }, content: [{ type: 'text', text }] }
}

function bulletList(items: string[]): JiraAdfNode {
  const safeItems = items.length === 0 ? ['None'] : items
  return {
    type: 'bulletList',
    content: safeItems.map(item => ({
      type: 'listItem',
      content: [paragraph(item)]
    }))
  }
}

function uniqueLabels(labels: string[]): string[] {
  return Array.from(new Set(['agent-draft', ...labels])).filter(Boolean)
}

function textNode(text: string): JiraAdfNode {
  return { type: 'text', text }
}

function collectInlineText(node: JiraAdfNode): string {
  if (node.text) return node.text
  return (node.content ?? []).map(collectInlineText).join('')
}

function adfBlockToPlainText(node: JiraAdfNode): string[] {
  if (node.type === 'heading') {
    const level = Number(node.attrs?.level ?? 2)
    return [`${'#'.repeat(Math.max(1, Math.min(level, 6)))} ${collectInlineText(node)}`]
  }

  if (node.type === 'paragraph') {
    return [collectInlineText(node)]
  }

  if (node.type === 'listItem') {
    const text = (node.content ?? []).flatMap(adfBlockToPlainText).join(' ').trim()
    return text ? [`- ${text.replace(/^- /, '')}`] : []
  }

  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return (node.content ?? []).flatMap(adfBlockToPlainText)
  }

  return (node.content ?? []).flatMap(adfBlockToPlainText)
}

export function adfToPlainText(doc: JiraAdfDocument | null | undefined): string {
  if (!doc?.content) return ''
  return doc.content.flatMap(adfBlockToPlainText).filter(Boolean).join('\n')
}

function textBlockToAdf(block: string): JiraAdfNode {
  if (block.startsWith('### ')) {
    return { type: 'heading', attrs: { level: 3 }, content: [textNode(block.slice(4))] }
  }

  if (block.startsWith('## ')) {
    return { type: 'heading', attrs: { level: 2 }, content: [textNode(block.slice(3))] }
  }

  if (block.split('\n').every(line => line.startsWith('- '))) {
    return bulletList(block.split('\n').map(line => line.slice(2).trim()))
  }

  return paragraph(block)
}

function plainTextToAdfBlocks(text: string): JiraAdfNode[] {
  return text.split(/\n{2,}/).map(block => block.trim()).filter(Boolean).map(textBlockToAdf)
}

export function appendTextToDescriptionAdf(
  description: JiraAdfDocument | null | undefined,
  text: string
): JiraAdfDocument {
  return {
    type: 'doc',
    version: 1,
    content: [
      ...(description?.content ?? []),
      ...plainTextToAdfBlocks(text)
    ]
  }
}

export function buildUpdateDescriptionPayload(description: JiraAdfDocument): { fields: { description: JiraAdfDocument } } {
  return {
    fields: {
      description
    }
  }
}

export function buildCreateIssuePayload(projectKey: string, draft: TicketDraft): CreateIssuePayload {
  return {
    fields: {
      project: { key: projectKey },
      summary: draft.summary,
      issuetype: { name: draft.issueType },
      labels: uniqueLabels(draft.labels),
      description: {
        type: 'doc',
        version: 1,
        content: [
          heading('Problem'),
          paragraph(draft.problem),
          heading('Goal'),
          paragraph(draft.goal),
          heading('Non-goals'),
          bulletList(draft.nonGoals),
          heading('Acceptance Criteria'),
          bulletList(draft.acceptanceCriteria),
          heading('Research Notes'),
          bulletList(draft.researchNotes),
          heading('Risks'),
          bulletList(draft.risks),
          heading('Definition of Done'),
          bulletList(draft.definitionOfDone),
          heading('Related Repos'),
          bulletList(draft.relatedRepos)
        ]
      }
    }
  }
}

export async function createIssueFromDraft(projectKey: string, draft: TicketDraft): Promise<string> {
  const config = requireJiraConfig()
  const res = await fetch(`${config.baseUrl}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(config.email),
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildCreateIssuePayload(projectKey, draft))
  })
  if (!res.ok) throw new Error(`Jira create issue error ${res.status}: ${await res.text()}`)
  const data = await res.json() as { key: string }
  return data.key
}

export async function updateTicketDescription(ticketKey: string, description: JiraAdfDocument): Promise<void> {
  const config = requireJiraConfig()
  const res = await fetch(`${config.baseUrl}/rest/api/3/issue/${ticketKey}`, {
    method: 'PUT',
    headers: {
      Authorization: authHeader(config.email),
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildUpdateDescriptionPayload(description))
  })
  if (!res.ok) throw new Error(`Jira update issue error ${res.status}: ${await res.text()}`)
}

export async function transitionTicket(ticketKey: string, statusName: 'In Progress' | 'Done'): Promise<void> {
  const config = requireJiraConfig()
  const transUrl = `${config.baseUrl}/rest/api/3/issue/${ticketKey}/transitions`
  const transRes = await fetch(transUrl, { headers: { Authorization: authHeader(config.email), Accept: 'application/json' } })
  const transData = await transRes.json() as { transitions: Array<{ id: string; name: string }> }
  const transition = transData.transitions.find(t => t.name === statusName)
  if (!transition) return
  await fetch(transUrl, {
    method: 'POST',
    headers: { Authorization: authHeader(config.email), 'Content-Type': 'application/json' },
    body: JSON.stringify({ transition: { id: transition.id } })
  })
}

export async function commentOnTicket(ticketKey: string, text: string): Promise<void> {
  const config = requireJiraConfig()
  const res = await fetch(`${config.baseUrl}/rest/api/3/issue/${ticketKey}/comment`, {
    method: 'POST',
    headers: { Authorization: authHeader(config.email), 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [textNode(text)] }] } })
  })
  if (!res.ok) throw new Error(`Jira comment error ${res.status}: ${await res.text()}`)
}

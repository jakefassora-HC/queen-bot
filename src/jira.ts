import type { JiraAdfDocument, JiraAdfNode, JiraTicket } from './types.js'
import type { TicketDraft } from './types.js'
import type { JiraConfig } from './config.js'
import type { JiraWritePermit } from './jira-write-policy.js'
import { getJiraKey, requireJiraConfig } from './config.js'

function authHeader(email: string): string {
  const creds = Buffer.from(`${email}:${getJiraKey()}`).toString('base64')
  return `Basic ${creds}`
}

type Fetcher = typeof fetch

const QUEUE_FIELDS = [
  '*all'
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

function parseIssueSummary(issue: unknown): { key?: string; fields?: { summary?: string; status?: { name?: string } } } | undefined {
  return issue as { key?: string; fields?: { summary?: string; status?: { name?: string } } } | undefined
}

function parseSubtasks(value: unknown): JiraTicket['subtasks'] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    const issue = parseIssueSummary(item)
    if (!issue?.key) return []
    return [{
      key: issue.key,
      summary: issue.fields?.summary ?? '',
      status: issue.fields?.status?.name ?? ''
    }]
  })
}

function parseIssueLinks(value: unknown): JiraTicket['issueLinks'] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    const link = item as {
      type?: { name?: string; inward?: string; outward?: string }
      inwardIssue?: unknown
      outwardIssue?: unknown
    }
    const direction = link.outwardIssue ? 'outward' : 'inward'
    const issue = parseIssueSummary(link.outwardIssue ?? link.inwardIssue)
    if (!issue?.key) return []
    return [{
      key: issue.key,
      summary: issue.fields?.summary ?? '',
      type: link.type?.name ?? (direction === 'outward' ? link.type?.outward : link.type?.inward) ?? '',
      direction
    }]
  })
}

function parseNamedArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (typeof item === 'string') return [item]
    if (!item || typeof item !== 'object') return []
    const name = (item as { name?: unknown }).name
    return typeof name === 'string' && name.trim() ? [name] : []
  })
}

function parseUser(value: unknown): JiraTicket['assignee'] {
  if (!value || typeof value !== 'object') return undefined
  const user = value as { displayName?: unknown; emailAddress?: unknown }
  if (typeof user.displayName !== 'string' || !user.displayName.trim()) return undefined
  return {
    displayName: user.displayName,
    emailAddress: typeof user.emailAddress === 'string' ? user.emailAddress : undefined
  }
}

function parseProject(value: unknown): JiraTicket['project'] {
  if (!value || typeof value !== 'object') return undefined
  const project = value as { key?: unknown; name?: unknown }
  if (typeof project.key !== 'string' || !project.key.trim()) return undefined
  return {
    key: project.key,
    name: typeof project.name === 'string' ? project.name : ''
  }
}

function parseNamedValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value
  if (!value || typeof value !== 'object') return undefined
  const named = value as { name?: unknown; value?: unknown; displayName?: unknown; key?: unknown; summary?: unknown }
  for (const key of ['name', 'value', 'displayName', 'key', 'summary'] as const) {
    const candidate = named[key]
    if (typeof candidate === 'string' && candidate.trim()) return candidate
  }
  return undefined
}

function parseTimeTracking(value: unknown): JiraTicket['timeTracking'] {
  if (!value || typeof value !== 'object') return undefined
  const tracking = value as { originalEstimate?: unknown; remainingEstimate?: unknown; timeSpent?: unknown }
  const parsed = {
    originalEstimate: typeof tracking.originalEstimate === 'string' ? tracking.originalEstimate : undefined,
    remainingEstimate: typeof tracking.remainingEstimate === 'string' ? tracking.remainingEstimate : undefined,
    timeSpent: typeof tracking.timeSpent === 'string' ? tracking.timeSpent : undefined
  }
  return Object.values(parsed).some(Boolean) ? parsed : undefined
}

function summarizeFieldValue(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'string') return value.trim() || undefined
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    const items = value.flatMap(item => summarizeFieldValue(item) ?? [])
    return items.length > 0 ? items.join(', ') : undefined
  }
  if (typeof value === 'object') {
    const named = parseNamedValue(value)
    if (named) return named
  }
  return undefined
}

function parseComments(value: unknown): JiraTicket['comments'] {
  const comments = (value as { comments?: unknown[] } | undefined)?.comments
  if (!Array.isArray(comments)) return []
  return comments.flatMap(comment => {
    if (!comment || typeof comment !== 'object') return []
    const item = comment as { author?: unknown; created?: unknown; body?: unknown }
    const author = parseUser(item.author)?.displayName ?? 'unknown'
    const created = typeof item.created === 'string' ? item.created : ''
    const body = adfToPlainText(item.body as JiraAdfDocument | undefined).trim()
    return body ? [{ author, created, body }] : []
  })
}

function parseAttachments(value: unknown): JiraTicket['attachments'] {
  if (!Array.isArray(value)) return []
  return value.flatMap(attachment => {
    if (!attachment || typeof attachment !== 'object') return []
    const item = attachment as { filename?: unknown; content?: unknown }
    if (typeof item.filename !== 'string' || !item.filename.trim()) return []
    return [{
      filename: item.filename,
      url: typeof item.content === 'string' ? item.content : undefined
    }]
  })
}

function parseAdditionalFields(
  fields: Record<string, unknown>,
  fieldNames: Record<string, string> = {}
): JiraTicket['additionalFields'] {
  const ignored = new Set(['customfield_10016', 'customfield_10014', 'customfield_10020'])
  return Object.entries(fields).flatMap(([key, value]) => {
    if (!key.startsWith('customfield_') || ignored.has(key)) return []
    const summary = summarizeFieldValue(value)
    return summary ? [{ key, name: fieldNames[key], value: summary.slice(0, 240) }] : []
  })
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

export function parseTicket(issue: Record<string, unknown>, fieldNames: Record<string, string> = {}): JiraTicket {
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
  const subtasks = parseSubtasks(fields.subtasks)
  const issueLinks = parseIssueLinks(fields.issuelinks)
  const priority = parseNamedValue(fields.priority)

  return {
    id: issue.id as string,
    key: issue.key as string,
    summary: (fields.summary as string) ?? '',
    description,
    descriptionAdf,
    storyPoints: points,
    issueType,
    project: parseProject(fields.project),
    priority,
    assignee: parseUser(fields.assignee),
    reporter: parseUser(fields.reporter),
    parent,
    subtasks,
    issueLinks,
    labels,
    status: ((fields.status as Record<string, string>)?.name) ?? '',
    components: parseNamedArray(fields.components),
    fixVersions: parseNamedArray(fields.fixVersions),
    affectsVersions: parseNamedArray(fields.versions),
    timeTracking: parseTimeTracking(fields.timetracking),
    additionalFields: parseAdditionalFields(fields, fieldNames),
    comments: parseComments(fields.comment),
    attachments: parseAttachments(fields.attachment),
    sprint,
    repo
  }
}

async function fetchFieldNameMap(config: JiraConfig, auth: string): Promise<Record<string, string>> {
  const res = await fetch(`${config.baseUrl}/rest/api/3/field`, {
    headers: { Authorization: auth, Accept: 'application/json' }
  })
  if (!res.ok) return {}
  const fields = await res.json() as Array<{ id?: string; name?: string }>
  return fields.reduce<Record<string, string>>((fieldNames, field) => {
    if (field.id && field.name) fieldNames[field.id] = field.name
    return fieldNames
  }, {})
}

export async function fetchQueue(): Promise<JiraTicket[]> {
  const config = requireJiraConfig()
  const auth = authHeader(config.email)
  await verifyJiraAuth(config, auth)
  const fieldNames = await fetchFieldNameMap(config, auth)
  const url = buildQueueSearchUrl(config.baseUrl, buildQueueJql(config.project), 20)
  const res = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Jira error ${res.status}: ${await res.text()}`)
  const data = await res.json() as { issues: unknown[] }
  return data.issues.map(i => parseTicket(i as Record<string, unknown>, fieldNames))
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
  if (node.type === 'hardBreak') return '\n'
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

export function buildCommentBodyAdf(text: string): JiraAdfDocument {
  return {
    type: 'doc',
    version: 1,
    content: plainTextToAdfBlocks(text)
  }
}

function isHeadingNode(node: JiraAdfNode, headingText: string): boolean {
  return node.type === 'heading' && collectInlineText(node).trim() === headingText
}

export function upsertTextToDescriptionAdf(
  description: JiraAdfDocument | null | undefined,
  text: string,
  headingText: string
): JiraAdfDocument {
  const content = description?.content ?? []
  const replacement = plainTextToAdfBlocks(text)
  const start = content.findIndex(node => isHeadingNode(node, headingText))

  if (start === -1) {
    return {
      type: 'doc',
      version: 1,
      content: [...content, ...replacement]
    }
  }

  const headingLevel = Number(content[start].attrs?.level ?? 2)
  let end = start + 1
  while (end < content.length) {
    const node = content[end]
    const nodeLevel = Number(node.attrs?.level ?? 2)
    if (node.type === 'heading' && nodeLevel <= headingLevel) break
    end += 1
  }

  return {
    type: 'doc',
    version: 1,
    content: [
      ...content.slice(0, start),
      ...replacement,
      ...content.slice(end)
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

function assertPermit(permit: JiraWritePermit, action: JiraWritePermit['action']): void {
  if (permit.action !== action) {
    throw new Error(`Jira write permit mismatch: expected ${action}, received ${permit.action}.`)
  }
}

export async function createIssueFromDraft(projectKey: string, draft: TicketDraft, permit: JiraWritePermit): Promise<string> {
  assertPermit(permit, 'create-ticket')
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

export async function updateTicketDescription(ticketKey: string, description: JiraAdfDocument, permit: JiraWritePermit): Promise<void> {
  assertPermit(permit, 'update-description')
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

export async function transitionTicket(ticketKey: string, statusName: 'In Progress' | 'Done', permit: JiraWritePermit): Promise<void> {
  assertPermit(permit, 'transition')
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

export async function commentOnTicket(ticketKey: string, text: string, permit: JiraWritePermit): Promise<void> {
  assertPermit(permit, 'comment')
  const config = requireJiraConfig()
  const res = await fetch(`${config.baseUrl}/rest/api/3/issue/${ticketKey}/comment`, {
    method: 'POST',
    headers: { Authorization: authHeader(config.email), 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: buildCommentBodyAdf(text) })
  })
  if (!res.ok) throw new Error(`Jira comment error ${res.status}: ${await res.text()}`)
}

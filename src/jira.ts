import type { JiraTicket } from './types.js'
import type { TicketDraft } from './types.js'
import { getJiraKey, JIRA_BASE_URL, JIRA_EMAIL, JIRA_PROJECT } from './config.js'

function authHeader(): string {
  const creds = Buffer.from(`${JIRA_EMAIL}:${getJiraKey()}`).toString('base64')
  return `Basic ${creds}`
}

export function parseTicket(issue: Record<string, unknown>): JiraTicket {
  const fields = issue.fields as Record<string, unknown>
  const points = (fields.customfield_10016 as number) ?? 0
  const size = points <= 2 ? 'small' : points <= 5 ? 'medium' : 'large'

  const descDoc = fields.description as { content?: Array<{ content?: Array<{ text?: string }> }> } | null
  const description = descDoc?.content
    ?.flatMap(b => b.content ?? [])
    .map(n => n.text ?? '')
    .join(' ') ?? ''

  const labels = (fields.labels as string[]) ?? []
  const repoLabel = labels.find(l => l.startsWith('repo:'))
  const repo = repoLabel ? repoLabel.slice(5) : undefined

  return {
    id: issue.id as string,
    key: issue.key as string,
    summary: (fields.summary as string) ?? '',
    description,
    size,
    labels,
    status: ((fields.status as Record<string, string>)?.name) ?? '',
    repo
  }
}

export async function fetchQueue(): Promise<JiraTicket[]> {
  const jql = encodeURIComponent(
    `assignee = currentUser() AND status != Done ORDER BY priority DESC`
  )
  const url = `${JIRA_BASE_URL}/rest/api/3/search/jql?jql=${jql}&maxResults=20`
  const res = await fetch(url, { headers: { Authorization: authHeader(), Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Jira error ${res.status}: ${await res.text()}`)
  const data = await res.json() as { issues: unknown[] }
  return data.issues.map(i => parseTicket(i as Record<string, unknown>))
}

type AdfNode = {
  type: string
  text?: string
  attrs?: Record<string, string>
  content?: AdfNode[]
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
      content: AdfNode[]
    }
  }
}

function paragraph(text: string): AdfNode {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function heading(text: string): AdfNode {
  return { type: 'heading', attrs: { level: '2' }, content: [{ type: 'text', text }] }
}

function bulletList(items: string[]): AdfNode {
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
  const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildCreateIssuePayload(projectKey, draft))
  })
  if (!res.ok) throw new Error(`Jira create issue error ${res.status}: ${await res.text()}`)
  const data = await res.json() as { key: string }
  return data.key
}

export async function transitionTicket(ticketKey: string, statusName: 'In Progress' | 'Done'): Promise<void> {
  const transUrl = `${JIRA_BASE_URL}/rest/api/3/issue/${ticketKey}/transitions`
  const transRes = await fetch(transUrl, { headers: { Authorization: authHeader(), Accept: 'application/json' } })
  const transData = await transRes.json() as { transitions: Array<{ id: string; name: string }> }
  const transition = transData.transitions.find(t => t.name === statusName)
  if (!transition) return
  await fetch(transUrl, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ transition: { id: transition.id } })
  })
}

export async function commentOnTicket(ticketKey: string, text: string): Promise<void> {
  await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${ticketKey}/comment`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } })
  })
}

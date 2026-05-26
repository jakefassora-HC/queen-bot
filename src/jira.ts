import type { JiraTicket } from './types.js'
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
    `project = ${JIRA_PROJECT} AND assignee = currentUser() AND status != Done ORDER BY priority DESC`
  )
  const url = `${JIRA_BASE_URL}/rest/api/3/search/jql?jql=${jql}&maxResults=20`
  const res = await fetch(url, { headers: { Authorization: authHeader(), Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Jira error ${res.status}: ${await res.text()}`)
  const data = await res.json() as { issues: unknown[] }
  return data.issues.map(i => parseTicket(i as Record<string, unknown>))
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

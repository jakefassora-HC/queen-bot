import type { JiraTicket } from './types.js'

export function formatQueue(tickets: JiraTicket[]): string {
  const lines = ['\n  agent-queue', `  ${'─'.repeat(50)}`]

  tickets.forEach((ticket, index) => {
    const parent = ticket.parent
      ? `  parent: ${ticket.parent.key} ${ticket.parent.summary}`
      : '  parent: none'
    const points = ticket.storyPoints === null ? 'points: none' : `points: ${ticket.storyPoints}`

    lines.push(`  ${index + 1}. ${ticket.key}  ${ticket.issueType || 'Issue'}  ${ticket.status}  ${points}  ${ticket.summary}`)
    lines.push(`     ${parent}`)
  })

  lines.push(`  ${'─'.repeat(50)}`)
  return lines.join('\n')
}

export function resolveTicketSelection(tickets: JiraTicket[], selection: string): JiraTicket | null {
  const trimmed = selection.trim()
  const index = Number.parseInt(trimmed, 10)

  if (Number.isInteger(index) && String(index) === trimmed && index >= 1 && index <= tickets.length) {
    return tickets[index - 1]
  }

  return tickets.find(ticket => ticket.key.toUpperCase() === trimmed.toUpperCase()) ?? null
}

export function formatTicketDetails(ticket: JiraTicket): string {
  const points = ticket.storyPoints === null ? 'none' : String(ticket.storyPoints)
  const parent = ticket.parent
    ? `${ticket.parent.key} ${ticket.parent.summary}`
    : 'none'
  const labels = ticket.labels.length > 0 ? ticket.labels.join(', ') : 'none'
  const repo = ticket.repo ?? 'none'
  const description = ticket.description.trim() || 'No description returned by Jira.'

  return [
    `# ${ticket.key} ${ticket.summary}`,
    '',
    `- Type: ${ticket.issueType || 'Issue'}`,
    `- Status: ${ticket.status || 'unknown'}`,
    `- Points: ${points}`,
    `- Parent: ${parent}`,
    `- Repo label: ${repo}`,
    `- Labels: ${labels}`,
    '',
    '## Description',
    '',
    description,
    '',
    '## Use In Claude',
    '',
    'Use this Jira context as the source of truth for discussion, planning, and implementation in the current Claude session. Do not launch a nested Claude process for this ticket.'
  ].join('\n')
}

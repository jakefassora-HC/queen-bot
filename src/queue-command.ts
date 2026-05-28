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
  const components = ticket.components && ticket.components.length > 0 ? ticket.components.join(', ') : 'none'
  const fixVersions = ticket.fixVersions && ticket.fixVersions.length > 0 ? ticket.fixVersions.join(', ') : 'none'
  const affectsVersions = ticket.affectsVersions && ticket.affectsVersions.length > 0 ? ticket.affectsVersions.join(', ') : 'none'
  const assignee = ticket.assignee?.displayName ?? 'none'
  const reporter = ticket.reporter?.displayName ?? 'none'
  const priority = ticket.priority ?? 'none'
  const project = ticket.project ? `${ticket.project.key} ${ticket.project.name}`.trim() : 'none'
  const sprint = ticket.sprint ? `${ticket.sprint.name}${ticket.sprint.state ? ` (${ticket.sprint.state})` : ''}` : 'none'
  const timeTracking = ticket.timeTracking
    ? [
      ticket.timeTracking.originalEstimate ? `original: ${ticket.timeTracking.originalEstimate}` : null,
      ticket.timeTracking.remainingEstimate ? `remaining: ${ticket.timeTracking.remainingEstimate}` : null,
      ticket.timeTracking.timeSpent ? `spent: ${ticket.timeTracking.timeSpent}` : null
    ].filter(Boolean).join(', ')
    : 'none'
  const subtasks = ticket.subtasks && ticket.subtasks.length > 0
    ? ticket.subtasks.map(subtask => `- ${subtask.key} ${subtask.status} - ${subtask.summary}`).join('\n')
    : 'none'
  const issueLinks = ticket.issueLinks && ticket.issueLinks.length > 0
    ? ticket.issueLinks.map(link => `- ${link.key} ${link.type} ${link.direction} - ${link.summary}`).join('\n')
    : 'none'
  const comments = ticket.comments && ticket.comments.length > 0
    ? ticket.comments.map(comment => `- ${comment.author}${comment.created ? ` (${comment.created})` : ''}: ${comment.body}`).join('\n')
    : 'none'
  const attachments = ticket.attachments && ticket.attachments.length > 0
    ? ticket.attachments.map(attachment => `- ${attachment.filename}${attachment.url ? ` - ${attachment.url}` : ''}`).join('\n')
    : 'none'
  const additionalFields = ticket.additionalFields && ticket.additionalFields.length > 0
    ? ticket.additionalFields.map(field => {
      const label = field.name ? `${field.name} (${field.key})` : field.key
      return `- ${label}: ${field.value}`
    }).join('\n')
    : 'none'

  return [
    `# ${ticket.key} ${ticket.summary}`,
    '',
    '## Details',
    '',
    `- Type: ${ticket.issueType || 'Issue'}`,
    `- Status: ${ticket.status || 'unknown'}`,
    `- Points: ${points}`,
    `- Priority: ${priority}`,
    `- Project: ${project}`,
    `- Parent: ${parent}`,
    `- Sprint: ${sprint}`,
    `- Assignee: ${assignee}`,
    `- Reporter: ${reporter}`,
    `- Components: ${components}`,
    `- Fix versions: ${fixVersions}`,
    `- Affects versions: ${affectsVersions}`,
    `- Time tracking: ${timeTracking}`,
    `- Repo label: ${repo}`,
    `- Labels: ${labels}`,
    '',
    '## Description',
    '',
    description,
    '',
    '## Subtasks',
    '',
    subtasks,
    '',
    '## Linked Work Items',
    '',
    issueLinks,
    '',
    '## Comments',
    '',
    comments,
    '',
    '## Attachments',
    '',
    attachments,
    '',
    '## Additional Jira Fields',
    '',
    additionalFields,
    '',
    '## Use In Claude',
    '',
    'Use this Jira context as the source of truth for discussion, planning, and implementation in the current Claude session. Do not launch a nested Claude process for this ticket.'
  ].join('\n')
}

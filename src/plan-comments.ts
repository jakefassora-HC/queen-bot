import type { JiraTicket } from './types.js'

function bullets(items: string[]): string {
  return items.length ? items.map(item => `- ${item}`).join('\n') : '- none'
}

export function formatLocalPlanRevisionComment(input: {
  ticket: JiraTicket
  localPlanPath: string
  reason: string
  changes: string[]
}): string {
  return [
    '## Plan Revision',
    `Ticket: ${input.ticket.key}`,
    `Local Plan: ${input.localPlanPath}`,
    '',
    '### Reason',
    input.reason,
    '',
    '### Changes',
    bullets(input.changes)
  ].join('\n')
}

export function formatSuperPrdChangeComment(input: {
  ticket: JiraTicket
  reason: string
  changes: string[]
}): string {
  return [
    '## Planning Contract Change',
    `Ticket: ${input.ticket.key}`,
    'Jira Description: updated',
    '',
    '### Reason',
    input.reason,
    '',
    '### Changes',
    bullets(input.changes)
  ].join('\n')
}

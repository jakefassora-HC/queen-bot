import type { JiraTicket } from './types.js'

export const JIRA_PLAN_COMMENT_APPROVAL_PHRASE = 'APPROVE JIRA PLAN COMMENT'

export function hasPlanCommentApproval(answer: string): boolean {
  return answer.trim() === JIRA_PLAN_COMMENT_APPROVAL_PHRASE
}

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
    '## Agent Q Plan Revision',
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
    '## Agent Q Super PRD Change',
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

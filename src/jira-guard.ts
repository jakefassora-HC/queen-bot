import type { JiraTicket } from './types.js'

export interface JiraWriteGuardOptions {
  email: string
  displayName?: string
}

function normalized(value?: string): string {
  return value?.trim().toLowerCase() ?? ''
}

function matchesEmail(actual: string | undefined, expected: string): boolean {
  return normalized(actual) !== '' && normalized(actual) === normalized(expected)
}

function matchesName(actual: string | undefined, expected: string): boolean {
  return normalized(actual) !== '' && normalized(actual) === normalized(expected)
}

function assigneeLabel(ticket: JiraTicket): string {
  const assignee = ticket.assignee
  if (!assignee) return 'unassigned'
  return assignee.emailAddress
    ? `${assignee.displayName} <${assignee.emailAddress}>`
    : assignee.displayName
}

export function isJiraWriteAllowedForTicket(
  ticket: JiraTicket,
  options: JiraWriteGuardOptions
): boolean {
  const expectedName = options.displayName ?? 'Jake Fassora'
  return (
    matchesEmail(ticket.assignee?.emailAddress, options.email) ||
    matchesName(ticket.assignee?.displayName, expectedName)
  )
}

export function assertJiraWriteAllowedForTicket(
  ticket: JiraTicket,
  options: JiraWriteGuardOptions
): void {
  if (isJiraWriteAllowedForTicket(ticket, options)) return

  throw new Error(
    `Refusing Jira write for ${ticket.key}: ticket is not assigned to ${options.email || options.displayName || 'Jake Fassora'} ` +
    `(assignee: ${assigneeLabel(ticket)}).`
  )
}

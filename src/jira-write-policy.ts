import { assertJiraWriteAllowedForTicket, isJiraWriteAllowedForTicket } from './jira-guard.js'
import type { JiraTicket, JiraWriteAction } from './types.js'

export interface JiraWritePolicyInput {
  action: JiraWriteAction
  email: string
  ticket?: JiraTicket
  tickets?: JiraTicket[]
  projectKey?: string
  configuredProject?: string
}

export interface JiraWritePolicyResult {
  allowed: boolean
  reason?: string
}

export interface JiraWritePermit {
  action: JiraWriteAction
  ticketKey?: string
  projectKey?: string
}

function actionLabel(action: JiraWriteAction): string {
  return action.replace('-', ' ')
}

function queueHasTicket(ticket: JiraTicket, tickets?: JiraTicket[]): boolean {
  return !tickets || tickets.some(item => item.key === ticket.key)
}

export function evaluateJiraWritePolicy(input: JiraWritePolicyInput): JiraWritePolicyResult {
  if (input.action === 'create-ticket') {
    if (!input.projectKey) return { allowed: false, reason: 'ticket creation requires an explicit Jira project' }
    if (input.configuredProject && input.projectKey !== input.configuredProject) {
      return {
        allowed: false,
        reason: `project ${input.projectKey} does not match configured Jira project ${input.configuredProject}`
      }
    }
    return { allowed: true }
  }

  if (!input.ticket) return { allowed: false, reason: `${actionLabel(input.action)} requires a Jira ticket` }
  if (!queueHasTicket(input.ticket, input.tickets)) {
    return { allowed: false, reason: `${input.ticket.key} is not in the current Jira queue` }
  }
  if (!isJiraWriteAllowedForTicket(input.ticket, { email: input.email })) {
    return { allowed: false, reason: `${input.ticket.key} is not assigned to ${input.email}` }
  }

  return { allowed: true }
}

export function assertJiraWritePolicy(input: JiraWritePolicyInput): JiraWritePermit {
  const result = evaluateJiraWritePolicy(input)
  if (result.allowed) {
    return {
      action: input.action,
      ticketKey: input.ticket?.key,
      projectKey: input.projectKey
    }
  }
  if (input.ticket && input.action !== 'create-ticket') {
    try {
      assertJiraWriteAllowedForTicket(input.ticket, { email: input.email })
    } catch {
      throw new Error(`Refusing Jira ${actionLabel(input.action)} for ${input.ticket.key}: ${result.reason}.`)
    }
  }
  throw new Error(`Refusing Jira ${actionLabel(input.action)}: ${result.reason}.`)
}

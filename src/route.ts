import type { JiraTicket, Route } from './types.js'
import { isHighRisk } from './policy.js'

export function route(ticket: JiraTicket): Route {
  if (isHighRisk(ticket)) {
    return { runtime: null, reason: 'high-risk — handle manually', approval: 'plan' }
  }

  if (ticket.size === 'large' || ticket.labels.includes('big-ticket')) {
    return { runtime: 'claude-native', reason: 'large ticket — native Claude Code', approval: 'design+plan' }
  }

  return { runtime: 'claude-docker', reason: 'default — isolated container', approval: 'plan' }
}

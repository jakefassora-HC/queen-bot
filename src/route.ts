import type { JiraTicket, Route } from './types.js'
import { isHighRisk } from './policy.js'

export function route(ticket: JiraTicket): Route {
  if (isHighRisk(ticket)) {
    return { runtime: null, reason: 'high-risk — handle manually', approval: 'plan' }
  }

  if (ticket.size === 'large' || ticket.labels.includes('big-ticket') || ticket.labels.includes('ui')) {
    return { runtime: 'claude-native', reason: 'large/UI ticket — native Claude Code with MCP', approval: 'design+plan' }
  }

  // claude-docker reserved for when Docker/OrbStack is available
  return { runtime: 'claude-native', reason: 'default — native Claude Code', approval: 'plan' }
}

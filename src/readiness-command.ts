import { scoreTicketReadiness } from './readiness.js'
import type { JiraTicket } from './types.js'

export function formatReadinessQueue(tickets: JiraTicket[]): string {
  const lines = ['\n  agent-queue readiness', `  ${'─'.repeat(70)}`]

  tickets.forEach((ticket, index) => {
    const readiness = scoreTicketReadiness(ticket)
    lines.push(`  ${index + 1}. ${ticket.key}  ${readiness.score}%  ${readiness.band}  ${ticket.summary}`)
    lines.push(`     ${readiness.reason}`)
  })

  lines.push(`  ${'─'.repeat(70)}`)
  return lines.join('\n')
}

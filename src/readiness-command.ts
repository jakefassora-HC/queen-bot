import { scoreTicketReadiness } from './readiness.js'
import type { JiraTicket } from './types.js'

function pointsLabel(points: number | null): string {
  return points === null ? 'none' : String(points)
}

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

export function formatQueenDashboard(tickets: JiraTicket[], limit = 8): string {
  const visibleTickets = tickets.slice(0, limit)
  const readyCount = tickets.filter(ticket => scoreTicketReadiness(ticket).canExecute).length
  const lines = [
    '# Queen Bot',
    '',
    `Planning dashboard: ${tickets.length} tickets | ${readyCount} ready | ${tickets.length - readyCount} need planning`,
    '',
    'Pick tickets by checking boxes mentally, then reply with numbers or keys.',
    ''
  ]

  visibleTickets.forEach((ticket, index) => {
    const readiness = scoreTicketReadiness(ticket)
    const parent = ticket.parent ? `${ticket.parent.key} ${ticket.parent.summary}` : 'none'
    lines.push(`- [ ] ${index + 1}. ${ticket.key} - ${readiness.score}% ${readiness.band}`)
    lines.push(`  ${ticket.summary}`)
    lines.push(`  Type: ${ticket.issueType || 'unknown'} | Status: ${ticket.status || 'unknown'} | Points: ${pointsLabel(ticket.storyPoints)} | Parent: ${parent}`)
    lines.push(`  Next: ${readiness.canExecute ? `ready to discuss execution for ${ticket.key}` : `plan ${ticket.key} before execution`} | ${readiness.reason}`)
    lines.push('')
  })

  const remaining = tickets.length - visibleTickets.length
  if (remaining > 0) {
    lines.push(`...and ${remaining} more. Run \`agent-queue list\` when you want the full raw queue.`)
    lines.push('')
  }

  lines.push('Reply with a number/key to inspect, or multiple numbers/keys to plan a batch.')
  return lines.join('\n')
}

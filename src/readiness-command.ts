import { scoreTicketReadiness } from './readiness.js'
import type { JiraTicket } from './types.js'

function pointsLabel(points: number | null): string {
  return points === null ? 'none' : String(points)
}

function epicLabel(ticket: JiraTicket): string {
  return ticket.parent?.summary || 'No epic'
}

function ticketNumber(ticket: JiraTicket, tickets: JiraTicket[]): number {
  return tickets.findIndex(item => item.key === ticket.key) + 1
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
  const epicCounts = tickets.reduce<Record<string, number>>((counts, ticket) => {
    const label = epicLabel(ticket)
    counts[label] = (counts[label] ?? 0) + 1
    return counts
  }, {})
  const groups = visibleTickets.reduce<Map<string, JiraTicket[]>>((grouped, ticket) => {
    const label = epicLabel(ticket)
    grouped.set(label, [...(grouped.get(label) ?? []), ticket])
    return grouped
  }, new Map<string, JiraTicket[]>())
  const lines = [
    '# Queen Bot',
    '',
    `Planning dashboard: ${tickets.length} tickets | ${readyCount} ready | ${tickets.length - readyCount} need planning`,
    '',
    Object.entries(epicCounts).map(([label, count]) => `${label}: ${count}`).join(' | '),
    '',
    'Check boxes mentally, then reply with numbers or keys. No table needed.',
    ''
  ]

  for (const [label, groupTickets] of groups) {
    const groupReadyCount = groupTickets.filter(ticket => scoreTicketReadiness(ticket).canExecute).length
    lines.push(`## ${label} (${groupTickets.length} shown, ${groupReadyCount} ready)`)
    lines.push('')

    for (const ticket of groupTickets) {
      const readiness = scoreTicketReadiness(ticket)
      const nextAction = readiness.canExecute ? 'ready to discuss execution' : 'plan before execution'
      lines.push(`- [ ] ${ticketNumber(ticket, tickets)}. ${ticket.key} - ${readiness.score}% ${readiness.band} - ${ticket.status || 'unknown'}`)
      lines.push(`  ${ticket.summary}`)
      lines.push(`  ${ticket.issueType || 'unknown'} | points: ${pointsLabel(ticket.storyPoints)} | next: ${nextAction}`)
      if (!readiness.canExecute) lines.push(`  Missing: ${readiness.missing.join(', ')}`)
      lines.push('')
    }
  }

  const remaining = tickets.length - visibleTickets.length
  if (remaining > 0) {
    lines.push(`+ ${remaining} more hidden to keep this readable. Run \`agent-queue dashboard --all\` or \`agent-queue list\` for everything.`)
    lines.push('')
  }

  lines.push('Reply with a number/key to inspect, or multiple numbers/keys to plan a batch.')
  return lines.join('\n')
}

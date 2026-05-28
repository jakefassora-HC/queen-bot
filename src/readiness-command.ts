import { scoreTicketReadiness } from './readiness.js'
import type { JiraTicket } from './types.js'

function pointsLabel(points: number | null): string {
  return points === null ? 'none' : String(points)
}

function joinedLabel(values: string[] | undefined, fallback = 'none'): string {
  return values && values.length > 0 ? values.join(', ') : fallback
}

function ticketContextLine(ticket: JiraTicket): string {
  const parts = [
    `${ticket.issueType || 'unknown'} | points: ${pointsLabel(ticket.storyPoints)}`,
    ticket.priority ? `priority: ${ticket.priority}` : null,
    (ticket.components ?? []).length > 0 ? `components: ${joinedLabel(ticket.components)}` : null,
    (ticket.fixVersions ?? []).length > 0 ? `fix: ${joinedLabel(ticket.fixVersions)}` : null
  ].filter(Boolean)

  return parts.join(' | ')
}

function epicLabel(ticket: JiraTicket): string {
  return ticket.parent?.summary?.trim() || 'No epic'
}

function sprintSection(ticket: JiraTicket): 'Current Sprint' | 'Backlog' {
  if (ticket.sprint?.state?.toLowerCase() === 'active') return 'Current Sprint'
  return ticket.status.toLowerCase() === 'to do' ? 'Backlog' : 'Current Sprint'
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

export function formatQueenDashboard(tickets: JiraTicket[], limit = tickets.length): string {
  const visibleTickets = tickets.slice(0, limit)
  const readyCount = tickets.filter(ticket => scoreTicketReadiness(ticket).canExecute).length
  const epicCounts = tickets.reduce<Record<string, number>>((counts, ticket) => {
    const label = epicLabel(ticket)
    counts[label] = (counts[label] ?? 0) + 1
    return counts
  }, {})
  const sections = visibleTickets.reduce<Map<string, Map<string, JiraTicket[]>>>((grouped, ticket) => {
    const section = sprintSection(ticket)
    const label = epicLabel(ticket)
    const sectionGroups = grouped.get(section) ?? new Map<string, JiraTicket[]>()
    sectionGroups.set(label, [...(sectionGroups.get(label) ?? []), ticket])
    grouped.set(section, sectionGroups)
    return grouped
  }, new Map<string, Map<string, JiraTicket[]>>())
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

  for (const section of ['Current Sprint', 'Backlog']) {
    const sectionGroups = sections.get(section)
    if (!sectionGroups) continue

    const sectionTickets = Array.from(sectionGroups.values()).flat()
    const sectionReadyCount = sectionTickets.filter(ticket => scoreTicketReadiness(ticket).canExecute).length
    lines.push(`## ${section} (${sectionTickets.length} tickets, ${sectionReadyCount} ready)`)
    lines.push('')

    for (const [label, groupTickets] of sectionGroups) {
      const groupReadyCount = groupTickets.filter(ticket => scoreTicketReadiness(ticket).canExecute).length
      const noun = groupTickets.length === 1 ? 'ticket' : 'tickets'
      lines.push(`### ${label} (${groupTickets.length} ${noun}, ${groupReadyCount} ready)`)
      lines.push('')

      for (const ticket of groupTickets) {
        const readiness = scoreTicketReadiness(ticket)
        const nextAction = readiness.canExecute ? 'ready to discuss execution' : 'plan before execution'
        lines.push(`- [ ] ${ticketNumber(ticket, tickets)}. ${ticket.key} - ${readiness.score}% ${readiness.band} - ${ticket.status || 'unknown'}`)
        lines.push(`  ${ticket.summary}`)
        lines.push(`  ${ticketContextLine(ticket)} | next: ${nextAction}`)
        if (!readiness.canExecute) lines.push(`  Missing: ${readiness.missing.join(', ')}`)
        lines.push('')
      }
    }
  }

  lines.push('Reply with a number/key to inspect, or multiple numbers/keys to plan a batch.')
  return lines.join('\n')
}

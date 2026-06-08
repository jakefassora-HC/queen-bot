import type { JiraTicket } from './types.js'

export interface ParsedWorkGraphMetadata {
  wave: number | null
  lane: string
  blockedBy: string[]
  blocks: string[]
  canRunWith: string[]
  sharedContextPath?: string
  localPlanPath?: string
}

export interface WaveResolution {
  ready: JiraTicket[]
  blocked: Array<{ ticketKey: string; reason: string }>
}

function parseList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(/[,|]/)
    .map(item => item.trim())
    .filter(Boolean)
}

function readLineValue(description: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = description.match(new RegExp(`^${escaped}:\\s*(.+)$`, 'im'))
  return match?.[1]?.trim()
}

export function parseWorkGraphMetadata(ticket: JiraTicket): ParsedWorkGraphMetadata {
  const description = ticket.description ?? ''
  const waveValue = readLineValue(description, 'Wave')
  const wave = waveValue && /^\d+$/.test(waveValue) ? Number(waveValue) : null
  return {
    wave,
    lane: readLineValue(description, 'Lane') ?? 'Unassigned',
    blockedBy: parseList(readLineValue(description, 'Blocked by')),
    blocks: parseList(readLineValue(description, 'Blocks')),
    canRunWith: parseList(readLineValue(description, 'Can run with')),
    sharedContextPath: readLineValue(description, 'Shared context'),
    localPlanPath: readLineValue(description, 'Local plan'),
  }
}

function isChildOf(ticket: JiraTicket, parentKey: string): boolean {
  if (ticket.key === parentKey) return false
  if (ticket.parent?.key === parentKey) return true
  return ticket.issueLinks?.some(link => link.key === parentKey && /parent|epic|relates/i.test(link.type)) ?? false
}

export function childTicketsFor(parentKey: string, tickets: JiraTicket[]): JiraTicket[] {
  return tickets.filter(ticket => isChildOf(ticket, parentKey))
}

function ticketDone(ticket: JiraTicket | undefined): boolean {
  return Boolean(ticket && /done|closed|resolved/i.test(ticket.status))
}

export function resolveWaveTickets(parentKey: string, wave: number, tickets: JiraTicket[]): WaveResolution {
  const byKey = new Map(tickets.map(ticket => [ticket.key, ticket]))
  const candidates = childTicketsFor(parentKey, tickets)
    .filter(ticket => parseWorkGraphMetadata(ticket).wave === wave)
  const ready: JiraTicket[] = []
  const blocked: Array<{ ticketKey: string; reason: string }> = []

  for (const ticket of candidates) {
    const blockers = parseWorkGraphMetadata(ticket).blockedBy
      .filter(key => !ticketDone(byKey.get(key)))
    if (blockers.length > 0) {
      blocked.push({ ticketKey: ticket.key, reason: `blocked by ${blockers.join(', ')}` })
    } else {
      ready.push(ticket)
    }
  }

  return { ready, blocked }
}

export function formatGraphStatus(parent: JiraTicket, tickets: JiraTicket[]): string {
  const children = childTicketsFor(parent.key, tickets)
  const waves = new Map<number, JiraTicket[]>()
  const unassigned: JiraTicket[] = []

  for (const child of children) {
    const wave = parseWorkGraphMetadata(child).wave
    if (wave === null) unassigned.push(child)
    else waves.set(wave, [...(waves.get(wave) ?? []), child])
  }

  const lines = [`Queen WorkGraph: ${parent.key} ${parent.summary}`, '']
  for (const wave of Array.from(waves.keys()).sort((a, b) => a - b)) {
    lines.push(`Wave ${wave}`)
    const byLane = new Map<string, JiraTicket[]>()
    for (const ticket of waves.get(wave) ?? []) {
      const lane = parseWorkGraphMetadata(ticket).lane
      byLane.set(lane, [...(byLane.get(lane) ?? []), ticket])
    }
    for (const lane of Array.from(byLane.keys()).sort()) {
      lines.push(`  ${lane}`)
      for (const ticket of byLane.get(lane) ?? []) {
        const metadata = parseWorkGraphMetadata(ticket)
        const blockers = metadata.blockedBy.length ? ` | blocked by: ${metadata.blockedBy.join(', ')}` : ''
        const parallel = metadata.canRunWith.length ? ` | can run with: ${metadata.canRunWith.join(', ')}` : ''
        lines.push(`  - ${ticket.key} (${ticket.status || 'unknown'}) ${ticket.summary}${blockers}${parallel}`)
      }
    }
    lines.push('')
  }

  if (unassigned.length > 0) {
    lines.push('Unassigned')
    unassigned.forEach(ticket => lines.push(`  - ${ticket.key} ${ticket.summary}`))
    lines.push('')
  }

  if (children.length === 0) lines.push('No child work found for this parent.')
  return lines.join('\n').trimEnd()
}

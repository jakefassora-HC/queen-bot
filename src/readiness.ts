import type { JiraTicket, TicketReadiness } from './types.js'
import { parseJiraPlan, renderJiraPlan } from './jira-plan.js'

const REQUIRED_SIGNALS = [
  { key: 'goal', pattern: /(?:^|\n)#{0,3}\s*goal\b|goal:/i, points: 20 },
  { key: 'context', pattern: /(?:^|\n)#{0,3}\s*context\b|context:/i, points: 15 },
  { key: 'acceptance criteria', pattern: /(?:^|\n)#{0,3}\s*acceptance criteria\b|acceptance criteria:/i, points: 20 },
  { key: 'verification', pattern: /(?:^|\n)#{0,3}\s*verification\b|verification:/i, points: 15 },
  { key: 'autonomy level', pattern: /autonomy level:/i, points: 10 },
  { key: 'forbidden actions', pattern: /(?:^|\n)#{0,3}\s*forbidden actions\b|forbidden actions:/i, points: 10 }
]

export function scoreTicketReadiness(ticket: JiraTicket): TicketReadiness {
  const parsedPlan = parseJiraPlan(ticket.description || '')
  const description = parsedPlan ? renderJiraPlan(parsedPlan) : ''
  const strengths: string[] = []
  const missing: string[] = parsedPlan ? [] : ['Agent Q Plan']
  let score = ticket.summary.trim() ? 10 : 0

  if (parsedPlan) {
    score += 10
    strengths.push('Agent Q Plan')
  }

  for (const signal of REQUIRED_SIGNALS) {
    if (signal.pattern.test(description)) {
      score += signal.points
      strengths.push(signal.key)
    } else {
      missing.push(signal.key)
    }
  }

  if (ticket.repo) {
    score += 10
    strengths.push('repo')
  } else {
    missing.push('repo')
  }

  const boundedScore = Math.min(100, score)
  const canExecute = boundedScore >= 80 && missing.length === 0
  const missingOnlyRepo = missing.length === 1 && missing[0] === 'repo'
  const band = canExecute ? 'ready' : missingOnlyRepo ? 'blocked' : 'needs-planning'

  return {
    ticketKey: ticket.key,
    score: boundedScore,
    band,
    canExecute,
    strengths,
    missing,
    reason: canExecute
      ? 'Ticket has enough Jira context to execute from the plan.'
      : `Missing: ${missing.join(', ')}`
  }
}

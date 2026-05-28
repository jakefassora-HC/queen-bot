import type { AutonomyLevel, JiraPlan } from './types.js'

const AGENT_Q_PLAN_HEADING = '## Agent Q Plan'

function bullets(items: string[]): string {
  return (items.length ? items : ['None']).map(item => `- ${item}`).join('\n')
}

function section(text: string, heading: string): string | null {
  const match = text.match(new RegExp(`### ${heading}\\n([\\s\\S]*?)(?=\\n### |$)`, 'i'))
  return match?.[1]?.trim() ?? null
}

function parseBullets(text: string | null): string[] {
  if (!text) return []
  return text
    .split('\n')
    .map(line => line.replace(/^- /, '').trim())
    .filter(Boolean)
    .filter(line => line.toLowerCase() !== 'none')
}

export function renderJiraPlan(plan: JiraPlan): string {
  return [
    AGENT_Q_PLAN_HEADING,
    `Ticket: ${plan.ticketKey}`,
    `Autonomy Level: ${plan.autonomyLevel}`,
    '',
    '### Goal',
    plan.goal,
    '',
    '### Context',
    bullets(plan.context),
    '',
    '### Acceptance Criteria',
    bullets(plan.acceptanceCriteria),
    '',
    '### Implementation Notes',
    bullets(plan.implementationNotes),
    '',
    '### Verification',
    bullets(plan.verification),
    '',
    '### Risks',
    bullets(plan.risks),
    '',
    '### Forbidden Actions',
    bullets(plan.forbiddenActions)
  ].join('\n')
}

export function parseJiraPlan(description: string): JiraPlan | null {
  const start = description.indexOf(AGENT_Q_PLAN_HEADING)
  if (start === -1) return null

  const text = description.slice(start)
  const ticketKey = text.match(/Ticket: ([A-Z]+-\d+)/)?.[1]
  const autonomy = Number(text.match(/Autonomy Level: ([0-4])/)?.[1])
  const goal = section(text, 'Goal')
  if (!ticketKey || !goal || !Number.isInteger(autonomy)) return null

  return {
    ticketKey,
    goal,
    context: parseBullets(section(text, 'Context')),
    acceptanceCriteria: parseBullets(section(text, 'Acceptance Criteria')),
    implementationNotes: parseBullets(section(text, 'Implementation Notes')),
    verification: parseBullets(section(text, 'Verification')),
    risks: parseBullets(section(text, 'Risks')),
    autonomyLevel: autonomy as AutonomyLevel,
    forbiddenActions: parseBullets(section(text, 'Forbidden Actions'))
  }
}

export function upsertJiraPlanSection(description: string, plan: JiraPlan): string {
  const rendered = renderJiraPlan(plan)
  const start = description.indexOf(AGENT_Q_PLAN_HEADING)
  if (start === -1) return [description.trim(), rendered].filter(Boolean).join('\n\n')

  return [description.slice(0, start).trim(), rendered].filter(Boolean).join('\n\n')
}

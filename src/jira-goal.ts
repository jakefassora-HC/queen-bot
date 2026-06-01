import type { TicketGoal } from './types.js'

export const GOAL_HEADING = '## Goal'

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

export function renderGoal(goal: TicketGoal): string {
  return [
    GOAL_HEADING,
    '',
    '### Why',
    goal.why,
    '',
    '### Constraints',
    bullets(goal.constraints),
    '',
    '### Non-Goals',
    bullets(goal.nonGoals),
    '',
    '### Success Criteria',
    bullets(goal.successCriteria),
  ].join('\n')
}

export function parseGoal(description: string): TicketGoal | null {
  const start = description.indexOf(GOAL_HEADING)
  if (start === -1) return null

  const text = description.slice(start)
  const why = section(text, 'Why')
  if (!why) return null

  return {
    why,
    constraints: parseBullets(section(text, 'Constraints')),
    nonGoals: parseBullets(section(text, 'Non-Goals')),
    successCriteria: parseBullets(section(text, 'Success Criteria')),
  }
}

export function upsertGoalSection(description: string, goal: TicketGoal): string {
  const rendered = renderGoal(goal)
  const start = description.indexOf(GOAL_HEADING)
  if (start === -1) return [description.trim(), rendered].filter(Boolean).join('\n\n')

  const beforeGoal = description.slice(0, start).trim()
  const afterGoal = description.slice(start + GOAL_HEADING.length)
  const nextSection = afterGoal.indexOf('\n## ')
  const afterNextSection = nextSection === -1 ? '' : afterGoal.slice(nextSection)

  const parts = [beforeGoal, rendered, afterNextSection].filter(Boolean)
  return parts.join('\n\n')
}

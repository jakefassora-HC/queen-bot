import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { renderJiraPlan } from './jira-plan.js'
import type { JiraPlan, JiraTicket } from './types.js'

export const DEFAULT_PLANS_DIR = process.env.AGENT_QUEUE_PLANS_DIR ?? path.join(process.env.HOME ?? '.', '.agent-queue', 'plans')

export function normalizeTicketKey(ticketKey: string): string {
  const key = ticketKey.trim().toUpperCase()
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) {
    throw new Error(`Invalid Jira ticket key for local plan path: ${ticketKey}`)
  }
  return key
}

export function localPlanPath(ticketKey: string, root = DEFAULT_PLANS_DIR): string {
  return path.join(root, normalizeTicketKey(ticketKey), 'plan.md')
}

function bullets(items: string[]): string {
  return (items.length ? items : ['none']).map(item => `- ${item}`).join('\n')
}

export function renderLocalPlan(ticket: JiraTicket, plan: JiraPlan): string {
  const key = normalizeTicketKey(ticket.key)
  return [
    `# ${key} Agent Q Full Plan`,
    '',
    '## Contract',
    '',
    `ticket: ${key}`,
    `summary: ${ticket.summary}`,
    `status: ${ticket.status || 'unknown'}`,
    `repo: ${ticket.repo || 'none'}`,
    `autonomy: ${plan.autonomyLevel}`,
    `local_plan: ${plan.localPlanPath || localPlanPath(key)}`,
    '',
    '## Super PRD',
    '',
    renderJiraPlan({ ...plan, ticketKey: key }),
    '',
    '## Execution Notes',
    '',
    '- Use the Jira Super PRD as the approval contract.',
    '- Use this local plan for implementation detail that would make Jira noisy.',
    '- Keep Jira comments for proof, progress, review notes, and approved plan revisions.',
    '- Do not create, update, or transition Jira work without Jake approving the exact write.',
    '',
    '## Linked Work',
    '',
    bullets([
      ...(ticket.subtasks ?? []).map(item => `${item.key} subtask ${item.status} - ${item.summary}`),
      ...(ticket.issueLinks ?? []).map(item => `${item.key} ${item.type || 'linked'} - ${item.summary}`)
    ]),
    '',
    '## Source Jira Context',
    '',
    ticket.description?.trim() || 'No Jira description text available.'
  ].join('\n')
}

export function writeLocalPlan(ticket: JiraTicket, plan: JiraPlan, root = DEFAULT_PLANS_DIR): string {
  const filePath = localPlanPath(ticket.key, root)
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, renderLocalPlan(ticket, { ...plan, localPlanPath: filePath }), 'utf8')
  return filePath
}

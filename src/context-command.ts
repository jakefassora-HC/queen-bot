import { existsSync } from 'fs'
import { buildExecutionContract } from './execution-command.js'
import { localPlanPath as resolveLocalPlanPath } from './local-plan.js'
import { resolveTicketSelection } from './queue-command.js'
import { workGraphSummary } from './work-graph.js'
import type { ExecutionContract, JiraTicket } from './types.js'

function bulletList(items: string[]): string[] {
  return items.length > 0 ? items.map(item => `- ${item}`) : ['- none']
}

function linkedWorkLines(ticket: JiraTicket): string[] {
  const links = ticket.issueLinks ?? []
  const subtasks = ticket.subtasks ?? []
  const lines = [
    ...subtasks.map(item => `- ${item.key} subtask ${item.status} - ${item.summary}`),
    ...links.map(item => `- ${item.key} ${item.type || 'linked'} - ${item.summary}`)
  ]
  return lines.length > 0 ? lines : ['- none']
}

export function formatBriefExecutionContext(
  ticket: JiraTicket,
  contract: ExecutionContract,
  options: { localPlanPath?: string; localPlanExists?: boolean } = {}
): string {
  const planPath = options.localPlanPath ?? contract.plan.localPlanPath ?? resolveLocalPlanPath(ticket)
  const planExists = options.localPlanExists ?? existsSync(planPath)
  const planStatus = planExists ? 'ready' : 'missing'
  const graph = workGraphSummary(ticket)
  return [
    `# Agent Q Context: ${ticket.key}`,
    '',
    '## Contract',
    '',
    `summary: ${ticket.summary}`,
    `status: ${ticket.status || 'unknown'}`,
    `repo: ${contract.repo}`,
    `branch: ${contract.branch}`,
    `worktree: ${contract.worktreePath}`,
    `autonomy: ${contract.autonomyLevel}`,
    `local_plan: ${planPath}`,
    `local_plan_status: ${planStatus}`,
    `parent: ${graph.parent}`,
    `story_point_policy: ${graph.storyPointPolicy}`,
    '',
    '## Super PRD',
    '',
    `goal: ${contract.plan.goal}`,
    '',
    'acceptance_criteria:',
    ...bulletList(contract.plan.acceptanceCriteria),
    '',
    'implementation_notes:',
    ...bulletList(contract.plan.implementationNotes),
    '',
    'verification:',
    ...bulletList(contract.plan.verification),
    '',
    'forbidden_actions:',
    ...bulletList(contract.plan.forbiddenActions),
    '',
    '## Linked Work',
    '',
    ...linkedWorkLines(ticket),
    '',
    '## Debug',
    '',
    `For full Jira detail: agent-queue show ${ticket.key}`
  ].join('\n')
}

export async function runContextCommand(args: string[], tickets: JiraTicket[]): Promise<void> {
  const selection = args.find(arg => !arg.startsWith('--'))
  if (!selection) throw new Error('Usage: agent-queue context <ticket-number-or-key> [--brief]')

  const ticket = resolveTicketSelection(tickets, selection)
  if (!ticket) throw new Error(`Ticket not found in current queue: ${selection}`)

  const result = buildExecutionContract(ticket)
  if (!result.ok) throw new Error(`Cannot build execution context for ${result.ticketKey}: ${result.reason}`)

  const planPath = result.contract.plan.localPlanPath ?? resolveLocalPlanPath(ticket)
  console.log(formatBriefExecutionContext(ticket, result.contract, { localPlanPath: planPath, localPlanExists: existsSync(planPath) }))
}

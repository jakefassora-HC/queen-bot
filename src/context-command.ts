import { existsSync } from 'fs'
import { buildExecutionContract } from './execution-command.js'
import { localPlanPath as resolveLocalPlanPath } from './local-plan.js'
import { resolveTicketSelection } from './queue-command.js'
import { workGraphSummary } from './work-graph.js'
import type { ContextMode, ExecutionContract, JiraTicket } from './types.js'

export interface ContextArgs {
  selection: string
  mode: ContextMode
}

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

export function parseContextArgs(args: string[]): ContextArgs {
  const modes = [
    args.includes('--brief') ? 'brief' : null,
    args.includes('--standard') ? 'standard' : null,
    args.includes('--deep') ? 'deep' : null
  ].filter((mode): mode is ContextMode => mode !== null)
  if (modes.length > 1) throw new Error('Choose only one context mode: --brief, --standard, or --deep')

  const selection = args.find(arg => !arg.startsWith('--'))
  if (!selection) throw new Error('Usage: agent-queue context <ticket-number-or-key> [--brief|--standard|--deep]')

  return { selection, mode: modes[0] ?? 'brief' }
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
    `# Agent Q Receipt: ${ticket.key}`,
    '',
    `summary: ${ticket.summary}`,
    `goal: ${contract.plan.goal}`,
    `status: ${ticket.status || 'unknown'}`,
    `repo: ${contract.repo}`,
    `engine: ${contract.engine}`,
    `branch: ${contract.branch}`,
    `worktree: ${contract.worktreePath}`,
    `autonomy: ${contract.autonomyLevel}`,
    `local_plan: ${planPath}`,
    `local_plan_status: ${planStatus}`,
    `parent: ${graph.parent}`,
    `story_point_policy: ${graph.storyPointPolicy}`,
    'jira_write_policy: use Queen only; no direct Jira writes from worker',
    `upgrade_context: agent-queue context ${ticket.key} --standard`
  ].join('\n')
}

export function formatStandardExecutionContext(
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
    `engine: ${contract.engine}`,
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
    `For full Jira detail: agent-queue context ${ticket.key} --deep`
  ].join('\n')
}

export function formatDeepExecutionContext(
  ticket: JiraTicket,
  contract: ExecutionContract,
  options: { localPlanPath?: string; localPlanExists?: boolean } = {}
): string {
  return [
    formatStandardExecutionContext(ticket, contract, options),
    '',
    '## Source Jira Description',
    '',
    ticket.description || 'No Jira description available.',
    '',
    '## Comments',
    '',
    ...(ticket.comments ?? []).map(comment => `- ${comment.created} ${comment.author}: ${comment.body}`)
  ].join('\n')
}

export function formatExecutionContext(
  ticket: JiraTicket,
  contract: ExecutionContract,
  options: { mode?: ContextMode; localPlanPath?: string; localPlanExists?: boolean } = {}
): string {
  const mode = options.mode ?? 'brief'
  if (mode === 'deep') return formatDeepExecutionContext(ticket, contract, options)
  if (mode === 'standard') return formatStandardExecutionContext(ticket, contract, options)
  return formatBriefExecutionContext(ticket, contract, options)
}

export async function runContextCommand(args: string[], tickets: JiraTicket[]): Promise<void> {
  const parsed = parseContextArgs(args)

  const ticket = resolveTicketSelection(tickets, parsed.selection)
  if (!ticket) throw new Error(`Ticket not found in current queue: ${parsed.selection}`)

  const result = buildExecutionContract(ticket)
  if (!result.ok) throw new Error(`Cannot build execution context for ${result.ticketKey}: ${result.reason}`)

  const planPath = result.contract.plan.localPlanPath ?? resolveLocalPlanPath(ticket)
  console.log(formatExecutionContext(ticket, result.contract, { mode: parsed.mode, localPlanPath: planPath, localPlanExists: existsSync(planPath) }))
}

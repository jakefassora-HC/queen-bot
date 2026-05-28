import readline from 'readline'
import { renderJiraPlan } from './jira-plan.js'
import { updateTicketDescription, upsertTextToDescriptionAdf } from './jira.js'
import { resolveTicketSelection } from './queue-command.js'
import type { JiraAdfDocument, JiraPlan, JiraTicket } from './types.js'

export interface PlanArgs {
  selection: string
  write: boolean
}

export const JIRA_PLAN_APPROVAL_PHRASE = 'APPROVE JIRA PLAN'

export function hasJiraPlanApproval(answer: string): boolean {
  return answer.trim() === JIRA_PLAN_APPROVAL_PHRASE
}

export function parsePlanArgs(args: string[]): PlanArgs {
  const selection = args.find(arg => !arg.startsWith('--'))
  if (!selection) throw new Error('Usage: agent-queue plan <ticket-number-or-key> [--write]')
  return { selection, write: args.includes('--write') }
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()) }))
}

export function buildPlanFromTicket(ticket: JiraTicket): JiraPlan {
  return {
    ticketKey: ticket.key,
    goal: ticket.summary,
    context: ticket.description ? [ticket.description] : ['Jake will provide context in the planning cmux session.'],
    acceptanceCriteria: ['Defined with Jake before execution.'],
    implementationNotes: ['Use repo patterns and Superpowers planning before code changes.'],
    verification: ['Run the smallest meaningful verification command before reporting done.'],
    risks: ['Under-specified ticket can cause agent drift.'],
    autonomyLevel: 2,
    forbiddenActions: ['Do not merge.', 'Do not deploy.', 'Do not update Jira without approval.']
  }
}

export function buildPlanDescriptionAdf(ticket: JiraTicket, plan: JiraPlan): JiraAdfDocument {
  return upsertTextToDescriptionAdf(ticket.descriptionAdf, renderJiraPlan(plan), 'Agent Q Plan')
}

export async function writePlanWithApproval(ticket: JiraTicket, plan: JiraPlan): Promise<boolean> {
  const rendered = renderJiraPlan(plan)
  console.log(rendered)
  const answer = await prompt(`\nWrite this plan to ${ticket.key}? Type "${JIRA_PLAN_APPROVAL_PHRASE}" to approve: `)
  if (!hasJiraPlanApproval(answer)) return false

  await updateTicketDescription(ticket.key, buildPlanDescriptionAdf(ticket, plan))
  return true
}

export async function runPlanCommand(args: string[], tickets: JiraTicket[]): Promise<void> {
  const parsed = parsePlanArgs(args)
  const ticket = resolveTicketSelection(tickets, parsed.selection)
  if (!ticket) throw new Error(`Ticket not found in current queue: ${parsed.selection}`)

  const plan = buildPlanFromTicket(ticket)
  if (!parsed.write) {
    console.log(renderJiraPlan(plan))
    console.log(`\nPreview only. Re-run with --write to request a Jira write, then type "${JIRA_PLAN_APPROVAL_PHRASE}" after reviewing the plan.`)
    return
  }

  const wrote = await writePlanWithApproval(ticket, plan)
  console.log(wrote ? `Wrote Agent Q plan to ${ticket.key}.` : 'Skipped Jira plan write.')
}

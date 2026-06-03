import readline from 'readline'
import { getJiraConfig } from './config.js'
import { renderJiraPlan } from './jira-plan.js'
import { updateTicketDescription, upsertTextToDescriptionAdf } from './jira.js'
import { assertJiraWritePolicy } from './jira-write-policy.js'
import { localPlanPath, writeLocalPlan, storyBrainPath, writeStoryBrain } from './local-plan.js'
import { resolveTicketSelection } from './queue-command.js'
import { parseGoal } from './jira-goal.js'
import type { JiraAdfDocument, JiraPlan, JiraTicket, StoryBrain, StoryTaskEntry } from './types.js'

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
  const goal = parseGoal(ticket.description ?? '')
  const acceptanceCriteria = goal?.successCriteria?.length
    ? goal.successCriteria
    : ['Defined with Jake before execution.']
  const verification = acceptanceCriteria === goal?.successCriteria
    ? acceptanceCriteria.map(c => `Verify: ${c}`)
    : ['Run the smallest meaningful verification command before reporting done.']
  return {
    ticketKey: ticket.key,
    goal: goal?.why ?? ticket.summary,
    context: ticket.description ? [ticket.description.slice(0, 500)] : ['Jake will provide context in the planning cmux session.'],
    acceptanceCriteria,
    implementationNotes: ['Use repo patterns and Superpowers planning before code changes.'],
    verification,
    risks: ['Under-specified ticket can cause agent drift.'],
    autonomyLevel: 2,
    forbiddenActions: ['Do not merge.', 'Do not deploy.', 'Do not update Jira without approval.'],
    localPlanPath: localPlanPath(ticket)
  }
}

export function isStoryTicket(ticket: JiraTicket): boolean {
  if (ticket.subtasks && ticket.subtasks.length > 0) return true
  if (ticket.issueLinks?.some(l => l.type === 'is parent of' && l.direction === 'outward')) return true
  return false
}

export function getParentKey(ticket: JiraTicket): string | null {
  return ticket.parent?.key ?? null
}

export function buildJiraDescriptionWithBrainLink(ticket: JiraTicket, brainPath: string): string {
  const description = ticket.description ?? ''
  const goalStart = description.indexOf('## Goal')
  if (goalStart === -1) return `${description.trim()}\n\nStory brain: ${brainPath}`
  const afterGoal = description.slice(goalStart)
  const nextSection = afterGoal.indexOf('\n## ', 8)
  const goalOnly = nextSection === -1 ? afterGoal : afterGoal.slice(0, nextSection)
  return `${goalOnly.trim()}\n\nStory brain: ${brainPath}`
}

export function buildStoryBrainFromTickets(
  parentTicket: JiraTicket,
  childTickets: JiraTicket[],
  planContent: string
): StoryBrain {
  const goal = parseGoal(parentTicket.description ?? '')
  const taskGraph: StoryTaskEntry[] = childTickets.map(t => ({
    key: t.key,
    summary: t.summary,
    done: t.status === 'Done',
  }))

  const planSections = childTickets.map(t => {
    const sectionStart = planContent.indexOf(`(${t.key})`)
    if (sectionStart === -1) {
      return { taskKey: t.key, taskSummary: t.summary, content: '' }
    }
    const lineStart = planContent.lastIndexOf('\n', sectionStart)
    const nextSection = planContent.indexOf('\n### Task', lineStart + 1)
    const content = nextSection === -1
      ? planContent.slice(lineStart).trim()
      : planContent.slice(lineStart, nextSection).trim()
    return { taskKey: t.key, taskSummary: t.summary, content }
  })

  return {
    parentKey: parentTicket.key,
    summary: parentTicket.summary,
    goal: goal ?? { why: parentTicket.summary, constraints: [], nonGoals: [], successCriteria: [] },
    taskGraph,
    planSections,
    worktrees: [],
    proof: [],
    status: 'pending',
  }
}

export function buildPlanDescriptionAdf(ticket: JiraTicket, plan: JiraPlan): JiraAdfDocument {
  return upsertTextToDescriptionAdf(ticket.descriptionAdf, renderJiraPlan(plan), 'Agent Q Plan')
}

export async function writePlanWithApproval(
  ticket: JiraTicket,
  plan: JiraPlan,
  tickets?: JiraTicket[]
): Promise<boolean> {
  const parentKey = getParentKey(ticket)
  const parentTicket = parentKey ? tickets?.find(t => t.key === parentKey) : undefined

  // Determine if this ticket should use a story brain
  const brainParent = parentTicket ?? (isStoryTicket(ticket) ? ticket : null)
  const brainPath = brainParent ? storyBrainPath(brainParent) : null

  const rendered = renderJiraPlan(plan)
  console.log(rendered)
  if (brainPath) {
    console.log(`\nStory brain path: ${brainPath}`)
  }

  const answer = await prompt(`\nWrite this plan to ${ticket.key}? Type "${JIRA_PLAN_APPROVAL_PHRASE}" to approve: `)
  if (!hasJiraPlanApproval(answer)) return false

  const permit = assertJiraWritePolicy({ action: 'update-description', ticket, tickets, email: getJiraConfig().email })

  // Always write local plan.md
  const writtenPath = writeLocalPlan(ticket, plan)

  if (brainPath && brainParent) {
    // Write story.md
    const children = tickets?.filter(t => t.parent?.key === brainParent.key) ?? []
    const brain = buildStoryBrainFromTickets(brainParent, children, rendered)
    writeStoryBrain(brainParent, brain)
    console.log(`Story brain written: ${brainPath}`)

    // Jira gets Goal + brain link only
    const jiraDescription = buildJiraDescriptionWithBrainLink(ticket, brainPath)
    const cleanAdf = upsertTextToDescriptionAdf(
      { version: 1, type: 'doc', content: [] },
      jiraDescription,
      'Goal'
    )
    await updateTicketDescription(ticket.key, cleanAdf, permit)
  } else {
    // Standalone task: existing behavior
    await updateTicketDescription(ticket.key, buildPlanDescriptionAdf(ticket, { ...plan, localPlanPath: writtenPath }), permit)
  }

  console.log(`Local plan: ${writtenPath}`)
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

  const wrote = await writePlanWithApproval(ticket, plan, tickets)
  console.log(wrote ? `Wrote Agent Q plan to ${ticket.key}.` : 'Skipped Jira plan write.')
}

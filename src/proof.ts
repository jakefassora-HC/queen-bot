import { readFile } from 'fs/promises'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { getJiraConfig } from './config.js'
import { openCmuxExecutionWorkspace } from './cmux.js'
import { buildExecutionContract } from './execution-command.js'
import { commentOnTicket, transitionTicket } from './jira.js'
import { assertJiraWritePolicy } from './jira-write-policy.js'
import { storyBrainPath } from './local-plan.js'
import { appendProofEntry, updateTaskGraphDone, setStoryStatus, parseTaskGraphStatus } from './story-brain.js'
import type { JiraTicket, ProofReport } from './types.js'

export interface ProofArgs {
  file: string
  comment: boolean
}

function bullets(items: string[]): string {
  return items.length ? items.map(item => `- ${item}`).join('\n') : '- none'
}

export function parseProofArgs(args: string[]): ProofArgs {
  const fileFlag = args.indexOf('--file')
  const flagValue = fileFlag === -1 ? undefined : args[fileFlag + 1]
  const positional = args.find((arg, index) => !arg.startsWith('--') && index !== fileFlag + 1)
  const file = flagValue ?? positional
  if (!file) throw new Error('Usage: agent-queue proof --file <proof-json-path> [--comment]')

  return { file, comment: args.includes('--comment') }
}

export function formatProofReport(report: ProofReport): string {
  const sections = [
    '## Agent Q Proof',
    `Ticket: ${report.ticketKey}`,
    `Branch: ${report.branch}`,
    report.prUrl ? `PR: ${report.prUrl}` : 'PR: none',
    '',
    '### Summary',
    report.summary,
    '',
    '### Files Changed',
    bullets(report.filesChanged),
    '',
    '### Verification',
    bullets(report.verification),
    '',
    '### Residual Risk',
    bullets(report.residualRisk)
  ]

  if (report.goal?.successCriteria && report.goal.successCriteria.length > 0) {
    const criteria = report.goal.successCriteria.map(c => `- [ ] ${c}`).join('\n')
    sections.push('')
    sections.push('## Goal Verification')
    sections.push('')
    sections.push('Check each Success Criterion against the evidence above:')
    sections.push('')
    sections.push(criteria)
  }

  return sections.join('\n')
}

export function assertProofTicketInQueue(report: ProofReport, tickets: JiraTicket[]): JiraTicket {
  const ticket = tickets.find(item => item.key === report.ticketKey)
  if (!ticket) {
    throw new Error(`Proof ticket ${report.ticketKey} is not in the current Jira queue; refusing to comment from an unbound proof file.`)
  }
  return ticket
}

// Find tickets that are now unblocked by the completion of completedKey.
// A ticket is unblocked when all its inward "Blocks" links are either the
// just-completed ticket or not present in the active queue (already done).
export function findUnblockedTickets(completedKey: string, tickets: JiraTicket[]): JiraTicket[] {
  const completedTicket = tickets.find(t => t.key === completedKey)
  if (!completedTicket) return []

  const blockedKeys = (completedTicket.issueLinks ?? [])
    .filter(l => l.type === 'Blocks' && l.direction === 'outward')
    .map(l => l.key)

  return blockedKeys.flatMap(blockedKey => {
    const blockedTicket = tickets.find(t => t.key === blockedKey)
    if (!blockedTicket) return []

    const remainingBlockers = (blockedTicket.issueLinks ?? [])
      .filter(l => l.type === 'Blocks' && l.direction === 'inward')
      .filter(b => b.key !== completedKey && tickets.some(t => t.key === b.key))

    return remainingBlockers.length === 0 ? [blockedTicket] : []
  })
}

export async function runProofCommand(args: string[], tickets: JiraTicket[]): Promise<void> {
  const parsed = parseProofArgs(args)
  const report = JSON.parse(await readFile(parsed.file, 'utf8')) as ProofReport
  const ticket = assertProofTicketInQueue(report, tickets)

  const formatted = formatProofReport(report)
  console.log(formatted)

  if (!parsed.comment) {
    console.log('\nPreview only. Re-run with --comment to post proof to Jira.')
    return
  }

  const permit = assertJiraWritePolicy({ action: 'comment', ticket, tickets, email: getJiraConfig().email })
  await commentOnTicket(report.ticketKey, formatted, permit)
  console.log(`Commented Agent Q proof on ${report.ticketKey}.`)

  // Transition ticket to Done
  try {
    const donePermit = assertJiraWritePolicy({ action: 'transition', ticket, tickets, email: getJiraConfig().email })
    await transitionTicket(report.ticketKey, 'Done', donePermit)
    console.log(`Transitioned ${report.ticketKey} to Done.`)
  } catch (err) {
    console.log(`Could not transition to Done: ${err instanceof Error ? err.message : err}`)
  }

  // Update story brain if it exists
  const storyBrainFile = storyBrainPath(ticket)
  if (existsSync(storyBrainFile)) {
    let md = readFileSync(storyBrainFile, 'utf8')
    md = updateTaskGraphDone(md, report.ticketKey)
    md = appendProofEntry(md, `${report.ticketKey}: ${report.summary.slice(0, 120)} (${new Date().toISOString().slice(0, 10)})`)
    const { total, done } = parseTaskGraphStatus(md)
    if (done === total) md = setStoryStatus(md, 'done')
    else md = setStoryStatus(md, 'in-progress')
    writeFileSync(storyBrainFile, md, 'utf8')
    console.log(`Updated story brain: ${storyBrainFile}`)
  }

  // Auto-progression: open cmux workspaces for any tickets now unblocked
  const unblocked = findUnblockedTickets(report.ticketKey, tickets)
  for (const nextTicket of unblocked) {
    const result = buildExecutionContract(nextTicket)
    if (!result.ok) {
      console.log(`\n🔓 ${nextTicket.key} unblocked but not ready: ${result.reason}`)
      if (result.fix) console.log(`   Fix: ${result.fix}`)
      continue
    }
    console.log(`\n🔓 ${nextTicket.key} unblocked — opening execution workspace...`)
    await openCmuxExecutionWorkspace(result.contract)
  }
}

import { readFile } from 'fs/promises'
import readline from 'readline'
import { commentOnTicket } from './jira.js'
import type { JiraTicket, ProofReport } from './types.js'

export interface ProofArgs {
  file: string
  comment: boolean
}

export const JIRA_PROOF_APPROVAL_PHRASE = 'APPROVE JIRA PROOF'

export function hasProofApproval(answer: string): boolean {
  return answer.trim() === JIRA_PROOF_APPROVAL_PHRASE
}

function bullets(items: string[]): string {
  return items.length ? items.map(item => `- ${item}`).join('\n') : '- none'
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()) }))
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
  return [
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
  ].join('\n')
}

export function assertProofTicketInQueue(report: ProofReport, tickets: JiraTicket[]): JiraTicket {
  const ticket = tickets.find(item => item.key === report.ticketKey)
  if (!ticket) {
    throw new Error(`Proof ticket ${report.ticketKey} is not in the current Jira queue; refusing to comment from an unbound proof file.`)
  }
  return ticket
}

export async function runProofCommand(args: string[], tickets: JiraTicket[]): Promise<void> {
  const parsed = parseProofArgs(args)
  const report = JSON.parse(await readFile(parsed.file, 'utf8')) as ProofReport
  assertProofTicketInQueue(report, tickets)

  const formatted = formatProofReport(report)
  console.log(formatted)

  if (!parsed.comment) {
    console.log(`\nPreview only. Re-run with --comment to request a Jira comment, then type "${JIRA_PROOF_APPROVAL_PHRASE}" after reviewing the proof.`)
    return
  }

  const answer = await prompt(`\nComment this proof on ${report.ticketKey}? Type "${JIRA_PROOF_APPROVAL_PHRASE}" to approve: `)
  if (!hasProofApproval(answer)) {
    console.log('Skipped Jira proof comment.')
    return
  }

  await commentOnTicket(report.ticketKey, formatted)
  console.log(`Commented Agent Q proof on ${report.ticketKey}.`)
}

import readline from 'readline'
import { parseExecutionEngine } from './execution-engine.js'
import { parseJiraPlan } from './jira-plan.js'
import { preflightExecutionTicket, type PreflightMessage, type PreflightOptions } from './preflight.js'
import { scoreTicketReadiness } from './readiness.js'
import { resolveTicketSelection } from './queue-command.js'
import { canStartCmuxFromEnv, cmuxStartHelp, formatCmuxExecutionCommand, openCmuxExecutionWorkspace } from './cmux.js'
import { branchName, prepareExecutionWorktree, repoLocalPath, worktreePath } from './worktree.js'
import { writeRunManifest } from './run-manifest.js'
import type { ExecutionContract, ExecutionEngine, JiraTicket } from './types.js'

export interface ExecuteReadyArgs {
  selections: string[]
  start: boolean
  verbose: boolean
  engine: ExecutionEngine
}

export type ExecutionContractResult =
  | { ok: true; contract: ExecutionContract; warnings: PreflightMessage[] }
  | { ok: false; ticketKey: string; reason: string; fix?: string }

export const EXECUTION_APPROVAL_PHRASE = 'APPROVE EXECUTION'

export function hasExecutionApproval(answer: string): boolean {
  return answer.trim() === EXECUTION_APPROVAL_PHRASE
}

export function buildExecutionBranch(ticketKey: string): string {
  return branchName(ticketKey)
}

export function parseExecuteReadyArgs(args: string[]): ExecuteReadyArgs {
  const engineIndex = args.indexOf('--engine')
  const engine = parseExecutionEngine(engineIndex === -1 ? undefined : args[engineIndex + 1])
  const selections = args.filter((arg, index) => {
    if (arg.startsWith('--')) return false
    return engineIndex === -1 || index !== engineIndex + 1
  })
  if (selections.length === 0) throw new Error('Usage: agent-queue execute-ready <ticket-number-or-key...> [--start]')
  return { selections, start: args.includes('--start'), verbose: args.includes('--verbose') || args.includes('--debug'), engine }
}

export function buildExecutionContract(
  ticket: JiraTicket,
  preflightOptions: PreflightOptions = {},
  engine: ExecutionEngine = 'claude'
): ExecutionContractResult {
  const plan = parseJiraPlan(ticket.description)
  if (!plan) return { ok: false, ticketKey: ticket.key, reason: 'missing Agent Q Plan', fix: `agent-queue plan ${ticket.key} --write` }
  if (plan.ticketKey !== ticket.key) return { ok: false, ticketKey: ticket.key, reason: `Agent Q Plan ticket mismatch: ${plan.ticketKey}` }
  if (!plan.acceptanceCriteria.length) return { ok: false, ticketKey: ticket.key, reason: 'Agent Q Plan is missing acceptance criteria' }
  if (!plan.verification.length) return { ok: false, ticketKey: ticket.key, reason: 'Agent Q Plan is missing verification' }
  if (!plan.forbiddenActions.length) return { ok: false, ticketKey: ticket.key, reason: 'Agent Q Plan is missing forbidden actions' }
  if (!ticket.repo) return { ok: false, ticketKey: ticket.key, reason: 'missing repo label', fix: `add label repo:owner/name to ${ticket.key}` }

  const readiness = scoreTicketReadiness(ticket)
  if (!readiness.canExecute) return { ok: false, ticketKey: ticket.key, reason: readiness.reason }
  if (![2, 3].includes(plan.autonomyLevel)) {
    return { ok: false, ticketKey: ticket.key, reason: `autonomy level ${plan.autonomyLevel} is not executable; use 2 or 3` }
  }

  const preflight = preflightExecutionTicket(ticket, preflightOptions)
  if (!preflight.ok) {
    const first = preflight.blockers[0]
    return { ok: false, ticketKey: ticket.key, reason: first.message, fix: first.fix }
  }

  const repoPath = repoLocalPath(ticket.repo)
  return {
    ok: true,
    contract: {
      ticketKey: ticket.key,
      plan,
      repo: ticket.repo,
      branch: buildExecutionBranch(ticket.key),
      worktreePath: worktreePath(ticket.key, repoPath),
      engine,
      autonomyLevel: plan.autonomyLevel,
      approvedAt: 'pending'
    },
    warnings: preflight.warnings
  }
}

export function formatExecutionPreview(
  contracts: ExecutionContract[],
  rejected: Array<{ ticketKey: string; reason: string; fix?: string }>,
  options: { verbose?: boolean; warnings?: Array<{ ticketKey?: string; message: string; fix?: string }> } = {}
): string {
  const lines = ['Queen Bot execution preview', '']

  if (contracts.length > 0) {
    lines.push('Ready to start:')
    lines.push('')
    contracts.forEach(contract => {
      lines.push(`- [ ] ${contract.ticketKey}`)
      lines.push(`  repo: ${contract.repo}`)
      lines.push(`  engine: ${contract.engine}`)
      lines.push(`  branch: ${contract.branch}`)
      lines.push(`  worktree: ${contract.worktreePath}`)
      lines.push(`  autonomy: ${contract.autonomyLevel}`)
      if (options.verbose) {
        lines.push(`  cmux: ${formatCmuxExecutionCommand(contract)}`)
      } else {
        lines.push(`  context: agent-queue context ${contract.ticketKey} --brief`)
      }
      lines.push('')
    })
    if (!options.verbose) {
      lines.push('Add --verbose to show the full cmux command.')
      lines.push('')
    }
  }

  if (rejected.length > 0) {
    lines.push('Blocked:')
    lines.push('')
    rejected.forEach(item => {
      lines.push(`- ${item.ticketKey}: ${item.reason}`)
      if (item.fix) lines.push(`  fix: ${item.fix}`)
    })
    lines.push('')
  }

  const warnings = options.warnings ?? []
  if (warnings.length > 0) {
    lines.push('Warnings:')
    lines.push('')
    warnings.forEach(item => {
      const prefix = item.ticketKey ? `${item.ticketKey}: ` : ''
      lines.push(`- ${prefix}${item.message}`)
      if (item.fix) lines.push(`  fix: ${item.fix}`)
    })
    lines.push('')
  }

  lines.push(`Start requires --start and exact approval phrase: ${EXECUTION_APPROVAL_PHRASE}`)
  return lines.join('\n')
}

function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(q, answer => { rl.close(); resolve(answer.trim()) }))
}

export async function runExecuteReadyCommand(args: string[], tickets: JiraTicket[]): Promise<void> {
  const parsed = parseExecuteReadyArgs(args)
  const results = parsed.selections.map(selection => {
    const ticket = resolveTicketSelection(tickets, selection)
    if (!ticket) return { ok: false as const, ticketKey: selection, reason: 'ticket not found in current queue' }
    return buildExecutionContract(ticket, {}, parsed.engine)
  })
  const contracts = results.flatMap(result => result.ok ? [result.contract] : [])
  const rejected = results.flatMap(result => result.ok ? [] : [{ ticketKey: result.ticketKey, reason: result.reason, fix: result.fix }])
  const warnings = results.flatMap(result => result.ok ? result.warnings.map(warning => ({ ticketKey: result.contract.ticketKey, ...warning })) : [])

  console.log(formatExecutionPreview(contracts, rejected, { verbose: parsed.verbose, warnings }))
  if (!parsed.start) return
  if (rejected.length > 0) throw new Error('Refusing to start while selected tickets are blocked.')
  if (parsed.engine !== 'claude') {
    throw new Error(`Execution engine ${parsed.engine} is not implemented for cmux start yet. Use --engine claude or run this ticket manually.`)
  }
  if (!canStartCmuxFromEnv()) throw new Error(cmuxStartHelp())

  const answer = await prompt(`\nOpen ${contracts.length} execution workspaces? Type "${EXECUTION_APPROVAL_PHRASE}" to approve: `)
  if (!hasExecutionApproval(answer)) {
    console.log('Skipped execution start.')
    return
  }

  for (const contract of contracts) {
    const prepared = prepareExecutionWorktree(contract)
    const approvedContract = { ...contract, worktreePath: prepared.worktreePath, approvedAt: new Date().toISOString() }
    writeRunManifest(approvedContract, { status: 'running', startedAt: approvedContract.approvedAt })
    await openCmuxExecutionWorkspace(approvedContract)
    console.log(`Opened execution workspace ${contract.ticketKey}`)
  }
}

import { getJiraConfig } from './config.js'
import { commentOnTicket } from './jira.js'
import { assertJiraWriteAllowedForTicket } from './jira-guard.js'
import {
  formatLocalPlanRevisionComment,
  formatSuperPrdChangeComment
} from './plan-comments.js'
import { resolveTicketSelection } from './queue-command.js'
import type { JiraTicket } from './types.js'

export interface PlanCommentArgs {
  selection: string
  localPlanPath?: string
  reason: string
  changes: string[]
  superPrdChange: boolean
}

const VALUE_FLAGS = new Set(['--local-plan', '--reason', '--change'])

function readFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index === -1) return undefined
  const value = args[index + 1]
  return value && !value.startsWith('--') ? value : undefined
}

function readRepeatedFlag(args: string[], flag: string): string[] {
  return args.flatMap((arg, index) => {
    const value = args[index + 1]
    return arg === flag && value && !value.startsWith('--') ? [value] : []
  })
}

function positionalArgs(args: string[]): string[] {
  return args.filter((arg, index) => {
    if (arg.startsWith('--')) return false
    return !VALUE_FLAGS.has(args[index - 1])
  })
}

export function parsePlanCommentArgs(args: string[]): PlanCommentArgs {
  const selection = positionalArgs(args)[0]
  if (!selection) {
    throw new Error('Usage: agent-queue plan-comment <ticket-number-or-key> --reason <text> --change <text> [--local-plan <path> | --super-prd-change]')
  }

  const reason = readFlag(args, '--reason')
  if (!reason) throw new Error('Missing --reason <text>')

  const changes = readRepeatedFlag(args, '--change')
  if (changes.length === 0) throw new Error('Missing at least one --change <text>')

  const superPrdChange = args.includes('--super-prd-change')
  const localPlanPath = readFlag(args, '--local-plan')
  if (!superPrdChange && !localPlanPath) {
    throw new Error('Plan revision comments need --local-plan <path> unless --super-prd-change is set.')
  }

  return {
    selection,
    localPlanPath,
    reason,
    changes,
    superPrdChange
  }
}

export async function runPlanCommentCommand(args: string[], tickets: JiraTicket[]): Promise<void> {
  const parsed = parsePlanCommentArgs(args)
  const ticket = resolveTicketSelection(tickets, parsed.selection)
  if (!ticket) throw new Error(`Ticket not found in current queue: ${parsed.selection}`)

  assertJiraWriteAllowedForTicket(ticket, { email: getJiraConfig().email })

  const comment = parsed.superPrdChange
    ? formatSuperPrdChangeComment({
        ticket,
        reason: parsed.reason,
        changes: parsed.changes
      })
    : formatLocalPlanRevisionComment({
        ticket,
        localPlanPath: parsed.localPlanPath!,
        reason: parsed.reason,
        changes: parsed.changes
      })

  console.log(comment)
  await commentOnTicket(ticket.key, comment)
  console.log(`Commented planning note on ${ticket.key}.`)
}

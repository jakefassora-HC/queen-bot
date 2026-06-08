import { existsSync } from 'fs'
import { parseJiraPlan } from './jira-plan.js'
import { localPlanPath } from './local-plan.js'
import { repoLocalPath } from './worktree.js'
import { workGraphSummary } from './work-graph.js'
import type { JiraTicket } from './types.js'

export interface PreflightMessage {
  message: string
  fix: string
}

export interface ExecutionPreflightResult {
  ok: boolean
  blockers: PreflightMessage[]
  warnings: PreflightMessage[]
}

export interface PreflightOptions {
  localPlanExists?: (planPath: string) => boolean
  repoExists?: (repo: string) => boolean
}

function message(message: string, fix: string): PreflightMessage {
  return { message, fix }
}

export function preflightExecutionTicket(ticket: JiraTicket, options: PreflightOptions = {}): ExecutionPreflightResult {
  const localPlanExists = options.localPlanExists ?? existsSync
  const repoExists = options.repoExists ?? ((repo: string) => existsSync(repoLocalPath(repo)))
  const blockers: PreflightMessage[] = []
  const warnings: PreflightMessage[] = []
  const plan = parseJiraPlan(ticket.description || '')

  if (!plan) {
    blockers.push(message('missing Agent Q Plan', `agent-queue plan ${ticket.key} --write`))
  } else {
    const planPath = plan.localPlanPath ?? localPlanPath(ticket)
    if (!localPlanExists(planPath)) {
      blockers.push(message(`local plan missing: ${planPath}`, `agent-queue plan ${ticket.key} --write`))
    }
  }

  if (!ticket.repo) {
    blockers.push(message('missing repo label', `add label repo:owner/name to ${ticket.key}`))
  } else if (!repoExists(ticket.repo)) {
    warnings.push(message(`local repo checkout not found for ${ticket.repo}`, 'Queen will use the managed clone path if execution starts.'))
  }

  const graph = workGraphSummary(ticket)
  if (!graph.executionAllowedBySize) {
    blockers.push(message(graph.storyPointPolicy, `link child tickets or execute a smaller ticket instead of ${ticket.key}`))
  }

  return { ok: blockers.length === 0, blockers, warnings }
}

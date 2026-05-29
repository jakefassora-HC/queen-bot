import readline from 'readline'
import { fetchQueue } from './jira.js'
import { generatePlan } from './plan.js'
import { route } from './route.js'
import { createWorktree, removeWorktree, branchName } from './worktree.js'
import { spawnDocker } from './spawn-docker.js'
import { spawnNative } from './spawn-native.js'
import { commitAndPush, openDraftPr } from './pr.js'
import { writeRun, updateRun, activeRuns } from './state.js'
import { getModel } from './models.js'
import { runDraftCommand } from './draft-command.js'
import { getJiraConfig } from './config.js'
import { formatQueue, formatTicketDetails, resolveTicketSelection } from './queue-command.js'
import { formatCmuxCommand } from './cmux.js'
import { formatQueenDashboard, formatReadinessQueue } from './readiness-command.js'
import { runPlanCommand } from './plan-command.js'
import { runProofCommand } from './proof.js'
import { runExecuteReadyCommand } from './execution-command.js'
import { runContextCommand } from './context-command.js'
import type { JiraTicket } from './types.js'

function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(q, a => { rl.close(); resolve(a.trim()) }))
}

async function runTicket(ticket: JiraTicket): Promise<void> {
  console.log(`\n  Generating plan for ${ticket.key}...`)
  const plan = await generatePlan(ticket)
  const r = route(ticket)

  if (!r.runtime) {
    console.log(`  ⚠  ${ticket.key} blocked: ${r.reason}`)
    return
  }

  if (!ticket.repo) {
    console.log(`  ⚠  ${ticket.key} has no repo label. Add label "repo:owner/name" in Jira.`)
    return
  }

  const model = getModel(r.runtime)
  console.log(`\n  Runtime: ${r.runtime}  Repo: ${ticket.repo}  Model: ${model}`)
  console.log('\n' + plan.raw.split('\n').map(l => '  ' + l).join('\n'))

  const answer = await prompt('\n  Approve? [y/n/r(evise)]: ')
  if (answer !== 'y') { console.log('  Skipped.'); return }

  const worktree = createWorktree(ticket.key, ticket.repo)
  const startedAt = new Date().toISOString()
  const start = Date.now()

  await writeRun({
    ticket: ticket.key,
    runtime: r.runtime,
    model,
    status: 'running',
    worktree,
    branch: branchName(ticket.key),
    startedAt
  })

  console.log(`  → Agent running. Watch this window or switch cmux workspaces.\n`)

  try {
    if (r.runtime === 'claude-docker') {
      await spawnDocker(worktree, plan.raw, '')
    } else {
      await spawnNative(worktree, plan.raw)
    }

    commitAndPush(worktree, ticket.key, ticket.summary)
    const prUrl = await openDraftPr(ticket.key, ticket.summary, plan.raw)
    const elapsed = Math.floor((Date.now() - start) / 1000)
    const mins = Math.floor(elapsed / 60), secs = elapsed % 60

    await updateRun(ticket.key, { status: 'done', pr: prUrl, finishedAt: new Date().toISOString() })
    console.log(`\n  ✅ ${ticket.key} done in ${mins}m ${secs}s`)
    console.log(`  PR: ${prUrl}`)
    removeWorktree(ticket.key, ticket.repo!)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await updateRun(ticket.key, { status: 'failed', error: msg })
    console.error(`\n  ❌ ${ticket.key} failed: ${msg}`)
  }
}

async function loadQueue(): Promise<JiraTicket[] | null> {
  try {
    const tickets = await fetchQueue()
    if (tickets.length === 0) {
      const config = getJiraConfig()
      const scope = config.project ? ` in ${config.project}` : ''
      console.log(`No open tickets assigned to ${config.email}${scope}.`)
      return null
    }

    return tickets
  } catch (err) {
    console.error(`  ❌ Jira error: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args[0] === 'draft') {
    await runDraftCommand(args.slice(1))
    return
  }

  if (args[0] === 'status') {
    const runs = await activeRuns()
    if (runs.length === 0) { console.log('No active runs.'); return }
    runs.forEach(r => console.log(`  ${r.ticket}  ${r.status}  ${r.runtime}  started: ${r.startedAt}`))
    return
  }

  const tickets = await loadQueue()
  if (!tickets) {
    return
  }

  if (args[0] === 'proof') {
    await runProofCommand(args.slice(1), tickets)
    return
  }

  if (args[0] === 'list') {
    console.log(formatQueue(tickets))
    return
  }

  if (args[0] === 'readiness') {
    console.log(formatReadinessQueue(tickets))
    return
  }

  if (args[0] === 'dashboard') {
    console.log(formatQueenDashboard(tickets))
    return
  }

  if (args[0] === 'plan') {
    await runPlanCommand(args.slice(1), tickets)
    return
  }

  if (args[0] === 'execute-ready') {
    await runExecuteReadyCommand(args.slice(1), tickets)
    return
  }

  if (args[0] === 'context') {
    await runContextCommand(args.slice(1), tickets)
    return
  }

  if (args[0] === 'show') {
    const selection = args[1]
    if (!selection) {
      console.error('Usage: agent-queue show <ticket-number-or-key>')
      process.exitCode = 1
      return
    }

    const ticket = resolveTicketSelection(tickets, selection)
    if (!ticket) {
      console.error(`Ticket not found in current queue: ${selection}`)
      process.exitCode = 1
      return
    }

    console.log(formatTicketDetails(ticket))
    return
  }

  if (args[0] === 'run') {
    const selection = args[1]
    if (!selection) {
      console.error('Usage: agent-queue run <ticket-number-or-key>')
      process.exitCode = 1
      return
    }

    const ticket = resolveTicketSelection(tickets, selection)
    if (!ticket) {
      console.error(`Ticket not found in current queue: ${selection}`)
      process.exitCode = 1
      return
    }

    await runTicket(ticket)
    return
  }

  if (args[0] === 'cmux') {
    const start = args.includes('--start')
    const selections = args.slice(1).filter(arg => arg !== '--start')
    if (selections.length === 0) {
      console.error('Usage: agent-queue cmux <ticket-number-or-key...> [--start]')
      process.exitCode = 1
      return
    }

    const selectedTickets = selections.map(selection => {
      const ticket = resolveTicketSelection(tickets, selection)
      if (!ticket) throw new Error(`Ticket not found in current queue: ${selection}`)
      return ticket
    })

    if (!start) {
      console.log('Preview only. Add --start after Jake approves opening these cmux workspaces.\n')
      selectedTickets.forEach(ticket => console.log(formatCmuxCommand(process.cwd(), ticket.key)))
      return
    }

    console.error('Direct cmux --start is disabled. Use agent-queue execute-ready <ticket...> --start so execution goes through Jira plan, repo, worktree, and approval gates.')
    process.exitCode = 1
    return
  }

  console.log(formatQueenDashboard(tickets))
  const input = await prompt('\n  Pick tickets to preview Agent Q plans (Enter to skip): ')
  if (!input) return

  const selected = input.split(',').map(s => parseInt(s.trim()) - 1).filter(i => i >= 0 && i < tickets.length)

  for (const idx of selected) {
    await runPlanCommand([tickets[idx].key], tickets)
  }
}

main().catch(err => {
  console.error(`  ❌ ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})

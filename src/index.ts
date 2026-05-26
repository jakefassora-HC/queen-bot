import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') })
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
import type { JiraTicket } from './types.js'

function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(q, a => { rl.close(); resolve(a.trim()) }))
}

function renderQueue(tickets: JiraTicket[]): void {
  console.log('\n  agent-queue\n  ' + '─'.repeat(50))
  tickets.forEach((t, i) => {
    const size = t.size.padEnd(6)
    console.log(`  ${i + 1}. ${t.key}  ${size}  ${t.summary}`)
  })
  console.log('  ' + '─'.repeat(50))
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

  console.log(`  → Agent running. Watch this window or switch tmux panes.\n`)

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

export async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args[0] === 'status') {
    const runs = await activeRuns()
    if (runs.length === 0) { console.log('No active runs.'); return }
    runs.forEach(r => console.log(`  ${r.ticket}  ${r.status}  ${r.runtime}  started: ${r.startedAt}`))
    return
  }

  const tickets = await fetchQueue()
  if (tickets.length === 0) { console.log('No ai-candidate tickets found.'); return }

  renderQueue(tickets)
  const input = await prompt('\n  Pick tickets (e.g. 1,3): ')
  const selected = input.split(',').map(s => parseInt(s.trim()) - 1).filter(i => i >= 0 && i < tickets.length)

  for (const idx of selected) {
    await runTicket(tickets[idx])
  }
}

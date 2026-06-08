import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { renderGoal } from './jira-goal.js'
import { storyBrainPath } from './local-plan.js'
import type { ExecutionContract } from './types.js'

export const DEFAULT_CMUX_BINARY = '/Applications/cmux.app/Contents/Resources/bin/cmux'

function shellPreviewQuote(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value
  return `"${value.replace(/(["\\$`])/g, '\\$1')}"`
}

export function cmuxWorkspaceName(ticketKey: string): string {
  return ticketKey.trim().toUpperCase()
}

export function resolveCmuxBinary(
  env: NodeJS.ProcessEnv = process.env,
  exists: (path: string) => boolean = existsSync
): string {
  if (env.CMUX_BIN) return env.CMUX_BIN
  if (exists(DEFAULT_CMUX_BINARY)) return DEFAULT_CMUX_BINARY
  return 'cmux'
}

export function canStartCmuxFromEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.CMUX_WORKSPACE_ID || env.AGENT_QUEUE_ALLOW_EXTERNAL_CMUX === '1')
}

export function cmuxStartHelp(): string {
  return [
    'cmux start is blocked from this shell.',
    'Your cmux app is configured to allow only processes started inside cmux to control workspaces.',
    'Run this command from a terminal inside cmux, or set AGENT_QUEUE_ALLOW_EXTERNAL_CMUX=1 after changing cmux socket access settings to allow external local processes.'
  ].join('\n')
}

export function buildClaudeHandoffPrompt(ticketKey: string, contract?: ExecutionContract): string {
  const key = cmuxWorkspaceName(ticketKey)

  const goalBlock = contract?.goal
    ? [
        '## Goal (source of truth)',
        '',
        renderGoal(contract.goal),
        '',
        'The Goal above is your primary constraint. If the Plan conflicts with the Goal, the Goal wins.',
      ].join('\n')
    : ''

  const storyBrainFile = contract ? storyBrainPath(contract.ticketKey) : null
  const hasBrain = Boolean(storyBrainFile && existsSync(storyBrainFile))

  const sections: string[] = []

  sections.push(`You are Agent Q for Jira ticket ${key}.`)

  if (goalBlock) sections.push(goalBlock)

  if (hasBrain && storyBrainFile) {
    sections.push([
      '## Story Brain',
      '',
      'Your full execution context is in the story brain file:',
      `  ${storyBrainFile}`,
      '',
      'Read this file first. It contains the Goal, Task Graph (completion status), Plan sections for each task, Worktrees, Proof history, and Status.',
      'Update Task Graph checkboxes as you complete each task.',
      'Append proof entries when you verify work.',
    ].join('\n'))
  }

  sections.push([
    '## Execution Rules',
    '',
    '- Execute only after the ticket has an approved Jira plan and autonomy level.',
    '- Use an isolated worktree and branch for implementation.',
    '- Do not create, update, or transition Jira tickets without Jake explicitly approving the exact write.',
    '- Do not run agent-queue from inside this session.',
    '- Use Superpowers: brainstorm/plan first, TDD for changes, systematic debugging for failures, verify before claiming completion.',
    '- Dispatch parallel agents for independent work when safe (superpowers:dispatching-parallel-agents).',
    '- Move fast inside the approved contract; stop before forbidden writes, merges, deploys, or unclear scope changes.',
  ].join('\n'))

  if (contract) {
    const proofFile = `/tmp/proof-${key}.json`
    const startLines = [
      '## Start Sequence',
      '',
      hasBrain && storyBrainFile
        ? `1. Read story brain: ${storyBrainFile}`
        : `1. Run: cd ~/projects/agent-queue && agent-queue context ${key} --brief`,
      '2. Print this execution brief and wait for Jake to type "proceed":',
      `   TICKET: ${key}`,
    ]
    if (contract.goal) {
      startLines.push(`   GOAL: ${contract.goal.why}`)
      if (contract.goal.successCriteria.length > 0) {
        startLines.push(`   SUCCESS: ${contract.goal.successCriteria.join(' | ')}`)
      }
    }
    startLines.push(
      '3. After "proceed": sanity-check repo, then execute inside the approved contract.',
      `   repo: ${contract.repo}`,
      `   branch: ${contract.branch}`,
      `   worktree: ${contract.worktreePath}`,
      `   autonomy: ${contract.autonomyLevel}`,
      '',
      '## On Completion',
      '',
      `Write proof file: ${proofFile}`,
      `{ "ticketKey": "${key}", "branch": "<branch>", "prUrl": "<url or null>", "summary": "<one paragraph>", "filesChanged": ["<path>"], "verification": ["<what you ran>"], "residualRisk": ["<anything incomplete>"] }`,
      '',
      `Then run: cd ~/projects/agent-queue && agent-queue proof --file ${proofFile} --comment`,
    )
    if (hasBrain) startLines.push('Update the story brain Task Graph checkboxes for completed tasks.')
    sections.push(startLines.join('\n'))
  } else {
    sections.push([
      '## Start Sequence',
      '',
      `1. Run: cd ~/projects/agent-queue && agent-queue show ${key}`,
      '2. Read the Jira output as source context.',
      '3. Propose the plan and wait for Jake before implementing.',
    ].join('\n'))
  }

  return sections.join('\n\n')
}

export function buildCmuxAgentCommand(ticketKey: string, cmuxBinary = resolveCmuxBinary(), contract?: ExecutionContract): string {
  const key = cmuxWorkspaceName(ticketKey)
  const autoFlag = contract && contract.autonomyLevel >= 2 ? ' --dangerously-skip-permissions' : ''
  return [
    `${shellPreviewQuote(cmuxBinary)} rename-workspace ${shellPreviewQuote(key)}`,
    `claude${autoFlag} --name ${shellPreviewQuote(key)} -p ${shellPreviewQuote(buildClaudeHandoffPrompt(key, contract))}`
  ].join(' && ')
}

export function buildCmuxWorkspaceArgs(
  projectDir: string,
  ticketKey: string,
  cmuxBinary = resolveCmuxBinary()
): string[] {
  const key = cmuxWorkspaceName(ticketKey)
  return [
    'new-workspace',
    '--cwd',
    projectDir,
    '--command',
    buildCmuxAgentCommand(key, cmuxBinary)
  ]
}

export function formatCmuxCommand(
  projectDir: string,
  ticketKey: string,
  binary = resolveCmuxBinary()
): string {
  return [binary, ...buildCmuxWorkspaceArgs(projectDir, ticketKey, binary).map(shellPreviewQuote)].join(' ')
}

export function buildCmuxExecutionWorkspaceArgs(
  contract: ExecutionContract,
  cmuxBinary = resolveCmuxBinary()
): string[] {
  const key = cmuxWorkspaceName(contract.ticketKey)
  return [
    'new-workspace',
    '--cwd',
    contract.worktreePath,
    '--command',
    buildCmuxAgentCommand(key, cmuxBinary, contract)
  ]
}

export function formatCmuxExecutionCommand(
  contract: ExecutionContract,
  binary = resolveCmuxBinary()
): string {
  return [binary, ...buildCmuxExecutionWorkspaceArgs(contract, binary).map(shellPreviewQuote)].join(' ')
}

export function openCmuxTicketWorkspace(projectDir: string, ticketKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const binary = resolveCmuxBinary()
    const proc = spawn(binary, buildCmuxWorkspaceArgs(projectDir, ticketKey, binary), {
      stdio: 'inherit',
      shell: false
    })

    proc.on('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`cmux exited with code ${code}`))
    })
  })
}

export function openCmuxExecutionWorkspace(contract: ExecutionContract): Promise<void> {
  return new Promise((resolve, reject) => {
    const binary = resolveCmuxBinary()
    const proc = spawn(binary, buildCmuxExecutionWorkspaceArgs(contract, binary), {
      stdio: 'inherit',
      shell: false
    })

    proc.on('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`cmux exited with code ${code}`))
    })
  })
}

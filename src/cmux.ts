import { spawn } from 'child_process'
import { existsSync } from 'fs'
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
  const lines = [
    `You are Agent Q for Jira ticket ${key}.`,
    'Execute only after the ticket has an approved Jira plan and autonomy level.',
    'Use an isolated worktree and branch for implementation.',
    'If the Jira plan is missing or weak, stop and improve Jira first.',
    'Do not create, update, or transition Jira tickets without Jake explicitly approving the exact write.',
    'Do not run agent-queue run from inside this session; that would spawn another non-interactive Claude process.',
    'Use Superpowers as the quality protocol: brainstorm/plan first, use TDD for changes, use systematic debugging for failures, and verify before claiming completion.',
    'After Jake approves the plan and autonomy level, dispatch parallel agents for independent research, implementation, review, or verification domains whenever doing so is safe and useful.',
    'Keep bounded autonomy: move fast inside the approved contract, but stop before forbidden writes, merges, deploys, or unclear scope changes.'
  ]

  if (contract) {
    lines.push('Start by running:')
    lines.push(`cd ~/projects/agent-queue && agent-queue context ${key} --brief`)
    lines.push('Use that compact execution packet as source context. If it includes a configured local plan path, read that file too. Do not dump full Jira unless debugging.')
    lines.push('Execution is already approved. After reading Jira context and sanity-checking the repo, give a concise implementation outline and begin implementation inside the approved contract without asking Jake to approve the plan again.')
    lines.push(`Approved execution contract: repo ${contract.repo}, branch ${contract.branch}, worktree ${contract.worktreePath}, autonomy level ${contract.autonomyLevel}.`)
    lines.push(`After reading Jira context, work in this directory: ${contract.worktreePath}.`)
  } else {
    lines.push('Start by running:')
    lines.push(`cd ~/projects/agent-queue && agent-queue show ${key}`)
    lines.push('Use that Jira output as source context in this Claude session.')
    lines.push('After you understand the ticket, propose the plan and wait for Jake before implementing.')
  }

  return lines.join(' ')
}

export function buildCmuxAgentCommand(ticketKey: string, cmuxBinary = resolveCmuxBinary(), contract?: ExecutionContract): string {
  const key = cmuxWorkspaceName(ticketKey)
  return [
    `${shellPreviewQuote(cmuxBinary)} rename-workspace ${shellPreviewQuote(key)}`,
    `claude --name ${shellPreviewQuote(key)} ${shellPreviewQuote(buildClaudeHandoffPrompt(key, contract))}`
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

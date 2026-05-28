import { spawn } from 'child_process'
import { existsSync } from 'fs'

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

export function buildCmuxAgentCommand(ticketKey: string, cmuxBinary = resolveCmuxBinary()): string {
  const key = cmuxWorkspaceName(ticketKey)
  return `${shellPreviewQuote(cmuxBinary)} rename-workspace ${shellPreviewQuote(key)} && agent-queue run ${shellPreviewQuote(key)}`
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

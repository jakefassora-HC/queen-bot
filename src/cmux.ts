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

export function buildCmuxAgentCommand(ticketKey: string): string {
  return `agent-queue run ${cmuxWorkspaceName(ticketKey)}`
}

export function buildCmuxWorkspaceArgs(projectDir: string, ticketKey: string): string[] {
  const key = cmuxWorkspaceName(ticketKey)
  return [
    'new-workspace',
    '--name',
    key,
    '--cwd',
    projectDir,
    '--command',
    buildCmuxAgentCommand(key)
  ]
}

export function formatCmuxCommand(
  projectDir: string,
  ticketKey: string,
  binary = resolveCmuxBinary()
): string {
  return [binary, ...buildCmuxWorkspaceArgs(projectDir, ticketKey).map(shellPreviewQuote)].join(' ')
}

export function openCmuxTicketWorkspace(projectDir: string, ticketKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(resolveCmuxBinary(), buildCmuxWorkspaceArgs(projectDir, ticketKey), {
      stdio: 'inherit',
      shell: false
    })

    proc.on('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`cmux exited with code ${code}`))
    })
  })
}

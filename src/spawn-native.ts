import { spawn } from 'child_process'
import { AGENT_TIMEOUT_SECONDS } from './config.js'

const ALLOWED_TOOLS = [
  'Read', 'Edit', 'Write',
  'Bash(npm test*)', 'Bash(npm run test*)', 'Bash(npm run lint*)',
  'Bash(git diff*)', 'Bash(git status)', 'Bash(git log*)', 'Bash(git add*)',
  'Bash(git commit*)'
].join(',')

export function buildClaudeArgs(worktreePath: string, plan: string): string[] {
  return [
    '--bare',
    '--permission-mode', 'dontAsk',
    '--allowedTools', ALLOWED_TOOLS,
    '--cwd', worktreePath,
    '-p', plan   // plan passed as argument value, spawn called with shell: false
  ]
}

export function spawnNative(worktreePath: string, plan: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'timeout',
      [String(AGENT_TIMEOUT_SECONDS), 'claude', ...buildClaudeArgs(worktreePath, plan)],
      { stdio: 'inherit', shell: false }
    )

    proc.on('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`Claude agent exited with code ${code}`))
    })
  })
}

import { spawn } from 'child_process'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { DOCKER_IMAGE, AGENT_TIMEOUT_SECONDS } from './config.js'

export function buildDockerArgs(worktreePath: string, planFile: string, anthropicKey: string): string[] {
  return [
    'run', '--rm',
    '--network', 'none',
    '--read-only',
    '--tmpfs', '/tmp',
    '-v', `${worktreePath}:/workspace`,
    '-v', `${planFile}:/plan.txt:ro`,
    '-e', `ANTHROPIC_API_KEY=${anthropicKey}`,
    DOCKER_IMAGE,
    '--allowedTools', 'Read,Edit,Write,Bash(npm test*),Bash(npm run lint*),Bash(git diff*),Bash(git status)',
    '-p', '@/plan.txt'   // claude reads plan from file, not shell arg
  ]
}

export function spawnDocker(worktreePath: string, plan: string, anthropicKey: string): Promise<void> {
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'aq-plan-'))
  const planFile = path.join(tmpDir, 'plan.txt')
  writeFileSync(planFile, plan, 'utf8')

  return new Promise((resolve, reject) => {
    const args = buildDockerArgs(worktreePath, planFile, anthropicKey)
    const proc = spawn('timeout', [String(AGENT_TIMEOUT_SECONDS), 'docker', ...args], {
      stdio: 'inherit',
      shell: false
    })

    proc.on('exit', code => {
      rmSync(tmpDir, { recursive: true })
      if (code === 0) resolve()
      else reject(new Error(`Docker agent exited with code ${code}`))
    })
  })
}

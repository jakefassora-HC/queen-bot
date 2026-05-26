import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { REPO_PATH } from './config.js'

export function worktreePath(ticketKey: string, repoPath = REPO_PATH): string {
  return path.join(path.dirname(repoPath), '.agent-worktrees', ticketKey)
}

export function branchName(ticketKey: string): string {
  return `agent/${ticketKey}`
}

export function createWorktree(ticketKey: string): string {
  const wtPath = worktreePath(ticketKey)
  const branch = branchName(ticketKey)

  if (existsSync(wtPath)) {
    console.log(`  Worktree already exists: ${wtPath}`)
    return wtPath
  }

  execSync(`git -C ${REPO_PATH} worktree add ${wtPath} -b ${branch} main`, {
    stdio: 'inherit'
  })
  return wtPath
}

export function removeWorktree(ticketKey: string): void {
  const wtPath = worktreePath(ticketKey)
  if (!existsSync(wtPath)) return
  execSync(`git -C ${REPO_PATH} worktree remove ${wtPath} --force`, { stdio: 'inherit' })
}

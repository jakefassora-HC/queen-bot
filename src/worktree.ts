import { execFileSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { REPOS_DIR } from './config.js'
import type { ExecutionContract } from './types.js'

export function repoLocalPath(repo: string): string {
  const name = repo.split('/')[1] ?? repo
  return path.join(REPOS_DIR, name)
}

export function ensureRepo(repo: string): string {
  const localPath = repoLocalPath(repo)
  if (!existsSync(localPath)) {
    console.log(`  Cloning ${repo}...`)
    mkdirSync(REPOS_DIR, { recursive: true })
    execFileSync('gh', ['repo', 'clone', repo, localPath], { stdio: 'inherit' })
  }
  // Always pull latest main before branching
  execFileSync('git', ['-C', localPath, 'fetch', 'origin', 'main', '--quiet'], { stdio: 'inherit' })
  return localPath
}

export function worktreePath(ticketKey: string, repoPath: string): string {
  return path.join(path.dirname(repoPath), '.agent-worktrees', ticketKey)
}

export function branchName(ticketKey: string): string {
  return `agent/${ticketKey.trim().toUpperCase()}`
}

export interface PreparedExecutionWorktree {
  repoPath: string
  worktreePath: string
  branch: string
}

export function prepareExecutionWorktree(contract: ExecutionContract): PreparedExecutionWorktree {
  const repoPath = ensureRepo(contract.repo)
  const wtPath = worktreePath(contract.ticketKey, repoPath)

  if (existsSync(wtPath)) {
    const currentBranch = execFileSync('git', ['-C', wtPath, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim()
    if (currentBranch !== contract.branch) {
      throw new Error(`Existing worktree ${wtPath} is on ${currentBranch}, expected ${contract.branch}.`)
    }
    return { repoPath, worktreePath: wtPath, branch: contract.branch }
  }

  execFileSync('git', ['-C', repoPath, 'worktree', 'add', wtPath, '-b', contract.branch, 'origin/main'], { stdio: 'inherit' })
  return { repoPath, worktreePath: wtPath, branch: contract.branch }
}

export function createWorktree(ticketKey: string, repo: string): string {
  const repoPath = ensureRepo(repo)
  const wtPath = worktreePath(ticketKey, repoPath)
  const branch = branchName(ticketKey)

  if (existsSync(wtPath)) return wtPath

  execFileSync('git', ['-C', repoPath, 'worktree', 'add', wtPath, '-b', branch, 'origin/main'], { stdio: 'inherit' })
  return wtPath
}

export function removeWorktree(ticketKey: string, repo: string): void {
  const repoPath = repoLocalPath(repo)
  const wtPath = worktreePath(ticketKey, repoPath)
  if (!existsSync(wtPath)) return
  execFileSync('git', ['-C', repoPath, 'worktree', 'remove', wtPath, '--force'], { stdio: 'inherit' })
}

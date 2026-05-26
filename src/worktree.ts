import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { REPOS_DIR } from './config.js'

export function repoLocalPath(repo: string): string {
  const name = repo.split('/')[1] ?? repo
  return path.join(REPOS_DIR, name)
}

export function ensureRepo(repo: string): string {
  const localPath = repoLocalPath(repo)
  if (!existsSync(localPath)) {
    console.log(`  Cloning ${repo}...`)
    mkdirSync(REPOS_DIR, { recursive: true })
    execSync(`gh repo clone ${repo} ${localPath}`, { stdio: 'inherit' })
  }
  // Always pull latest main before branching
  execSync(`git -C ${localPath} fetch origin main --quiet`, { stdio: 'inherit' })
  return localPath
}

export function worktreePath(ticketKey: string, repoPath: string): string {
  return path.join(path.dirname(repoPath), '.agent-worktrees', ticketKey)
}

export function branchName(ticketKey: string): string {
  return `agent/${ticketKey}`
}

export function createWorktree(ticketKey: string, repo: string): string {
  const repoPath = ensureRepo(repo)
  const wtPath = worktreePath(ticketKey, repoPath)
  const branch = branchName(ticketKey)

  if (existsSync(wtPath)) return wtPath

  execSync(`git -C ${repoPath} worktree add ${wtPath} -b ${branch} origin/main`, { stdio: 'inherit' })
  return wtPath
}

export function removeWorktree(ticketKey: string, repo: string): void {
  const repoPath = repoLocalPath(repo)
  const wtPath = worktreePath(ticketKey, repoPath)
  if (!existsSync(wtPath)) return
  execSync(`git -C ${repoPath} worktree remove ${wtPath} --force`, { stdio: 'inherit' })
}

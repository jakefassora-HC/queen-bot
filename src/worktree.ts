import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readdirSync } from 'fs'
import path from 'path'
import { REPOS_DIR } from './config.js'
import type { ExecutionContract } from './types.js'

export interface RepoDiscoveryOptions {
  home?: string
  reposDir?: string
  envPaths?: string[]
  exists?: (candidate: string) => boolean
  readdir?: (dir: string) => string[]
  getRemoteUrl?: (candidate: string) => string | undefined
}

function repoName(repo: string): string {
  const name = repo.split('/')[1] ?? repo
  return name.replace(/\.git$/, '')
}

function managedRepoPath(repo: string, reposDir: string): string {
  return path.join(reposDir, repoName(repo))
}

function defaultReaddir(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
  } catch {
    return []
  }
}

function defaultGetRemoteUrl(candidate: string): string | undefined {
  try {
    return execFileSync('git', ['-C', candidate, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return undefined
  }
}

export function normalizeRepoRef(value: string): string | undefined {
  const trimmed = value.trim().replace(/\.git$/, '')
  const sshMatch = trimmed.match(/github\.com:([^/]+\/[^/]+)$/i)
  const urlMatch = trimmed.match(/github\.com\/([^/]+\/[^/]+)$/i)
  const plainMatch = trimmed.match(/^([^/\s]+\/[^/\s]+)$/)
  const repo = sshMatch?.[1] ?? urlMatch?.[1] ?? plainMatch?.[1]
  return repo?.toLowerCase()
}

export function remoteMatchesRepo(remoteUrl: string, repo: string): boolean {
  return normalizeRepoRef(remoteUrl) === normalizeRepoRef(repo)
}

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths.filter(Boolean)))
}

export function findExistingRepo(repo: string, options: RepoDiscoveryOptions = {}): string | undefined {
  const home = options.home ?? process.env.HOME ?? ''
  const reposDir = options.reposDir ?? REPOS_DIR
  const exists = options.exists ?? existsSync
  const readdir = options.readdir ?? defaultReaddir
  const getRemoteUrl = options.getRemoteUrl ?? defaultGetRemoteUrl
  const name = repoName(repo)
  const ownerName = repo.replace('/', '-')
  const projectsDir = home ? path.join(home, 'projects') : ''
  const envPaths = options.envPaths ?? (process.env.AGENT_QUEUE_REPO_PATHS ?? '').split(path.delimiter)

  const candidates = uniquePaths([
    ...envPaths,
    projectsDir ? path.join(projectsDir, name) : '',
    projectsDir ? path.join(projectsDir, `${name}-v2`) : '',
    projectsDir ? path.join(projectsDir, ownerName) : '',
    ...(projectsDir ? readdir(projectsDir).map(entry => path.join(projectsDir, entry)) : []),
    managedRepoPath(repo, reposDir)
  ])

  return candidates.find(candidate => {
    if (!exists(candidate)) return false
    const remoteUrl = getRemoteUrl(candidate)
    return remoteUrl ? remoteMatchesRepo(remoteUrl, repo) : false
  })
}

export function repoLocalPath(repo: string, options: RepoDiscoveryOptions = {}): string {
  const reposDir = options.reposDir ?? REPOS_DIR
  return findExistingRepo(repo, options) ?? managedRepoPath(repo, reposDir)
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

import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import type { ExecutionContract, RunManifest, RunManifestStatus } from './types.js'

export function runManifestPath(planPath: string): string {
  return path.join(path.dirname(planPath), 'manifest.json')
}

export function buildRunManifest(
  contract: ExecutionContract,
  options: { status: RunManifestStatus; startedAt?: string } = { status: 'pending' }
): RunManifest {
  return {
    ticketKey: contract.ticketKey,
    repo: contract.repo,
    branch: contract.branch,
    worktreePath: contract.worktreePath,
    engine: contract.engine,
    status: options.status,
    planPath: contract.plan.localPlanPath ?? '',
    allowedWrites: ['comment'],
    startedAt: options.startedAt ?? contract.approvedAt
  }
}

export function writeRunManifest(
  contract: ExecutionContract,
  options: { status: RunManifestStatus; startedAt?: string } = { status: 'pending' }
): string {
  const planPath = contract.plan.localPlanPath
  if (!planPath) throw new Error(`Cannot write run manifest for ${contract.ticketKey}: missing local plan path.`)
  const filePath = runManifestPath(planPath)
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(buildRunManifest(contract, options), null, 2) + '\n', 'utf8')
  return filePath
}

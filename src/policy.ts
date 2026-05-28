import type { JiraTicket } from './types.js'
import { minimatch } from 'minimatch'

const BLOCKED_PATH_PATTERNS = [
  '.github/workflows/**',
  'infra/**',
  'terraform/**',
  'k8s/**',
  'helm/**',
  'migrations/**',
  'auth/**',
  'billing/**',
  'payments/**',
  '.env*',
  'secrets/**'
]

const MAX_DIFF_LINES = 500
const MAX_FILES_CHANGED = 10

export function isHighRisk(ticket: JiraTicket): boolean {
  const isLarge = ticket.storyPoints !== null && ticket.storyPoints > 5
  return ticket.labels.includes('risk-high') || isLarge && ticket.labels.includes('no-ai')
}

export function isBlockedPath(filePath: string): boolean {
  return BLOCKED_PATH_PATTERNS.some(pattern => minimatch(filePath, pattern))
}

export function isWithinLimits(diffLines: number, filesChanged: number): boolean {
  return diffLines <= MAX_DIFF_LINES && filesChanged <= MAX_FILES_CHANGED
}

export interface JiraTicket {
  id: string
  key: string
  summary: string
  description: string
  size: 'small' | 'medium' | 'large'
  labels: string[]
  status: string
  repo?: string  // parsed from label "repo:owner/name"
}

export interface ResearchSource {
  title: string
  url: string
  notes: string
}

export interface TicketDraft {
  summary: string
  issueType: string
  problem: string
  goal: string
  nonGoals: string[]
  acceptanceCriteria: string[]
  researchNotes: string[]
  risks: string[]
  definitionOfDone: string[]
  labels: string[]
  relatedRepos: string[]
}

export interface TicketDraftRequest {
  idea: string
  sources: ResearchSource[]
  projectKey: string
  maxTickets: number
}

export interface Plan {
  ticketKey: string
  raw: string
}

export type Runtime = 'claude-docker' | 'claude-native'

export interface Route {
  runtime: Runtime | null
  reason: string
  approval: 'plan' | 'design+plan'
}

export interface RunState {
  ticket: string
  runtime: Runtime
  model: string
  status: 'running' | 'done' | 'failed'
  worktree: string
  branch: string
  startedAt: string
  pid?: number
  pr?: string
  finishedAt?: string
  error?: string
}

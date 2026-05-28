export interface JiraAdfNode {
  type: string
  text?: string
  attrs?: Record<string, string | number>
  content?: JiraAdfNode[]
}

export interface JiraAdfDocument {
  type: 'doc'
  version: 1
  content: JiraAdfNode[]
}

export interface JiraTicket {
  id: string
  key: string
  summary: string
  description: string
  descriptionAdf?: JiraAdfDocument
  storyPoints: number | null
  issueType: string
  project?: {
    key: string
    name: string
  }
  priority?: string
  assignee?: {
    displayName: string
    emailAddress?: string
  }
  reporter?: {
    displayName: string
    emailAddress?: string
  }
  parent?: {
    key: string
    summary: string
  }
  subtasks?: Array<{
    key: string
    summary: string
    status: string
  }>
  issueLinks?: Array<{
    key: string
    summary: string
    type: string
    direction: 'inward' | 'outward'
  }>
  labels: string[]
  status: string
  components?: string[]
  fixVersions?: string[]
  affectsVersions?: string[]
  timeTracking?: {
    originalEstimate?: string
    remainingEstimate?: string
    timeSpent?: string
  }
  additionalFields?: Array<{
    key: string
    name?: string
    value: string
  }>
  comments?: Array<{
    author: string
    created: string
    body: string
  }>
  attachments?: Array<{
    filename: string
    url?: string
  }>
  sprint?: {
    name: string
    state?: string
  }
  repo?: string  // parsed from label "repo:owner/name"
}

export type ReadinessBand = 'ready' | 'needs-planning' | 'blocked'

export interface TicketReadiness {
  ticketKey: string
  score: number
  band: ReadinessBand
  canExecute: boolean
  strengths: string[]
  missing: string[]
  reason: string
}

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4

export interface JiraPlan {
  ticketKey: string
  goal: string
  context: string[]
  acceptanceCriteria: string[]
  implementationNotes: string[]
  verification: string[]
  risks: string[]
  autonomyLevel: AutonomyLevel
  forbiddenActions: string[]
}

export interface ExecutionContract {
  ticketKey: string
  plan: JiraPlan
  repo: string
  branch: string
  worktreePath: string
  autonomyLevel: AutonomyLevel
  approvedAt: string
}

export interface ProofReport {
  ticketKey: string
  branch: string
  prUrl?: string
  summary: string
  filesChanged: string[]
  verification: string[]
  residualRisk: string[]
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

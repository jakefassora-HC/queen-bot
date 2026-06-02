import { readFile } from 'fs/promises'
import readline from 'readline'
import { getJiraConfig } from './config.js'
import {
  buildCreateIssuePayload,
  createIssueLinkInJira,
  createIssueFromDraft,
  fetchEpics,
  updateTicketDescription,
  upsertTextToDescriptionAdf
} from './jira.js'
import { renderJiraPlan } from './jira-plan.js'
import { assertJiraWritePolicy } from './jira-write-policy.js'
import { buildPlanPrompt, runClaude } from './plan.js'
import {
  buildTicketDraftPrompt,
  parseDraftOutput,
  summarizeDraftOutput
} from './ticket-draft.js'
import type { DraftOutput, JiraPlan, ResearchSource, TicketDraft } from './types.js'

export interface DraftArgs {
  file: string
  projectKey: string
  create: boolean
  sources: ResearchSource[]
}

export const JIRA_WRITE_APPROVAL_PHRASE = 'APPROVE JIRA WRITE'
export const JIRA_PLAN_APPROVAL_PHRASE = 'APPROVE JIRA PLAN'

export function hasJiraWriteApproval(answer: string): boolean {
  return answer.trim() === JIRA_WRITE_APPROVAL_PHRASE
}

export function hasJiraPlanApproval(answer: string): boolean {
  return answer.trim() === JIRA_PLAN_APPROVAL_PHRASE
}

export function buildDefaultResearchSources(): ResearchSource[] {
  return [
    {
      title: 'RTK',
      url: 'https://github.com/rtk-ai/rtk',
      notes: 'Token model: compact command output before it reaches agent context.'
    },
    {
      title: 'Caveman',
      url: 'https://github.com/JuliusBrussee/caveman',
      notes: 'Token model: terse output, memory compression, and preserved code/URLs/paths.'
    }
  ]
}

function readFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index === -1) return undefined
  return args[index + 1]
}

function parseSource(value: string): ResearchSource {
  const [title, url, ...notes] = value.split('|')
  if (!title || !url) throw new Error(`Invalid source "${value}". Use "title|url|notes".`)
  return { title, url, notes: notes.join('|') }
}

export function parseDraftArgs(args: string[]): DraftArgs {
  const file = readFlag(args, '--file')
  const projectKey = readFlag(args, '--project')
  if (!file) throw new Error('Missing --file <path>')
  if (!projectKey) throw new Error('Missing --project <JIRA_PROJECT_KEY>')

  const sources = [...buildDefaultResearchSources()]
  args.forEach((arg, index) => {
    if (arg === '--source' && args[index + 1]) {
      sources.push(parseSource(args[index + 1]))
    }
  })

  return {
    file,
    projectKey,
    create: args.includes('--create'),
    sources
  }
}

function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(q, answer => { rl.close(); resolve(answer.trim()) }))
}

const DEFAULT_FORBIDDEN_ACTIONS = [
  'Merge to main without PR review',
  'Push directly to main',
  'Deploy to production',
  'Delete or modify existing tests without approval',
]

function buildPlanFromDraft(key: string, draft: TicketDraft, rawImplementation: string): JiraPlan {
  const verificationSteps = draft.goal.successCriteria.length > 0
    ? draft.goal.successCriteria.map(c => `Verify: ${c}`)
    : ['Run existing tests and confirm they pass', 'Manually verify the feature works as described']
  return {
    ticketKey: key,
    autonomyLevel: 2,
    goal: draft.goal.why,
    context: [draft.problem],
    acceptanceCriteria: draft.goal.successCriteria,
    implementationNotes: rawImplementation.split('\n').map(l => l.trim()).filter(Boolean),
    verification: verificationSteps,
    risks: draft.risks,
    forbiddenActions: DEFAULT_FORBIDDEN_ACTIONS,
  }
}

function draftWithRepoLabel(draft: TicketDraft): TicketDraft {
  const repoLabel = draft.relatedRepos[0] ? `repo:${draft.relatedRepos[0]}` : null
  if (!repoLabel || draft.labels.some(l => l.startsWith('repo:'))) return draft
  return { ...draft, labels: [...draft.labels, repoLabel] }
}

export async function runDraftCommand(args: string[]): Promise<void> {
  const parsed = parseDraftArgs(args)
  const idea = await readFile(parsed.file, 'utf8')
  const epics = await fetchEpics(parsed.projectKey)
  const draftPrompt = buildTicketDraftPrompt({
    idea,
    sources: parsed.sources,
    projectKey: parsed.projectKey,
    maxTickets: 4,
    epics,
  })
  const raw = await runClaude(draftPrompt)
  const output: DraftOutput = parseDraftOutput(raw)

  console.log('\nJira ticket drafts\n' + '─'.repeat(50))
  console.log(summarizeDraftOutput(output))

  if (!parsed.create) {
    console.log(`\nPreview only. Re-run with --create to request a Jira write, then type "${JIRA_WRITE_APPROVAL_PHRASE}" after reviewing the drafts.`)
    return
  }

  const writeAnswer = await prompt(`\nCreate these Jira tickets as ${parsed.projectKey}? Type "${JIRA_WRITE_APPROVAL_PHRASE}" to approve: `)
  if (!hasJiraWriteApproval(writeAnswer)) {
    console.log('Skipped Jira write.')
    return
  }

  const config = getJiraConfig()
  const writePermit = assertJiraWritePolicy({
    action: 'create-ticket',
    projectKey: parsed.projectKey,
    configuredProject: config.project,
    email: config.email
  })

  // Create parent Story first, linked to epic if detected
  let parentKey: string | undefined
  if (output.parentStory) {
    const story = draftWithRepoLabel(output.parentStory)
    parentKey = await createIssueFromDraft(parsed.projectKey, story, writePermit, output.epicKey)
    const epicNote = output.epicKey ? ` → ${output.epicKey}` : ''
    console.log(`Created Story ${parentKey}: ${story.summary}${epicNote}`)
  }

  // Create Tasks under the Story
  const created: Array<{ key: string; draft: TicketDraft }> = []
  for (const draft of output.tasks) {
    const labeled = draftWithRepoLabel(draft)
    const key = await createIssueFromDraft(parsed.projectKey, labeled, writePermit, parentKey)
    console.log(`  Created ${key}: ${labeled.summary}`)
    created.push({ key, draft: labeled })
  }

  // Wire up task dependency links
  if (output.taskLinks && output.taskLinks.length > 0) {
    const linkPermit = assertJiraWritePolicy({
      action: 'link-issue',
      projectKey: parsed.projectKey,
      configuredProject: config.project,
      email: config.email
    })
    for (const { fromIndex, blocksIndex } of output.taskLinks) {
      const from = created[fromIndex]
      const blocks = created[blocksIndex]
      if (from && blocks) {
        await createIssueLinkInJira(from.key, blocks.key, linkPermit)
        console.log(`  Linked ${from.key} → blocks → ${blocks.key}`)
      }
    }
  }

  // Generate Agent Q plans for each task
  console.log('\nGenerating implementation plans...')
  const plans: Array<{ key: string; draft: TicketDraft; plan: JiraPlan }> = []
  for (const { key, draft } of created) {
    const context = `${draft.goal.why}\n\n${draft.problem}`
    const rawImpl = await runClaude(buildPlanPrompt(key, draft.summary, context))
    const plan = buildPlanFromDraft(key, draft, rawImpl)
    plans.push({ key, draft, plan })
    console.log(`\n── ${key}: ${draft.summary} ──`)
    console.log(renderJiraPlan(plan))
  }

  const planAnswer = await prompt(`\nWrite Agent Q plans to Jira? Type "${JIRA_PLAN_APPROVAL_PHRASE}" to approve: `)
  if (!hasJiraPlanApproval(planAnswer)) {
    console.log('Skipped plan write.')
    return
  }

  const planPermit = assertJiraWritePolicy({
    action: 'update-description',
    projectKey: parsed.projectKey,
    configuredProject: config.project,
    email: config.email
  })

  for (const { key, draft, plan } of plans) {
    const baseDescription = buildCreateIssuePayload(parsed.projectKey, draft).fields.description
    const newDescription = upsertTextToDescriptionAdf(baseDescription, renderJiraPlan(plan), '## Agent Q Plan')
    await updateTicketDescription(key, newDescription, planPermit)
    console.log(`Plan written to ${key}`)
  }
}

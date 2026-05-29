import { readFile } from 'fs/promises'
import readline from 'readline'
import { getJiraConfig } from './config.js'
import { createIssueFromDraft } from './jira.js'
import { assertJiraWritePolicy } from './jira-write-policy.js'
import { runClaude } from './plan.js'
import {
  buildTicketDraftPrompt,
  parseTicketDrafts,
  summarizeTicketDrafts
} from './ticket-draft.js'
import type { ResearchSource } from './types.js'

export interface DraftArgs {
  file: string
  projectKey: string
  create: boolean
  sources: ResearchSource[]
}

export const JIRA_WRITE_APPROVAL_PHRASE = 'APPROVE JIRA WRITE'

export function hasJiraWriteApproval(answer: string): boolean {
  return answer.trim() === JIRA_WRITE_APPROVAL_PHRASE
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

export async function runDraftCommand(args: string[]): Promise<void> {
  const parsed = parseDraftArgs(args)
  const idea = await readFile(parsed.file, 'utf8')
  const draftPrompt = buildTicketDraftPrompt({
    idea,
    sources: parsed.sources,
    projectKey: parsed.projectKey,
    maxTickets: 4
  })
  const raw = await runClaude(draftPrompt)
  const drafts = parseTicketDrafts(raw)

  console.log('\nJira ticket drafts\n' + '─'.repeat(50))
  console.log(summarizeTicketDrafts(drafts))

  if (!parsed.create) {
    console.log(`\nPreview only. Re-run with --create to request a Jira write, then type "${JIRA_WRITE_APPROVAL_PHRASE}" after reviewing the drafts.`)
    return
  }

  const answer = await prompt(`\nCreate these Jira tickets as ${parsed.projectKey}? Type "${JIRA_WRITE_APPROVAL_PHRASE}" to approve: `)
  if (!hasJiraWriteApproval(answer)) {
    console.log('Skipped Jira write.')
    return
  }

  const config = getJiraConfig()
  const permit = assertJiraWritePolicy({
    action: 'create-ticket',
    projectKey: parsed.projectKey,
    configuredProject: config.project,
    email: config.email
  })

  for (const draft of drafts) {
    const key = await createIssueFromDraft(parsed.projectKey, draft, permit)
    console.log(`Created ${key}: ${draft.summary}`)
  }
}

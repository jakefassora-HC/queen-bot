import { buildExecutionContract } from '../execution-command.js'
import {
  formatExecutionContext,
  parseContextArgs
} from '../context-command.js'
import { renderJiraPlan } from '../jira-plan.js'
import { localPlanPath } from '../local-plan.js'
import type { JiraTicket } from '../types.js'

const ticket: JiraTicket = {
  id: '1',
  key: 'AISOL-592',
  summary: 'Update SanKey to include all details on flow',
  description: renderJiraPlan({
    ticketKey: 'AISOL-592',
    goal: 'Show all Sankey flow details.',
    context: ['Roadwarrior and Salesforce stages need clearer reason visibility.'],
    acceptanceCriteria: ['All kicked-out reasons are visible.', 'Salesforce handoff details are visible.'],
    implementationNotes: ['Use existing Sankey data flow.'],
    verification: ['Run frontend tests.', 'Manually inspect Sankey output.'],
    risks: ['Live schema may differ from migrations.'],
    autonomyLevel: 2,
    forbiddenActions: ['Do not merge.', 'Do not deploy.']
  }),
  storyPoints: 5,
  issueType: 'Story',
  project: { key: 'AISOL', name: 'AI Solutions' },
  labels: ['repo:Codefied/human-road-warrior'],
  status: 'In Progress',
  repo: 'Codefied/human-road-warrior',
  parent: { key: 'AISOL-97', summary: 'Roadwarrior' },
  issueLinks: [{ key: 'AISOL-601', summary: 'Related Sankey cleanup', type: 'Relates', direction: 'outward' }]
}

test('parseContextArgs defaults to brief and supports explicit modes', () => {
  expect(parseContextArgs(['AISOL-592'])).toEqual({ selection: 'AISOL-592', mode: 'brief' })
  expect(parseContextArgs(['AISOL-592', '--standard'])).toEqual({ selection: 'AISOL-592', mode: 'standard' })
  expect(parseContextArgs(['--deep', 'AISOL-592'])).toEqual({ selection: 'AISOL-592', mode: 'deep' })
  expect(() => parseContextArgs(['AISOL-592', '--brief', '--deep'])).toThrow('Choose only one context mode')
})

test('formatExecutionContext brief mode prints a receipt without Super PRD bulk', () => {
  const contract = buildExecutionContract(ticket, { localPlanExists: () => true, repoExists: () => true })
  if (!contract.ok) throw new Error(contract.reason)

  const output = formatExecutionContext(ticket, contract.contract, { mode: 'brief', localPlanPath: localPlanPath(ticket, '/tmp/plans'), localPlanExists: true })

  expect(output).toContain('# Agent Q Receipt: AISOL-592')
  expect(output).toContain('repo: Codefied/human-road-warrior')
  expect(output).toContain('branch: agent/AISOL-592')
  expect(output).toContain('engine: claude')
  expect(output).toContain('local_plan: /tmp/plans/Codefied/human-road-warrior/AISOL-592/plan.md')
  expect(output).toContain('local_plan_status: ready')
  expect(output).toContain('parent: AISOL-97 Roadwarrior')
  expect(output).toContain('story_point_policy: executable leaf work')
  expect(output).toContain('goal: Show all Sankey flow details.')
  expect(output).toContain('upgrade_context: agent-queue context AISOL-592 --standard')
  expect(output).not.toContain('- All kicked-out reasons are visible.')
  expect(output).not.toContain('- AISOL-601 Relates - Related Sankey cleanup')
  expect(output).not.toContain('## Comments')
  expect(output).not.toContain('Additional Jira Fields')
})

test('formatExecutionContext standard mode includes the Super PRD and linked work', () => {
  const contract = buildExecutionContract(ticket, { localPlanExists: () => true, repoExists: () => true })
  if (!contract.ok) throw new Error(contract.reason)

  const output = formatExecutionContext(ticket, contract.contract, { mode: 'standard', localPlanPath: localPlanPath(ticket, '/tmp/plans'), localPlanExists: true })

  expect(output).toContain('# Agent Q Context: AISOL-592')
  expect(output).toContain('- All kicked-out reasons are visible.')
  expect(output).toContain('- AISOL-601 Relates - Related Sankey cleanup')
  expect(output).toContain('For full Jira detail: agent-queue context AISOL-592 --deep')
})

test('formatExecutionContext deep mode includes full Jira description only when explicit', () => {
  const contract = buildExecutionContract(ticket, { localPlanExists: () => true, repoExists: () => true })
  if (!contract.ok) throw new Error(contract.reason)

  const output = formatExecutionContext(ticket, contract.contract, { mode: 'deep', localPlanPath: localPlanPath(ticket, '/tmp/plans'), localPlanExists: true })

  expect(output).toContain('## Source Jira Description')
  expect(output).toContain('Roadwarrior and Salesforce stages need clearer reason visibility.')
})

test('formatExecutionContext marks missing local plans without hiding the expected path', () => {
  const contract = buildExecutionContract(ticket, { localPlanExists: () => true, repoExists: () => true })
  if (!contract.ok) throw new Error(contract.reason)

  const output = formatExecutionContext(ticket, contract.contract, { mode: 'brief', localPlanPath: localPlanPath(ticket, '/tmp/plans'), localPlanExists: false })

  expect(output).toContain('local_plan: /tmp/plans/Codefied/human-road-warrior/AISOL-592/plan.md')
  expect(output).toContain('local_plan_status: missing')
})

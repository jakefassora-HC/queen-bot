import { buildExecutionContract } from '../execution-command.js'
import { formatBriefExecutionContext } from '../context-command.js'
import { renderJiraPlan } from '../jira-plan.js'
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
  labels: ['repo:Codefied/human-road-warrior'],
  status: 'In Progress',
  repo: 'Codefied/human-road-warrior',
  parent: { key: 'AISOL-97', summary: 'Roadwarrior' },
  issueLinks: [{ key: 'AISOL-601', summary: 'Related Sankey cleanup', type: 'Relates', direction: 'outward' }]
}

test('formatBriefExecutionContext prints compact execution packet without raw Jira dump', () => {
  const contract = buildExecutionContract(ticket)
  if (!contract.ok) throw new Error(contract.reason)

  const output = formatBriefExecutionContext(ticket, contract.contract)

  expect(output).toContain('# Agent Q Context: AISOL-592')
  expect(output).toContain('repo: Codefied/human-road-warrior')
  expect(output).toContain('branch: agent/AISOL-592')
  expect(output).toContain('goal: Show all Sankey flow details.')
  expect(output).toContain('- All kicked-out reasons are visible.')
  expect(output).toContain('- AISOL-601 Relates - Related Sankey cleanup')
  expect(output).toContain('For full Jira detail: agent-queue show AISOL-592')
  expect(output).not.toContain('## Comments')
  expect(output).not.toContain('Additional Jira Fields')
})

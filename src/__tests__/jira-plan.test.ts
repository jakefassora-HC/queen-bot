import { parseJiraPlan, renderJiraPlan, upsertJiraPlanSection } from '../jira-plan.js'
import type { JiraPlan } from '../types.js'

const plan: JiraPlan = {
  ticketKey: 'AISOL-465',
  goal: 'Create onboarding handoff documentation.',
  context: ['Roadwarrior onboarding is scattered across comments.'],
  acceptanceCriteria: ['New teammate can complete setup from the ticket.'],
  implementationNotes: ['Update docs only.'],
  verification: ['Run markdown lint.', 'Check links manually.'],
  risks: ['Docs can go stale.'],
  autonomyLevel: 2,
  forbiddenActions: ['Do not merge.', 'Do not deploy.'],
  localPlanPath: '/tmp/plans/AISOL-465/plan.md'
}

test('renderJiraPlan writes a stable Agent Q plan section', () => {
  const text = renderJiraPlan(plan)

  expect(text).toContain('## Agent Q Plan')
  expect(text).toContain('Autonomy Level: 2')
  expect(text).toContain('Local Plan Path: /tmp/plans/AISOL-465/plan.md')
  expect(text).toContain('- Do not merge.')
})

test('parseJiraPlan reads the rendered section', () => {
  const parsed = parseJiraPlan('intro\n\n' + renderJiraPlan(plan))

  expect(parsed?.ticketKey).toBe('AISOL-465')
  expect(parsed?.goal).toBe('Create onboarding handoff documentation.')
  expect(parsed?.autonomyLevel).toBe(2)
  expect(parsed?.localPlanPath).toBe('/tmp/plans/AISOL-465/plan.md')
})

test('upsertJiraPlanSection replaces an existing Agent Q plan without duplicating it', () => {
  const first = upsertJiraPlanSection('Existing context', plan)
  const second = upsertJiraPlanSection(first, { ...plan, goal: 'Updated goal.' })

  expect(second.match(/## Agent Q Plan/g)).toHaveLength(1)
  expect(second).toContain('Existing context')
  expect(second).toContain('Updated goal.')
  expect(second).not.toContain('Create onboarding handoff documentation.')
})

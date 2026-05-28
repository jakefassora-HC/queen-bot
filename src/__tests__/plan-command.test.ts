import {
  JIRA_PLAN_APPROVAL_PHRASE,
  buildPlanFromTicket,
  hasJiraPlanApproval,
  parsePlanArgs
} from '../plan-command.js'
import type { JiraTicket } from '../types.js'

const ticket: JiraTicket = {
  id: '1',
  key: 'AISOL-465',
  summary: 'Handoff Documentation or Onboarding?',
  description: 'Current docs are scattered.',
  storyPoints: null,
  issueType: 'Story',
  labels: ['repo:jakefassora-HC/queen-bot'],
  status: 'To Do',
  repo: 'jakefassora-HC/queen-bot'
}

test('Jira plan writes require exact approval phrase', () => {
  expect(JIRA_PLAN_APPROVAL_PHRASE).toBe('APPROVE JIRA PLAN')
  expect(hasJiraPlanApproval('APPROVE JIRA PLAN')).toBe(true)
  expect(hasJiraPlanApproval('yes')).toBe(false)
  expect(hasJiraPlanApproval('y')).toBe(false)
})

test('parsePlanArgs supports preview and write modes', () => {
  expect(parsePlanArgs(['AISOL-465'])).toEqual({ selection: 'AISOL-465', write: false })
  expect(parsePlanArgs(['AISOL-465', '--write'])).toEqual({ selection: 'AISOL-465', write: true })
})

test('buildPlanFromTicket creates a bounded Agent Q plan draft', () => {
  const plan = buildPlanFromTicket(ticket)

  expect(plan.ticketKey).toBe('AISOL-465')
  expect(plan.goal).toBe('Handoff Documentation or Onboarding?')
  expect(plan.context).toContain('Current docs are scattered.')
  expect(plan.autonomyLevel).toBe(2)
  expect(plan.forbiddenActions).toContain('Do not update Jira without approval.')
})

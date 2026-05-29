import {
  JIRA_PLAN_COMMENT_APPROVAL_PHRASE,
  formatLocalPlanRevisionComment,
  formatSuperPrdChangeComment,
  hasPlanCommentApproval
} from '../plan-comments.js'
import type { JiraTicket } from '../types.js'

const ticket: JiraTicket = {
  id: '1',
  key: 'AISOL-465',
  summary: 'Handoff docs',
  description: '',
  storyPoints: 3,
  issueType: 'Story',
  labels: [],
  status: 'To Do'
}

test('plan comment approval requires exact phrase', () => {
  expect(JIRA_PLAN_COMMENT_APPROVAL_PHRASE).toBe('APPROVE JIRA PLAN COMMENT')
  expect(hasPlanCommentApproval('APPROVE JIRA PLAN COMMENT')).toBe(true)
  expect(hasPlanCommentApproval('yes')).toBe(false)
})

test('formatLocalPlanRevisionComment points to local plan without dumping plan body', () => {
  const output = formatLocalPlanRevisionComment({
    ticket,
    localPlanPath: '/Users/jake/.agent-queue/plans/owner/repo/AISOL-465/plan.md',
    reason: 'Claude critique tightened verification.',
    changes: ['Added Playwright smoke check.', 'Kept Super PRD unchanged.']
  })

  expect(output).toContain('## Agent Q Plan Revision')
  expect(output).toContain('Ticket: AISOL-465')
  expect(output).toContain('Local Plan: /Users/jake/.agent-queue/plans/owner/repo/AISOL-465/plan.md')
  expect(output).toContain('- Added Playwright smoke check.')
  expect(output).not.toContain('## Super PRD')
})

test('formatSuperPrdChangeComment explains Jira description changes', () => {
  const output = formatSuperPrdChangeComment({
    ticket,
    reason: 'Execution scope changed after repo inspection.',
    changes: ['Updated acceptance criteria.', 'Updated verification.']
  })

  expect(output).toContain('## Agent Q Super PRD Change')
  expect(output).toContain('Jira Description: updated')
  expect(output).toContain('- Updated acceptance criteria.')
})

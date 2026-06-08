import {
  formatLocalPlanRevisionComment,
  formatSuperPrdChangeComment
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

test('formatLocalPlanRevisionComment is neutral and points to local plan without dumping plan body', () => {
  const output = formatLocalPlanRevisionComment({
    ticket,
    localPlanPath: '/Users/jake/.agent-queue/plans/owner/repo/AISOL-465/plan.md',
    reason: 'Claude critique tightened verification.',
    changes: ['Added Playwright smoke check.', 'Kept Super PRD unchanged.']
  })

  expect(output).toContain('## Plan Revision')
  expect(output).toContain('Ticket: AISOL-465')
  expect(output).toContain('Local Plan: /Users/jake/.agent-queue/plans/owner/repo/AISOL-465/plan.md')
  expect(output).toContain('- Added Playwright smoke check.')
  expect(output).not.toContain('Agent Q')
  expect(output).not.toContain('## Super PRD')
})

test('formatSuperPrdChangeComment explains Jira description changes', () => {
  const output = formatSuperPrdChangeComment({
    ticket,
    reason: 'Execution scope changed after repo inspection.',
    changes: ['Updated acceptance criteria.', 'Updated verification.']
  })

  expect(output).toContain('## Planning Contract Change')
  expect(output).toContain('Jira Description: updated')
  expect(output).toContain('- Updated acceptance criteria.')
  expect(output).not.toContain('Agent Q')
})

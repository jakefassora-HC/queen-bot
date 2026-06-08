import {
  JIRA_PROOF_APPROVAL_PHRASE,
  assertProofTicketInQueue,
  formatProofReport,
  hasProofApproval,
  parseProofArgs
} from '../proof.js'
import type { JiraTicket, ProofReport } from '../types.js'

test('formatProofReport renders evidence for Jira', () => {
  const output = formatProofReport({
    ticketKey: 'AISOL-465',
    branch: 'agent/AISOL-465',
    prUrl: 'https://github.com/example/pr/1',
    summary: 'Added onboarding docs.',
    filesChanged: ['docs/onboarding.md'],
    verification: ['npm test passed'],
    residualRisk: ['Docs can go stale.']
  })

  expect(output).toContain('## Agent Q Proof')
  expect(output).toContain('https://github.com/example/pr/1')
  expect(output).toContain('npm test passed')
})

test('proof updates require exact approval phrase', () => {
  expect(JIRA_PROOF_APPROVAL_PHRASE).toBe('APPROVE JIRA PROOF')
  expect(hasProofApproval('APPROVE JIRA PROOF')).toBe(true)
  expect(hasProofApproval('yes')).toBe(false)
})

test('parseProofArgs supports preview and comment modes', () => {
  expect(parseProofArgs(['--file', 'proof.json'])).toEqual({ file: 'proof.json', comment: false })
  expect(parseProofArgs(['--file', 'proof.json', '--comment'])).toEqual({ file: 'proof.json', comment: true })
})

test('proof comments must target a ticket in the current Jira queue', () => {
  const report = {
    ticketKey: 'AISOL-465',
    branch: 'agent/AISOL-465',
    summary: 'Added onboarding docs.',
    filesChanged: [],
    verification: [],
    residualRisk: []
  }

  expect(assertProofTicketInQueue(report, [{
    id: '1',
    key: 'AISOL-465',
    summary: 'Handoff Documentation or Onboarding?',
    description: '',
    storyPoints: null,
    issueType: 'Story',
    labels: [],
    status: 'To Do'
  }]).key).toBe('AISOL-465')

  expect(() => assertProofTicketInQueue(report, [])).toThrow('not in the current Jira queue')
})

test('includes Goal Verification checklist when goal is present', () => {
  const report: ProofReport = {
    ticketKey: 'AISOL-465',
    branch: 'agent/AISOL-465',
    summary: 'Added onboarding docs.',
    filesChanged: ['docs/onboarding.md'],
    verification: ['npm test passed'],
    residualRisk: ['Docs can go stale.'],
    goal: {
      why: 'Users need rejection reasons.',
      constraints: [],
      nonGoals: [],
      successCriteria: ['Rejection reasons visible', 'All stages shown'],
    },
  }
  const formatted = formatProofReport(report)
  expect(formatted).toContain('## Goal Verification')
  expect(formatted).toContain('- [ ] Rejection reasons visible')
  expect(formatted).toContain('- [ ] All stages shown')
})

import { findUnblockedTickets } from '../proof.js'

const makeTicket = (key: string, links: Array<{ key: string; type: string; direction: 'inward' | 'outward' }> = []): JiraTicket => ({
  key,
  summary: key,
  status: 'In Progress',
  description: '',
  labels: [],
  issueLinks: links,
} as unknown as JiraTicket)

test('findUnblockedTickets returns tickets whose only blocker just completed', () => {
  const completed = makeTicket('AISOL-641', [{ key: 'AISOL-642', type: 'Blocks', direction: 'outward' }])
  const next = makeTicket('AISOL-642', [{ key: 'AISOL-641', type: 'Blocks', direction: 'inward' }])
  const tickets = [completed, next]

  const unblocked = findUnblockedTickets('AISOL-641', tickets)
  expect(unblocked.map(t => t.key)).toEqual(['AISOL-642'])
})

test('findUnblockedTickets does not return ticket with remaining active blockers', () => {
  const completed = makeTicket('AISOL-641', [{ key: 'AISOL-644', type: 'Blocks', direction: 'outward' }])
  const other = makeTicket('AISOL-643', [])
  const next = makeTicket('AISOL-644', [
    { key: 'AISOL-641', type: 'Blocks', direction: 'inward' },
    { key: 'AISOL-643', type: 'Blocks', direction: 'inward' }, // still active
  ])
  const tickets = [completed, other, next]

  const unblocked = findUnblockedTickets('AISOL-641', tickets)
  expect(unblocked).toHaveLength(0)
})

test('findUnblockedTickets returns empty when completed ticket has no outward blocks', () => {
  const solo = makeTicket('AISOL-641', [])
  expect(findUnblockedTickets('AISOL-641', [solo])).toHaveLength(0)
})

test('omits Goal Verification when goal is not present', () => {
  const report: ProofReport = {
    ticketKey: 'AISOL-465',
    branch: 'agent/AISOL-465',
    summary: 'Added onboarding docs.',
    filesChanged: ['docs/onboarding.md'],
    verification: ['npm test passed'],
    residualRisk: ['Docs can go stale.'],
  }
  const formatted = formatProofReport(report)
  expect(formatted).not.toContain('## Goal Verification')
})

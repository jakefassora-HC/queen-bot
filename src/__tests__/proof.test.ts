import {
  JIRA_PROOF_APPROVAL_PHRASE,
  assertProofTicketInQueue,
  formatProofReport,
  hasProofApproval,
  parseProofArgs
} from '../proof.js'

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

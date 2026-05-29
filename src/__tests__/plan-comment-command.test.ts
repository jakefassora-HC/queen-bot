import { parsePlanCommentArgs } from '../plan-comment-command.js'

test('parsePlanCommentArgs supports local plan revision comments without approval phrases', () => {
  expect(parsePlanCommentArgs([
    'AISOL-592',
    '--local-plan',
    '/Users/jake/.agent-queue/plans/Codefied/human-road-warrior/AISOL-592/plan.md',
    '--reason',
    'Claude critique tightened verification.',
    '--change',
    'Added Playwright smoke check.',
    '--change',
    'Kept Super PRD unchanged.'
  ])).toEqual({
    selection: 'AISOL-592',
    localPlanPath: '/Users/jake/.agent-queue/plans/Codefied/human-road-warrior/AISOL-592/plan.md',
    reason: 'Claude critique tightened verification.',
    changes: ['Added Playwright smoke check.', 'Kept Super PRD unchanged.'],
    superPrdChange: false
  })
})

test('parsePlanCommentArgs supports Super PRD change comments', () => {
  expect(parsePlanCommentArgs([
    '--super-prd-change',
    '--reason',
    'Execution scope changed after repo inspection.',
    '1',
    '--change',
    'Updated verification.'
  ])).toEqual({
    selection: '1',
    localPlanPath: undefined,
    reason: 'Execution scope changed after repo inspection.',
    changes: ['Updated verification.'],
    superPrdChange: true
  })
})

test('parsePlanCommentArgs rejects comments with no change summary', () => {
  expect(() => parsePlanCommentArgs([
    'AISOL-592',
    '--local-plan',
    '/tmp/plan.md',
    '--reason',
    'Changed plan.'
  ])).toThrow('Missing at least one --change')
})

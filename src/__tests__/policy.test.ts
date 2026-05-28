// src/__tests__/policy.test.ts
import { isHighRisk, isBlockedPath, isWithinLimits } from '../policy.js'
import type { JiraTicket } from '../types.js'

const base: JiraTicket = {
  id: '1', key: 'TOOL-1', summary: 'test', description: 'test',
  storyPoints: null, issueType: 'Story', labels: [], status: 'To Do'
}

test('high-risk label blocks ticket', () => {
  expect(isHighRisk({ ...base, labels: ['risk-high'] })).toBe(true)
  expect(isHighRisk({ ...base, labels: ['ai-candidate'] })).toBe(false)
})

test('blocked paths are detected', () => {
  expect(isBlockedPath('.github/workflows/deploy.yml')).toBe(true)
  expect(isBlockedPath('infra/terraform/main.tf')).toBe(true)
  expect(isBlockedPath('src/components/Button.tsx')).toBe(false)
})

test('diff within limits passes', () => {
  expect(isWithinLimits(50, 5)).toBe(true)
  expect(isWithinLimits(600, 5)).toBe(false)
  expect(isWithinLimits(50, 15)).toBe(false)
})

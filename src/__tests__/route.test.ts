import { route } from '../route.js'
import type { JiraTicket } from '../types.js'

const base: JiraTicket = {
  id: '1', key: 'TOOL-1', summary: 'test', description: 'test',
  storyPoints: null, issueType: 'Story', labels: ['ai-candidate'], status: 'To Do'
}

test('small ticket routes to claude-native (no Docker)', () => {
  const r = route(base)
  expect(r.runtime).toBe('claude-native')
  expect(r.approval).toBe('plan')
})

test('ui label routes to claude-native with MCP', () => {
  const r = route({ ...base, labels: ['ai-candidate', 'ui'] })
  expect(r.runtime).toBe('claude-native')
  expect(r.approval).toBe('design+plan')
})

test('large ticket routes to claude-native', () => {
  const r = route({ ...base, storyPoints: 8 })
  expect(r.runtime).toBe('claude-native')
  expect(r.approval).toBe('design+plan')
})

test('big-ticket label routes to claude-native', () => {
  const r = route({ ...base, labels: ['ai-candidate', 'big-ticket'] })
  expect(r.runtime).toBe('claude-native')
})

test('high-risk label blocks routing', () => {
  const r = route({ ...base, labels: ['risk-high'] })
  expect(r.runtime).toBeNull()
  expect(r.reason).toMatch(/high-risk/)
})

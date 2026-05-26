import { route } from '../route.js'
import type { JiraTicket } from '../types.js'

const base: JiraTicket = {
  id: '1', key: 'TOOL-1', summary: 'test', description: 'test',
  size: 'small', labels: ['ai-candidate'], status: 'To Do'
}

test('small ticket routes to claude-docker', () => {
  const r = route(base)
  expect(r.runtime).toBe('claude-docker')
  expect(r.approval).toBe('plan')
})

test('large ticket routes to claude-native', () => {
  const r = route({ ...base, size: 'large' })
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

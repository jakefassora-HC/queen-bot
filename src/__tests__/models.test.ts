import { getModel, getRuntimes } from '../models.js'

test('getModel returns configured model for runtime', () => {
  expect(getModel('claude-docker')).toBe('claude-sonnet-4-6')
  expect(getModel('claude-native')).toBe('claude-sonnet-4-6')
})

test('getRuntimes returns all configured runtimes', () => {
  const runtimes = getRuntimes()
  expect(runtimes).toContain('claude-docker')
  expect(runtimes).toContain('claude-native')
})

import { getJiraConfig, requireJiraConfig } from '../config.js'

test('getJiraConfig reads Jira settings from an env object', () => {
  const config = getJiraConfig({
    JIRA_BASE_URL: 'https://example.atlassian.net',
    JIRA_EMAIL: 'jake@example.com',
    JIRA_PROJECT: 'TOOL'
  })

  expect(config.baseUrl).toBe('https://example.atlassian.net')
  expect(config.email).toBe('jake@example.com')
  expect(config.project).toBe('TOOL')
})

test('requireJiraConfig reports every missing Jira setting', () => {
  expect(() => requireJiraConfig({})).toThrow(
    'Missing Jira config: JIRA_BASE_URL, JIRA_EMAIL'
  )
})

test('Jira project is optional for queue reads', () => {
  const config = requireJiraConfig({
    JIRA_BASE_URL: 'https://example.atlassian.net',
    JIRA_EMAIL: 'jake@example.com'
  })

  expect(config.project).toBe('')
})

import 'dotenv/config'
import { execSync } from 'child_process'

export interface JiraConfig {
  baseUrl: string
  email: string
  project: string
}

function keychain(service: string): string {
  try {
    return execSync(`security find-generic-password -s ${service} -w`, {
      stdio: ['pipe', 'pipe', 'pipe']
    }).toString().trim()
  } catch {
    throw new Error(`Secret not found in Keychain: ${service}\nRun: security add-generic-password -s ${service} -a $USER -w <value>`)
  }
}

export function getJiraKey(): string { return keychain('agent-queue-jira') }

export function getJiraConfig(env: NodeJS.ProcessEnv = process.env): JiraConfig {
  return {
    baseUrl: env.JIRA_BASE_URL ?? '',
    email: env.JIRA_EMAIL ?? '',
    project: env.JIRA_PROJECT ?? ''
  }
}

export function requireJiraConfig(env: NodeJS.ProcessEnv = process.env): JiraConfig {
  const config = getJiraConfig(env)
  const missing = [
    config.baseUrl ? null : 'JIRA_BASE_URL',
    config.email ? null : 'JIRA_EMAIL'
  ].filter((item): item is string => item !== null)

  if (missing.length > 0) {
    throw new Error(
      `Missing Jira config: ${missing.join(', ')}\n` +
      'Set these in your shell or a local .env file. JIRA_PROJECT is optional for queue reads.\n' +
      'Store the API token with:\n' +
      'security add-generic-password -s agent-queue-jira -a $USER -w <jira-api-token>'
    )
  }

  return config
}

export const JIRA_BASE_URL = getJiraConfig().baseUrl
export const JIRA_EMAIL = getJiraConfig().email
export const JIRA_PROJECT = getJiraConfig().project
export const REPOS_DIR = process.env.REPOS_DIR ?? `${process.env.HOME}/.agent-queue/repos`
export const DOCKER_IMAGE = 'agent-queue:latest'
export const AGENT_TIMEOUT_SECONDS = 600

import { execSync } from 'child_process'

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

export const JIRA_BASE_URL = process.env.JIRA_BASE_URL ?? ''
export const JIRA_EMAIL = process.env.JIRA_EMAIL ?? ''
export const JIRA_PROJECT = process.env.JIRA_PROJECT ?? ''
export const REPOS_DIR = process.env.REPOS_DIR ?? `${process.env.HOME}/.agent-queue/repos`
export const DOCKER_IMAGE = 'agent-queue:latest'
export const AGENT_TIMEOUT_SECONDS = 600

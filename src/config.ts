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
export function getSlackToken(): string { return keychain('agent-queue-slack') }
export function getGitHubToken(): string { return keychain('agent-queue-github') }
export function getAnthropicKey(): string { return keychain('agent-queue-anthropic') }

export const JIRA_BASE_URL = process.env.JIRA_BASE_URL ?? ''
export const JIRA_EMAIL = process.env.JIRA_EMAIL ?? ''
export const JIRA_PROJECT = process.env.JIRA_PROJECT ?? ''
export const GITHUB_OWNER = process.env.GITHUB_OWNER ?? ''
export const GITHUB_REPO = process.env.GITHUB_REPO ?? ''
export const SLACK_USER_ID = process.env.SLACK_USER_ID ?? ''
export const REPO_PATH = process.env.REPO_PATH ?? process.cwd()
export const DOCKER_IMAGE = 'agent-queue:latest'
export const AGENT_TIMEOUT_SECONDS = 600

import { execSync } from 'child_process'
import { getGitHubToken, GITHUB_OWNER, GITHUB_REPO } from './config.js'

export function buildPrBody(ticketKey: string, summary: string, plan: string): string {
  return `## ${ticketKey}: ${summary}\n\n**Plan:**\n${plan}\n\n---\n_Opened by agent-queue_`
}

export function commitAndPush(worktreePath: string, ticketKey: string, summary: string): void {
  const msg = `feat(${ticketKey}): ${summary}`
  execSync(`git -C ${worktreePath} add -A`, { stdio: 'inherit' })
  execSync(`git -C ${worktreePath} commit -m ${JSON.stringify(msg)}`, { stdio: 'inherit' })
  execSync(`git -C ${worktreePath} push origin agent/${ticketKey}`, { stdio: 'inherit' })
}

export async function openDraftPr(
  ticketKey: string,
  summary: string,
  plan: string
): Promise<string> {
  const body = buildPrBody(ticketKey, summary, plan)
  const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getGitHubToken()}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: `[${ticketKey}] ${summary}`,
      body,
      head: `agent/${ticketKey}`,
      base: 'main',
      draft: true
    })
  })

  if (!res.ok) throw new Error(`GitHub PR error ${res.status}: ${await res.text()}`)
  const data = await res.json() as { html_url: string }
  return data.html_url
}

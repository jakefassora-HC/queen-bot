import { execSync } from 'child_process'

export function buildPrBody(ticketKey: string, summary: string, plan: string): string {
  return `## ${ticketKey}: ${summary}\n\n**Plan:**\n${plan}\n\n---\n_Opened by agent-queue_`
}

export function commitAndPush(worktreePath: string, ticketKey: string, summary: string): void {
  const msg = `feat(${ticketKey}): ${summary}`
  execSync(`git -C ${worktreePath} add -A`, { stdio: 'inherit' })
  execSync(`git -C ${worktreePath} commit -m ${JSON.stringify(msg)}`, { stdio: 'inherit' })
  execSync(`git -C ${worktreePath} push origin agent/${ticketKey}`, { stdio: 'inherit' })
}

export function openDraftPr(ticketKey: string, summary: string, plan: string): string {
  const body = buildPrBody(ticketKey, summary, plan)
  // gh CLI uses its own auth — no GitHub token needed
  const url = execSync(
    `gh pr create --title ${JSON.stringify(`[${ticketKey}] ${summary}`)} --body ${JSON.stringify(body)} --draft`,
    { cwd: process.env.REPO_PATH }
  ).toString().trim()
  return url
}

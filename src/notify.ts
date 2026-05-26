import { getSlackToken, SLACK_USER_ID } from './config.js'

export function buildSuccessMessage(ticketKey: string, summary: string, prUrl: string, elapsedSeconds: number): string {
  const mins = Math.floor(elapsedSeconds / 60)
  const secs = elapsedSeconds % 60
  const duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  return `✅ *${ticketKey}* done — ${summary}\n<${prUrl}|View PR> · ${duration}`
}

export function buildFailureMessage(ticketKey: string, error: string): string {
  return `❌ *${ticketKey}* failed\n\`${error}\`\nInspect: \`tmux attach -t ${ticketKey}\``
}

export async function sendDm(text: string): Promise<void> {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getSlackToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ channel: SLACK_USER_ID, text })
  })
  const data = await res.json() as { ok: boolean; error?: string }
  if (!data.ok) throw new Error(`Slack error: ${data.error}`)
}

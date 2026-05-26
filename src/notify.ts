export function buildSuccessMessage(ticketKey: string, summary: string, prUrl: string, elapsedSeconds: number): string {
  const mins = Math.floor(elapsedSeconds / 60)
  const secs = elapsedSeconds % 60
  const duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  return `✅ *${ticketKey}* done — ${summary}\n<${prUrl}|View PR> · ${duration}`
}

export function buildFailureMessage(ticketKey: string, error: string): string {
  return `❌ *${ticketKey}* failed\n\`${error}\`\nInspect: \`tmux attach -t ${ticketKey}\``
}

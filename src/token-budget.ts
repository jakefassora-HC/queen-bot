export interface CompactResult {
  text: string
  originalTokens: number
  compressedTokens: number
  droppedTokens: number
}

export const TOKEN_DISCIPLINE = [
  'compress research before prompting',
  'preserve URLs, paths, commands, and code-like tokens exactly',
  'use terse Jira language without filler',
  'prefer grouped evidence over raw logs'
].join('; ')

export function estimateTokens(text: string): number {
  if (text.length === 0) return 0
  return Math.ceil(text.length / 4)
}

function isProtectedLine(line: string): boolean {
  return /https?:\/\//.test(line) ||
    /[`{}[\]();=]/.test(line) ||
    /^\s*[-*]\s+/.test(line) ||
    /^[A-Z0-9_-]+-\d+/.test(line)
}

export function compactText(text: string, maxTokens: number): CompactResult {
  const originalTokens = estimateTokens(text)
  if (originalTokens <= maxTokens) {
    return { text, originalTokens, compressedTokens: originalTokens, droppedTokens: 0 }
  }

  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const protectedLines = lines.filter(isProtectedLine)
  const normalLines = lines.filter(line => !isProtectedLine(line))
  const selected: string[] = []

  for (const line of protectedLines) {
    selected.push(line)
  }

  for (const line of normalLines) {
    const candidate = [...selected, line].join('\n')
    if (estimateTokens(candidate) > maxTokens) continue
    selected.push(line)
  }

  while (selected.length > 0 && estimateTokens(selected.join('\n')) > maxTokens) {
    const removable = selected.findIndex(line => !isProtectedLine(line))
    if (removable === -1) break
    selected.splice(removable, 1)
  }

  const compacted = selected.join('\n')
  const compressedTokens = estimateTokens(compacted)
  return {
    text: compacted,
    originalTokens,
    compressedTokens,
    droppedTokens: Math.max(0, originalTokens - compressedTokens)
  }
}

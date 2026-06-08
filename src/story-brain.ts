import { renderGoal } from './jira-goal.js'
import type { StoryBrain } from './types.js'

export function renderStoryBrain(brain: StoryBrain): string {
  const taskGraphLines = brain.taskGraph.map((t, i) =>
    `- [${t.done ? 'x' : ' '}] Task ${i + 1}: ${t.summary} (${t.key})`
  )

  const planSectionLines = brain.planSections.map((s, i) => [
    `### Task ${i + 1}: ${s.taskSummary} (${s.taskKey})`,
    '',
    s.content,
  ].join('\n'))

  const worktreeLines = brain.worktrees.length > 0
    ? brain.worktrees.map(w => `- ${w}`)
    : ['- none']

  const proofLines = brain.proof.length > 0
    ? brain.proof.map(p => `- ${p}`)
    : ['- none']

  return [
    `# Story ${brain.parentKey}: ${brain.summary}`,
    '',
    renderGoal(brain.goal),
    '',
    '## Task Graph',
    '',
    taskGraphLines.join('\n'),
    '',
    '## Plan',
    '',
    planSectionLines.join('\n\n'),
    '',
    '## Worktrees',
    '',
    worktreeLines.join('\n'),
    '',
    '## Proof',
    '',
    proofLines.join('\n'),
    '',
    '## Status',
    '',
    brain.status,
  ].join('\n')
}

export function extractGoalSection(md: string): string | null {
  const start = md.indexOf('\n## Goal')
  if (start === -1) return null
  const afterHeading = md.slice(start + 1)
  const nextSection = afterHeading.indexOf('\n## ')
  return nextSection === -1
    ? afterHeading.trim()
    : afterHeading.slice(0, nextSection).trim()
}

export function parseTaskGraphStatus(md: string): { total: number; done: number; pending: number } {
  const section = (() => {
    const start = md.indexOf('\n## Task Graph')
    if (start === -1) return ''
    const after = md.slice(start + 1)
    const next = after.indexOf('\n## ')
    return next === -1 ? after : after.slice(0, next)
  })()

  const lines = section.split('\n').filter(l => l.startsWith('- ['))
  const done = lines.filter(l => l.startsWith('- [x]')).length
  return { total: lines.length, done, pending: lines.length - done }
}

export function updateTaskGraphDone(md: string, ticketKey: string): string {
  const pattern = new RegExp(`(- \\[ \\] Task \\d+: [^(]+\\(${ticketKey}\\))`)
  return md.replace(pattern, (match) => match.replace('- [ ]', '- [x]'))
}

export function appendProofEntry(md: string, entry: string): string {
  const proofStart = md.indexOf('\n## Proof')
  if (proofStart === -1) return md

  const afterHeading = md.slice(proofStart + 1)
  const nextSection = afterHeading.indexOf('\n## ')
  const sectionEnd = nextSection === -1 ? md.length : proofStart + 1 + nextSection

  const nonePattern = /\n- none\n?/
  const sectionContent = md.slice(proofStart, sectionEnd)

  if (nonePattern.test(sectionContent)) {
    return md.slice(0, proofStart) +
      sectionContent.replace(nonePattern, `\n- ${entry}\n`) +
      md.slice(sectionEnd)
  }

  return md.slice(0, sectionEnd) + `\n- ${entry}` + md.slice(sectionEnd)
}

export function setStoryStatus(md: string, status: 'pending' | 'in-progress' | 'done'): string {
  const statusStart = md.indexOf('\n## Status')
  if (statusStart === -1) return md

  const afterHeading = md.slice(statusStart + 1)
  const nextSection = afterHeading.indexOf('\n## ')
  const sectionEnd = nextSection === -1 ? md.length : statusStart + 1 + nextSection

  const newSection = `## Status\n\n${status}\n`
  return md.slice(0, statusStart + 1) + newSection + md.slice(sectionEnd)
}

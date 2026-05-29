import type { JiraTicket } from './types.js'

export interface WorkGraphSummary {
  parent: string
  childCount: number
  linkedCount: number
  storyPointPolicy: string
  warnings: string[]
  executionAllowedBySize: boolean
}

function parentLabel(ticket: JiraTicket): string {
  return ticket.parent ? `${ticket.parent.key} ${ticket.parent.summary}` : 'none'
}

function linkedWorkCount(ticket: JiraTicket): number {
  return (ticket.subtasks ?? []).length + (ticket.issueLinks ?? []).length
}

export function workGraphSummary(ticket: JiraTicket): WorkGraphSummary {
  const childCount = ticket.subtasks?.length ?? 0
  const linkedCount = ticket.issueLinks?.length ?? 0
  const linkedWork = linkedWorkCount(ticket)
  const warnings: string[] = []
  let storyPointPolicy = 'executable leaf work'
  let executionAllowedBySize = true

  if (ticket.storyPoints !== null && ticket.storyPoints >= 13) {
    storyPointPolicy = '13+ point ticket should stay parent-level work; execute linked children instead'
    executionAllowedBySize = false
    warnings.push(storyPointPolicy)
  } else if (ticket.storyPoints !== null && ticket.storyPoints >= 8) {
    if (linkedWork === 0) {
      storyPointPolicy = '8+ point ticket needs linked child work before execution'
      executionAllowedBySize = false
      warnings.push(storyPointPolicy)
    } else {
      storyPointPolicy = '8+ point ticket has linked child work'
    }
  }

  return {
    parent: parentLabel(ticket),
    childCount,
    linkedCount,
    storyPointPolicy,
    warnings,
    executionAllowedBySize
  }
}

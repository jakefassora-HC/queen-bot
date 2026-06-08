import { workGraphSummary } from '../work-graph.js'
import type { JiraTicket } from '../types.js'

const ticket: JiraTicket = {
  id: '1',
  key: 'AISOL-465',
  summary: 'Handoff docs',
  description: '',
  storyPoints: 5,
  issueType: 'Story',
  labels: [],
  status: 'To Do',
  parent: { key: 'AISOL-97', summary: 'Roadwarrior' }
}

test('workGraphSummary treats 1-5 point work as executable leaf work', () => {
  const summary = workGraphSummary(ticket)

  expect(summary.executionAllowedBySize).toBe(true)
  expect(summary.storyPointPolicy).toContain('executable leaf')
  expect(summary.parent).toBe('AISOL-97 Roadwarrior')
})

test('workGraphSummary blocks 8 point work without linked child work', () => {
  const summary = workGraphSummary({ ...ticket, storyPoints: 8 })

  expect(summary.executionAllowedBySize).toBe(false)
  expect(summary.storyPointPolicy).toContain('8+ point ticket needs linked child')
})

test('workGraphSummary allows 8 point work with linked child work', () => {
  const summary = workGraphSummary({
    ...ticket,
    storyPoints: 8,
    issueLinks: [{ key: 'AISOL-601', summary: 'Phase 1', type: 'relates', direction: 'outward' }]
  })

  expect(summary.executionAllowedBySize).toBe(true)
  expect(summary.linkedCount).toBe(1)
})

test('workGraphSummary blocks 13+ point work from direct execution', () => {
  const summary = workGraphSummary({
    ...ticket,
    storyPoints: 13,
    subtasks: [{ key: 'AISOL-602', summary: 'Child work', status: 'To Do' }]
  })

  expect(summary.executionAllowedBySize).toBe(false)
  expect(summary.storyPointPolicy).toContain('13+ point ticket should stay parent')
})

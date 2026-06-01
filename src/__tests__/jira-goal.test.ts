import { renderGoal, parseGoal, upsertGoalSection, GOAL_HEADING } from '../jira-goal.js'
import type { TicketGoal } from '../types.js'

const sampleGoal: TicketGoal = {
  why: 'Users cannot see rejection reasons in the funnel.',
  constraints: ['Must not break existing Sankey chart', 'Read-only change'],
  nonGoals: ['Adding new data sources', 'Redesigning the chart UI'],
  successCriteria: ['Rejection reasons appear as nodes', 'Funnel shows all stages'],
}

const renderedGoal = `## Goal

### Why
Users cannot see rejection reasons in the funnel.

### Constraints
- Must not break existing Sankey chart
- Read-only change

### Non-Goals
- Adding new data sources
- Redesigning the chart UI

### Success Criteria
- Rejection reasons appear as nodes
- Funnel shows all stages`

describe('renderGoal', () => {
  it('renders a structured Goal section', () => {
    expect(renderGoal(sampleGoal)).toBe(renderedGoal)
  })

  it('renders None for empty arrays', () => {
    const goal: TicketGoal = { why: 'Why text', constraints: [], nonGoals: [], successCriteria: [] }
    const result = renderGoal(goal)
    expect(result).toContain('- None')
  })
})

describe('parseGoal', () => {
  it('parses a rendered Goal section', () => {
    const parsed = parseGoal(renderedGoal)
    expect(parsed).toEqual(sampleGoal)
  })

  it('returns null when no Goal section present', () => {
    expect(parseGoal('Some description without a goal section')).toBeNull()
  })

  it('returns null when Why is missing', () => {
    const noWhy = `## Goal\n\n### Success Criteria\n- thing`
    expect(parseGoal(noWhy)).toBeNull()
  })

  it('parses Goal embedded in a larger description', () => {
    const full = `Some intro text.\n\n${renderedGoal}\n\n## Agent Q Plan\n\nplan stuff`
    const parsed = parseGoal(full)
    expect(parsed?.why).toBe('Users cannot see rejection reasons in the funnel.')
  })

  it('stops parsing at the next ## heading', () => {
    const full = `${renderedGoal}\n\n## Agent Q Plan\n\n### Why\nNot the goal`
    const parsed = parseGoal(full)
    expect(parsed?.why).toBe('Users cannot see rejection reasons in the funnel.')
  })
})

describe('upsertGoalSection', () => {
  it('appends Goal to empty description', () => {
    expect(upsertGoalSection('', sampleGoal)).toBe(renderGoal(sampleGoal))
  })

  it('appends Goal after existing description', () => {
    const result = upsertGoalSection('Existing content.', sampleGoal)
    expect(result).toBe(`Existing content.\n\n${renderGoal(sampleGoal)}`)
  })

  it('replaces an existing Goal section', () => {
    const original = upsertGoalSection('', sampleGoal)
    const updated: TicketGoal = { ...sampleGoal, why: 'Updated why text.' }
    const result = upsertGoalSection(original, updated)
    expect(result).toContain('Updated why text.')
    expect(result).not.toContain('Users cannot see rejection reasons')
  })

  it('preserves content after the Goal section when replacing', () => {
    const description = `${renderGoal(sampleGoal)}\n\n## Agent Q Plan\n\nplan stuff`
    const updated: TicketGoal = { ...sampleGoal, why: 'New why.' }
    const result = upsertGoalSection(description, updated)
    expect(result).toContain('## Agent Q Plan')
    expect(result).toContain('plan stuff')
  })
})

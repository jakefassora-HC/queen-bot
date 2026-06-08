import { renderStoryBrain, parseTaskGraphStatus, updateTaskGraphDone, appendProofEntry, setStoryStatus, extractGoalSection } from '../story-brain.js'
import type { StoryBrain, TicketGoal } from '../types.js'

const sampleGoal: TicketGoal = {
  why: 'Surface AI tools automatically.',
  constraints: ['Haiku only', 'Admin auth required'],
  nonGoals: ['File uploads'],
  successCriteria: ['Weekly cron runs without intervention', 'Duplicate entries prevented'],
}

const sampleBrain: StoryBrain = {
  parentKey: 'AISOL-651',
  summary: 'Auto-sync AI Toolshed',
  goal: sampleGoal,
  taskGraph: [
    { key: 'AISOL-652', summary: 'DB schema', done: false },
    { key: 'AISOL-653', summary: 'Ingestion pipeline', done: true },
  ],
  planSections: [
    { taskKey: 'AISOL-652', taskSummary: 'DB schema', content: '### Step 1\nCreate migration file.' },
    { taskKey: 'AISOL-653', taskSummary: 'Ingestion pipeline', content: '### Step 1\nExtend confluence.ts.' },
  ],
  worktrees: ['/path/to/worktree feature/aisol-651'],
  proof: ['AISOL-652: migration verified 2026-06-02'],
  status: 'in-progress',
}

describe('renderStoryBrain', () => {
  it('renders a complete story.md document', () => {
    const md = renderStoryBrain(sampleBrain)
    expect(md).toContain('# Story AISOL-651: Auto-sync AI Toolshed')
    expect(md).toContain('## Goal')
    expect(md).toContain('Surface AI tools automatically.')
    expect(md).toContain('## Task Graph')
    expect(md).toContain('- [ ] Task 1: DB schema (AISOL-652)')
    expect(md).toContain('- [x] Task 2: Ingestion pipeline (AISOL-653)')
    expect(md).toContain('## Plan')
    expect(md).toContain('### Task 1: DB schema (AISOL-652)')
    expect(md).toContain('### Task 2: Ingestion pipeline (AISOL-653)')
    expect(md).toContain('## Worktrees')
    expect(md).toContain('## Proof')
    expect(md).toContain('AISOL-652: migration verified')
    expect(md).toContain('## Status')
    expect(md).toContain('in-progress')
  })
})

describe('extractGoalSection', () => {
  it('returns the ## Goal markdown block from a rendered brain', () => {
    const md = renderStoryBrain(sampleBrain)
    const goal = extractGoalSection(md)
    expect(goal).toContain('## Goal')
    expect(goal).toContain('Surface AI tools automatically.')
    expect(goal).not.toContain('## Task Graph')
  })

  it('returns null when no Goal section', () => {
    expect(extractGoalSection('# Story\n\nNo goal here.')).toBeNull()
  })
})

describe('parseTaskGraphStatus', () => {
  it('returns done/pending counts from rendered markdown', () => {
    const md = renderStoryBrain(sampleBrain)
    const result = parseTaskGraphStatus(md)
    expect(result.total).toBe(2)
    expect(result.done).toBe(1)
    expect(result.pending).toBe(1)
  })
})

describe('updateTaskGraphDone', () => {
  it('marks a task as done in the markdown', () => {
    const md = renderStoryBrain(sampleBrain)
    const updated = updateTaskGraphDone(md, 'AISOL-652')
    expect(updated).toContain('- [x] Task 1: DB schema (AISOL-652)')
  })

  it('is a no-op for a key not in the graph', () => {
    const md = renderStoryBrain(sampleBrain)
    const updated = updateTaskGraphDone(md, 'AISOL-999')
    expect(updated).toBe(md)
  })
})

describe('appendProofEntry', () => {
  it('appends a proof entry to the ## Proof section', () => {
    const md = renderStoryBrain({ ...sampleBrain, proof: [] })
    const updated = appendProofEntry(md, 'AISOL-653: pipeline verified 2026-06-03')
    expect(updated).toContain('- AISOL-653: pipeline verified 2026-06-03')
  })
})

describe('setStoryStatus', () => {
  it('updates the ## Status section', () => {
    const md = renderStoryBrain(sampleBrain)
    const updated = setStoryStatus(md, 'done')
    expect(updated).toContain('\ndone\n')
  })
})

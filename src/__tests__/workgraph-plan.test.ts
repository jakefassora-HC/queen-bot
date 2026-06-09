import { buildWorkGraph, groupWorkTasksIntoWaves, renderWorkGraphStatus } from '../workgraph-plan.js'
import type { WorkTask } from '../workgraph-plan.js'

const sharedContextPath = '/tmp/queen/story.md'

function task(overrides: Partial<WorkTask> & Pick<WorkTask, 'title'>): WorkTask {
  return {
    title: overrides.title,
    summary: overrides.summary ?? `${overrides.title} summary`,
    storyPoints: overrides.storyPoints ?? 3,
    lane: overrides.lane ?? 'backend',
    wave: overrides.wave ?? 0,
    blockedBy: overrides.blockedBy ?? [],
    blocks: overrides.blocks ?? [],
    canRunWith: overrides.canRunWith ?? [],
    sourceSection: overrides.sourceSection ?? 'Section 1',
    sharedContextPath,
    autonomyLevel: overrides.autonomyLevel ?? 2,
    humanReviewRequired: overrides.humanReviewRequired ?? true,
    proofRequired: overrides.proofRequired ?? true,
    ticketKey: overrides.ticketKey,
    localPlanPath: overrides.localPlanPath
  }
}

test('groupWorkTasksIntoWaves puts independent tasks in the same first wave', () => {
  const waves = groupWorkTasksIntoWaves([
    task({ title: 'API contract', ticketKey: 'QUEEN-1', lane: 'backend' }),
    task({ title: 'UI shell', ticketKey: 'QUEEN-2', lane: 'frontend' })
  ])

  expect(waves).toHaveLength(1)
  expect(waves[0]?.wave).toBe(1)
  expect(waves[0]?.tasks.map((workTask) => workTask.ticketKey)).toEqual(['QUEEN-1', 'QUEEN-2'])
  expect(waves[0]?.tasks.every((workTask) => workTask.wave === 1)).toBe(true)
})

test('groupWorkTasksIntoWaves moves dependent tasks into later waves', () => {
  const waves = groupWorkTasksIntoWaves([
    task({ title: 'Create schema', ticketKey: 'QUEEN-1', lane: 'backend', blocks: ['QUEEN-2'] }),
    task({ title: 'Build evaluator', ticketKey: 'QUEEN-2', lane: 'ml', blockedBy: ['QUEEN-1'] }),
    task({ title: 'Write harness', ticketKey: 'QUEEN-3', lane: 'qa', blockedBy: ['QUEEN-2'] })
  ])

  expect(waves.map((wave) => wave.tasks.map((workTask) => workTask.ticketKey))).toEqual([
    ['QUEEN-1'],
    ['QUEEN-2'],
    ['QUEEN-3']
  ])
})

test('renderWorkGraphStatus includes wave, lane, and blockers', () => {
  const graph = buildWorkGraph({
    sourcePlanPath: '/tmp/source-plan.md',
    epicKey: 'QUEEN-0',
    sharedContextPath,
    tasks: [
      task({ title: 'Create schema', ticketKey: 'QUEEN-1', lane: 'backend', blocks: ['QUEEN-2'] }),
      task({ title: 'Build evaluator', ticketKey: 'QUEEN-2', lane: 'ml', blockedBy: ['QUEEN-1'] })
    ]
  })

  const status = renderWorkGraphStatus(graph)

  expect(status).toContain('Epic: QUEEN-0')
  expect(status).toContain('Wave 1')
  expect(status).toContain('[backend]')
  expect(status).toContain('QUEEN-1 Create schema')
  expect(status).toContain('Wave 2')
  expect(status).toContain('[ml]')
  expect(status).toContain('blocked by QUEEN-1')
})

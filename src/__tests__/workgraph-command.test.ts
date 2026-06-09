import { formatGraphStatus, resolveWaveTickets } from '../workgraph-command.js'
import type { JiraTicket } from '../types.js'

function ticket(overrides: Partial<JiraTicket>): JiraTicket {
  return {
    id: overrides.key ?? '1',
    key: overrides.key ?? 'AISOL-1',
    summary: overrides.summary ?? 'Task',
    description: overrides.description ?? '',
    storyPoints: overrides.storyPoints ?? 3,
    issueType: overrides.issueType ?? 'Task',
    labels: overrides.labels ?? [],
    status: overrides.status ?? 'To Do',
    parent: overrides.parent,
    issueLinks: overrides.issueLinks ?? [],
    repo: overrides.repo ?? 'Codefied/pathfinder',
  }
}

const story = ticket({
  key: 'AISOL-448',
  summary: 'Auto Research',
  issueType: 'Epic',
  storyPoints: 13,
})

const taxonomy = ticket({
  key: 'AISOL-738',
  summary: 'Plan-tier taxonomy reconciliation',
  parent: { key: 'AISOL-448', summary: 'Auto Research' },
  description: '## Parallel Execution\nWave: 0\nLane: Data Foundation\nBlocks: AISOL-740\n\n## Continuity\nShared context: /tmp/story.md\nLocal plan: /tmp/AISOL-738/plan.md',
})

const schemas = ticket({
  key: 'AISOL-740',
  summary: 'Data contract schemas',
  parent: { key: 'AISOL-448', summary: 'Auto Research' },
  description: '## Parallel Execution\nWave: 1\nLane: Data Foundation\nBlocked by: AISOL-738\nCan run with: AISOL-741\n\n## Continuity\nShared context: /tmp/story.md\nLocal plan: /tmp/AISOL-740/plan.md',
  issueLinks: [{ key: 'AISOL-738', summary: 'Plan-tier taxonomy reconciliation', type: 'Blocks', direction: 'inward' }],
})

const assetInventory = ticket({
  key: 'AISOL-741',
  summary: 'Asset inventory',
  parent: { key: 'AISOL-448', summary: 'Auto Research' },
  description: '## Parallel Execution\nWave: 1\nLane: Documentation\nCan run with: AISOL-740\n\n## Continuity\nShared context: /tmp/story.md\nLocal plan: /tmp/AISOL-741/plan.md',
})

test('formatGraphStatus groups child tickets by wave and lane', () => {
  const output = formatGraphStatus(story, [story, taxonomy, schemas, assetInventory])

  expect(output).toContain('Queen WorkGraph: AISOL-448 Auto Research')
  expect(output).toContain('Wave 0')
  expect(output).toContain('Data Foundation')
  expect(output).toContain('AISOL-738')
  expect(output).toContain('Wave 1')
  expect(output).toContain('Documentation')
  expect(output).toContain('blocked by: AISOL-738')
})

test('resolveWaveTickets returns only unblocked tickets for the selected wave', () => {
  const result = resolveWaveTickets('AISOL-448', 1, [story, taxonomy, schemas, assetInventory])

  expect(result.ready.map(t => t.key)).toEqual(['AISOL-741'])
  expect(result.blocked).toEqual([{ ticketKey: 'AISOL-740', reason: 'blocked by AISOL-738' }])
})

test('resolveWaveTickets treats completed blockers as unblocked', () => {
  const doneTaxonomy = { ...taxonomy, status: 'Done' }
  const result = resolveWaveTickets('AISOL-448', 1, [story, doneTaxonomy, schemas, assetInventory])

  expect(result.ready.map(t => t.key)).toEqual(['AISOL-740', 'AISOL-741'])
  expect(result.blocked).toEqual([])
})

test('resolveWaveTickets treats formal Jira Blocks links as blockers without text metadata', () => {
  const api = ticket({
    key: 'AISOL-742',
    summary: 'API contract',
    parent: { key: 'AISOL-448', summary: 'Auto Research' },
    description: 'Wave: 1\nLane: Data Foundation',
    issueLinks: [{ key: 'AISOL-743', summary: 'Schema review', type: 'Blocks', direction: 'inward' }],
  })
  const docs = ticket({
    key: 'AISOL-744',
    summary: 'Docs draft',
    parent: { key: 'AISOL-448', summary: 'Auto Research' },
    description: 'Wave: 1\nLane: Documentation',
    issueLinks: [{ key: 'AISOL-745', summary: 'Editorial pass', type: 'Blocks', direction: 'outward' }],
  })
  const schemaReview = ticket({ key: 'AISOL-743', summary: 'Schema review' })
  const editorialPass = ticket({ key: 'AISOL-745', summary: 'Editorial pass' })

  const result = resolveWaveTickets('AISOL-448', 1, [story, api, docs, schemaReview, editorialPass])

  expect(result.ready).toEqual([])
  expect(result.blocked).toEqual([
    { ticketKey: 'AISOL-742', reason: 'blocked by AISOL-743' },
    { ticketKey: 'AISOL-744', reason: 'blocked by AISOL-745' },
  ])
})

test('formatGraphStatus displays link-derived blockers compactly', () => {
  const api = ticket({
    key: 'AISOL-742',
    summary: 'API contract',
    parent: { key: 'AISOL-448', summary: 'Auto Research' },
    description: 'Wave: 1\nLane: Data Foundation',
    issueLinks: [{ key: 'AISOL-743', summary: 'Schema review', type: 'Blocks', direction: 'inward' }],
  })
  const schemaReview = ticket({ key: 'AISOL-743', summary: 'Schema review' })

  const output = formatGraphStatus(story, [story, api, schemaReview])

  expect(output).toContain('AISOL-742 (To Do) API contract | blocked by: AISOL-743')
})

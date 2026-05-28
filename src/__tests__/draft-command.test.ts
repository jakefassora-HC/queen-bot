import { buildDefaultResearchSources, parseDraftArgs } from '../draft-command.js'

test('parseDraftArgs extracts file, project, and create flag', () => {
  const args = parseDraftArgs(['--file', 'idea.md', '--project', 'TOOL', '--create'])

  expect(args.file).toBe('idea.md')
  expect(args.projectKey).toBe('TOOL')
  expect(args.create).toBe(true)
})

test('parseDraftArgs accepts custom research sources', () => {
  const args = parseDraftArgs([
    '--file', 'idea.md',
    '--project', 'TOOL',
    '--source', 'Ruflo|https://github.com/ruvnet/ruflo|Swarm vocabulary'
  ])

  const source = args.sources.find(item => item.title === 'Ruflo')
  expect(source?.url).toBe('https://github.com/ruvnet/ruflo')
  expect(source?.notes).toBe('Swarm vocabulary')
})

test('default research sources include token-cost references', () => {
  const urls = buildDefaultResearchSources().map(source => source.url)

  expect(urls).toContain('https://github.com/rtk-ai/rtk')
  expect(urls).toContain('https://github.com/JuliusBrussee/caveman')
})

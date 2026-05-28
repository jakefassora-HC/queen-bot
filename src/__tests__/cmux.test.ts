import {
  DEFAULT_CMUX_BINARY,
  buildCmuxWorkspaceArgs,
  cmuxWorkspaceName,
  formatCmuxCommand,
  resolveCmuxBinary
} from '../cmux.js'

test('cmuxWorkspaceName uses the Jira key for easy scanning', () => {
  expect(cmuxWorkspaceName('aisol-465')).toBe('AISOL-465')
})

test('buildCmuxWorkspaceArgs opens a named workspace that runs one ticket flow', () => {
  const args = buildCmuxWorkspaceArgs('/Users/jakefassora/projects/agent-queue', 'AISOL-465')

  expect(args).toEqual([
    'new-workspace',
    '--name',
    'AISOL-465',
    '--cwd',
    '/Users/jakefassora/projects/agent-queue',
    '--command',
    'agent-queue run AISOL-465'
  ])
})

test('formatCmuxCommand previews the exact command that will run', () => {
  expect(formatCmuxCommand('/Users/jakefassora/projects/agent-queue', 'AISOL-465', 'cmux')).toBe(
    'cmux new-workspace --name AISOL-465 --cwd /Users/jakefassora/projects/agent-queue --command "agent-queue run AISOL-465"'
  )
})

test('resolveCmuxBinary prefers env, then the app bundle, then PATH', () => {
  expect(resolveCmuxBinary({ CMUX_BIN: '/custom/cmux' }, () => false)).toBe('/custom/cmux')
  expect(resolveCmuxBinary({}, path => path === DEFAULT_CMUX_BINARY)).toBe(DEFAULT_CMUX_BINARY)
  expect(resolveCmuxBinary({}, () => false)).toBe('cmux')
})

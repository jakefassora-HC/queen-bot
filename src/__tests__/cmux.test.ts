import {
  DEFAULT_CMUX_BINARY,
  buildCmuxAgentCommand,
  buildCmuxWorkspaceArgs,
  canStartCmuxFromEnv,
  cmuxWorkspaceName,
  formatCmuxCommand,
  resolveCmuxBinary
} from '../cmux.js'

test('cmuxWorkspaceName uses the Jira key for easy scanning', () => {
  expect(cmuxWorkspaceName('aisol-465')).toBe('AISOL-465')
})

test('buildCmuxAgentCommand opens interactive Claude with the ticket handoff prompt', () => {
  const command = buildCmuxAgentCommand('AISOL-465', 'cmux')

  expect(command).toContain('cmux rename-workspace AISOL-465')
  expect(command).toContain('claude --name AISOL-465')
  expect(command).toContain('agent-queue show AISOL-465')
  expect(command).not.toContain('agent-queue run AISOL-465')
})

test('buildCmuxWorkspaceArgs creates a workspace and starts Claude from inside cmux', () => {
  const args = buildCmuxWorkspaceArgs('/Users/jakefassora/projects/agent-queue', 'AISOL-465', 'cmux')

  expect(args).toEqual([
    'new-workspace',
    '--cwd',
    '/Users/jakefassora/projects/agent-queue',
    '--command',
    commandWithPrompt('cmux')
  ])
})

test('formatCmuxCommand previews the exact command that will run', () => {
  expect(formatCmuxCommand('/Users/jakefassora/projects/agent-queue', 'AISOL-465', 'cmux')).toBe(
    `cmux new-workspace --cwd /Users/jakefassora/projects/agent-queue --command ${JSON.stringify(commandWithPrompt('cmux'))}`
  )
})

function commandWithPrompt(cmuxBinary: string): string {
  return buildCmuxAgentCommand('AISOL-465', cmuxBinary)
}

test('resolveCmuxBinary prefers env, then the app bundle, then PATH', () => {
  expect(resolveCmuxBinary({ CMUX_BIN: '/custom/cmux' }, () => false)).toBe('/custom/cmux')
  expect(resolveCmuxBinary({}, path => path === DEFAULT_CMUX_BINARY)).toBe(DEFAULT_CMUX_BINARY)
  expect(resolveCmuxBinary({}, () => false)).toBe('cmux')
})

test('canStartCmuxFromEnv requires an inside-cmux shell unless explicitly overridden', () => {
  expect(canStartCmuxFromEnv({})).toBe(false)
  expect(canStartCmuxFromEnv({ CMUX_WORKSPACE_ID: 'workspace:1' })).toBe(true)
  expect(canStartCmuxFromEnv({ AGENT_QUEUE_ALLOW_EXTERNAL_CMUX: '1' })).toBe(true)
})

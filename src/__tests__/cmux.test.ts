import {
  DEFAULT_CMUX_BINARY,
  buildCmuxAgentCommand,
  buildCmuxExecutionWorkspaceArgs,
  buildClaudeHandoffPrompt,
  buildCmuxWorkspaceArgs,
  canStartCmuxFromEnv,
  cmuxWorkspaceName,
  formatCmuxCommand,
  resolveCmuxBinary
} from '../cmux.js'
import type { ExecutionContract } from '../types.js'

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

test('buildClaudeHandoffPrompt tells workers to use Superpowers and parallel agents where safe', () => {
  const prompt = buildClaudeHandoffPrompt('AISOL-465')

  expect(prompt).toContain('Use Superpowers')
  expect(prompt).toContain('dispatch parallel agents')
  expect(prompt).toContain('independent')
  expect(prompt).toContain('bounded autonomy')
})

test('cmux handoff says execution must come from Jira plan and worktree', () => {
  const prompt = buildClaudeHandoffPrompt('AISOL-465')

  expect(prompt).toContain('approved Jira plan')
  expect(prompt).toContain('autonomy level')
  expect(prompt).toContain('worktree')
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

test('buildCmuxExecutionWorkspaceArgs starts in the execution worktree', () => {
  const contract: ExecutionContract = {
    ticketKey: 'AISOL-465',
    repo: 'jakefassora-HC/queen-bot',
    branch: 'agent/AISOL-465',
    worktreePath: '/tmp/.agent-worktrees/AISOL-465',
    autonomyLevel: 2,
    approvedAt: 'pending',
    plan: {
      ticketKey: 'AISOL-465',
      goal: 'Goal',
      context: ['Context'],
      acceptanceCriteria: ['Done'],
      implementationNotes: [],
      verification: ['Test'],
      risks: [],
      forbiddenActions: ['Do not merge.'],
      autonomyLevel: 2
    }
  }

  const args = buildCmuxExecutionWorkspaceArgs(contract, 'cmux')

  expect(args).toContain('/tmp/.agent-worktrees/AISOL-465')
  expect(args.join(' ')).toContain('approved Jira plan')
})

test('execution handoff does not ask for another planning approval after approval contract exists', () => {
  const prompt = buildClaudeHandoffPrompt('AISOL-465', {
    ticketKey: 'AISOL-465',
    repo: 'jakefassora-HC/queen-bot',
    branch: 'agent/AISOL-465',
    worktreePath: '/tmp/.agent-worktrees/AISOL-465',
    autonomyLevel: 2,
    approvedAt: '2026-05-28T00:00:00.000Z',
    plan: {
      ticketKey: 'AISOL-465',
      goal: 'Goal',
      context: ['Context'],
      acceptanceCriteria: ['Done'],
      implementationNotes: [],
      verification: ['Test'],
      risks: [],
      forbiddenActions: ['Do not merge.'],
      autonomyLevel: 2
    }
  })

  expect(prompt).toContain('Execution is already approved')
  expect(prompt).toContain('begin implementation')
  expect(prompt).not.toContain('propose the plan and wait')
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

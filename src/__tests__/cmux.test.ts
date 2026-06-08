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
  expect(prompt).toContain('Dispatch parallel agents')
  expect(prompt).toContain('independent')
  expect(prompt).toContain('approved contract')
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
    engine: 'claude',
    autonomyLevel: 2,
    approvedAt: 'pending',
    goal: null,
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
    engine: 'claude',
    autonomyLevel: 2,
    approvedAt: '2026-05-28T00:00:00.000Z',
    goal: null,
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

  expect(prompt).toContain('proceed')
  expect(prompt).toContain('agent-queue context AISOL-465 --brief')
  expect(prompt).not.toContain('agent-queue show AISOL-465')
  expect(prompt).not.toContain('plus the local plan path')
  expect(prompt).toContain('After "proceed"')
  expect(prompt).not.toContain('propose the plan and wait')
})

test('execution handoff points workers at the local plan without dumping plan body', () => {
  const prompt = buildClaudeHandoffPrompt('AISOL-465', {
    ticketKey: 'AISOL-465',
    repo: 'jakefassora-HC/queen-bot',
    branch: 'agent/AISOL-465',
    worktreePath: '/tmp/.agent-worktrees/AISOL-465',
    engine: 'claude',
    autonomyLevel: 2,
    approvedAt: '2026-05-28T00:00:00.000Z',
    goal: null,
    plan: {
      ticketKey: 'AISOL-465',
      goal: 'DO NOT DUMP PLAN GOAL',
      context: ['DO NOT DUMP HUGE JIRA CONTEXT'],
      acceptanceCriteria: ['DO NOT DUMP ACCEPTANCE CRITERIA'],
      implementationNotes: [],
      verification: ['Test'],
      risks: [],
      forbiddenActions: ['Do not merge.'],
      autonomyLevel: 2,
      localPlanPath: '/tmp/plans/Codefied/queen-bot/AISOL-465/plan.md'
    }
  })

  expect(prompt).toContain('Local plan: /tmp/plans/Codefied/queen-bot/AISOL-465/plan.md')
  expect(prompt).toContain('Read these files for continuity')
  expect(prompt).not.toContain('DO NOT DUMP PLAN GOAL')
  expect(prompt).not.toContain('DO NOT DUMP HUGE JIRA CONTEXT')
  expect(prompt).not.toContain('DO NOT DUMP ACCEPTANCE CRITERIA')
})

test('execution handoff includes existing WorkGraph continuity file pointers', () => {
  const prompt = buildClaudeHandoffPrompt('AISOL-465', {
    ticketKey: 'AISOL-465',
    repo: 'jakefassora-HC/queen-bot',
    branch: 'agent/AISOL-465',
    worktreePath: '/tmp/.agent-worktrees/AISOL-465',
    engine: 'claude',
    autonomyLevel: 2,
    approvedAt: '2026-05-28T00:00:00.000Z',
    goal: null,
    plan: {
      ticketKey: 'AISOL-465',
      goal: 'Goal',
      context: ['Context'],
      acceptanceCriteria: ['Done'],
      implementationNotes: [],
      verification: ['Test'],
      risks: [],
      forbiddenActions: ['Do not merge.'],
      autonomyLevel: 2,
      localPlanPath: '/tmp/plans/Codefied/queen-bot/AISOL-465/plan.md'
    }
  }, {
    plansRoot: '/tmp/plans',
    exists: filePath => filePath.endsWith('/AISOL-465/story.md') || filePath.endsWith('/AISOL-465/workgraph.md')
  })

  expect(prompt).toContain('Story brain: /tmp/plans/jakefassora-HC/queen-bot/AISOL-465/story.md')
  expect(prompt).toContain('WorkGraph continuity: /tmp/plans/jakefassora-HC/queen-bot/AISOL-465/workgraph.md')
  expect(prompt).not.toContain('# WorkGraph AISOL-465')
  expect(prompt).not.toContain('## Task Graph')
})

test('buildClaudeHandoffPrompt injects Goal when contract has a non-null goal', () => {
  const prompt = buildClaudeHandoffPrompt('AISOL-465', {
    ticketKey: 'AISOL-465',
    repo: 'jakefassora-HC/queen-bot',
    branch: 'agent/AISOL-465',
    worktreePath: '/tmp/.agent-worktrees/AISOL-465',
    engine: 'claude',
    autonomyLevel: 2,
    approvedAt: '2026-05-28T00:00:00.000Z',
    goal: {
      why: 'We need to improve performance',
      constraints: ['No breaking changes', 'Must use existing APIs'],
      nonGoals: ['Refactor the entire module'],
      successCriteria: ['30% faster', 'All tests pass']
    },
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

  expect(prompt).toContain('## Goal (source of truth)')
  const agentIndex = prompt.indexOf('You are Agent Q')
  const goalIndex = prompt.indexOf('## Goal (source of truth)')
  expect(agentIndex).toBeLessThan(goalIndex)
})

test('buildClaudeHandoffPrompt does not inject Goal when contract has goal: null', () => {
  const prompt = buildClaudeHandoffPrompt('AISOL-465', {
    ticketKey: 'AISOL-465',
    repo: 'jakefassora-HC/queen-bot',
    branch: 'agent/AISOL-465',
    worktreePath: '/tmp/.agent-worktrees/AISOL-465',
    engine: 'claude',
    autonomyLevel: 2,
    approvedAt: '2026-05-28T00:00:00.000Z',
    goal: null,
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

  expect(prompt).not.toContain('## Goal (source of truth)')
})

test('formatCmuxCommand previews the exact command that will run', () => {
  const result = formatCmuxCommand('/Users/jakefassora/projects/agent-queue', 'AISOL-465', 'cmux')
  expect(result).toContain('cmux new-workspace --cwd /Users/jakefassora/projects/agent-queue --command')
  expect(result).toContain('rename-workspace AISOL-465')
  expect(result).toContain('claude --name AISOL-465')
  expect(result).toContain('agent-queue show AISOL-465')
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

const sampleContract = (autonomyLevel: number): ExecutionContract => ({
  ticketKey: 'AISOL-651',
  repo: 'jakefassora-HC/queen-bot',
  branch: 'agent/AISOL-651',
  worktreePath: '/tmp/.agent-worktrees/AISOL-651',
  engine: 'claude',
  autonomyLevel: autonomyLevel as ExecutionContract['autonomyLevel'],
  approvedAt: '2026-06-01T00:00:00.000Z',
  goal: null,
  plan: {
    ticketKey: 'AISOL-651',
    goal: 'Goal',
    context: ['Context'],
    acceptanceCriteria: ['Done'],
    implementationNotes: [],
    verification: ['Test'],
    risks: [],
    forbiddenActions: ['Do not merge.'],
    autonomyLevel: autonomyLevel as ExecutionContract['autonomyLevel']
  }
})

describe('buildCmuxAgentCommand auto mode', () => {
  it('includes --dangerously-skip-permissions for autonomy level 2', () => {
    const command = buildCmuxAgentCommand('AISOL-651', 'cmux', sampleContract(2))
    expect(command).toContain('claude --dangerously-skip-permissions --name AISOL-651')
  })

  it('does not include --dangerously-skip-permissions for autonomy level 1', () => {
    const command = buildCmuxAgentCommand('AISOL-651', 'cmux', sampleContract(1))
    expect(command).not.toContain('--dangerously-skip-permissions')
    expect(command).toContain('claude --name AISOL-651')
  })
})

describe('buildClaudeHandoffPrompt formatting', () => {
  it('sections are separated by double newlines not spaces', () => {
    const prompt = buildClaudeHandoffPrompt('AISOL-651')
    expect(prompt).toContain('\n\n')
    const lines = prompt.split('\n')
    const agentLine = lines.findIndex(l => l.startsWith('You are Agent Q'))
    const rulesLine = lines.findIndex(l => l.includes('Execution Rules'))
    expect(agentLine).not.toBe(rulesLine)
    expect(rulesLine).toBeGreaterThan(agentLine)
  })
})

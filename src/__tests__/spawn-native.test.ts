import { buildClaudeArgs } from '../spawn-native.js'

test('plan is last argument, not shell-interpolated', () => {
  const args = buildClaudeArgs('/repo/worktree', 'implement rate limiting')
  expect(args[args.length - 1]).toBe('implement rate limiting')
  expect(args[args.length - 2]).toBe('-p')
})

test('git push is not in allowed tools', () => {
  const args = buildClaudeArgs('/repo/worktree', 'test')
  const toolsIdx = args.indexOf('--allowedTools')
  const tools = args[toolsIdx + 1]
  expect(tools).not.toContain('git push')
  expect(tools).not.toContain('curl')
})

test('cwd is set to worktree', () => {
  const args = buildClaudeArgs('/repo/worktree', 'test')
  expect(args).toContain('--cwd')
  expect(args[args.indexOf('--cwd') + 1]).toBe('/repo/worktree')
})

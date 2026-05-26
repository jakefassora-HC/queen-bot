import { worktreePath, branchName } from '../worktree.js'

test('worktreePath returns predictable path', () => {
  const p = worktreePath('TOOL-48', '/base/repo')
  expect(p).toBe('/base/.agent-worktrees/TOOL-48')
})

test('branchName uses agent/ prefix', () => {
  expect(branchName('TOOL-48')).toBe('agent/TOOL-48')
})

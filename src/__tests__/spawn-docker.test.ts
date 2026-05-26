import { buildDockerArgs } from '../spawn-docker.js'

test('docker args never contain shell-interpolated plan', () => {
  const args = buildDockerArgs('/workspace/TOOL-1', '/tmp/plan-TOOL-1.txt', 'sk-ant-xxx')
  // plan is passed as a file mount, not in args
  expect(args.join(' ')).not.toContain('implement')
  // network is disabled
  expect(args).toContain('--network')
  expect(args[args.indexOf('--network') + 1]).toBe('none')
  // worktree is mounted
  expect(args.join(' ')).toContain('/workspace/TOOL-1')
})

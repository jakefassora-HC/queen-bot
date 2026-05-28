import { buildSuccessMessage, buildFailureMessage } from '../notify.js'

test('success message contains ticket and PR link', () => {
  const msg = buildSuccessMessage('TOOL-48', 'Add rate limiting', 'https://github.com/pr/1', 120)
  expect(msg).toContain('TOOL-48')
  expect(msg).toContain('https://github.com/pr/1')
  expect(msg).toContain('2m')
})

test('failure message contains ticket and how to inspect', () => {
  const msg = buildFailureMessage('TOOL-48', 'some error')
  expect(msg).toContain('TOOL-48')
  expect(msg).toContain('cmux workspace TOOL-48')
  expect(msg).not.toContain('tmux')
})

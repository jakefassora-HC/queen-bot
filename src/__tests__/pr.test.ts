import { buildPrBody } from '../pr.js'

test('PR body contains ticket key and plan', () => {
  const body = buildPrBody('TOOL-48', 'Add rate limiting', 'Step 1: read route.ts')
  expect(body).toContain('TOOL-48')
  expect(body).toContain('Step 1: read route.ts')
})

import { compactText, estimateTokens, TOKEN_DISCIPLINE } from '../token-budget.js'

test('estimateTokens uses a stable rough character ratio', () => {
  expect(estimateTokens('12345678')).toBe(2)
  expect(estimateTokens('123456789')).toBe(3)
})

test('compactText stays under budget and preserves URLs', () => {
  const text = [
    'This is filler that can be trimmed.',
    'https://github.com/rtk-ai/rtk',
    'Another long explanatory sentence that is less important.',
    'https://github.com/JuliusBrussee/caveman',
    'Final detail that can be dropped.'
  ].join('\n')

  const result = compactText(text, 20)

  expect(result.compressedTokens).toBeLessThanOrEqual(20)
  expect(result.text).toContain('https://github.com/rtk-ai/rtk')
  expect(result.text).toContain('https://github.com/JuliusBrussee/caveman')
  expect(result.originalTokens).toBeGreaterThan(result.compressedTokens)
})

test('token discipline captures terse output and compact command-output principles', () => {
  expect(TOKEN_DISCIPLINE).toContain('compress research')
  expect(TOKEN_DISCIPLINE).toContain('preserve URLs')
  expect(TOKEN_DISCIPLINE).toContain('terse Jira language')
})

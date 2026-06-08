import {
  DEFAULT_EXECUTION_ENGINE,
  parseExecutionEngine
} from '../execution-engine.js'

test('parseExecutionEngine supports the planned engine interface', () => {
  expect(DEFAULT_EXECUTION_ENGINE).toBe('claude')
  expect(parseExecutionEngine(undefined)).toBe('claude')
  expect(parseExecutionEngine('claude')).toBe('claude')
  expect(parseExecutionEngine('codex')).toBe('codex')
  expect(parseExecutionEngine('ruflo')).toBe('ruflo')
  expect(parseExecutionEngine('manual')).toBe('manual')
})

test('parseExecutionEngine rejects unsupported engines', () => {
  expect(() => parseExecutionEngine('magic')).toThrow('Unsupported execution engine')
})

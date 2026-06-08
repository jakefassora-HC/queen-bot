import { extractJson } from '../json-extract.js'

test('parses clean JSON directly', () => {
  expect(extractJson('{"a":1}')).toBe('{"a":1}')
})

test('strips code fences', () => {
  const input = '```json\n{"a":1}\n```'
  expect(JSON.parse(extractJson(input))).toEqual({ a: 1 })
})

test('strips code fences without language tag', () => {
  const input = '```\n{"a":1}\n```'
  expect(JSON.parse(extractJson(input))).toEqual({ a: 1 })
})

test('extracts JSON from preamble text', () => {
  const input = 'Here is the JSON output:\n\n{"a":1}'
  expect(JSON.parse(extractJson(input))).toEqual({ a: 1 })
})

test('extracts JSON ignoring trailing text', () => {
  const input = '{"a":1}\n\nLet me know if you need changes.'
  expect(JSON.parse(extractJson(input))).toEqual({ a: 1 })
})

test('handles nested objects correctly', () => {
  const obj = { tickets: [{ summary: 'x', goal: { why: 'y' } }] }
  const input = `Some intro.\n${JSON.stringify(obj)}\nSome outro.`
  expect(JSON.parse(extractJson(input))).toEqual(obj)
})

test('handles strings with braces inside', () => {
  const obj = { message: 'use {curly} braces' }
  expect(JSON.parse(extractJson(JSON.stringify(obj)))).toEqual(obj)
})

test('throws when no JSON present', () => {
  expect(() => extractJson('no json here at all')).toThrow('No valid JSON found')
})

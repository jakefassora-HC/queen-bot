// Robustly extract the first valid JSON object or array from a Claude response.
// Handles: code fences, preamble text, trailing text, mixed content.
export function extractJson(text: string): string {
  const trimmed = text.trim()

  // Best case: response is already clean JSON
  try {
    JSON.parse(trimmed)
    return trimmed
  } catch {}

  // Strip code fences (```json ... ``` or ``` ... ```)
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try {
    JSON.parse(fenced)
    return fenced
  } catch {}

  // Find the first { or [ and scan forward for a valid JSON boundary
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (ch !== '{' && ch !== '[') continue
    const close = ch === '{' ? '}' : ']'
    let depth = 0
    let inString = false
    let escaped = false

    for (let j = i; j < trimmed.length; j++) {
      const c = trimmed[j]
      if (escaped) { escaped = false; continue }
      if (c === '\\' && inString) { escaped = true; continue }
      if (c === '"') { inString = !inString; continue }
      if (inString) continue
      if (c === ch) depth++
      if (c === close) {
        depth--
        if (depth === 0) {
          const candidate = trimmed.slice(i, j + 1)
          try {
            JSON.parse(candidate)
            return candidate
          } catch {
            break
          }
        }
      }
    }
  }

  throw new Error(`No valid JSON found in response: ${trimmed.slice(0, 300)}`)
}

export const JSON_ONLY_INSTRUCTION =
  'CRITICAL: Your entire response must be valid JSON. Start with { and end with }. No preamble, no explanation, no code fences, no markdown.'

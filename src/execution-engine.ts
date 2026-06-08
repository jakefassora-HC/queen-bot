import type { ExecutionEngine } from './types.js'

export const DEFAULT_EXECUTION_ENGINE: ExecutionEngine = 'claude'

const EXECUTION_ENGINES: ExecutionEngine[] = ['claude', 'codex', 'ruflo', 'manual']

export function parseExecutionEngine(value: string | undefined): ExecutionEngine {
  if (!value) return DEFAULT_EXECUTION_ENGINE
  if (EXECUTION_ENGINES.includes(value as ExecutionEngine)) return value as ExecutionEngine
  throw new Error(`Unsupported execution engine "${value}". Use one of: ${EXECUTION_ENGINES.join(', ')}`)
}

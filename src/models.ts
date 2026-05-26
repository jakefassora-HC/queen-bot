import type { Runtime } from './types.js'

const MODELS: Record<Runtime, string> = {
  'claude-docker': 'claude-sonnet-4-6',
  'claude-native': 'claude-sonnet-4-6'
}

export function getModel(runtime: Runtime): string {
  return MODELS[runtime]
}

export function getRuntimes(): Runtime[] {
  return Object.keys(MODELS) as Runtime[]
}

export const PLANNER_MODEL = 'claude-sonnet-4-6'

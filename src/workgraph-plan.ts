export type WorkAutonomyLevel = 0 | 1 | 2 | 3 | 4

export interface WorkTask {
  title: string
  ticketKey?: string
  summary: string
  storyPoints: number
  lane: string
  wave: number
  blockedBy: string[]
  blocks: string[]
  canRunWith: string[]
  sourceSection: string
  localPlanPath?: string
  sharedContextPath: string
  autonomyLevel: WorkAutonomyLevel
  humanReviewRequired: boolean
  proofRequired: boolean
}

export interface WorkWave {
  wave: number
  tasks: WorkTask[]
}

export interface WorkGraph {
  sourcePlanPath: string
  epicKey?: string
  sharedContextPath: string
  waves: WorkWave[]
  tasks: WorkTask[]
}

export interface WorkGraphInput {
  sourcePlanPath: string
  epicKey?: string
  sharedContextPath: string
  tasks: WorkTask[]
}

function taskId(task: WorkTask): string {
  return task.ticketKey ?? task.title
}

function compareTasksByInputOrder(taskOrder: Map<string, number>) {
  return (left: WorkTask, right: WorkTask): number => {
    const leftOrder = taskOrder.get(taskId(left)) ?? 0
    const rightOrder = taskOrder.get(taskId(right)) ?? 0
    return leftOrder - rightOrder
  }
}

function knownBlockers(task: WorkTask, taskIds: Set<string>): string[] {
  return task.blockedBy.filter((blocker) => taskIds.has(blocker))
}

function assertUniqueTaskIds(tasks: WorkTask[]): void {
  const seen = new Set<string>()
  for (const task of tasks) {
    const id = taskId(task)
    if (seen.has(id)) {
      throw new Error(`Duplicate WorkTask id: ${id}`)
    }
    seen.add(id)
  }
}

export function groupWorkTasksIntoWaves(tasks: WorkTask[]): WorkWave[] {
  assertUniqueTaskIds(tasks)

  const taskIds = new Set(tasks.map(taskId))
  const taskOrder = new Map(tasks.map((task, index) => [taskId(task), index]))
  const remaining = new Map(tasks.map((task) => [taskId(task), task]))
  const resolved = new Set<string>()
  const waves: WorkWave[] = []

  while (remaining.size > 0) {
    const ready = Array.from(remaining.values())
      .filter((task) => knownBlockers(task, taskIds).every((blocker) => resolved.has(blocker)))
      .sort(compareTasksByInputOrder(taskOrder))

    if (ready.length === 0) {
      throw new Error(`WorkGraph dependency cycle: ${Array.from(remaining.keys()).join(', ')}`)
    }

    const waveNumber = waves.length + 1
    const waveTasks = ready.map((task) => ({ ...task, wave: waveNumber }))
    waves.push({ wave: waveNumber, tasks: waveTasks })

    for (const task of ready) {
      const id = taskId(task)
      remaining.delete(id)
      resolved.add(id)
    }
  }

  return waves
}

export function buildWorkGraph(input: WorkGraphInput): WorkGraph {
  const waves = groupWorkTasksIntoWaves(input.tasks)
  const tasks = waves.flatMap((wave) => wave.tasks)

  return {
    sourcePlanPath: input.sourcePlanPath,
    epicKey: input.epicKey,
    sharedContextPath: input.sharedContextPath,
    waves,
    tasks
  }
}

function laneNames(tasks: WorkTask[]): string[] {
  return Array.from(new Set(tasks.map((task) => task.lane))).sort((left, right) => left.localeCompare(right))
}

function renderTaskLine(task: WorkTask): string {
  const label = task.ticketKey ? `${task.ticketKey} ${task.title}` : task.title
  const details = [`${task.storyPoints} pts`]
  if (task.blockedBy.length > 0) {
    details.push(`blocked by ${task.blockedBy.join(', ')}`)
  }
  if (task.blocks.length > 0) {
    details.push(`blocks ${task.blocks.join(', ')}`)
  }
  if (task.humanReviewRequired) {
    details.push('human review')
  }
  if (task.proofRequired) {
    details.push('proof')
  }

  return `    - ${label} (${details.join('; ')})`
}

export function renderWorkGraphStatus(graph: WorkGraph): string {
  const lines = [`Source: ${graph.sourcePlanPath}`]

  if (graph.epicKey) {
    lines.push(`Epic: ${graph.epicKey}`)
  }

  lines.push(`Context: ${graph.sharedContextPath}`)

  for (const wave of graph.waves) {
    lines.push(`Wave ${wave.wave}`)
    for (const lane of laneNames(wave.tasks)) {
      lines.push(`  [${lane}]`)
      for (const task of wave.tasks.filter((workTask) => workTask.lane === lane)) {
        lines.push(renderTaskLine(task))
      }
    }
  }

  return lines.join('\n')
}

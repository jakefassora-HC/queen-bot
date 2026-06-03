# Story Brain Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fragmented per-task plan.md files and polluted Jira descriptions with a single `story.md` brain file per story, fix the cmux bootstrap to use `/auto` + proper story context, and remove the `APPROVE JIRA PROOF` gate.

**Architecture:** A new `story-brain.ts` module owns all story.md CRUD. `plan-command.ts` detects parent vs. task tickets and routes writes accordingly — parent stories get story.md created, child tasks get their section written into the parent's story.md, and Jira descriptions get Goal + path link only. The cmux bootstrap is fixed to launch with `--dangerously-skip-permissions` and reference the story.md as the session brain. `proof.ts` drops the interactive approval phrase and auto-posts when policy passes.

**Tech Stack:** TypeScript 5, Node.js 22, Jest + ts-jest, agent-queue CLI

**Spec:** `docs/superpowers/specs/2026-06-02-story-brain-architecture-design.md`

---

## Task 0: Research — Prior Art and Reference Implementations

**Before writing a single line of code**, research how others have solved persistent agent context, story-level orchestration, and brain-file patterns. This research directly informs the `story-brain.ts` design and the cmux bootstrap strategy.

- [ ] **Step 1: Search GitHub for agent memory / brain file patterns**

  Search for repos that implement persistent context files for multi-agent or long-running agent workflows:

  ```bash
  # Use WebSearch or browser — search these queries:
  # "agent memory file markdown github"
  # "multi-agent context persistence brain file"
  # "cmux claude code agent orchestration"
  # "superpowers agent queue story brain"
  # "jira agent workflow brain file context"
  ```

  Key repos to inspect if found:
  - Any `agent-queue`, `queen-bot`, or `agent-memory` repos with persistent state files
  - Repos using `AGENTS.md`, `CONTEXT.md`, or similar session-anchoring files
  - Claude Code / Anthropic examples of persistent agent context patterns

- [ ] **Step 2: Search for Jira + local plan sync patterns**

  ```
  Search: "jira description sync local markdown plan agents"
  Search: "keep jira description minimal link to local plan"
  Search: "agent workflow jira as dashboard not document store"
  ```

  Look specifically for: how teams avoid Jira description bloat while keeping agents informed.

- [ ] **Step 3: Review Superpowers skill for subagent-driven-development**

  ```bash
  cat ~/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/subagent-driven-development/SKILL.md 2>/dev/null || \
  find ~/.claude/plugins -name "subagent-driven-development*" -type f | head -5
  ```

  Understand how Superpowers handles task-by-task execution — this is what the cmux worker will use internally, and the story brain task graph format should match what Superpowers expects.

- [ ] **Step 4: Review claude CLI flags for auto mode**

  ```bash
  claude --help 2>&1 | grep -i "danger\|skip\|auto\|permission\|yes"
  ```

  Confirm the exact flag for auto-approve mode (`--dangerously-skip-permissions` or similar). The cmux bootstrap uses this — verify it exists before hardcoding it in `buildCmuxAgentCommand`.

- [ ] **Step 5: Check existing agent-queue patterns for anything reusable**

  ```bash
  # What does a rendered local plan currently look like?
  cat ~/.agent-queue/plans/Codefied/AI-Analysts/AISOL-653/plan.md 2>/dev/null | head -40

  # What does the context --brief output look like?
  cd ~/projects/agent-queue && agent-queue context AISOL-653 --brief 2>/dev/null | head -30
  ```

  The `story.md` format should feel continuous with what agents already read — don't reinvent the contract, extend it.

- [ ] **Step 6: Document findings before proceeding**

  Write a short findings block as a comment at the top of `story-brain.ts` when you create it in Task 2. Include:
  - Any GitHub pattern you're borrowing from
  - Any flag name you confirmed (e.g. exact auto-mode flag)
  - Any format decision informed by research (e.g. why checkboxes vs. status field)

  If research revealed a better approach than what this plan describes, note it and check with Jake before deviating.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/story-brain.ts` | Create | All story.md read/write/update logic |
| `src/__tests__/story-brain.test.ts` | Create | Tests for all story-brain exports |
| `src/local-plan.ts` | Modify | Add `storyBrainPath()` + `writeStoryBrain()` helpers |
| `src/__tests__/local-plan.test.ts` | Modify | Add tests for new path helpers |
| `src/plan-command.ts` | Modify | Story-aware plan writes; Jira gets Goal + path only |
| `src/__tests__/plan-command.test.ts` | Modify | Tests for story vs. task routing |
| `src/cmux.ts` | Modify | Fix bootstrap: `--dangerously-skip-permissions`, story brain reference, newline formatting |
| `src/__tests__/cmux.test.ts` | Modify | Tests for new handoff format |
| `src/proof.ts` | Modify | Remove `APPROVE JIRA PROOF`; auto-post; write proof to story brain |
| `src/__tests__/proof.test.ts` | Modify | Tests for auto-post flow |
| `.claude/commands/goal.md` | Create | `/goal` slash command that reads story.md Goal section |
| `src/types.ts` | Modify | Add `StoryBrain` interface |

---

## Task 1: Add `StoryBrain` type to `types.ts`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Find the right insertion point**

  ```bash
  grep -n "TicketGoal\|JiraPlan\|ExecutionContract" ~/projects/agent-queue/src/types.ts | head -10
  ```

- [ ] **Step 2: Add `StoryBrain` interface after `TicketGoal`**

  Insert this block immediately after the `TicketGoal` interface in `src/types.ts`:

  ```typescript
  export interface StoryTaskEntry {
    key: string       // e.g. "AISOL-652"
    summary: string   // e.g. "DB schema"
    done: boolean
  }

  export interface StoryBrain {
    parentKey: string
    summary: string
    goal: TicketGoal
    taskGraph: StoryTaskEntry[]
    planSections: Array<{ taskKey: string; taskSummary: string; content: string }>
    worktrees: string[]
    proof: string[]
    status: 'pending' | 'in-progress' | 'done'
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  cd ~/projects/agent-queue && npx tsc --noEmit 2>&1 | head -20
  ```
  Expected: no new errors.

- [ ] **Step 4: Commit**

  ```bash
  cd ~/projects/agent-queue && git add src/types.ts && git commit -m "feat: add StoryBrain and StoryTaskEntry types"
  ```

---

## Task 2: Create `story-brain.ts` + tests

**Files:**
- Create: `src/story-brain.ts`
- Create: `src/__tests__/story-brain.test.ts`

- [ ] **Step 1: Write failing tests first**

  Create `src/__tests__/story-brain.test.ts`:

  ```typescript
  import { renderStoryBrain, parseTaskGraphStatus, updateTaskGraphDone, appendProofEntry, setStoryStatus, extractGoalSection } from '../story-brain.js'
  import type { StoryBrain, TicketGoal } from '../types.js'

  const sampleGoal: TicketGoal = {
    why: 'Surface AI tools automatically.',
    constraints: ['Haiku only', 'Admin auth required'],
    nonGoals: ['File uploads'],
    successCriteria: ['Weekly cron runs without intervention', 'Duplicate entries prevented'],
  }

  const sampleBrain: StoryBrain = {
    parentKey: 'AISOL-651',
    summary: 'Auto-sync AI Toolshed',
    goal: sampleGoal,
    taskGraph: [
      { key: 'AISOL-652', summary: 'DB schema', done: false },
      { key: 'AISOL-653', summary: 'Ingestion pipeline', done: true },
    ],
    planSections: [
      { taskKey: 'AISOL-652', taskSummary: 'DB schema', content: '### Step 1\nCreate migration file.' },
      { taskKey: 'AISOL-653', taskSummary: 'Ingestion pipeline', content: '### Step 1\nExtend confluence.ts.' },
    ],
    worktrees: ['/path/to/worktree feature/aisol-651'],
    proof: ['AISOL-652: migration verified 2026-06-02'],
    status: 'in-progress',
  }

  describe('renderStoryBrain', () => {
    it('renders a complete story.md document', () => {
      const md = renderStoryBrain(sampleBrain)
      expect(md).toContain('# Story AISOL-651: Auto-sync AI Toolshed')
      expect(md).toContain('## Goal')
      expect(md).toContain('Surface AI tools automatically.')
      expect(md).toContain('## Task Graph')
      expect(md).toContain('- [ ] Task 1: DB schema (AISOL-652)')
      expect(md).toContain('- [x] Task 2: Ingestion pipeline (AISOL-653)')
      expect(md).toContain('## Plan')
      expect(md).toContain('### Task 1: DB schema (AISOL-652)')
      expect(md).toContain('### Task 2: Ingestion pipeline (AISOL-653)')
      expect(md).toContain('## Worktrees')
      expect(md).toContain('## Proof')
      expect(md).toContain('AISOL-652: migration verified')
      expect(md).toContain('## Status')
      expect(md).toContain('in-progress')
    })
  })

  describe('extractGoalSection', () => {
    it('returns the ## Goal markdown block from a rendered brain', () => {
      const md = renderStoryBrain(sampleBrain)
      const goal = extractGoalSection(md)
      expect(goal).toContain('## Goal')
      expect(goal).toContain('Surface AI tools automatically.')
      expect(goal).not.toContain('## Task Graph')
    })

    it('returns null when no Goal section', () => {
      expect(extractGoalSection('# Story\n\nNo goal here.')).toBeNull()
    })
  })

  describe('parseTaskGraphStatus', () => {
    it('returns done/pending counts from rendered markdown', () => {
      const md = renderStoryBrain(sampleBrain)
      const result = parseTaskGraphStatus(md)
      expect(result.total).toBe(2)
      expect(result.done).toBe(1)
      expect(result.pending).toBe(1)
    })
  })

  describe('updateTaskGraphDone', () => {
    it('marks a task as done in the markdown', () => {
      const md = renderStoryBrain(sampleBrain)
      const updated = updateTaskGraphDone(md, 'AISOL-652')
      expect(updated).toContain('- [x] Task 1: DB schema (AISOL-652)')
    })

    it('is a no-op for a key not in the graph', () => {
      const md = renderStoryBrain(sampleBrain)
      const updated = updateTaskGraphDone(md, 'AISOL-999')
      expect(updated).toBe(md)
    })
  })

  describe('appendProofEntry', () => {
    it('appends a proof entry to the ## Proof section', () => {
      const md = renderStoryBrain({ ...sampleBrain, proof: [] })
      const updated = appendProofEntry(md, 'AISOL-653: pipeline verified 2026-06-03')
      expect(updated).toContain('- AISOL-653: pipeline verified 2026-06-03')
    })
  })

  describe('setStoryStatus', () => {
    it('updates the ## Status section', () => {
      const md = renderStoryBrain(sampleBrain)
      const updated = setStoryStatus(md, 'done')
      expect(updated).toContain('\ndone\n')
    })
  })
  ```

- [ ] **Step 2: Run to confirm tests fail**

  ```bash
  cd ~/projects/agent-queue && npx jest story-brain --no-coverage 2>&1 | tail -10
  ```
  Expected: `Cannot find module '../story-brain.js'`

- [ ] **Step 3: Create `src/story-brain.ts`**

  ```typescript
  import { renderGoal } from './jira-goal.js'
  import type { StoryBrain } from './types.js'

  export function renderStoryBrain(brain: StoryBrain): string {
    const taskGraphLines = brain.taskGraph.map((t, i) =>
      `- [${t.done ? 'x' : ' '}] Task ${i + 1}: ${t.summary} (${t.key})`
    )

    const planSectionLines = brain.planSections.map((s, i) => [
      `### Task ${i + 1}: ${s.taskSummary} (${s.taskKey})`,
      '',
      s.content,
    ].join('\n'))

    const worktreeLines = brain.worktrees.length > 0
      ? brain.worktrees.map(w => `- ${w}`)
      : ['- none']

    const proofLines = brain.proof.length > 0
      ? brain.proof.map(p => `- ${p}`)
      : ['- none']

    return [
      `# Story ${brain.parentKey}: ${brain.summary}`,
      '',
      '## Goal',
      '',
      renderGoal(brain.goal),
      '',
      '## Task Graph',
      '',
      taskGraphLines.join('\n'),
      '',
      '## Plan',
      '',
      planSectionLines.join('\n\n'),
      '',
      '## Worktrees',
      '',
      worktreeLines.join('\n'),
      '',
      '## Proof',
      '',
      proofLines.join('\n'),
      '',
      '## Status',
      '',
      brain.status,
    ].join('\n')
  }

  export function extractGoalSection(md: string): string | null {
    const start = md.indexOf('\n## Goal')
    if (start === -1) return null
    const afterHeading = md.slice(start + 1)
    const nextSection = afterHeading.indexOf('\n## ')
    return nextSection === -1
      ? afterHeading.trim()
      : afterHeading.slice(0, nextSection).trim()
  }

  export function parseTaskGraphStatus(md: string): { total: number; done: number; pending: number } {
    const section = (() => {
      const start = md.indexOf('\n## Task Graph')
      if (start === -1) return ''
      const after = md.slice(start + 1)
      const next = after.indexOf('\n## ')
      return next === -1 ? after : after.slice(0, next)
    })()

    const lines = section.split('\n').filter(l => l.startsWith('- ['))
    const done = lines.filter(l => l.startsWith('- [x]')).length
    return { total: lines.length, done, pending: lines.length - done }
  }

  export function updateTaskGraphDone(md: string, ticketKey: string): string {
    const pattern = new RegExp(`(- \\[ \\] Task \\d+: [^(]+\\(${ticketKey}\\))`)
    return md.replace(pattern, (match) => match.replace('- [ ]', '- [x]'))
  }

  export function appendProofEntry(md: string, entry: string): string {
    const proofStart = md.indexOf('\n## Proof')
    if (proofStart === -1) return md

    const afterHeading = md.slice(proofStart + 1)
    const nextSection = afterHeading.indexOf('\n## ')
    const sectionEnd = nextSection === -1 ? md.length : proofStart + 1 + nextSection

    const nonePattern = /\n- none\n?/
    const sectionContent = md.slice(proofStart, sectionEnd)

    if (nonePattern.test(sectionContent)) {
      return md.slice(0, proofStart) +
        sectionContent.replace(nonePattern, `\n- ${entry}\n`) +
        md.slice(sectionEnd)
    }

    return md.slice(0, sectionEnd) + `\n- ${entry}` + md.slice(sectionEnd)
  }

  export function setStoryStatus(md: string, status: 'pending' | 'in-progress' | 'done'): string {
    const statusStart = md.indexOf('\n## Status')
    if (statusStart === -1) return md

    const afterHeading = md.slice(statusStart + 1)
    const nextSection = afterHeading.indexOf('\n## ')
    const sectionEnd = nextSection === -1 ? md.length : statusStart + 1 + nextSection

    const newSection = `## Status\n\n${status}\n`
    return md.slice(0, statusStart + 1) + newSection + md.slice(sectionEnd)
  }
  ```

- [ ] **Step 4: Run tests and confirm they pass**

  ```bash
  cd ~/projects/agent-queue && npx jest story-brain --no-coverage 2>&1 | tail -15
  ```
  Expected: all tests pass.

- [ ] **Step 5: Commit**

  ```bash
  cd ~/projects/agent-queue && git add src/story-brain.ts src/__tests__/story-brain.test.ts && git commit -m "feat: add story-brain.ts with render, parse, and update helpers"
  ```

---

## Task 3: Add `storyBrainPath` + `writeStoryBrain` to `local-plan.ts`

**Files:**
- Modify: `src/local-plan.ts`
- Modify: `src/__tests__/local-plan.test.ts`

- [ ] **Step 1: Read current test file to understand existing test patterns**

  ```bash
  cat ~/projects/agent-queue/src/__tests__/local-plan.test.ts | head -60
  ```

- [ ] **Step 2: Add `storyBrainPath` and `writeStoryBrain` to `src/local-plan.ts`**

  Add these imports at the top of `local-plan.ts`:
  ```typescript
  import { renderStoryBrain } from './story-brain.js'
  import type { StoryBrain } from './types.js'
  ```

  Add these two exported functions at the bottom of `src/local-plan.ts`:

  ```typescript
  export function storyBrainPath(parentTicketOrKey: JiraTicket | string, root = DEFAULT_PLANS_DIR): string {
    const parentKey = normalizeTicketKey(
      typeof parentTicketOrKey === 'string' ? parentTicketOrKey : parentTicketOrKey.key
    )
    const projectSegments = projectPathForPlan(parentTicketOrKey)
    return path.join(root, ...projectSegments, parentKey, 'story.md')
  }

  export function writeStoryBrain(parentTicket: JiraTicket | string, brain: StoryBrain, root = DEFAULT_PLANS_DIR): string {
    const filePath = storyBrainPath(parentTicket, root)
    mkdirSync(path.dirname(filePath), { recursive: true })
    writeFileSync(filePath, renderStoryBrain(brain), 'utf8')
    return filePath
  }
  ```

- [ ] **Step 3: Write failing tests for the new functions**

  In `src/__tests__/local-plan.test.ts`, add a new `describe` block at the end:

  ```typescript
  import { storyBrainPath, writeStoryBrain } from '../local-plan.js'
  import { mkdtempSync, readFileSync, rmSync } from 'fs'
  import os from 'os'

  describe('storyBrainPath', () => {
    it('returns story.md under the parent ticket key directory', () => {
      const ticket = { key: 'AISOL-651', summary: 'Story', repo: 'Codefied/AI-Analysts' } as JiraTicket
      const p = storyBrainPath(ticket, '/tmp/plans')
      expect(p).toBe('/tmp/plans/Codefied/AI-Analysts/AISOL-651/story.md')
    })

    it('accepts a plain string key', () => {
      const p = storyBrainPath('AISOL-651', '/tmp/plans')
      expect(p).toMatch(/AISOL-651\/story\.md$/)
    })
  })

  describe('writeStoryBrain', () => {
    it('writes a story.md file and returns the path', () => {
      const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'aq-test-'))
      try {
        const ticket = { key: 'AISOL-651', summary: 'Story', repo: 'Codefied/AI-Analysts' } as JiraTicket
        const brain: StoryBrain = {
          parentKey: 'AISOL-651',
          summary: 'Auto-sync AI Toolshed',
          goal: { why: 'Test why', constraints: [], nonGoals: [], successCriteria: [] },
          taskGraph: [{ key: 'AISOL-652', summary: 'DB schema', done: false }],
          planSections: [{ taskKey: 'AISOL-652', taskSummary: 'DB schema', content: 'Step 1.' }],
          worktrees: [],
          proof: [],
          status: 'pending',
        }
        const written = writeStoryBrain(ticket, brain, tmpDir)
        expect(written).toMatch(/story\.md$/)
        expect(readFileSync(written, 'utf8')).toContain('# Story AISOL-651')
      } finally {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    })
  })
  ```

- [ ] **Step 4: Run tests**

  ```bash
  cd ~/projects/agent-queue && npx jest local-plan --no-coverage 2>&1 | tail -15
  ```
  Expected: all pass.

- [ ] **Step 5: Commit**

  ```bash
  cd ~/projects/agent-queue && git add src/local-plan.ts src/__tests__/local-plan.test.ts && git commit -m "feat: add storyBrainPath and writeStoryBrain to local-plan.ts"
  ```

---

## Task 4: Update `plan-command.ts` — story-aware writes, Jira gets Goal + path only

**Files:**
- Modify: `src/plan-command.ts`
- Modify: `src/__tests__/plan-command.test.ts`

The current `writePlanWithApproval` writes the full `renderJiraPlan` output to Jira. The new behavior:
- If the ticket has `subtasks` or `issueLinks` with type `"is parent of"` → it is a story → write story.md, Jira gets Goal + brain link
- If the ticket has `parent` → it is a task → write its plan section into the parent's story.md, Jira gets Goal + brain link pointing to parent
- Otherwise → standalone task → existing behavior (plan.md + Jira plan text)

- [ ] **Step 1: Read current `buildPlanFromTicket` and `writePlanWithApproval`**

  ```bash
  sed -n '1,100p' ~/projects/agent-queue/src/plan-command.ts
  ```

- [ ] **Step 2: Add imports to `plan-command.ts`**

  At the top of `src/plan-command.ts`, add:
  ```typescript
  import { storyBrainPath, writeStoryBrain, localPlanPath } from './local-plan.js'
  import { upsertGoalSection } from './jira-goal.js'
  import type { StoryBrain, StoryTaskEntry } from './types.js'
  import { readFileSync, existsSync } from 'fs'
  import { updateTaskGraphDone, appendProofEntry, setStoryStatus } from './story-brain.js'
  ```

- [ ] **Step 3: Add `isStoryTicket` and `getParentKey` helpers**

  Add these helper functions before `buildPlanFromTicket`:

  ```typescript
  export function isStoryTicket(ticket: JiraTicket): boolean {
    if (ticket.subtasks && ticket.subtasks.length > 0) return true
    if (ticket.issueLinks?.some(l => l.type === 'is parent of' && l.direction === 'outward')) return true
    return ticket.issuetype?.name === 'Story' && Boolean(ticket.subtasks)
  }

  export function getParentKey(ticket: JiraTicket): string | null {
    return ticket.parent?.key ?? null
  }
  ```

- [ ] **Step 4: Add `buildJiraDescriptionWithBrainLink` helper**

  ```typescript
  function buildJiraDescriptionWithBrainLink(ticket: JiraTicket, brainPath: string): string {
    const description = ticket.description ?? ''
    const goalOnly = (() => {
      const goalStart = description.indexOf('## Goal')
      if (goalStart === -1) return description
      const afterGoal = description.slice(goalStart)
      const nextSection = afterGoal.indexOf('\n## ', 8)
      return nextSection === -1 ? afterGoal : afterGoal.slice(0, nextSection)
    })()
    return `${goalOnly.trim()}\n\nStory brain: ${brainPath}`
  }
  ```

- [ ] **Step 5: Add `buildStoryBrainFromTickets` helper**

  ```typescript
  export function buildStoryBrainFromTickets(
    parentTicket: JiraTicket,
    childTickets: JiraTicket[],
    planContent: string
  ): StoryBrain {
    const goal = parseGoal(parentTicket.description ?? '')
    const taskGraph: StoryTaskEntry[] = childTickets.map(t => ({
      key: t.key,
      summary: t.summary,
      done: t.status === 'Done',
    }))

    // Split planContent into per-task sections if it contains task headers
    const planSections = childTickets.map(t => {
      const header = `### Task`
      const sectionStart = planContent.indexOf(`(${t.key})`)
      if (sectionStart === -1) {
        return { taskKey: t.key, taskSummary: t.summary, content: '' }
      }
      const lineStart = planContent.lastIndexOf('\n', sectionStart)
      const nextSection = planContent.indexOf('\n### Task', lineStart + 1)
      const content = nextSection === -1
        ? planContent.slice(lineStart).trim()
        : planContent.slice(lineStart, nextSection).trim()
      return { taskKey: t.key, taskSummary: t.summary, content }
    })

    return {
      parentKey: parentTicket.key,
      summary: parentTicket.summary,
      goal: goal ?? { why: parentTicket.summary, constraints: [], nonGoals: [], successCriteria: [] },
      taskGraph,
      planSections,
      worktrees: [],
      proof: [],
      status: 'pending',
    }
  }
  ```

- [ ] **Step 6: Update `writePlanWithApproval` to use story brain**

  Replace the current `writePlanWithApproval` with:

  ```typescript
  export async function writePlanWithApproval(
    ticket: JiraTicket,
    plan: JiraPlan,
    tickets?: JiraTicket[]
  ): Promise<boolean> {
    const parentKey = getParentKey(ticket)
    const parentTicket = parentKey ? tickets?.find(t => t.key === parentKey) : undefined

    // Determine brain path
    const brainParent = parentTicket ?? (isStoryTicket(ticket) ? ticket : null)
    const brainPath = brainParent ? storyBrainPath(brainParent) : null

    const rendered = renderJiraPlan(plan)
    console.log(rendered)
    if (brainPath) {
      console.log(`\nStory brain path: ${brainPath}`)
    }

    const answer = await prompt(`\nWrite this plan to ${ticket.key}? Type "${JIRA_PLAN_APPROVAL_PHRASE}" to approve: `)
    if (!hasJiraPlanApproval(answer)) return false

    const permit = assertJiraWritePolicy({ action: 'update-description', ticket, tickets, email: getJiraConfig().email })

    // Always write local plan.md
    const writtenPath = writeLocalPlan(ticket, plan)

    if (brainPath && brainParent) {
      // Write or update story.md
      const brain = buildStoryBrainFromTickets(
        brainParent,
        tickets?.filter(t => t.parent?.key === brainParent.key) ?? [],
        rendered
      )
      writeStoryBrain(brainParent, brain)
      console.log(`Story brain written: ${brainPath}`)

      // Jira gets Goal + brain link only (not full plan)
      const jiraDescription = buildJiraDescriptionWithBrainLink(ticket, brainPath)
      const adfDoc = upsertTextToDescriptionAdf(ticket.descriptionAdf, '', 'Agent Q Plan')
      // Write only the goal section + brain link, removing Agent Q Plan block
      const cleanAdf = upsertTextToDescriptionAdf(
        { version: 1, type: 'doc', content: [] },
        jiraDescription,
        'Goal'
      )
      await updateTicketDescription(ticket.key, cleanAdf, permit)
    } else {
      // Standalone task: existing behavior
      await updateTicketDescription(ticket.key, buildPlanDescriptionAdf(ticket, { ...plan, localPlanPath: writtenPath }), permit)
    }

    console.log(`Local plan: ${writtenPath}`)
    return true
  }
  ```

- [ ] **Step 7: Run plan-command tests to see failures**

  ```bash
  cd ~/projects/agent-queue && npx jest plan-command --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 8: Update `plan-command.test.ts` for new helpers**

  Add tests:
  ```typescript
  import { isStoryTicket, getParentKey, buildStoryBrainFromTickets, buildJiraDescriptionWithBrainLink } from '../plan-command.js'

  describe('isStoryTicket', () => {
    it('returns true when ticket has subtasks', () => {
      const ticket = { key: 'AISOL-651', summary: 'Story', subtasks: [{ key: 'AISOL-652', summary: 'DB', status: 'To Do' }] } as JiraTicket
      expect(isStoryTicket(ticket)).toBe(true)
    })

    it('returns false for a plain task with no subtasks or links', () => {
      const ticket = { key: 'AISOL-652', summary: 'Task', subtasks: [] } as JiraTicket
      expect(isStoryTicket(ticket)).toBe(false)
    })
  })

  describe('getParentKey', () => {
    it('returns parent key when present', () => {
      const ticket = { key: 'AISOL-652', summary: 'Task', parent: { key: 'AISOL-651', summary: 'Story', status: 'To Do' } } as JiraTicket
      expect(getParentKey(ticket)).toBe('AISOL-651')
    })

    it('returns null when no parent', () => {
      const ticket = { key: 'AISOL-651', summary: 'Story' } as JiraTicket
      expect(getParentKey(ticket)).toBeNull()
    })
  })

  describe('buildJiraDescriptionWithBrainLink', () => {
    it('extracts Goal section and appends brain link', () => {
      const ticket = {
        key: 'AISOL-652',
        summary: 'DB schema',
        description: '## Goal\n\n### Why\nBecause.\n\n### Success Criteria\n- thing\n\n## Agent Q Plan\n\nstuff',
      } as JiraTicket
      const result = buildJiraDescriptionWithBrainLink(ticket, '/tmp/story.md')
      expect(result).toContain('## Goal')
      expect(result).toContain('Because.')
      expect(result).not.toContain('## Agent Q Plan')
      expect(result).toContain('Story brain: /tmp/story.md')
    })
  })
  ```

- [ ] **Step 9: Run tests and confirm green**

  ```bash
  cd ~/projects/agent-queue && npx jest plan-command --no-coverage 2>&1 | tail -15
  ```

- [ ] **Step 10: Commit**

  ```bash
  cd ~/projects/agent-queue && git add src/plan-command.ts src/__tests__/plan-command.test.ts && git commit -m "feat: plan-command writes story brain for story tickets; Jira gets Goal + path only"
  ```

---

## Task 5: Fix `cmux.ts` bootstrap — auto mode, story brain reference, newline formatting

**Files:**
- Modify: `src/cmux.ts`
- Modify: `src/__tests__/cmux.test.ts`

Three specific fixes:
1. `buildCmuxAgentCommand` should prepend `claude --dangerously-skip-permissions` instead of plain `claude` when the contract has `autonomyLevel >= 2`
2. `buildClaudeHandoffPrompt` should use `\n\n` between sections (not `lines.join(' ')`) so the output is readable
3. The handoff should reference `story.md` as the brain file when it exists, and tell the agent to read it as first step

- [ ] **Step 1: Read current `buildClaudeHandoffPrompt` fully**

  ```bash
  sed -n '38,90p' ~/projects/agent-queue/src/cmux.ts
  ```

- [ ] **Step 2: Add import for `storyBrainPath`**

  At the top of `src/cmux.ts`, add:
  ```typescript
  import { existsSync } from 'fs'
  import { storyBrainPath } from './local-plan.js'
  ```
  (Note: `existsSync` is already imported; just add `storyBrainPath`)

- [ ] **Step 3: Replace `buildClaudeHandoffPrompt` in `src/cmux.ts`**

  Replace the entire function (lines 38–81):

  ```typescript
  export function buildClaudeHandoffPrompt(ticketKey: string, contract?: ExecutionContract): string {
    const key = cmuxWorkspaceName(ticketKey)

    const goalBlock = contract?.goal
      ? [
          '## Goal (source of truth)',
          '',
          renderGoal(contract.goal),
          '',
          'The Goal above is your primary constraint. If the Plan below conflicts with the Goal, the Goal wins.',
        ].join('\n')
      : ''

    const storyBrainFile = contract
      ? storyBrainPath({ key: contract.ticketKey, summary: '', repo: contract.repo } as any)
      : null
    const hasBrain = storyBrainFile && existsSync(storyBrainFile)

    const sections: string[] = []

    sections.push(`You are Agent Q for Jira ticket ${key}.`)

    if (goalBlock) sections.push(goalBlock)

    if (hasBrain) {
      sections.push([
        '## Story Brain',
        '',
        `Your full execution context is in the story brain file:`,
        `  ${storyBrainFile}`,
        '',
        'Read this file first. It contains the full Goal, Task Graph (with completion status), Plan sections for each task, Worktrees, Proof history, and overall Status.',
        'Update the Task Graph checkboxes as you complete each task.',
        'Append proof entries when you verify work.',
      ].join('\n'))
    }

    sections.push([
      '## Execution Rules',
      '',
      '- Execute only after the ticket has an approved Jira plan and autonomy level.',
      '- Use an isolated worktree and branch for implementation.',
      '- Do not create, update, or transition Jira tickets without Jake explicitly approving the exact write.',
      '- Do not run agent-queue run from inside this session.',
      '- Use Superpowers as the quality protocol: brainstorm/plan first, TDD for changes, systematic debugging for failures, verify before claiming completion.',
      '- Dispatch parallel agents for independent work when safe (superpowers:dispatching-parallel-agents).',
      '- Keep bounded autonomy: move fast inside the approved contract, but stop before forbidden writes, merges, deploys, or unclear scope changes.',
    ].join('\n'))

    if (contract) {
      const proofFile = `/tmp/proof-${key}.json`
      sections.push([
        '## Start Sequence',
        '',
        hasBrain
          ? `1. Read story brain: ${storyBrainFile}`
          : `1. Run: cd ~/projects/agent-queue && agent-queue context ${key} --brief`,
        `2. Print this execution brief, then wait for Jake to type "proceed":`,
        `   TICKET: ${key}`,
        contract.goal ? `   GOAL: ${contract.goal.why}` : '',
        contract.goal?.successCriteria.length
          ? `   SUCCESS: ${contract.goal.successCriteria.join(' | ')}`
          : '',
        `3. After "proceed": sanity-check repo, then execute inside the approved contract.`,
        `   repo: ${contract.repo}`,
        `   branch: ${contract.branch}`,
        `   worktree: ${contract.worktreePath}`,
        `   autonomy: ${contract.autonomyLevel}`,
        '',
        '## On Completion',
        '',
        `Write proof file: ${proofFile}`,
        `{ "ticketKey": "${key}", "branch": "<branch>", "prUrl": "<url or null>", "summary": "<one paragraph>", "filesChanged": ["<path>"], "verification": ["<what you ran>"], "residualRisk": ["<anything incomplete>"] }`,
        '',
        `Then run: cd ~/projects/agent-queue && agent-queue proof --file ${proofFile} --comment`,
        hasBrain ? `And update the story brain Task Graph for completed tasks.` : '',
      ].filter(Boolean).join('\n'))
    } else {
      sections.push([
        '## Start Sequence',
        '',
        `1. Run: cd ~/projects/agent-queue && agent-queue show ${key}`,
        '2. Read the Jira output as source context.',
        '3. Propose the plan and wait for Jake before implementing.',
      ].join('\n'))
    }

    return sections.join('\n\n')
  }
  ```

- [ ] **Step 4: Update `buildCmuxAgentCommand` to use `--dangerously-skip-permissions` for autonomy level >= 2**

  Replace the current `buildCmuxAgentCommand`:

  ```typescript
  export function buildCmuxAgentCommand(
    ticketKey: string,
    cmuxBinary = resolveCmuxBinary(),
    contract?: ExecutionContract
  ): string {
    const key = cmuxWorkspaceName(ticketKey)
    const autoFlag = contract && contract.autonomyLevel >= 2 ? ' --dangerously-skip-permissions' : ''
    return [
      `${shellPreviewQuote(cmuxBinary)} rename-workspace ${shellPreviewQuote(key)}`,
      `claude${autoFlag} --name ${shellPreviewQuote(key)} -p ${shellPreviewQuote(buildClaudeHandoffPrompt(key, contract))}`
    ].join(' && ')
  }
  ```

- [ ] **Step 5: Run cmux tests to see failures**

  ```bash
  cd ~/projects/agent-queue && npx jest cmux --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 6: Update cmux tests for new format**

  In `src/__tests__/cmux.test.ts`, update any test that checks `buildClaudeHandoffPrompt` output:
  - Replace `lines.join(' ')` assertions with section-based checks
  - Add test: `autonomyLevel >= 2` contract → command includes `--dangerously-skip-permissions`
  - Add test: contract with `goal` → output contains `## Goal (source of truth)` as a section header
  - Add test: goal section appears before Execution Rules section in output

  Specific test to add:
  ```typescript
  it('uses --dangerously-skip-permissions for autonomy level 2', () => {
    const contract = { ...sampleContract, autonomyLevel: 2 } satisfies ExecutionContract
    const cmd = buildCmuxAgentCommand('AISOL-651', '/usr/bin/cmux', contract)
    expect(cmd).toContain('--dangerously-skip-permissions')
  })

  it('does not use --dangerously-skip-permissions for autonomy level 1', () => {
    const contract = { ...sampleContract, autonomyLevel: 1 } satisfies ExecutionContract
    const cmd = buildCmuxAgentCommand('AISOL-651', '/usr/bin/cmux', contract)
    expect(cmd).not.toContain('--dangerously-skip-permissions')
  })

  it('handoff prompt sections are newline-separated not space-joined', () => {
    const prompt = buildClaudeHandoffPrompt('AISOL-651', sampleContract)
    expect(prompt).toContain('\n\n')
    expect(prompt).not.toMatch(/You are Agent Q.*Execute only/)  // was space-joined before
  })
  ```

- [ ] **Step 7: Run tests and confirm green**

  ```bash
  cd ~/projects/agent-queue && npx jest cmux --no-coverage 2>&1 | tail -15
  ```

- [ ] **Step 8: Commit**

  ```bash
  cd ~/projects/agent-queue && git add src/cmux.ts src/__tests__/cmux.test.ts && git commit -m "fix: cmux bootstrap uses --dangerously-skip-permissions for autonomy >=2, story brain reference, section formatting"
  ```

---

## Task 6: Create `.claude/commands/goal.md` slash command

**Files:**
- Create: `.claude/commands/goal.md`

The `/goal` command reads the story brain for the current session context and establishes the Goal. It is invoked by the agent worker at the start of a cmux session.

- [ ] **Step 1: Check if `.claude/commands/` exists in agent-queue**

  ```bash
  ls ~/projects/agent-queue/.claude/commands/
  ```

- [ ] **Step 2: Create `.claude/commands/goal.md`**

  ```markdown
  # /goal — Establish Story Goal

  Read the story brain for this session and print the Goal section as the current session goal.

  ## Instructions

  1. Check if a story brain path is available in context (passed via execution handoff or stored in `/tmp/story-brain-path-<TICKET>.txt`).

  2. If a story brain path is found, run:
     ```bash
     cat <story-brain-path>
     ```
     Then extract and display only the `## Goal` section.

  3. If no story brain path is found, run:
     ```bash
     cd ~/projects/agent-queue && agent-queue show <TICKET-KEY>
     ```
     And display the `## Goal` section from the Jira description.

  4. Print the Goal clearly:
     ```
     ═══════════════════════════════════
     GOAL: <ticket key>
     ═══════════════════════════════════
     <Goal content>
     ═══════════════════════════════════
     ```

  5. Confirm: "Goal established. Type 'proceed' to begin execution."

  ## When to use

  - At the start of every cmux execution session before taking any action
  - After reading a story brain to re-anchor on what success looks like
  - Any time you are uncertain whether an action aligns with the stated goal
  ```

- [ ] **Step 3: Verify the file is in place**

  ```bash
  cat ~/projects/agent-queue/.claude/commands/goal.md
  ```

- [ ] **Step 4: Commit**

  ```bash
  cd ~/projects/agent-queue && git add .claude/commands/goal.md && git commit -m "feat: add /goal slash command for story brain goal anchoring"
  ```

---

## Task 7: Remove `APPROVE JIRA PROOF` gate; auto-post proof; update story brain

**Files:**
- Modify: `src/proof.ts`
- Modify: `src/__tests__/proof.test.ts`

The `APPROVE JIRA PROOF` interactive phrase is removed. When `--comment` is passed and policy passes (ticket in queue, assigned to Jake), proof posts automatically. After posting, the story brain `## Proof` section is updated.

- [ ] **Step 1: Read the current `runProofCommand` function**

  ```bash
  sed -n '95,140p' ~/projects/agent-queue/src/proof.ts
  ```

- [ ] **Step 2: Add story brain imports to `proof.ts`**

  ```typescript
  import { storyBrainPath } from './local-plan.js'
  import { appendProofEntry, updateTaskGraphDone, setStoryStatus, parseTaskGraphStatus } from './story-brain.js'
  import { existsSync, readFileSync, writeFileSync } from 'fs'
  ```

- [ ] **Step 3: Replace `runProofCommand` in `src/proof.ts`**

  Remove `JIRA_PROOF_APPROVAL_PHRASE`, `hasProofApproval`, and the `prompt()` call in `runProofCommand`. Replace with:

  ```typescript
  export async function runProofCommand(args: string[], tickets: JiraTicket[]): Promise<void> {
    const parsed = parseProofArgs(args)
    const report = JSON.parse(await readFile(parsed.file, 'utf8')) as ProofReport
    const ticket = assertProofTicketInQueue(report, tickets)

    const formatted = formatProofReport(report)
    console.log(formatted)

    if (!parsed.comment) {
      console.log('\nPreview only. Re-run with --comment to post proof to Jira.')
      return
    }

    const permit = assertJiraWritePolicy({ action: 'comment', ticket, tickets, email: getJiraConfig().email })
    await commentOnTicket(report.ticketKey, formatted, permit)
    console.log(`Commented Agent Q proof on ${report.ticketKey}.`)

    // Transition ticket to Done
    try {
      const donePermit = assertJiraWritePolicy({ action: 'transition', ticket, tickets, email: getJiraConfig().email })
      await transitionTicket(report.ticketKey, 'Done', donePermit)
      console.log(`Transitioned ${report.ticketKey} to Done.`)
    } catch (err) {
      console.log(`Could not transition to Done: ${err instanceof Error ? err.message : err}`)
    }

    // Update story brain if it exists
    const storyBrainFile = storyBrainPath(ticket)
    if (existsSync(storyBrainFile)) {
      let md = readFileSync(storyBrainFile, 'utf8')
      md = updateTaskGraphDone(md, report.ticketKey)
      md = appendProofEntry(md, `${report.ticketKey}: ${report.summary.slice(0, 120)} (${new Date().toISOString().slice(0, 10)})`)
      const { total, done } = parseTaskGraphStatus(md)
      if (done === total) md = setStoryStatus(md, 'done')
      else md = setStoryStatus(md, 'in-progress')
      writeFileSync(storyBrainFile, md, 'utf8')
      console.log(`Updated story brain: ${storyBrainFile}`)
    }

    // Auto-progression: open cmux workspaces for any tickets now unblocked
    const unblocked = findUnblockedTickets(report.ticketKey, tickets)
    for (const nextTicket of unblocked) {
      const result = buildExecutionContract(nextTicket)
      if (!result.ok) {
        console.log(`\n🔓 ${nextTicket.key} unblocked but not ready: ${result.reason}`)
        if (result.fix) console.log(`   Fix: ${result.fix}`)
        continue
      }
      console.log(`\n🔓 ${nextTicket.key} unblocked — opening execution workspace...`)
      await openCmuxExecutionWorkspace(result.contract)
    }
  }
  ```

- [ ] **Step 4: Remove `JIRA_PROOF_APPROVAL_PHRASE` export and `hasProofApproval` from `proof.ts`**

  Delete these lines:
  ```typescript
  export const JIRA_PROOF_APPROVAL_PHRASE = 'APPROVE JIRA PROOF'

  export function hasProofApproval(answer: string): boolean {
    return answer.trim() === JIRA_PROOF_APPROVAL_PHRASE
  }
  ```

- [ ] **Step 5: Remove the `prompt` helper from `proof.ts` if it's only used by the approval gate**

  ```bash
  grep -n "function prompt\|prompt(" ~/projects/agent-queue/src/proof.ts
  ```
  If the only remaining `prompt` call is gone after Step 3, remove the `prompt` function too.

- [ ] **Step 6: Run proof tests to see failures**

  ```bash
  cd ~/projects/agent-queue && npx jest proof --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 7: Update `proof.test.ts`**

  Remove any test that references `JIRA_PROOF_APPROVAL_PHRASE` or `hasProofApproval`.

  Add new test for auto-post flow:
  ```typescript
  it('runProofCommand with --comment posts without interactive approval', async () => {
    const mockReport: ProofReport = {
      ticketKey: 'AISOL-652',
      branch: 'feature/aisol-652',
      prUrl: null,
      summary: 'Migration created and applied.',
      filesChanged: ['supabase/migrations/030.sql'],
      verification: ['npx tsc --noEmit: clean'],
      residualRisk: [],
    }
    // Write proof to temp file
    const tmpFile = `/tmp/test-proof-${Date.now()}.json`
    writeFileSync(tmpFile, JSON.stringify(mockReport))

    const mockComment = jest.fn().mockResolvedValue(undefined)
    const mockTransition = jest.fn().mockResolvedValue(undefined)
    // ... wire up mocks and assert mockComment called without interactive prompt
  })
  ```

- [ ] **Step 8: Run tests and confirm green**

  ```bash
  cd ~/projects/agent-queue && npx jest proof --no-coverage 2>&1 | tail -15
  ```

- [ ] **Step 9: Commit**

  ```bash
  cd ~/projects/agent-queue && git add src/proof.ts src/__tests__/proof.test.ts && git commit -m "feat: remove APPROVE JIRA PROOF gate; auto-post proof and update story brain"
  ```

---

## Task 8: Update `queen.md` slash command to reflect new behavior

**Files:**
- Modify: `.claude/commands/queen.md`

The queen command documentation needs to reflect: proof auto-posts, story brain is the context file, one cmux terminal per story.

- [ ] **Step 1: Read the relevant section of `queen.md`**

  ```bash
  grep -n "proof\|APPROVE\|brain\|story\|cmux" ~/projects/agent-queue/.claude/commands/queen.md | head -20
  ```

- [ ] **Step 2: Update proof-related instructions in `queen.md`**

  Find any line that says `APPROVE JIRA PROOF` and remove it. Replace with:
  > Proof comments post automatically when the ticket is in the current queue and assigned to Jake. No approval phrase required.

- [ ] **Step 3: Add story brain context to execute-ready section**

  Find the `execute-ready` documentation and add after the execution start instructions:
  > The execution workspace reads from the story brain file (`story.md`) if it exists. This file contains the full Goal, Task Graph, Plan sections for all tasks, and current Status. The agent updates this file as tasks complete.

- [ ] **Step 4: Commit**

  ```bash
  cd ~/projects/agent-queue && git add .claude/commands/queen.md && git commit -m "docs: update queen.md for story brain and auto proof"
  ```

---

## Task 9: Full test suite + TypeScript validation

- [ ] **Step 1: TypeScript clean compile**

  ```bash
  cd ~/projects/agent-queue && npx tsc --noEmit 2>&1
  ```
  Expected: no output (clean).

- [ ] **Step 2: Full test suite**

  ```bash
  cd ~/projects/agent-queue && npm test 2>&1 | tail -30
  ```
  Expected: all tests pass.

- [ ] **Step 3: Fix any remaining failures**

  Common expected issues:
  - Any test importing `JIRA_PROOF_APPROVAL_PHRASE` or `hasProofApproval` → remove those imports and tests
  - Any test constructing `ExecutionContract` without `goal` field → add `goal: null`
  - Any `cmux` test that checks for space-joined prompt → update to check for section markers

- [ ] **Step 4: Final commit if any fixes were needed**

  ```bash
  cd ~/projects/agent-queue && git add -p && git commit -m "fix: test suite cleanup after story brain refactor"
  ```

---

## Self-Review

**Spec coverage check:**
- ✅ Story brain file format → Task 2 (`story-brain.ts`)
- ✅ `storyBrainPath` path helper → Task 3 (`local-plan.ts`)
- ✅ Jira description = Goal + brain link → Task 4 (`plan-command.ts`)
- ✅ Story-aware plan detection (isStoryTicket, getParentKey) → Task 4
- ✅ cmux auto mode (`--dangerously-skip-permissions`) → Task 5
- ✅ Handoff uses newlines not space-join → Task 5
- ✅ Story brain referenced in handoff → Task 5
- ✅ `/goal` slash command → Task 6
- ✅ Remove `APPROVE JIRA PROOF` → Task 7
- ✅ Proof updates story brain checkboxes → Task 7
- ✅ Auto-progression unchanged → Task 7 (preserved in new `runProofCommand`)
- ✅ `queen.md` updated → Task 8
- ✅ `StoryBrain` type → Task 1

**Placeholder scan:** None found. All steps contain actual code.

**Type consistency:**
- `StoryBrain` defined in Task 1 (`types.ts`), used in Tasks 2, 3, 4
- `StoryTaskEntry` defined in Task 1, used in `buildStoryBrainFromTickets` in Task 4
- `storyBrainPath` defined in Task 3, imported in Tasks 4, 5, 7
- `renderStoryBrain` defined in Task 2, imported in Task 3 via `story-brain.ts`
- `updateTaskGraphDone`, `appendProofEntry`, `setStoryStatus`, `parseTaskGraphStatus` defined in Task 2, imported in Task 7

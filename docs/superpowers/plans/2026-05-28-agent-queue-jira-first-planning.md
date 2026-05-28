# Agent Queue Jira-First Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Jira the source of truth for Agent Q plans before execution, with readiness scoring, approval-gated Jira plan writes, proof updates, and later isolated worktree execution.

**Architecture:** Keep Agent Queue as the local control plane. Add a planning layer that scores Jira tickets, helps Jake fill missing context, writes approved plans back to Jira, then launches cmux/Claude workers only from Jira-backed execution contracts. Ruflo remains a future execution adapter after the Jira contract is stable.

**Tech Stack:** TypeScript CLI, Jira REST API, macOS Keychain, cmux CLI, Claude Code CLI, Jest, ts-jest, local git worktrees, GitHub draft PR flow.

---

## Product Workflow

Daily control room:

1. Jake opens one planning cmux workspace.
2. Jake runs `/agent-queue` or `agent-queue readiness`.
3. Agent Queue reads open assigned Jira tickets.
4. Agent Queue shows each ticket with an execution-readiness score and reason.
5. Jake picks one or more tickets to improve or execute.
6. If a ticket is under-planned, Claude asks targeted questions and drafts a structured Jira plan.
7. Jake approves the Jira write with the exact approval phrase.
8. Agent Queue writes the approved plan to Jira.
9. Agent Queue asks whether Jake is ready to execute.
10. Jake can answer no, continue planning more tickets, or approve a batch for execution.
11. Approved tickets open isolated worker sessions.
12. Workers execute only from the Jira-backed plan and report proof.

Autonomy contract:

- Planning is always allowed as a local preview.
- Jira writes require explicit approval.
- Execution requires an approved plan stored in Jira.
- Worker autonomy is bounded by the approved plan and autonomy level.
- Merges, deploys, Jira updates, and unclear scope changes require Jake approval.

---

## Target Files

- Modify: `src/types.ts`
  - Add `TicketReadiness`, `JiraPlan`, `AutonomyLevel`, `ExecutionContract`, and `ProofReport` types.
- Create: `src/readiness.ts`
  - Score tickets from 0-100 and explain missing context.
- Create: `src/jira-plan.ts`
  - Parse/render the structured Agent Q plan section in Jira descriptions or comments.
- Modify: `src/jira.ts`
  - Fetch richer Jira fields, update descriptions/comments, and preserve existing text.
- Create: `src/plan-command.ts`
  - Generate, preview, and approval-write Jira plans.
- Create: `src/readiness-command.ts`
  - Print daily planning queue with readiness percentages.
- Modify: `src/index.ts`
  - Wire `readiness`, `plan`, `execute-ready`, and `proof` commands.
- Modify: `src/cmux.ts`
  - Ensure cmux workers only launch from approved Jira execution contracts.
- Modify: `src/worktree.ts`
  - Add explicit worktree preparation for approved execution contracts.
- Create: `src/proof.ts`
  - Build proof summaries from git diff, test output, PR URL, and worker notes.
- Modify: `README.md`
  - Document the daily planning cmux workflow.
- Modify: `/Users/jakefassora/.claude/commands/agent-queue.md`
  - Make slash command default to readiness/planning, not direct execution.

---

## Milestone V2: Jira-First Planning

### Task 1: Add Readiness Types

**Files:**
- Modify: `src/types.ts`
- Test: `src/__tests__/readiness.test.ts`

- [ ] **Step 1: Write failing readiness type usage test**

```ts
import { scoreTicketReadiness } from '../readiness.js'
import type { JiraTicket } from '../types.js'

const baseTicket: JiraTicket = {
  id: '1',
  key: 'AISOL-465',
  summary: 'Handoff Documentation or Onboarding?',
  description: '',
  storyPoints: null,
  issueType: 'Story',
  labels: [],
  status: 'In Progress'
}

test('empty Jira ticket gets low readiness with missing plan reasons', () => {
  const readiness = scoreTicketReadiness(baseTicket)

  expect(readiness.ticketKey).toBe('AISOL-465')
  expect(readiness.score).toBeLessThan(40)
  expect(readiness.band).toBe('needs-planning')
  expect(readiness.missing).toContain('goal')
  expect(readiness.missing).toContain('acceptance criteria')
  expect(readiness.canExecute).toBe(false)
})
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- src/__tests__/readiness.test.ts`

Expected: FAIL because `src/readiness.ts` does not exist.

- [ ] **Step 3: Add types**

Add to `src/types.ts`:

```ts
export type ReadinessBand = 'ready' | 'needs-planning' | 'blocked'

export interface TicketReadiness {
  ticketKey: string
  score: number
  band: ReadinessBand
  canExecute: boolean
  strengths: string[]
  missing: string[]
  reason: string
}

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4

export interface JiraPlan {
  ticketKey: string
  goal: string
  context: string[]
  acceptanceCriteria: string[]
  implementationNotes: string[]
  verification: string[]
  risks: string[]
  autonomyLevel: AutonomyLevel
  forbiddenActions: string[]
}

export interface ExecutionContract {
  ticketKey: string
  plan: JiraPlan
  repo: string
  branch: string
  autonomyLevel: AutonomyLevel
  approvedAt: string
}

export interface ProofReport {
  ticketKey: string
  branch: string
  prUrl?: string
  summary: string
  filesChanged: string[]
  verification: string[]
  residualRisk: string[]
}
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/__tests__/readiness.test.ts
git commit -m "feat: add Jira planning contract types"
```

### Task 2: Implement Readiness Scoring

**Files:**
- Create: `src/readiness.ts`
- Test: `src/__tests__/readiness.test.ts`

- [ ] **Step 1: Extend failing tests**

Add:

```ts
test('planned ticket with repo and verification is executable', () => {
  const ticket: JiraTicket = {
    ...baseTicket,
    description: [
      'Agent Q Plan',
      'Goal: Create onboarding handoff docs.',
      'Context: Roadwarrior onboarding currently lives in scattered comments.',
      'Acceptance Criteria: New teammate can follow setup steps.',
      'Verification: Run markdown lint and check links.',
      'Autonomy Level: 2',
      'Forbidden Actions: Do not merge or deploy.'
    ].join('\n'),
    labels: ['repo:jakefassora-HC/queen-bot'],
    repo: 'jakefassora-HC/queen-bot'
  }

  const readiness = scoreTicketReadiness(ticket)

  expect(readiness.score).toBeGreaterThanOrEqual(80)
  expect(readiness.band).toBe('ready')
  expect(readiness.canExecute).toBe(true)
  expect(readiness.missing).toEqual([])
})
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- src/__tests__/readiness.test.ts`

Expected: FAIL because scoring is missing.

- [ ] **Step 3: Implement scorer**

Create `src/readiness.ts`:

```ts
import type { JiraTicket, TicketReadiness } from './types.js'

const REQUIRED_SIGNALS = [
  { key: 'goal', pattern: /goal:/i, points: 20 },
  { key: 'context', pattern: /context:/i, points: 15 },
  { key: 'acceptance criteria', pattern: /acceptance criteria:/i, points: 20 },
  { key: 'verification', pattern: /verification:/i, points: 15 },
  { key: 'autonomy level', pattern: /autonomy level:/i, points: 10 },
  { key: 'forbidden actions', pattern: /forbidden actions:/i, points: 10 }
]

export function scoreTicketReadiness(ticket: JiraTicket): TicketReadiness {
  const description = ticket.description || ''
  const strengths: string[] = []
  const missing: string[] = []
  let score = ticket.summary.trim() ? 10 : 0

  for (const signal of REQUIRED_SIGNALS) {
    if (signal.pattern.test(description)) {
      score += signal.points
      strengths.push(signal.key)
    } else {
      missing.push(signal.key)
    }
  }

  if (ticket.repo) {
    score += 10
    strengths.push('repo')
  } else {
    missing.push('repo')
  }

  const boundedScore = Math.min(100, score)
  const canExecute = boundedScore >= 80 && missing.length === 0
  const band = canExecute ? 'ready' : missing.includes('repo') ? 'blocked' : 'needs-planning'

  return {
    ticketKey: ticket.key,
    score: boundedScore,
    band,
    canExecute,
    strengths,
    missing,
    reason: canExecute
      ? 'Ticket has enough Jira context to execute from the plan.'
      : `Missing: ${missing.join(', ')}`
  }
}
```

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/__tests__/readiness.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/readiness.ts src/__tests__/readiness.test.ts
git commit -m "feat: score Jira ticket execution readiness"
```

### Task 3: Add Readiness Command

**Files:**
- Create: `src/readiness-command.ts`
- Modify: `src/index.ts`
- Test: `src/__tests__/readiness-command.test.ts`

- [ ] **Step 1: Write failing command formatting test**

```ts
import { formatReadinessQueue } from '../readiness-command.js'
import type { JiraTicket } from '../types.js'

test('formatReadinessQueue shows score and execution guess', () => {
  const tickets: JiraTicket[] = [{
    id: '1',
    key: 'AISOL-465',
    summary: 'Handoff Documentation or Onboarding?',
    description: '',
    storyPoints: null,
    issueType: 'Story',
    labels: [],
    status: 'In Progress'
  }]

  const output = formatReadinessQueue(tickets)

  expect(output).toContain('AISOL-465')
  expect(output).toContain('%')
  expect(output).toContain('needs-planning')
  expect(output).toContain('Missing:')
})
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- src/__tests__/readiness-command.test.ts`

Expected: FAIL because `readiness-command.ts` does not exist.

- [ ] **Step 3: Implement formatter**

Create `src/readiness-command.ts`:

```ts
import type { JiraTicket } from './types.js'
import { scoreTicketReadiness } from './readiness.js'

export function formatReadinessQueue(tickets: JiraTicket[]): string {
  const lines = ['\n  agent-queue readiness', `  ${'─'.repeat(70)}`]

  tickets.forEach((ticket, index) => {
    const readiness = scoreTicketReadiness(ticket)
    lines.push(`  ${index + 1}. ${ticket.key}  ${readiness.score}%  ${readiness.band}  ${ticket.summary}`)
    lines.push(`     ${readiness.reason}`)
  })

  lines.push(`  ${'─'.repeat(70)}`)
  return lines.join('\n')
}
```

- [ ] **Step 4: Wire CLI**

In `src/index.ts`, after loading tickets:

```ts
if (args[0] === 'readiness') {
  console.log(formatReadinessQueue(tickets))
  return
}
```

Import:

```ts
import { formatReadinessQueue } from './readiness-command.js'
```

- [ ] **Step 5: Run tests and smoke command**

Run:

```bash
npm test -- src/__tests__/readiness-command.test.ts
agent-queue readiness
```

Expected: tests pass and the live command prints readiness percentages for assigned Jira tickets.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/readiness-command.ts src/__tests__/readiness-command.test.ts
git commit -m "feat: add Jira readiness queue"
```

### Task 4: Render Structured Jira Plans

**Files:**
- Create: `src/jira-plan.ts`
- Test: `src/__tests__/jira-plan.test.ts`

- [ ] **Step 1: Write failing plan render/parse tests**

```ts
import { parseJiraPlan, renderJiraPlan } from '../jira-plan.js'
import type { JiraPlan } from '../types.js'

const plan: JiraPlan = {
  ticketKey: 'AISOL-465',
  goal: 'Create onboarding handoff documentation.',
  context: ['Roadwarrior onboarding is scattered across comments.'],
  acceptanceCriteria: ['New teammate can complete setup from the ticket.'],
  implementationNotes: ['Update docs only.'],
  verification: ['Run markdown lint.', 'Check links manually.'],
  risks: ['Docs can go stale.'],
  autonomyLevel: 2,
  forbiddenActions: ['Do not merge.', 'Do not deploy.']
}

test('renderJiraPlan writes a stable Agent Q plan section', () => {
  const text = renderJiraPlan(plan)

  expect(text).toContain('## Agent Q Plan')
  expect(text).toContain('Autonomy Level: 2')
  expect(text).toContain('- Do not merge.')
})

test('parseJiraPlan reads the rendered section', () => {
  const parsed = parseJiraPlan('intro\n\n' + renderJiraPlan(plan))

  expect(parsed?.ticketKey).toBe('AISOL-465')
  expect(parsed?.goal).toBe('Create onboarding handoff documentation.')
  expect(parsed?.autonomyLevel).toBe(2)
})
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- src/__tests__/jira-plan.test.ts`

Expected: FAIL because `jira-plan.ts` does not exist.

- [ ] **Step 3: Implement plain-text plan format**

Create `src/jira-plan.ts`:

```ts
import type { AutonomyLevel, JiraPlan } from './types.js'

function bullets(items: string[]): string {
  return items.map(item => `- ${item}`).join('\n')
}

function section(text: string, heading: string): string | null {
  const match = text.match(new RegExp(`### ${heading}\\n([\\s\\S]*?)(?=\\n### |$)`, 'i'))
  return match?.[1]?.trim() ?? null
}

function parseBullets(text: string | null): string[] {
  if (!text) return []
  return text.split('\n').map(line => line.replace(/^- /, '').trim()).filter(Boolean)
}

export function renderJiraPlan(plan: JiraPlan): string {
  return [
    '## Agent Q Plan',
    `Ticket: ${plan.ticketKey}`,
    `Autonomy Level: ${plan.autonomyLevel}`,
    '',
    '### Goal',
    plan.goal,
    '',
    '### Context',
    bullets(plan.context),
    '',
    '### Acceptance Criteria',
    bullets(plan.acceptanceCriteria),
    '',
    '### Implementation Notes',
    bullets(plan.implementationNotes),
    '',
    '### Verification',
    bullets(plan.verification),
    '',
    '### Risks',
    bullets(plan.risks),
    '',
    '### Forbidden Actions',
    bullets(plan.forbiddenActions)
  ].join('\n')
}

export function parseJiraPlan(description: string): JiraPlan | null {
  const start = description.indexOf('## Agent Q Plan')
  if (start === -1) return null
  const text = description.slice(start)
  const ticketKey = text.match(/Ticket: ([A-Z]+-\d+)/)?.[1]
  const autonomy = Number(text.match(/Autonomy Level: ([0-4])/)?.[1])
  const goal = section(text, 'Goal')
  if (!ticketKey || !goal || !Number.isInteger(autonomy)) return null

  return {
    ticketKey,
    goal,
    context: parseBullets(section(text, 'Context')),
    acceptanceCriteria: parseBullets(section(text, 'Acceptance Criteria')),
    implementationNotes: parseBullets(section(text, 'Implementation Notes')),
    verification: parseBullets(section(text, 'Verification')),
    risks: parseBullets(section(text, 'Risks')),
    autonomyLevel: autonomy as AutonomyLevel,
    forbiddenActions: parseBullets(section(text, 'Forbidden Actions'))
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/__tests__/jira-plan.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/jira-plan.ts src/__tests__/jira-plan.test.ts
git commit -m "feat: render structured Agent Q Jira plans"
```

### Task 5: Add Approval-Gated Jira Plan Writes

**Files:**
- Modify: `src/jira.ts`
- Create: `src/plan-command.ts`
- Modify: `src/index.ts`
- Test: `src/__tests__/plan-command.test.ts`

- [ ] **Step 1: Write failing approval test**

```ts
import { JIRA_PLAN_APPROVAL_PHRASE, hasJiraPlanApproval } from '../plan-command.js'

test('Jira plan writes require exact approval phrase', () => {
  expect(JIRA_PLAN_APPROVAL_PHRASE).toBe('APPROVE JIRA PLAN')
  expect(hasJiraPlanApproval('APPROVE JIRA PLAN')).toBe(true)
  expect(hasJiraPlanApproval('yes')).toBe(false)
  expect(hasJiraPlanApproval('y')).toBe(false)
})
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- src/__tests__/plan-command.test.ts`

Expected: FAIL because `plan-command.ts` does not exist.

- [ ] **Step 3: Add Jira description update helper**

Add to `src/jira.ts`:

```ts
export function buildUpdateDescriptionPayload(description: string): { fields: { description: { type: 'doc'; version: 1; content: AdfNode[] } } } {
  return {
    fields: {
      description: {
        type: 'doc',
        version: 1,
        content: description.split('\n\n').map(paragraph)
      }
    }
  }
}

export async function updateTicketDescription(ticketKey: string, description: string): Promise<void> {
  const config = requireJiraConfig()
  const res = await fetch(`${config.baseUrl}/rest/api/3/issue/${ticketKey}`, {
    method: 'PUT',
    headers: {
      Authorization: authHeader(config.email),
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildUpdateDescriptionPayload(description))
  })
  if (!res.ok) throw new Error(`Jira update issue error ${res.status}: ${await res.text()}`)
}
```

- [ ] **Step 4: Implement plan command approval helpers**

Create `src/plan-command.ts`:

```ts
export const JIRA_PLAN_APPROVAL_PHRASE = 'APPROVE JIRA PLAN'

export function hasJiraPlanApproval(answer: string): boolean {
  return answer.trim() === JIRA_PLAN_APPROVAL_PHRASE
}
```

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/__tests__/plan-command.test.ts src/__tests__/jira.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/jira.ts src/plan-command.ts src/__tests__/plan-command.test.ts src/__tests__/jira.test.ts
git commit -m "feat: add approval-gated Jira plan writes"
```

### Task 6: Implement Plan Draft Flow

**Files:**
- Modify: `src/plan-command.ts`
- Modify: `src/index.ts`
- Test: `src/__tests__/plan-command.test.ts`

- [ ] **Step 1: Add failing command arg test**

```ts
import { parsePlanArgs } from '../plan-command.js'

test('parsePlanArgs supports preview and write modes', () => {
  expect(parsePlanArgs(['AISOL-465'])).toEqual({ selection: 'AISOL-465', write: false })
  expect(parsePlanArgs(['AISOL-465', '--write'])).toEqual({ selection: 'AISOL-465', write: true })
})
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- src/__tests__/plan-command.test.ts`

Expected: FAIL because `parsePlanArgs` is missing.

- [ ] **Step 3: Implement args and plan preview**

Add to `src/plan-command.ts`:

```ts
import readline from 'readline'
import { renderJiraPlan } from './jira-plan.js'
import { updateTicketDescription } from './jira.js'
import type { JiraPlan, JiraTicket } from './types.js'

export interface PlanArgs {
  selection: string
  write: boolean
}

export function parsePlanArgs(args: string[]): PlanArgs {
  const selection = args.find(arg => !arg.startsWith('--'))
  if (!selection) throw new Error('Usage: agent-queue plan <ticket-number-or-key> [--write]')
  return { selection, write: args.includes('--write') }
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()) }))
}

export function buildPlanFromTicket(ticket: JiraTicket): JiraPlan {
  return {
    ticketKey: ticket.key,
    goal: ticket.summary,
    context: ticket.description ? [ticket.description] : ['Jake will provide context in the planning cmux session.'],
    acceptanceCriteria: ['Defined with Jake before execution.'],
    implementationNotes: ['Use repo patterns and Superpowers planning before code changes.'],
    verification: ['Run the smallest meaningful verification command before reporting done.'],
    risks: ['Under-specified ticket can cause agent drift.'],
    autonomyLevel: 2,
    forbiddenActions: ['Do not merge.', 'Do not deploy.', 'Do not update Jira without approval.']
  }
}

export async function writePlanWithApproval(ticket: JiraTicket, plan: JiraPlan): Promise<boolean> {
  const rendered = renderJiraPlan(plan)
  console.log(rendered)
  const answer = await prompt(`\nWrite this plan to ${ticket.key}? Type "${JIRA_PLAN_APPROVAL_PHRASE}" to approve: `)
  if (!hasJiraPlanApproval(answer)) return false
  const nextDescription = [ticket.description, rendered].filter(Boolean).join('\n\n')
  await updateTicketDescription(ticket.key, nextDescription)
  return true
}
```

- [ ] **Step 4: Wire CLI**

In `src/index.ts`, add:

```ts
if (args[0] === 'plan') {
  await runPlanCommand(args.slice(1), tickets)
  return
}
```

Import:

```ts
import { runPlanCommand } from './plan-command.js'
```

- [ ] **Step 5: Run tests and preview**

Run:

```bash
npm test -- src/__tests__/plan-command.test.ts
agent-queue plan AISOL-465
```

Expected: tests pass and preview prints a structured Agent Q plan without writing Jira.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/plan-command.ts src/__tests__/plan-command.test.ts
git commit -m "feat: preview Agent Q plans for Jira tickets"
```

---

## Milestone V2.5: Proof Back To Jira

### Task 7: Build Proof Reports

**Files:**
- Create: `src/proof.ts`
- Test: `src/__tests__/proof.test.ts`

- [ ] **Step 1: Write failing proof formatter test**

```ts
import { formatProofReport } from '../proof.js'

test('formatProofReport renders evidence for Jira', () => {
  const output = formatProofReport({
    ticketKey: 'AISOL-465',
    branch: 'agent/AISOL-465',
    prUrl: 'https://github.com/example/pr/1',
    summary: 'Added onboarding docs.',
    filesChanged: ['docs/onboarding.md'],
    verification: ['npm test passed'],
    residualRisk: ['Docs can go stale.']
  })

  expect(output).toContain('## Agent Q Proof')
  expect(output).toContain('https://github.com/example/pr/1')
  expect(output).toContain('npm test passed')
})
```

- [ ] **Step 2: Implement formatter**

Create `src/proof.ts`:

```ts
import type { ProofReport } from './types.js'

function bullets(items: string[]): string {
  return items.length ? items.map(item => `- ${item}`).join('\n') : '- none'
}

export function formatProofReport(report: ProofReport): string {
  return [
    '## Agent Q Proof',
    `Ticket: ${report.ticketKey}`,
    `Branch: ${report.branch}`,
    report.prUrl ? `PR: ${report.prUrl}` : 'PR: none',
    '',
    '### Summary',
    report.summary,
    '',
    '### Files Changed',
    bullets(report.filesChanged),
    '',
    '### Verification',
    bullets(report.verification),
    '',
    '### Residual Risk',
    bullets(report.residualRisk)
  ].join('\n')
}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- src/__tests__/proof.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/proof.ts src/__tests__/proof.test.ts
git commit -m "feat: format Agent Q proof reports"
```

### Task 8: Add Approval-Gated Proof Jira Comment

**Files:**
- Modify: `src/index.ts`
- Modify: `src/proof.ts`
- Modify: `src/jira.ts`
- Test: `src/__tests__/proof.test.ts`

- [ ] **Step 1: Add approval phrase test**

```ts
import { hasProofApproval, JIRA_PROOF_APPROVAL_PHRASE } from '../proof.js'

test('proof updates require exact approval phrase', () => {
  expect(JIRA_PROOF_APPROVAL_PHRASE).toBe('APPROVE JIRA PROOF')
  expect(hasProofApproval('APPROVE JIRA PROOF')).toBe(true)
  expect(hasProofApproval('yes')).toBe(false)
})
```

- [ ] **Step 2: Implement helpers**

Add to `src/proof.ts`:

```ts
export const JIRA_PROOF_APPROVAL_PHRASE = 'APPROVE JIRA PROOF'

export function hasProofApproval(answer: string): boolean {
  return answer.trim() === JIRA_PROOF_APPROVAL_PHRASE
}
```

- [ ] **Step 3: Wire `agent-queue proof`**

In `src/index.ts`, add a `proof` command that reads a local proof JSON file path and previews `formatProofReport(report)`. It should call `commentOnTicket(report.ticketKey, formatted)` only after the exact phrase.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/__tests__/proof.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/proof.ts src/jira.ts src/__tests__/proof.test.ts
git commit -m "feat: add approval-gated Jira proof comments"
```

---

## Milestone V3: Worktree Swarm Execution

### Task 9: Require Approved Jira Plan Before Execution

**Files:**
- Modify: `src/cmux.ts`
- Modify: `src/index.ts`
- Modify: `src/jira-plan.ts`
- Test: `src/__tests__/cmux.test.ts`

- [ ] **Step 1: Add failing handoff test**

```ts
import { buildClaudeHandoffPrompt } from '../cmux.js'

test('cmux handoff says execution must come from Jira plan', () => {
  const prompt = buildClaudeHandoffPrompt('AISOL-465')

  expect(prompt).toContain('approved Jira plan')
  expect(prompt).toContain('autonomy level')
  expect(prompt).toContain('worktree')
})
```

- [ ] **Step 2: Update handoff prompt**

The prompt must say:

```text
Execute only after the ticket has an approved Jira plan and autonomy level.
Use an isolated worktree and branch for implementation.
If the Jira plan is missing or weak, stop and improve Jira first.
```

- [ ] **Step 3: Run tests**

Run: `npm test -- src/__tests__/cmux.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/cmux.ts src/__tests__/cmux.test.ts
git commit -m "feat: require Jira plan before cmux execution"
```

### Task 10: Add Worktree Preparation Command

**Files:**
- Modify: `src/worktree.ts`
- Create: `src/execution-command.ts`
- Modify: `src/index.ts`
- Test: `src/__tests__/execution-command.test.ts`

- [ ] **Step 1: Write failing execution contract test**

```ts
import { buildExecutionBranch } from '../execution-command.js'

test('buildExecutionBranch uses agent ticket branch', () => {
  expect(buildExecutionBranch('AISOL-465')).toBe('agent/AISOL-465')
})
```

- [ ] **Step 2: Implement branch helper**

Create `src/execution-command.ts`:

```ts
export function buildExecutionBranch(ticketKey: string): string {
  return `agent/${ticketKey.toUpperCase()}`
}
```

- [ ] **Step 3: Wire command**

Add `agent-queue execute-ready <ticket...>` that checks each ticket has:

- parsed Agent Q plan
- repo label
- readiness score at least 80
- autonomy level 2 or 3

The command previews worktree/branch/cmux actions first. It starts only after Jake approves.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/__tests__/execution-command.test.ts src/__tests__/worktree.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/execution-command.ts src/index.ts src/worktree.ts src/__tests__/execution-command.test.ts
git commit -m "feat: prepare approved Jira tickets for worktree execution"
```

---

## Milestone V4: Ruflo Adapter

### Task 11: Define Execution Backend Interface

**Files:**
- Create: `src/execution-backend.ts`
- Test: `src/__tests__/execution-backend.test.ts`

- [ ] **Step 1: Write interface test**

```ts
import type { ExecutionBackend } from '../execution-backend.js'

test('ExecutionBackend supports cmux and future Ruflo implementations', () => {
  const backend: ExecutionBackend = {
    name: 'cmux',
    preview: contract => [`cmux ${contract.ticketKey}`],
    start: async () => undefined
  }

  expect(backend.name).toBe('cmux')
})
```

- [ ] **Step 2: Implement interface**

Create `src/execution-backend.ts`:

```ts
import type { ExecutionContract } from './types.js'

export interface ExecutionBackend {
  name: 'cmux' | 'ruflo'
  preview(contract: ExecutionContract): string[]
  start(contract: ExecutionContract): Promise<void>
}
```

- [ ] **Step 3: Commit**

```bash
git add src/execution-backend.ts src/__tests__/execution-backend.test.ts
git commit -m "feat: define execution backend interface"
```

### Task 12: Add Ruflo As Future Adapter Only

**Files:**
- Create: `src/ruflo-backend.ts`
- Test: `src/__tests__/ruflo-backend.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write adapter preview test**

```ts
import { createRufloBackend } from '../ruflo-backend.js'

test('Ruflo backend previews command without becoming control plane', () => {
  const backend = createRufloBackend('/usr/local/bin/ruflo')
  const lines = backend.preview({
    ticketKey: 'AISOL-465',
    repo: 'jakefassora-HC/queen-bot',
    branch: 'agent/AISOL-465',
    autonomyLevel: 2,
    approvedAt: '2026-05-28T00:00:00Z',
    plan: {
      ticketKey: 'AISOL-465',
      goal: 'Plan first',
      context: [],
      acceptanceCriteria: [],
      implementationNotes: [],
      verification: [],
      risks: [],
      autonomyLevel: 2,
      forbiddenActions: []
    }
  })

  expect(lines.join('\n')).toContain('ruflo')
  expect(lines.join('\n')).toContain('AISOL-465')
})
```

- [ ] **Step 2: Implement preview-only adapter**

Create `src/ruflo-backend.ts`:

```ts
import type { ExecutionBackend } from './execution-backend.js'

export function createRufloBackend(binary: string): ExecutionBackend {
  return {
    name: 'ruflo',
    preview: contract => [
      `${binary} run --ticket ${contract.ticketKey} --repo ${contract.repo} --branch ${contract.branch}`
    ],
    start: async () => {
      throw new Error('Ruflo backend is preview-only until Agent Queue execution contracts are stable.')
    }
  }
}
```

- [ ] **Step 3: Document adapter rule**

Add to `README.md`:

```md
Ruflo is a future execution backend, not the control plane. Agent Queue owns Jira planning, approval gates, execution contracts, and proof reporting. Ruflo may execute an approved contract later.
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/__tests__/ruflo-backend.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ruflo-backend.ts src/__tests__/ruflo-backend.test.ts README.md
git commit -m "feat: sketch Ruflo execution backend adapter"
```

---

## Verification Checklist

Run before opening or updating the PR:

```bash
npm test
npx tsc --noEmit
git diff --check
agent-queue readiness
agent-queue plan AISOL-465
agent-queue cmux AISOL-465
```

Expected:

- Tests pass.
- Typecheck passes.
- Diff check passes.
- `readiness` prints ticket percentages and missing context.
- `plan` previews a Jira plan without writing.
- `cmux` previews Claude worker launch from Jira context.

---

## Execution Notes

- Implement V2 before V3. Do not start worktree swarm behavior until Jira plans can be written and read reliably.
- Keep Jira writes approval-gated with exact phrases.
- Keep cmux as the default worker launcher until the execution contract is stable.
- Treat Ruflo as an adapter, not a rewrite.
- Use parallel agents after a plan is approved and tasks are independent.
- Preserve the invariant: Jira owns the plan, GitHub owns code review, Agent Queue owns orchestration, Jake owns irreversible approvals.

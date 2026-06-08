# Goal/Plan/Proof Architecture Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `goal: string` field in TicketDraft and JiraPlan with a structured `TicketGoal` artifact that becomes the primary Jira description content, carries into execution handoff, and enables Goal-anchored verification against Proof.

**Architecture:** A new `TicketGoal` type (`why`, `constraints`, `nonGoals`, `successCriteria`) is added to types.ts and rendered into a `## Goal` section at the top of every Jira description. The existing `## Agent Q Plan` section is preserved but becomes secondary — execution gates and handoff prompts inject Goal first, Plan second. No existing execution or plan infrastructure is removed; Goal presence is additive.

**Tech Stack:** TypeScript, Node.js 22, Jest + ts-jest, Jira ADF (Atlassian Document Format)

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `src/types.ts` | Modify | Add `TicketGoal` interface; update `TicketDraft.goal` from `string` to `TicketGoal`; add `goal: TicketGoal \| null` to `ExecutionContract`; add `'upsert-goal'` to `JiraWriteAction` |
| `src/jira-goal.ts` | Create | `renderGoal`, `parseGoal`, `upsertGoalSection` — mirrors pattern of `jira-plan.ts` |
| `src/__tests__/jira-goal.test.ts` | Create | Tests for render/parse/upsert round-trip |
| `src/ticket-draft.ts` | Modify | Update `buildTicketDraftPrompt` to request structured goal fields; update `parseTicketDrafts` to construct `TicketGoal` |
| `src/__tests__/ticket-draft.test.ts` | Modify | Update snapshots/assertions for new `TicketDraft.goal: TicketGoal` shape |
| `src/jira.ts` | Modify | Update `buildCreateIssuePayload` to render Goal as the primary ADF description section using `renderGoal` |
| `src/__tests__/jira.test.ts` | Modify | Update payload assertions for new description ADF shape |
| `src/execution-command.ts` | Modify | Gate on Goal presence; attach `goal` to `ExecutionContract` |
| `src/__tests__/execution-command.test.ts` | Modify | Add test for Goal-absent rejection |
| `src/readiness.ts` | Modify | Score Goal presence (add to strengths/weaknesses); import and call `parseGoal` |
| `src/__tests__/readiness.test.ts` | Modify | Add test for readiness scoring with/without Goal |
| `src/cmux.ts` | Modify | `buildClaudeHandoffPrompt` injects Goal before Plan when `contract.goal` is present |
| `src/__tests__/cmux.test.ts` | Modify | Add test for Goal injection in handoff prompt |
| `src/proof.ts` | Modify | `formatProofReport` appends Goal's `successCriteria` so reviewer can assess coverage |
| `src/__tests__/proof.test.ts` | Modify | Update snapshot for new proof report format |

---

## Task 1: Add `TicketGoal` type and update `TicketDraft` + `ExecutionContract` in types.ts

**Files:**
- Modify: `src/types.ts` (lines 93–121, 151–163)

- [ ] **Step 1: Locate the exact lines to change**

  Run to confirm current line numbers:
  ```bash
  grep -n "goal\|TicketDraft\|ExecutionContract\|JiraWriteAction" /Users/jakefassora/projects/agent-queue/src/types.ts | head -30
  ```

- [ ] **Step 2: Add `TicketGoal` interface after `AutonomyLevel` (around line 93)**

  Insert after `export type AutonomyLevel = 0 | 1 | 2 | 3 | 4`:
  ```typescript
  export interface TicketGoal {
    why: string
    constraints: string[]
    nonGoals: string[]
    successCriteria: string[]
  }
  ```

- [ ] **Step 3: Update `JiraWriteAction` to include `'upsert-goal'`**

  Change:
  ```typescript
  export type JiraWriteAction = 'comment' | 'update-description' | 'create-ticket' | 'transition' | 'link-issue'
  ```
  To:
  ```typescript
  export type JiraWriteAction = 'comment' | 'update-description' | 'create-ticket' | 'transition' | 'link-issue' | 'upsert-goal'
  ```

- [ ] **Step 4: Update `ExecutionContract` to carry the Goal**

  Add `goal: TicketGoal | null` field to `ExecutionContract`. The interface currently ends around line 121. Add after `approvedAt`:
  ```typescript
  goal: TicketGoal | null
  ```

- [ ] **Step 5: Update `TicketDraft` — replace `goal: string` with `goal: TicketGoal` and remove `nonGoals`/`acceptanceCriteria` top-level fields**

  The `nonGoals: string[]` and `acceptanceCriteria: string[]` fields on `TicketDraft` move into `TicketGoal`. Remove them from the top level and replace `goal: string` with `goal: TicketGoal`.

  Current (around L151-163):
  ```typescript
  export interface TicketDraft {
    summary: string
    issueType: string
    problem: string
    goal: string
    nonGoals: string[]
    acceptanceCriteria: string[]
    researchNotes: string
    risks: string[]
    definitionOfDone: string[]
    labels: string[]
    relatedRepos: string[]
  }
  ```

  New:
  ```typescript
  export interface TicketDraft {
    summary: string
    issueType: string
    problem: string
    goal: TicketGoal
    researchNotes: string
    risks: string[]
    definitionOfDone: string[]
    labels: string[]
    relatedRepos: string[]
  }
  ```

- [ ] **Step 6: Verify TypeScript compiles (will show errors in files that reference old shape)**

  ```bash
  cd /Users/jakefassora/projects/agent-queue && npx tsc --noEmit 2>&1 | head -40
  ```
  Expected: errors in `ticket-draft.ts`, `jira.ts`, `plan-command.ts` — these are addressed in later tasks.

- [ ] **Step 7: Commit types change**

  ```bash
  git add src/types.ts
  git commit -m "feat: add TicketGoal type, update TicketDraft and ExecutionContract"
  ```

---

## Task 2: Create `jira-goal.ts` with render/parse/upsert

**Files:**
- Create: `src/jira-goal.ts`
- Create: `src/__tests__/jira-goal.test.ts`

- [ ] **Step 1: Write the failing tests first**

  Create `src/__tests__/jira-goal.test.ts`:
  ```typescript
  import { renderGoal, parseGoal, upsertGoalSection, GOAL_HEADING } from '../jira-goal.js'
  import type { TicketGoal } from '../types.js'

  const sampleGoal: TicketGoal = {
    why: 'Users cannot see rejection reasons in the funnel.',
    constraints: ['Must not break existing Sankey chart', 'Read-only change'],
    nonGoals: ['Adding new data sources', 'Redesigning the chart UI'],
    successCriteria: ['Rejection reasons appear as nodes', 'Funnel shows all stages'],
  }

  const renderedGoal = `## Goal

### Why
Users cannot see rejection reasons in the funnel.

### Constraints
- Must not break existing Sankey chart
- Read-only change

### Non-Goals
- Adding new data sources
- Redesigning the chart UI

### Success Criteria
- Rejection reasons appear as nodes
- Funnel shows all stages`

  describe('renderGoal', () => {
    it('renders a structured Goal section', () => {
      expect(renderGoal(sampleGoal)).toBe(renderedGoal)
    })

    it('renders None for empty arrays', () => {
      const goal: TicketGoal = { why: 'Why text', constraints: [], nonGoals: [], successCriteria: [] }
      const result = renderGoal(goal)
      expect(result).toContain('- None')
    })
  })

  describe('parseGoal', () => {
    it('parses a rendered Goal section', () => {
      const parsed = parseGoal(renderedGoal)
      expect(parsed).toEqual(sampleGoal)
    })

    it('returns null when no Goal section present', () => {
      expect(parseGoal('Some description without a goal section')).toBeNull()
    })

    it('returns null when Why is missing', () => {
      const noWhy = `## Goal\n\n### Success Criteria\n- thing`
      expect(parseGoal(noWhy)).toBeNull()
    })

    it('parses Goal embedded in a larger description', () => {
      const full = `Some intro text.\n\n${renderedGoal}\n\n## Agent Q Plan\n\nplan stuff`
      const parsed = parseGoal(full)
      expect(parsed?.why).toBe('Users cannot see rejection reasons in the funnel.')
    })

    it('stops parsing at the next ## heading', () => {
      const full = `${renderedGoal}\n\n## Agent Q Plan\n\n### Why\nNot the goal`
      const parsed = parseGoal(full)
      expect(parsed?.why).toBe('Users cannot see rejection reasons in the funnel.')
    })
  })

  describe('upsertGoalSection', () => {
    it('appends Goal to empty description', () => {
      expect(upsertGoalSection('', sampleGoal)).toBe(renderGoal(sampleGoal))
    })

    it('appends Goal after existing description', () => {
      const result = upsertGoalSection('Existing content.', sampleGoal)
      expect(result).toBe(`Existing content.\n\n${renderGoal(sampleGoal)}`)
    })

    it('replaces an existing Goal section', () => {
      const original = upsertGoalSection('', sampleGoal)
      const updated: TicketGoal = { ...sampleGoal, why: 'Updated why text.' }
      const result = upsertGoalSection(original, updated)
      expect(result).toContain('Updated why text.')
      expect(result).not.toContain('Users cannot see rejection reasons')
    })

    it('preserves content after the Goal section when replacing', () => {
      const description = `${renderGoal(sampleGoal)}\n\n## Agent Q Plan\n\nplan stuff`
      const updated: TicketGoal = { ...sampleGoal, why: 'New why.' }
      const result = upsertGoalSection(description, updated)
      expect(result).toContain('## Agent Q Plan')
      expect(result).toContain('plan stuff')
    })
  })
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  cd /Users/jakefassora/projects/agent-queue && npx jest jira-goal --no-coverage 2>&1 | tail -10
  ```
  Expected: `Cannot find module '../jira-goal.js'`

- [ ] **Step 3: Create `src/jira-goal.ts`**

  ```typescript
  import type { TicketGoal } from './types.js'

  export const GOAL_HEADING = '## Goal'

  function bullets(items: string[]): string {
    return items.length > 0 ? items.map(i => `- ${i}`).join('\n') : '- None'
  }

  function extractSection(body: string, heading: string): string | null {
    const marker = `### ${heading}`
    const idx = body.indexOf(marker)
    if (idx === -1) return null
    const start = idx + marker.length
    const nextHeading = body.indexOf('###', start)
    const end = nextHeading === -1 ? body.length : nextHeading
    return body.slice(start, end).trim() || null
  }

  function parseBullets(text: string | null): string[] {
    if (!text) return []
    return text
      .split('\n')
      .map(l => l.replace(/^-\s*/, '').trim())
      .filter(Boolean)
      .filter(l => l !== 'None')
  }

  export function renderGoal(goal: TicketGoal): string {
    return [
      GOAL_HEADING,
      '',
      '### Why',
      goal.why,
      '',
      '### Constraints',
      bullets(goal.constraints),
      '',
      '### Non-Goals',
      bullets(goal.nonGoals),
      '',
      '### Success Criteria',
      bullets(goal.successCriteria),
    ].join('\n')
  }

  export function parseGoal(description: string): TicketGoal | null {
    const idx = description.indexOf(GOAL_HEADING)
    if (idx === -1) return null
    const afterHeading = description.slice(idx + GOAL_HEADING.length)
    const nextSection = afterHeading.indexOf('\n## ')
    const body = nextSection === -1 ? afterHeading : afterHeading.slice(0, nextSection)

    const why = extractSection(body, 'Why')
    if (!why) return null

    return {
      why,
      constraints: parseBullets(extractSection(body, 'Constraints')),
      nonGoals: parseBullets(extractSection(body, 'Non-Goals')),
      successCriteria: parseBullets(extractSection(body, 'Success Criteria')),
    }
  }

  export function upsertGoalSection(description: string, goal: TicketGoal): string {
    const rendered = renderGoal(goal)
    const idx = description.indexOf(GOAL_HEADING)
    if (idx === -1) {
      return description ? `${description}\n\n${rendered}` : rendered
    }
    const afterHeading = description.slice(idx + GOAL_HEADING.length)
    const nextSection = afterHeading.indexOf('\n## ')
    const end = nextSection === -1 ? description.length : idx + GOAL_HEADING.length + nextSection
    return description.slice(0, idx) + rendered + description.slice(end)
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  cd /Users/jakefassora/projects/agent-queue && npx jest jira-goal --no-coverage 2>&1 | tail -10
  ```
  Expected: all tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/jira-goal.ts src/__tests__/jira-goal.test.ts
  git commit -m "feat: add jira-goal.ts with renderGoal, parseGoal, upsertGoalSection"
  ```

---

## Task 3: Update `ticket-draft.ts` prompt and parsing for structured Goal

**Files:**
- Modify: `src/ticket-draft.ts`
- Modify: `src/__tests__/ticket-draft.test.ts`

- [ ] **Step 1: Read the current prompt and parse functions**

  ```bash
  sed -n '17,65p' /Users/jakefassora/projects/agent-queue/src/ticket-draft.ts
  ```

- [ ] **Step 2: Update `buildTicketDraftPrompt` to request structured Goal fields**

  In the JSON schema block of `buildTicketDraftPrompt`, replace the current `goal`, `nonGoals`, `acceptanceCriteria` fields with:
  ```
  goalWhy: string — one to two sentences on why this work matters
  goalConstraints: string[] — hard constraints the solution must respect
  goalNonGoals: string[] — what is explicitly out of scope
  goalSuccessCriteria: string[] — measurable outcomes that define done
  ```

  The prompt's JSON output schema comment block should read:
  ```
  {
    "summary": "...",
    "issueType": "Story|Bug|Task",
    "problem": "...",
    "goalWhy": "...",
    "goalConstraints": ["..."],
    "goalNonGoals": ["..."],
    "goalSuccessCriteria": ["..."],
    "researchNotes": "...",
    "risks": ["..."],
    "definitionOfDone": ["..."],
    "labels": ["..."],
    "relatedRepos": ["..."]
  }
  ```

- [ ] **Step 3: Update `parseTicketDrafts` to construct `TicketGoal` from the new fields**

  Replace the section that reads `draft.goal`, `draft.nonGoals`, `draft.acceptanceCriteria` with:
  ```typescript
  const goalWhy = typeof raw.goalWhy === 'string' ? raw.goalWhy.trim() : ''
  if (!goalWhy) throw new Error(`Draft missing goalWhy: ${JSON.stringify(raw)}`)
  const goal: TicketGoal = {
    why: goalWhy,
    constraints: asStringArray(raw.goalConstraints),
    nonGoals: asStringArray(raw.goalNonGoals),
    successCriteria: asStringArray(raw.goalSuccessCriteria),
  }
  ```
  And include `goal` (not `goalWhy` etc.) on the returned `TicketDraft` object.

- [ ] **Step 4: Update `summarizeTicketDrafts` to display Goal structure**

  Replace the flat `goal: draft.goal` line with:
  ```typescript
  `Goal: ${draft.goal.why}`,
  draft.goal.successCriteria.length > 0
    ? `Success Criteria:\n${draft.goal.successCriteria.map(c => `  - ${c}`).join('\n')}`
    : '',
  ```

- [ ] **Step 5: Run the existing ticket-draft tests to see what breaks**

  ```bash
  cd /Users/jakefassora/projects/agent-queue && npx jest ticket-draft --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 6: Fix ticket-draft.test.ts**

  Update any test fixture that constructs a `TicketDraft` to use `goal: TicketGoal` shape:
  ```typescript
  goal: {
    why: 'Users cannot view rejection reasons in the Sankey funnel.',
    constraints: ['Must preserve existing chart behavior'],
    nonGoals: ['Redesigning the UI'],
    successCriteria: ['Rejection reasons visible as nodes', 'All funnel stages shown'],
  }
  ```
  Remove standalone `nonGoals` and `acceptanceCriteria` from any `TicketDraft` test fixtures.

  Update any prompt output fixture strings to match the new JSON schema.

- [ ] **Step 7: Run tests and confirm green**

  ```bash
  cd /Users/jakefassora/projects/agent-queue && npx jest ticket-draft --no-coverage 2>&1 | tail -10
  ```
  Expected: all pass.

- [ ] **Step 8: Commit**

  ```bash
  git add src/ticket-draft.ts src/__tests__/ticket-draft.test.ts
  git commit -m "feat: ticket-draft structured TicketGoal — replace flat goal string"
  ```

---

## Task 4: Update `jira.ts` — Goal as primary ADF description content

**Files:**
- Modify: `src/jira.ts` (around L460–491, `buildCreateIssuePayload`)
- Modify: `src/__tests__/jira.test.ts`

- [ ] **Step 1: Read the current `buildCreateIssuePayload` function**

  ```bash
  sed -n '460,495p' /Users/jakefassora/projects/agent-queue/src/jira.ts
  ```

- [ ] **Step 2: Add import for `renderGoal` and `plainTextToAdfBlocks`**

  At the top of `jira.ts`, add:
  ```typescript
  import { renderGoal } from './jira-goal.js'
  ```

- [ ] **Step 3: Update `buildCreateIssuePayload` to render Goal as the first ADF section**

  The current function builds ADF nodes from `draft.problem`, `draft.goal`, `draft.acceptanceCriteria`, `draft.nonGoals`, `draft.risks`. Replace the goal/nonGoals/acceptanceCriteria ADF nodes with Goal-section-first ADF:

  ```typescript
  export function buildCreateIssuePayload(projectKey: string, draft: TicketDraft): CreateIssuePayload {
    const goalText = renderGoal(draft.goal)
    const descriptionNodes: JiraAdfNode[] = [
      ...plainTextToAdfBlocks(goalText),
      heading('Problem'),
      ...plainTextToAdfBlocks(draft.problem),
    ]
    if (draft.risks.length > 0) {
      descriptionNodes.push(heading('Risks'), bulletList(draft.risks))
    }
    if (draft.definitionOfDone.length > 0) {
      descriptionNodes.push(heading('Definition of Done'), bulletList(draft.definitionOfDone))
    }
    // ... rest of existing label/issuetype logic unchanged
  }
  ```

- [ ] **Step 4: Run jira tests to see what breaks**

  ```bash
  cd /Users/jakefassora/projects/agent-queue && npx jest jira.test --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 5: Update failing jira.test.ts fixtures**

  Any test that calls `buildCreateIssuePayload` with a `TicketDraft` fixture must be updated:
  - Replace `goal: 'some string'` with the structured `goal: TicketGoal` shape
  - Remove standalone `nonGoals` and `acceptanceCriteria` from draft fixtures
  - Update ADF payload assertions to expect Goal section nodes first

- [ ] **Step 6: Run tests and confirm green**

  ```bash
  cd /Users/jakefassora/projects/agent-queue && npx jest jira.test --no-coverage 2>&1 | tail -10
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add src/jira.ts src/__tests__/jira.test.ts
  git commit -m "feat: jira.ts uses Goal as primary ADF description content"
  ```

---

## Task 5: Update `execution-command.ts` — gate on Goal presence, carry Goal in contract

**Files:**
- Modify: `src/execution-command.ts` (around L44–84, `buildExecutionContract`)
- Modify: `src/__tests__/execution-command.test.ts`

- [ ] **Step 1: Read `buildExecutionContract`**

  ```bash
  sed -n '44,85p' /Users/jakefassora/projects/agent-queue/src/execution-command.ts
  ```

- [ ] **Step 2: Add import for `parseGoal`**

  ```typescript
  import { parseGoal } from './jira-goal.js'
  ```

- [ ] **Step 3: Add Goal gate and attach Goal to contract**

  After the existing plan parse and before the acceptanceCriteria gate, add:
  ```typescript
  const description = ticket.description ? adfToPlainText(ticket.description) : ''
  const goal = parseGoal(description)
  if (!goal) {
    return {
      type: 'rejected',
      reason: 'Missing Goal artifact — add a ## Goal section with Why and Success Criteria before executing.',
    }
  }
  ```

  And on the returned `ExecutionContract`, include:
  ```typescript
  goal,
  ```

- [ ] **Step 4: Run execution-command tests to see failures**

  ```bash
  cd /Users/jakefassora/projects/agent-queue && npx jest execution-command --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 5: Add test for Goal-absent rejection**

  In `execution-command.test.ts`, add a test that calls `buildExecutionContract` with a ticket whose description has no `## Goal` section and asserts the result is `{ type: 'rejected', reason: /Missing Goal artifact/ }`.

  Also update any existing test that constructs an `ExecutionContract` to include `goal: null` or a sample `TicketGoal`.

- [ ] **Step 6: Run tests and confirm green**

  ```bash
  cd /Users/jakefassora/projects/agent-queue && npx jest execution-command --no-coverage 2>&1 | tail -10
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add src/execution-command.ts src/__tests__/execution-command.test.ts
  git commit -m "feat: execution gate requires Goal artifact, carry goal in ExecutionContract"
  ```

---

## Task 6: Update `readiness.ts` — score Goal presence

**Files:**
- Modify: `src/readiness.ts`
- Modify: `src/__tests__/readiness.test.ts`

- [ ] **Step 1: Read `scoreTicketReadiness`**

  ```bash
  sed -n '23,103p' /Users/jakefassora/projects/agent-queue/src/readiness.ts
  ```

- [ ] **Step 2: Add import for `parseGoal` and `adfToPlainText`**

  ```typescript
  import { parseGoal } from './jira-goal.js'
  import { adfToPlainText } from './jira.js'
  ```

- [ ] **Step 3: Add Goal scoring in `scoreTicketReadiness`**

  After the existing plan parse, add:
  ```typescript
  const descriptionText = ticket.description ? adfToPlainText(ticket.description) : ''
  const goal = parseGoal(descriptionText)
  
  if (!goal) {
    weaknesses.push('Missing Goal artifact (## Goal section with Why and Success Criteria)')
  } else {
    strengths.push('Goal artifact present')
    if (goal.successCriteria.length === 0) {
      weaknesses.push('Goal has no Success Criteria')
    }
  }
  ```

  The readiness score weight: treat Goal presence as equivalent weight to Plan presence. If Goal is absent, the ticket is `needs-planning`.

- [ ] **Step 4: Run readiness tests**

  ```bash
  cd /Users/jakefassora/projects/agent-queue && npx jest readiness --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 5: Update readiness.test.ts**

  Add two test cases:
  1. Ticket with no Goal section → weaknesses includes `'Missing Goal artifact'`
  2. Ticket with a Goal section (use `renderGoal` output in description) → strengths includes `'Goal artifact present'`

- [ ] **Step 6: Run tests and confirm green**

  ```bash
  cd /Users/jakefassora/projects/agent-queue && npx jest readiness --no-coverage 2>&1 | tail -10
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add src/readiness.ts src/__tests__/readiness.test.ts
  git commit -m "feat: readiness scoring checks Goal artifact presence"
  ```

---

## Task 7: Update `cmux.ts` — inject Goal before Plan in execution handoff

**Files:**
- Modify: `src/cmux.ts` (L37–66, `buildClaudeHandoffPrompt`)
- Modify: `src/__tests__/cmux.test.ts`

- [ ] **Step 1: Read `buildClaudeHandoffPrompt`**

  ```bash
  sed -n '37,67p' /Users/jakefassora/projects/agent-queue/src/cmux.ts
  ```

- [ ] **Step 2: Add import for `renderGoal`**

  ```typescript
  import { renderGoal } from './jira-goal.js'
  ```

- [ ] **Step 3: Inject Goal at the top of the handoff prompt when present**

  In `buildClaudeHandoffPrompt`, before the existing plan context, add:
  ```typescript
  const goalBlock = contract?.goal
    ? `# Goal (source of truth)\n\n${renderGoal(contract.goal)}\n\nThe Goal above is your primary constraint. If the Plan below conflicts with the Goal, the Goal wins.\n\n`
    : ''
  ```

  Prepend `goalBlock` to the returned prompt string. The Plan section continues unchanged after it.

- [ ] **Step 4: Run cmux tests**

  ```bash
  cd /Users/jakefassora/projects/agent-queue && npx jest cmux --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 5: Add/update cmux tests for Goal injection**

  In `cmux.test.ts`, add a test:
  ```typescript
  it('injects Goal before Plan when contract has goal', () => {
    const contract = {
      // ... existing contract fixture fields ...
      goal: {
        why: 'Users need rejection reasons.',
        constraints: ['No UI changes'],
        nonGoals: ['New data sources'],
        successCriteria: ['Rejection reasons visible'],
      },
    } satisfies ExecutionContract
    const prompt = buildClaudeHandoffPrompt('AISOL-123', contract)
    const goalIdx = prompt.indexOf('# Goal (source of truth)')
    const planIdx = prompt.indexOf('Agent Q Plan')
    expect(goalIdx).toBeGreaterThan(-1)
    expect(goalIdx).toBeLessThan(planIdx)
  })

  it('omits Goal block when contract has no goal', () => {
    const contract = { /* ... */ goal: null } satisfies ExecutionContract
    const prompt = buildClaudeHandoffPrompt('AISOL-123', contract)
    expect(prompt).not.toContain('# Goal (source of truth)')
  })
  ```

- [ ] **Step 6: Run tests and confirm green**

  ```bash
  cd /Users/jakefassora/projects/agent-queue && npx jest cmux --no-coverage 2>&1 | tail -10
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add src/cmux.ts src/__tests__/cmux.test.ts
  git commit -m "feat: cmux handoff injects Goal before Plan when contract carries goal"
  ```

---

## Task 8: Update `proof.ts` — show Goal Success Criteria alongside Proof report

**Files:**
- Modify: `src/proof.ts`
- Modify: `src/__tests__/proof.test.ts`

- [ ] **Step 1: Read `formatProofReport`**

  ```bash
  sed -n '38,66p' /Users/jakefassora/projects/agent-queue/src/proof.ts
  ```

- [ ] **Step 2: Update `ProofReport` interface in types.ts to carry Goal**

  In `src/types.ts`, add an optional `goal` field to `ProofReport`:
  ```typescript
  export interface ProofReport {
    // ... existing fields ...
    goal?: TicketGoal
  }
  ```

- [ ] **Step 3: Update `formatProofReport` to append Goal Success Criteria as a checklist**

  At the end of the formatted report, append:
  ```typescript
  if (report.goal?.successCriteria && report.goal.successCriteria.length > 0) {
    const criteria = report.goal.successCriteria.map(c => `- [ ] ${c}`).join('\n')
    sections.push(`## Goal Verification\n\nCheck each Success Criterion against the evidence above:\n\n${criteria}`)
  }
  ```

- [ ] **Step 4: Run proof tests**

  ```bash
  cd /Users/jakefassora/projects/agent-queue && npx jest proof --no-coverage 2>&1 | tail -20
  ```

- [ ] **Step 5: Update proof.test.ts**

  Add a test for `formatProofReport` with a `ProofReport` that includes a `goal`:
  ```typescript
  it('includes Goal Verification checklist when goal is present', () => {
    const report: ProofReport = {
      // ... existing fixture fields ...
      goal: {
        why: 'Users need rejection reasons.',
        constraints: [],
        nonGoals: [],
        successCriteria: ['Rejection reasons visible', 'All stages shown'],
      },
    }
    const formatted = formatProofReport(report)
    expect(formatted).toContain('## Goal Verification')
    expect(formatted).toContain('- [ ] Rejection reasons visible')
    expect(formatted).toContain('- [ ] All stages shown')
  })
  ```

- [ ] **Step 6: Run tests and confirm green**

  ```bash
  cd /Users/jakefassora/projects/agent-queue && npx jest proof --no-coverage 2>&1 | tail -10
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add src/proof.ts src/__tests__/proof.test.ts src/types.ts
  git commit -m "feat: proof report shows Goal Success Criteria verification checklist"
  ```

---

## Task 9: Full test suite + TypeScript validation

- [ ] **Step 1: Run `tsc --noEmit` to verify no type errors remain**

  ```bash
  cd /Users/jakefassora/projects/agent-queue && npx tsc --noEmit 2>&1
  ```
  Expected: no output (clean compile).

- [ ] **Step 2: Run full test suite**

  ```bash
  cd /Users/jakefassora/projects/agent-queue && npm test 2>&1 | tail -20
  ```
  Expected: all tests pass.

- [ ] **Step 3: If any tests fail, fix them before proceeding**

  Common expected failures: `plan-command.test.ts` if `buildPlanFromTicket` still references `draft.nonGoals` or `draft.acceptanceCriteria` from a `TicketDraft`. Fix by reading `draft.goal.nonGoals` and `draft.goal.successCriteria`.

---

## Self-Review Checklist

- **TicketGoal type added to types.ts** → Task 1 ✓
- **jira-goal.ts renders/parses/upserts `## Goal` section** → Task 2 ✓
- **ticket-draft.ts produces structured Goal in output JSON** → Task 3 ✓
- **jira.ts creates tickets with Goal as primary description** → Task 4 ✓
- **execution-command.ts blocks execution when Goal is absent** → Task 5 ✓
- **readiness.ts scores Goal presence** → Task 6 ✓
- **cmux.ts injects Goal before Plan in handoff** → Task 7 ✓
- **proof.ts shows Success Criteria alongside Proof evidence** → Task 8 ✓
- **`JiraWriteAction` union includes `'upsert-goal'`** → Task 1 ✓
- **`plan-command.ts` `buildPlanFromTicket` tested** → covered in Task 9 catch
- **No `TicketDraft.nonGoals` or `TicketDraft.acceptanceCriteria` references remain** → Task 9 tsc check ✓
- **`ExecutionContract.goal` carries `TicketGoal | null`** → Task 1 + 5 ✓
- **All tests pass clean** → Task 9 ✓

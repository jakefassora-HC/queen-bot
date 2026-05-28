# Jira Ticket Drafting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Queen Bot v2's first workflow slice: turn planning discussions into approved Jira ticket drafts.

**Architecture:** Keep the existing TypeScript CLI. Add focused modules for token budgeting, ticket draft prompt/parsing, and a `draft` subcommand. Jira creation remains in the host process and requires explicit human approval.

**Tech Stack:** Node.js, TypeScript, Jest, Jira REST v3, existing Claude CLI auth.

---

## File Structure

- `src/token-budget.ts`: rough token estimates and deterministic compaction.
- `src/ticket-draft.ts`: prompt construction, JSON parsing, and human preview rendering.
- `src/draft-command.ts`: CLI argument parsing and draft command orchestration.
- `src/jira.ts`: Jira ADF issue payload construction and issue creation.
- `src/types.ts`: shared draft and research types.
- `docs/specs/2026-05-28-jira-ticket-drafting-design.md`: approved product design.

## Task 1: Token Budgeting

**Files:**
- Create: `src/token-budget.ts`
- Test: `src/__tests__/token-budget.test.ts`

- [x] **Step 1: Write failing tests**
  - Test rough token estimation.
  - Test compaction stays under budget.
  - Test URLs are preserved.
  - Test token discipline mentions compact research, preserved URLs, and terse Jira language.

- [x] **Step 2: Verify red**
  - Run: `npm test -- --runTestsByPath src/__tests__/token-budget.test.ts`
  - Expected: fail because `token-budget.ts` does not exist.

- [x] **Step 3: Implement minimal module**
  - Add `estimateTokens`, `compactText`, and `TOKEN_DISCIPLINE`.

- [x] **Step 4: Verify green**
  - Run focused Jest tests.

## Task 2: Ticket Draft Prompt And Parser

**Files:**
- Create: `src/ticket-draft.ts`
- Modify: `src/types.ts`
- Test: `src/__tests__/ticket-draft.test.ts`

- [x] **Step 1: Write failing tests**
  - Prompt includes trusted task framing.
  - Prompt includes compact idea/research blocks.
  - Parser validates required draft fields.
  - Preview renders acceptance criteria and related repos.

- [x] **Step 2: Verify red**
  - Run focused Jest tests.
  - Expected: fail because `ticket-draft.ts` does not exist.

- [x] **Step 3: Implement minimal module**
  - Add `buildTicketDraftPrompt`, `parseTicketDrafts`, and `summarizeTicketDrafts`.

- [x] **Step 4: Verify green**
  - Run focused Jest tests.

## Task 3: Jira ADF Payloads

**Files:**
- Modify: `src/jira.ts`
- Test: `src/__tests__/jira.test.ts`

- [x] **Step 1: Write failing tests**
  - Test a draft converts to Jira project, summary, labels, issue type, and ADF description.

- [x] **Step 2: Verify red**
  - Run focused Jest tests.
  - Expected: fail because `buildCreateIssuePayload` is not exported.

- [x] **Step 3: Implement minimal payload builder**
  - Add stable ADF sections for problem, goal, non-goals, acceptance criteria, research notes, risks, definition of done, and related repos.

- [x] **Step 4: Add Jira create function**
  - Add `createIssueFromDraft` using existing Jira auth.

- [x] **Step 5: Verify green**
  - Run focused Jest tests.

## Task 4: Draft CLI Command

**Files:**
- Create: `src/draft-command.ts`
- Modify: `src/index.ts`
- Modify: `src/plan.ts`
- Test: `src/__tests__/draft-command.test.ts`

- [x] **Step 1: Write failing tests**
  - Parse `--file`, `--project`, and `--create`.
  - Parse optional `--source`.
  - Default sources include RTK and Caveman.

- [x] **Step 2: Verify red**
  - Run focused Jest tests.
  - Expected: fail because `draft-command.ts` does not exist.

- [x] **Step 3: Implement command module**
  - Add defaults, arg parsing, file read, prompt generation, model call, draft preview, and approval-gated Jira creation.

- [x] **Step 4: Wire command**
  - Route `agent-queue draft ...` from `src/index.ts`.
  - Export `runClaude` from `src/plan.ts` for shared model calls.

- [x] **Step 5: Verify green**
  - Run focused Jest tests.

## Task 5: Full Verification

**Files:**
- All changed files.

- [x] **Step 1: Run full tests**
  - Run: `npm test`
  - Expected: all tests pass.

- [x] **Step 2: Run TypeScript compile check**
  - Run: `npx tsc --noEmit`
  - Expected: no output, exit code 0.

- [x] **Step 3: Run git diff check**
  - Run: `git diff --check`
  - Expected: no whitespace errors.

- [ ] **Step 4: Commit and open PR**
  - Commit: `feat: add Jira ticket drafting`
  - Push branch: `codex/jira-ticket-drafting`
  - Open draft PR against `main`.

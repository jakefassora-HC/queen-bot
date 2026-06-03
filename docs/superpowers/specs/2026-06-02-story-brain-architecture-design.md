# Story Brain Architecture — Design Spec

## Problem

Queen Bot currently has three failure modes:
1. **Jira description pollution** — `plan --write` dumps the full Agent Q Plan into the Jira description, often twice. Jira should show the Goal and a path, not the full plan.
2. **Context fragmentation** — one `plan.md` per task means each agent starts cold. There's no persistent, shared document an agent can read to understand the full story and current state.
3. **Bootstrap failures** — the cmux handoff prompt pastes Goal text raw instead of using `/goal` as a slash command; `/auto` mode is not established before work begins; all handoff lines are space-joined losing all formatting.

---

## Solution: One Story Brain Per Story

### Core idea

Every story (parent Jira ticket) owns a single `story.md` file. All child task agents read from and write to this one file. It is the durable global memory for that story's full execution.

### Story brain file format

```
~/.agent-queue/plans/<owner>/<repo>/<parent-key>/story.md
```

```markdown
# Story AISOL-651: Auto-sync AI Toolshed

## Goal
[overarching story goal — Why, Constraints, Non-Goals, Success Criteria]

## Task Graph
- [ ] Task 1: DB schema (AISOL-652)
- [ ] Task 2: Ingestion pipeline (AISOL-653)
- [ ] Task 3: Admin UI (AISOL-654)
- [ ] Task 4: Edge Function + pg_cron (AISOL-655)

## Plan

### Task 1: DB schema (AISOL-652)
[Full spec-driven implementation plan]

### Task 2: Ingestion pipeline (AISOL-653)
[Full spec-driven implementation plan]

### Task 3: Admin UI (AISOL-654)
[Full spec-driven implementation plan]

### Task 4: Edge Function + pg_cron (AISOL-655)
[Full spec-driven implementation plan]

## Worktrees
[branch/worktree paths, updated as execution starts]

## Proof
[appended by agents after verification]

## Status
pending | in-progress | done
```

### Jira artifact policy

| Ticket | Jira description contains |
|--------|--------------------------|
| Story (651) | `## Goal` (structured) + `Story brain: ~/.agent-queue/plans/.../AISOL-651/story.md` |
| Task (652–655) | `## Goal` (structured) + `Story brain: ~/.agent-queue/plans/.../AISOL-651/story.md` |

Neither the story nor the tasks get the full plan written into Jira. Plan lives locally.

### Bootstrap sequence (one cmux terminal per story)

1. `execute-ready AISOL-651 --start` opens **one** cmux terminal named `AISOL-651`
2. Session launches with `claude --dangerously-skip-permissions` (auto mode)
3. Handoff message opens with `/goal` — reads `## Goal` from story.md
4. Agent reads full story.md for global context (task graph, current status, worktrees)
5. Agent works through tasks in order, updating Task Graph checkboxes
6. On completion, appends to `## Proof` in story.md and auto-posts to Jira

### Proof approval policy change

| Action | Old | New |
|--------|-----|-----|
| Create ticket | `APPROVE JIRA WRITE` | `APPROVE JIRA WRITE` |
| Write plan to Jira | `APPROVE JIRA PLAN` | `APPROVE JIRA PLAN` |
| Post proof comment | `APPROVE JIRA PROOF` | **auto** (queue + owner check only) |
| Start execution | `APPROVE EXECUTION` | `APPROVE EXECUTION` |

---

## What does NOT change

- Individual `plan.md` files per task can still exist at `~/.agent-queue/plans/.../AISOL-65X/plan.md` — they are not removed
- All approval gates except proof-comment remain unchanged
- `execute-ready` contract, preflight, and worktree setup are unchanged
- `readiness.ts` and `execution-command.ts` are unchanged

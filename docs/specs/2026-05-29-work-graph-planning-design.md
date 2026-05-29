# Queen Bot Work Graph Planning Design
_2026-05-29_

## What It Is

Queen Bot should treat Jira as a work graph, not as a place to store giant agent documents.

Jira owns the visible structure of work: parent tickets, child tickets, linked work items, follow-ups, fixes, proofs, and review notes. Local markdown owns the deep agent plan. The Jira description owns a compressed "Super PRD" that humans can scan quickly and agents can use as a stable execution contract.

## Core Rule

Jira tickets should usually be executable leaves.

- `1-5 points`: executable ticket.
- `8 points`: should have child tickets, phased work items, or linked execution tickets before running broad autonomy.
- `13+ points`: should sit at the top as initiative, epic, or parent-level work with linked child tickets or phased work items. The parent can remain open as the organizing ticket; execution should happen through the linked children.

Large work should become linked smaller work, not a huge description. A `13+` parent should not hold execution detail beyond the Super PRD.

## Super PRD

The Jira description should stay compact and stable. It should include:

- goal
- acceptance criteria
- implementation notes
- verification
- autonomy level
- forbidden actions
- local plan path

The description is the high-level contract. It should not become the full working plan.

The Super PRD should be strong enough that Jake can understand the plan without opening the full local markdown every time. The local markdown exists for agents and deep review; the Jira description exists for fast human scanning and execution gating.

## Local Full Plan

The detailed plan should live locally, keyed by Jira ticket:

```text
~/.agent-queue/plans/<ticket-key>/plan.md
```

The local plan can be long. It can include code investigation notes, repo-specific file references, phase breakdowns, model critiques, and implementation detail that would make Jira hard to read.

The Super PRD should link to this local path. That path is for Jake and local agents; it is not expected to be readable by other Jira users.

## Comments

Jira comments are the audit trail, not the plan store.

Use comments for:

- proof
- progress
- review notes
- Claude/Codex critique summaries
- "changed the plan because..." notes

If a plan change alters the Super PRD, Queen Bot should:

1. Update the Jira description.
2. Add a Jira comment explaining what changed and why.

If a plan change only affects the local markdown plan, Queen Bot should:

1. Update the local plan file.
2. Add a Jira comment summarizing the local plan revision and pointing to the local plan path.

## Linked Work Items

Queen Bot should build and maintain a web of related work.

Examples:

- A 13-point parent ticket links to smaller phase tickets.
- An 8-point ticket links to child execution tickets if it is still broad.
- A bug discovered while implementing a ticket links back to the original ticket.
- A follow-up cleanup ticket links to the ticket that created the follow-up.
- A model critique or review ticket can link to the plan it critiques if it becomes actionable work.

The point is traceability: Jake should be able to see why work exists and how it relates to surrounding work.

## Model Workflow

This is a future loop, not a current implementation requirement. Queen Bot should not depend on Codex CLI until Jake has it installed and intentionally wires it in.

Queen should be the persistent planning/control layer. Codex is the preferred control-plane author for plans because this workflow is being designed inside Codex and can stay local-first.

Claude execution workspaces should read the Codex-authored Jira context and local full plan. For larger or riskier tickets, Claude should critique the plan before implementation.

Suggested large-ticket loop:

1. Queen/Codex drafts or updates the Super PRD and local full plan.
2. Claude execution workspace reads the Jira ticket and local plan.
3. Claude critiques the plan and proposes improvements.
4. Queen/Codex reviews that critique.
5. If the Super PRD changes, Queen updates the Jira description and writes a comment explaining the change.
6. If only the local plan changes, Queen updates the local markdown and writes a short comment.
7. Execution starts only after the required approval checkpoint.

This may later support a `/exit`-style loop where a Claude execution workspace hands its critique back to the persistent Queen/Codex workspace.

## Approval Checkpoints

Execution approval should stay explicit.

Recommended checkpoint behavior:

- `1-3 points`: one plan approval plus one execution approval is usually enough.
- `5 points`: experiment; may need a lightweight model critique depending on risk.
- `8+ points`: require linked child/phased work or an explicit plan review checkpoint.
- `13+ points`: keep as top-level work with a Super PRD and linked children; do not execute directly from the parent.

The double-approval pattern can stay available. It should be purposeful rather than accidental: use it when the ticket size, risk, or ambiguity calls for a second review pass.

## Security Boundaries

- Local full plans may contain repo-specific detail and should stay on Jake's machine.
- Jira descriptions should contain the compressed Super PRD, not raw transcripts or secret-bearing logs.
- Jira comments should summarize plan changes and proof without dumping sensitive local context.
- Model critiques should be treated as untrusted until Queen/Codex accepts them into the local plan or Jira description.

## Future Implementation Slices

1. Add local full-plan file creation and path linking.
2. Add Super PRD rendering separate from full plan rendering.
3. Add ticket sizing policy warnings for `8+` and `13+` work.
4. Add linked-work helpers for parent/child/follow-up relationships.
5. Add comment templates for local plan revision summaries and Super PRD changes.
6. Add optional Claude critique loop for `5+` or high-risk tickets.
7. Add model routing policy for planner, reviewer, and executor roles after Codex CLI is available.

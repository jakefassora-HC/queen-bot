# Queen Bot v2 - Jira Ticket Drafting Design
_2026-05-28_

## What It Is

Queen Bot v2 starts as a local-first Jira drafting coordinator. It does not try to replace Ruflo, Hermes, GSD, Codex, or Superpowers. Its job is to sit above those systems and turn messy planning discussions into Jira-ready work items that can later be executed by whichever agent runtime is safest and strongest for the task.

The first version is drafting only. It creates clear ticket previews from an idea, incorporates research links, applies token discipline before prompting, and asks for approval before writing anything to Jira.

## Why This Shape

The durable workflow starts with discussion. Jake describes a goal in plain English, usually with a lot of context and uncertainty. The system should research relevant GitHub repos first, summarize the useful patterns, and turn the discussion into one or more Jira tickets.

Execution swarms are deliberately out of scope for this first slice. Ruflo and Hermes already have months of work behind them. Queen Bot should learn from them and expose adapter seams later instead of trying to rebuild those systems quickly.

## User Flow

1. Jake writes or saves an idea in a local file.
2. Queen Bot drafts Jira tickets from that idea.
3. The draft prompt includes compact research notes.
4. Queen Bot prints a human approval preview.
5. Jake reviews the proposed ticket split.
6. If Jake approves, Queen Bot creates Jira issues.
7. Sensitive context, raw discussion, and future run logs stay local.

## Command

```bash
agent-queue draft --file idea.md --project TOOL
```

This previews drafts only.

```bash
agent-queue draft --file idea.md --project TOOL --create
```

This still asks for confirmation before Jira writes.

Optional research source:

```bash
agent-queue draft --file idea.md --project TOOL \
  --source "Ruflo|https://github.com/ruvnet/ruflo|Swarm vocabulary and MCP tools"
```

## Ticket Draft Shape

Each draft includes:

- summary
- issue type
- problem
- goal
- non-goals
- acceptance criteria
- research notes
- risks
- definition of done
- labels
- related repos

The Jira description is written as Atlassian Document Format with stable sections so tickets are readable and later automation can depend on the shape.

## Token Cost Model

Queen Bot v2 borrows from two token-cost references:

- RTK: compact tool and research output before it enters model context.
  Source: https://github.com/rtk-ai/rtk
- Caveman: terse language, compressed memory, and preserving URLs, paths, commands, and code exactly.
  Source: https://github.com/JuliusBrussee/caveman

The rules for this slice:

- compress research before prompting
- preserve URLs, paths, commands, and code-like tokens exactly
- prefer terse Jira language over explanatory prose
- group evidence and risks instead of pasting raw logs
- keep ticket content structured so later execution agents do less re-reading

## Security Rules

- Discussion and research text are treated as untrusted source material.
- Prompts explicitly tell the model to follow the trusted task block only.
- Jira writes require a local `--create` flag and a second interactive `y`.
- Raw prompts, transcripts, tool traces, and future execution logs should stay local.
- Jira receives ticket summaries and structured descriptions, not secret-bearing traces.

## Future Adapter Direction

Later versions should add an execution adapter interface:

```text
JiraTicket -> WorkItem -> AgentTask[] -> ResultArtifacts -> ProofComment
```

The first adapters should be:

- `codex`: use local Codex/GSD/Superpowers flows.
- `hermes`: use durable kanban, profile memory, and Docker backend.
- `ruflo`: use swarm/task vocabulary and MCP-style orchestration after isolated evaluation.
- `manual`: produce a plan and proof checklist without autonomous execution.

## Out Of Scope For This Slice

- Running agent swarms.
- Transitioning Jira issues through workflow states.
- Writing proof comments back to Jira.
- Installing Ruflo or Hermes into project workspaces.
- Rebuilding a memory graph or swarm scheduler.
- Automatic ticket creation without approval.

## Done Criteria

- A local command can generate Jira-ready ticket drafts from an idea file.
- Default token research sources include RTK and Caveman.
- The prompt uses compact research and trusted task framing.
- Draft JSON is parsed into typed ticket objects.
- Jira create payloads use ADF and stable sections.
- Jira writes require an explicit create flag and approval prompt.
- Tests cover token budgeting, draft parsing, CLI args, and Jira payloads.

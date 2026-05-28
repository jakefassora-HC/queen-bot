# Queen Bot

Local-first Jira and agent workflow coordinator.

## Current Slice: Jira Ticket Drafting

Queen Bot v2 starts by turning planning discussions into Jira-ready ticket drafts. It researches useful source links, compresses context before prompting, prints a human approval preview, and only writes to Jira after an explicit create flag plus confirmation.

## Jira Setup

Create a local `.env` file:

```bash
cp .env.example .env
```

Set:

```bash
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=you@your-company.com
```

`JIRA_PROJECT` is optional for queue reads. When it is set, Queen Bot narrows the ticket queue to that project.

Store your Jira API token in macOS Keychain:

```bash
security add-generic-password -s agent-queue-jira -a $USER -w <jira-api-token>
```

Open the Jira-first planning queue:

```bash
npm start
```

The default view opens the Queen Bot planning dashboard with Current Sprint and Backlog sections, grouped-by-epic checkbox rows, readiness scores, parent context, and plan-next hints. It intentionally avoids tables so Claude does not compress the queue into a hard-to-read block. The dashboard shows every ticket in the queue by default.

Print the dashboard without entering terminal mode:

```bash
npm start -- dashboard
```

List assigned open tickets without planning prompts:

```bash
npm start -- list
```

Score assigned tickets for Jira-first execution readiness:

```bash
npm start -- readiness
```

Preview an Agent Q plan for a ticket:

```bash
npm start -- plan AISOL-465
npm start -- plan 9
```

Write an approved Agent Q plan back to Jira:

```bash
npm start -- plan AISOL-465 --write
```

Plan writes require reviewing the preview and typing `APPROVE JIRA PLAN`. Short approvals like `y`, `yes`, or auto-mode approval are intentionally ignored.

Print one ticket as Claude-ready context:

```bash
npm start -- show AISOL-465
npm start -- show 9
```

Use `list` and `show` from Claude slash commands. They only read Jira and print context, so the current Claude session can plan from the ticket without launching a nested Claude CLI.

Preview legacy cmux handoff commands:

```bash
npm start -- cmux AISOL-465 AISOL-540
```

Direct `cmux --start` is disabled in V3 because it bypasses the Jira plan and worktree execution contract. Use `execute-ready --start` for actual execution.

Preview Jira-plan-backed execution workspaces:

```bash
npm start -- execute-ready AISOL-465 AISOL-540
```

Start approved execution workspaces:

```bash
npm start -- execute-ready AISOL-465 AISOL-540 --start
```

Execution start requires every selected ticket to have a valid Agent Q plan, repo label, executable readiness score, and autonomy level `2` or `3`. It also requires typing `APPROVE EXECUTION`.

Each cmux workspace is named by ticket key and opens an interactive Claude session with an Agent Q handoff prompt. Claude starts by reading `agent-queue show <ticket-key>` in that workspace, uses Superpowers as the planning/TDD/debugging/verification protocol, then dispatches parallel agents for independent work after Jake approves the plan and autonomy level.

Run `--start` from a terminal inside cmux. By default cmux only allows processes started inside cmux to control workspaces; running `--start` from macOS Terminal or a Claude session outside cmux can fail with `Access denied` or `TabManager not available`.

Agent Queue does not require the newer `cmux new-workspace --name` flag; it creates the workspace with `--command` and renames it from inside cmux. If you intentionally change cmux socket access settings to allow external local processes, set `AGENT_QUEUE_ALLOW_EXTERNAL_CMUX=1` before running `--start`.

Preview drafts:

```bash
npm start -- draft --file idea.md --project TOOL
```

Create approved drafts:

```bash
npm start -- draft --file idea.md --project TOOL --create
```

Jira writes require reviewing the preview and typing `APPROVE JIRA WRITE`. Short approvals like `y`, `yes`, or auto-mode approval are intentionally ignored.

Preview proof collected by an agent:

```bash
npm start -- proof --file proof.json
```

Comment approved proof back to Jira:

```bash
npm start -- proof --file proof.json --comment
```

Proof comments require the ticket to be in the current Jira queue, reviewing the preview, and typing `APPROVE JIRA PROOF`.

Add research context:

```bash
npm start -- draft --file idea.md --project TOOL \
  --source "Ruflo|https://github.com/ruvnet/ruflo|Swarm vocabulary and MCP tools"
```

## Token Discipline

The draft flow borrows from:

- RTK: compact command and research output before it enters model context.
- Caveman: terse output, compressed memory, and exact preservation of URLs, paths, commands, and code.

Queen Bot keeps prompts structured and compact so later execution agents do less re-reading.

## Repo Discovery

Execution uses git worktrees. Before cloning, Queen Bot looks for an existing local checkout with a matching GitHub remote in:

- paths listed in `AGENT_QUEUE_REPO_PATHS` (use `:` between paths)
- `~/projects/<repo-name>`
- `~/projects/<repo-name>-v2`
- immediate folders under `~/projects`
- the managed fallback at `~/.agent-queue/repos/<repo-name>`

If no matching checkout exists, Queen Bot falls back to a managed clone. This avoids duplicate clones for repos already on disk while still keeping execution branches isolated.

## Safety

- Jira writes require `--create` and the exact interactive phrase `APPROVE JIRA WRITE`.
- Agent Q plan writes require `--write` and the exact interactive phrase `APPROVE JIRA PLAN`.
- Agent Q proof comments require `--comment` and the exact interactive phrase `APPROVE JIRA PROOF`.
- Agent Q execution workspaces require `--start` and the exact interactive phrase `APPROVE EXECUTION`.
- Auto mode is never Jira approval. Jake must explicitly approve every Jira write, plan write, and proof comment.
- Ticket text and research notes are treated as untrusted source material.
- Raw prompts, transcripts, and future execution logs should stay local.
- Ruflo, Hermes, Codex, and manual execution should be adapter targets, not hidden dependencies.

## Tests

```bash
npm test
```

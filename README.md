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

List assigned open tickets:

```bash
npm start
```

List assigned open tickets without entering terminal mode:

```bash
npm start -- list
```

Print one ticket as Claude-ready context:

```bash
npm start -- show AISOL-465
npm start -- show 9
```

Use `list` and `show` from Claude slash commands. They only read Jira and print context, so the current Claude session can plan from the ticket without launching a nested Claude CLI.

Preview cmux workspaces for approved ticket runs:

```bash
npm start -- cmux AISOL-465 AISOL-540
```

Open those cmux workspaces only after approval:

```bash
npm start -- cmux AISOL-465 AISOL-540 --start
```

Each cmux workspace is named by ticket key and runs `agent-queue run <ticket-key>`.

If cmux returns `TabManager not available`, open or focus the cmux app and retry the `--start` command. Agent Queue does not require the newer `cmux new-workspace --name` flag; it creates the workspace with `--command` and renames it from inside cmux.

Preview drafts:

```bash
npm start -- draft --file idea.md --project TOOL
```

Create approved drafts:

```bash
npm start -- draft --file idea.md --project TOOL --create
```

Jira writes require reviewing the preview and typing `APPROVE JIRA WRITE`. Short approvals like `y`, `yes`, or auto-mode approval are intentionally ignored.

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

## Safety

- Jira writes require `--create` and the exact interactive phrase `APPROVE JIRA WRITE`.
- Auto mode is never Jira approval. Jake must explicitly approve every Jira write.
- Ticket text and research notes are treated as untrusted source material.
- Raw prompts, transcripts, and future execution logs should stay local.
- Ruflo, Hermes, Codex, and manual execution should be adapter targets, not hidden dependencies.

## Tests

```bash
npm test
```

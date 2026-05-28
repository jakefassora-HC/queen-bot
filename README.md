# Queen Bot

Local-first Jira and agent workflow coordinator.

## Current Slice: Jira Ticket Drafting

Queen Bot v2 starts by turning planning discussions into Jira-ready ticket drafts. It researches useful source links, compresses context before prompting, prints a human approval preview, and only writes to Jira after an explicit create flag plus confirmation.

Preview drafts:

```bash
npm start -- draft --file idea.md --project TOOL
```

Create approved drafts:

```bash
npm start -- draft --file idea.md --project TOOL --create
```

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

- Jira writes require `--create` and an interactive `y`.
- Ticket text and research notes are treated as untrusted source material.
- Raw prompts, transcripts, and future execution logs should stay local.
- Ruflo, Hermes, Codex, and manual execution should be adapter targets, not hidden dependencies.

## Tests

```bash
npm test
```

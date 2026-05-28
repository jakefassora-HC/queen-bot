# /queen - Queen Bot

Open Queen Bot as a human-friendly Jira planning dashboard inside this Claude session. Do not launch a nested Claude process.

Run this command exactly once:

```bash
cd ~/projects/agent-queue && agent-queue dashboard
```

Show the dashboard output in chat:

- Do not call `/queen` from inside this command.
- Do not rerun the dashboard command unless Jake explicitly asks to refresh.
- Do not summarize, compact, reorder, or rewrite the ticket list.
- Always preserve the dashboard line breaks, headings, checkbox rows, and indentation from the CLI output.
- Keep every visible ticket from the CLI output; do not collapse tickets into one sentence.
- Never convert the dashboard to a Markdown table or box-drawing table; tables wrap badly and waste tokens.
- After the dashboard, add only: `Reply with one or more numbers/keys.`

When Jake selects tickets, run:

```bash
cd ~/projects/agent-queue && agent-queue show <ticket-number-or-key>
```

Use the ticket as the source of truth. If it lacks enough context, help Jake create an Agent Q plan first. Preview plans locally, then use `agent-queue plan <ticket> --write` only when Jake explicitly wants to write it and is ready to type `APPROVE JIRA PLAN`.

Plan writes must update the Jira description through `agent-queue plan <ticket> --write`. Do not use the Atlassian MCP, Jira MCP, or any direct Jira comment API to write Agent Q plans. Jira comments are only for proof, progress, or follow-up notes after a separate approved proof write.

For approved parallel execution, preview the Jira-backed execution contract first:

```bash
cd ~/projects/agent-queue && agent-queue execute-ready <ticket-number-or-key...>
```

Start cmux execution workspaces only after Jake approves and only from inside cmux:

```bash
cd ~/projects/agent-queue && agent-queue execute-ready <ticket-number-or-key...> --start
```

Jira writes are never auto-approved:

- Ticket creation requires `APPROVE JIRA WRITE`.
- Plan writes require `APPROVE JIRA PLAN`.
- Proof comments require `APPROVE JIRA PROOF`.
- Execution starts require `APPROVE EXECUTION`.
- `yes`, `y`, and auto mode are not Jira approval.

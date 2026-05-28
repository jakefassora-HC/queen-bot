# /queen-bot - Queen Bot

Open Queen Bot as a human-friendly Jira planning dashboard inside this Claude session. Do not launch a nested Claude process.

```bash
cd ~/projects/agent-queue && agent-queue dashboard
```

Render the output back to Jake in the chat as an expanded dashboard:

- Start with `Queen Bot planning dashboard`.
- Use Markdown checkboxes for tickets.
- Keep the dashboard readable: ticket key, readiness percent, status, parent/epic, summary, and next action.
- Do not paste a giant raw terminal wall unless Jake asks for raw output.
- Ask: "Which boxes should Queen Bot open up?"

When Jake selects tickets, run:

```bash
cd ~/projects/agent-queue && agent-queue show <ticket-number-or-key>
```

Use the ticket as the source of truth. If it lacks enough context, help Jake create an Agent Q plan first. Preview plans locally, then use `agent-queue plan <ticket> --write` only when Jake explicitly wants to write it and is ready to type `APPROVE JIRA PLAN`.

For approved parallel execution, preview cmux first:

```bash
cd ~/projects/agent-queue && agent-queue cmux <ticket-number-or-key...>
```

Start cmux only after Jake approves and only from inside cmux:

```bash
cd ~/projects/agent-queue && agent-queue cmux <ticket-number-or-key...> --start
```

Jira writes are never auto-approved:

- Ticket creation requires `APPROVE JIRA WRITE`.
- Plan writes require `APPROVE JIRA PLAN`.
- Proof comments require `APPROVE JIRA PROOF`.
- `yes`, `y`, and auto mode are not Jira approval.

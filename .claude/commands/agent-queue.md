# /agent-queue - Queen Bot alias

Use `/queen` or `/queen-bot` for the friendlier dashboard entrypoint.

Run Queen Bot inside this Claude session. Do not launch a nested Claude process.

```bash
cd ~/projects/agent-queue && agent-queue dashboard
```

Render the result back to Jake as a readable dashboard in the chat, not as a compressed Bash blob:

- Use Markdown checkboxes for each ticket: `- [ ] 1. AISOL-123 - 60% needs-planning`.
- Keep each ticket to summary, status, parent/epic, readiness reason, and next action.
- Ask: "Which boxes should Queen Bot open up?"
- If Jake gives numbers or keys, fetch each selected ticket with `agent-queue show <ticket-number-or-key>` and continue the planning conversation.

If a ticket is under-planned, help Jake draft an Agent Q plan and preview it. Never write Jira until Jake explicitly approves the CLI write step.

Jira write rules:

- Ticket creation requires `APPROVE JIRA WRITE`.
- Plan writes require `APPROVE JIRA PLAN`.
- Proof comments require `APPROVE JIRA PROOF`.
- Do not treat `yes`, `y`, or auto approval as Jira approval.

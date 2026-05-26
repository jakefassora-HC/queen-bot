# agent-queue

Personal CLI that turns Jira tickets into autonomous Claude Code sessions.

## What it does

```
$ agent-queue          # shows Jira queue
→ pick tickets         # multi-select
→ approve plan         # Claude generates, you approve
→ agent runs           # Claude-in-Docker (isolated) or Claude CLI (big tickets)
→ Slack DM             # draft PR link when done
```

## Running

```bash
npm test               # run all tests
npx tsx src/index.ts   # run the CLI
agent-queue status     # show active runs
```

## Stack

- Node.js 22 + TypeScript (tsx, no compile step)
- `@anthropic-ai/sdk` — plan generation only
- `claude --bare -p` — agent execution (CLI or in Docker)
- Native `fetch` — Jira, GitHub, Slack APIs
- Jest + ts-jest — tests
- Docker/OrbStack — container isolation

## Architecture

```
index.ts        CLI entrypoint
jira.ts         fetch Jira queue
plan.ts         generate + pre-screen implementation plans
route.ts        decide runtime (docker vs native)
worktree.ts     per-ticket git worktrees
spawn-docker.ts Claude Code in isolated Docker container (default)
spawn-native.ts Claude Code CLI natively (big tickets only)
pr.ts           host-side draft PR creation (agent never has GitHub token)
notify.ts       Slack DM on completion
state.ts        JSONL run state at ~/.agent-queue/runs.jsonl
models.ts       runtime + model config
policy.ts       blocked file patterns, risk rules
config.ts       secrets from macOS Keychain
types.ts        shared TypeScript types
```

## Key rules

- Plan is NEVER shell-interpolated — passed as file mount or spawn arg with `shell: false`
- Container mounts only the worktree — no `~/.ssh`, `~/.aws`, `~/.claude`
- `--network none` in Docker — no outbound from agent
- PR creation always on host — container has no GitHub token
- Draft PRs only — human reviews everything
- All secrets in macOS Keychain — never in dotfiles

## Secrets setup

```bash
bash setup.sh   # interactive — stores all secrets in Keychain
cp .env.example .env && nano .env   # non-secret config
```

#!/bin/bash
# agent-queue setup — run once after git clone

set -e

echo "agent-queue setup"
echo "─────────────────────"

# Secrets into Keychain
read -r -p "Jira API key: " jira_key
security add-generic-password -s agent-queue-jira -a "$USER" -w "$jira_key" -U

read -r -p "Slack bot token (xoxb-...): " slack_token
security add-generic-password -s agent-queue-slack -a "$USER" -w "$slack_token" -U

read -r -p "GitHub personal access token: " gh_token
security add-generic-password -s agent-queue-github -a "$USER" -w "$gh_token" -U

read -r -p "Anthropic API key: " anthropic_key
security add-generic-password -s agent-queue-anthropic -a "$USER" -w "$anthropic_key" -U

echo ""
echo "Secrets stored in Keychain ✓"
echo "Now copy .env.example to .env and fill in the non-secret values."

# ---------------------------------------------------------------------------
# Pre-push hook (run this manually in your TARGET repo, not agent-queue)
# ---------------------------------------------------------------------------
#
# To prevent the agent from pushing to any branch other than agent/* branches,
# add this hook to the target repo you are running agent-queue against:
#
#   cat > /path/to/your-repo/.git/hooks/pre-push << 'EOF'
#   #!/bin/bash
#   while read local_ref local_sha remote_ref remote_sha; do
#     if [[ "$local_ref" != refs/heads/agent/* ]]; then
#       echo "agent-queue: agents can only push to agent/ branches"
#       exit 1
#     fi
#   done
#   exit 0
#   EOF
#   chmod +x /path/to/your-repo/.git/hooks/pre-push
#
# This ensures that even if something goes wrong, the agent can never push
# to main, master, or any other protected branch.

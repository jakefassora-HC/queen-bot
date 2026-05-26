FROM node:22-slim

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Non-root user for extra isolation
RUN useradd -m -u 1001 agent
USER agent

WORKDIR /workspace

# Entrypoint: claude in bare/headless mode
ENTRYPOINT ["claude", "--bare", "--permission-mode", "dontAsk"]

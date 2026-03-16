FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
  git \
  bash \
  openssh-client \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

# Install CLI providers used by Claw-Empire agent runtime
RUN npm install -g \
  @anthropic-ai/claude-code \
  @openai/codex \
  @google/gemini-cli \
  opencode-ai

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Ensure runtime paths exist (Railway volumes may mount as root)
RUN mkdir -p /app/data /home/node/.claude /home/node/.codex /home/node/.gemini /home/node/.local/share/opencode

EXPOSE 8790

# Run as root so Railway volume mounts (owned by root) are writable.
# The container is isolated — this is standard for Railway deployments.
CMD ["pnpm", "start:tailscale"]

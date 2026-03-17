#!/bin/bash
set -e

# Fix volume ownership — Railway volumes mount as root
# but CLI tools (claude, codex, gemini) refuse to run as root
chown -R app:app /app/data 2>/dev/null || true
chown -R app:app /home/app 2>/dev/null || true

# Initialize git repo if not present (COPY doesn't include .git)
# Agent runner needs git worktrees for task isolation
if [ ! -d "/app/.git" ]; then
  cd /app
  git init --quiet
  git config user.email "studio@claw-empire.local"
  git config user.name "Content Studio"
  git add -A
  git commit -m "initial" --quiet --allow-empty 2>/dev/null || true
  chown -R app:app /app/.git
fi

# Ensure worktree directory exists and is writable
mkdir -p /app/.climpire-worktrees
chown -R app:app /app/.climpire-worktrees

# Drop to non-root user and exec the command
exec gosu app "$@"

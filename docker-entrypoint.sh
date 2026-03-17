#!/bin/bash
set -e

# ---------- Fix ownership for non-root user ----------
# Railway volumes mount as root, and CLI tools refuse to run as root.
# chown the entire /app so the 'app' user can:
#   - write to /app/.git  (worktree creation)
#   - write to /app/.climpire-worktrees
#   - create/modify files during agent execution
chown -R app:app /app 2>/dev/null || true
chown -R app:app /home/app 2>/dev/null || true

# ---------- Bootstrap git repo ----------
# Docker COPY doesn't include .git. Agent runner needs git worktrees.
if [ ! -d "/app/.git" ]; then
  cd /app

  # Create .gitignore BEFORE git add to skip large dirs
  cat > /app/.gitignore <<'EOF'
node_modules/
dist/
.climpire-worktrees/
.climpire/
*.log
.DS_Store
/data/
EOF

  git init --quiet -b main
  git config user.email "studio@claw-empire.local"
  git config user.name "Content Studio"
  git add -A
  git commit -m "initial" --quiet 2>/dev/null || true
  chown -R app:app /app/.git /app/.gitignore
fi

# ---------- Ensure worktree directory ----------
mkdir -p /app/.climpire-worktrees
chown app:app /app/.climpire-worktrees

# ---------- Drop to non-root user ----------
exec gosu app "$@"

#!/bin/bash
set -e

# ---------- Fix ownership for non-root user ----------
chown -R app:app /app 2>/dev/null || true
chown -R app:app /home/app 2>/dev/null || true

# ---------- Set git identity globally (needed before any git commit) ----------
git config --global user.email "studio@claw-empire.local"
git config --global user.name "Content Studio"
# Mark /app as safe for git operations under any user
git config --global --add safe.directory /app

# ---------- Bootstrap git repo ----------
if [ ! -d "/app/.git" ] || ! git -C /app rev-parse HEAD >/dev/null 2>&1; then
  cd /app
  echo "==> Bootstrapping git repo at /app..."

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

  # Init, add, commit — abort on failure (no silent suppress)
  git init --quiet -b main 2>/dev/null || git init --quiet
  git add -A
  git commit -m "initial" --quiet --allow-empty
  echo "==> Git repo initialized with $(git rev-parse --short HEAD)"
  chown -R app:app /app/.git /app/.gitignore
fi

# ---------- Ensure worktree directory ----------
mkdir -p /app/.climpire-worktrees
chown app:app /app/.climpire-worktrees

# ---------- Drop to non-root user ----------
exec gosu app "$@"

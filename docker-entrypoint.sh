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

# ---------- SQLite hourly backup ----------
BACKUP_DIR="/app/data/backups"
mkdir -p "$BACKUP_DIR"
chown app:app "$BACKUP_DIR"

# Background backup loop: every hour, keep last 24
(
  while true; do
    sleep 3600
    DB="/app/data/claw-empire.sqlite"
    if [ -f "$DB" ]; then
      STAMP=$(date +%Y%m%d_%H%M%S)
      cp "$DB" "$BACKUP_DIR/backup_${STAMP}.sqlite" 2>/dev/null && \
        echo "==> SQLite backup: backup_${STAMP}.sqlite"
      # Rotate: keep only last 24 backups
      ls -1t "$BACKUP_DIR"/backup_*.sqlite 2>/dev/null | tail -n +25 | xargs rm -f 2>/dev/null
    fi
  done
) &

# ---------- Drop to non-root user ----------
exec gosu app "$@"

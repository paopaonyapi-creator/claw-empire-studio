#!/bin/bash
set -e

# Fix volume ownership — Railway volumes mount as root
# but CLI tools (claude, codex, gemini) refuse to run as root
chown -R app:app /app/data 2>/dev/null || true
chown -R app:app /home/app 2>/dev/null || true

# Drop to non-root user and exec the command
exec gosu app "$@"

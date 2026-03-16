# Environment Variable Reference

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `8790` |
| `HOST` | Bind address | `0.0.0.0` |
| `OAUTH_ENCRYPTION_SECRET` | Encryption key for OAuth tokens | Random 32+ char string |
| `API_AUTH_TOKEN` | API authentication token | Random token |
| `INBOX_WEBHOOK_SECRET` | Webhook signature verification | Random secret |

## LLM Provider Keys

At least one is required for agent execution:

| Variable | Provider |
|----------|----------|
| `ANTHROPIC_API_KEY` | Claude (Anthropic) |
| `GOOGLE_AI_API_KEY` | Gemini (Google) |
| `OPENAI_API_KEY` | GPT (OpenAI) |
| `OPENROUTER_API_KEY` | OpenRouter (multi-model) |
| `GROQ_API_KEY` | Groq (fast inference) |

## Database & Storage

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_PATH` | SQLite database location | `data/claw-empire.sqlite` |
| `LOGS_DIR` | Execution logs directory | `data/logs` |

## Supabase (Optional)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side service role key (keep secret) |

## SQLite Tuning (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `SQLITE_BUSY_TIMEOUT_MS` | Write lock wait timeout | `5000` |
| `SQLITE_BUSY_RETRY_MAX_ATTEMPTS` | Max retry attempts on busy | `4` |
| `SQLITE_BUSY_RETRY_BASE_DELAY_MS` | Base backoff delay | `40` |
| `SQLITE_BUSY_RETRY_MAX_DELAY_MS` | Max backoff delay | `400` |
| `SQLITE_BUSY_RETRY_JITTER_MS` | Random jitter added to delay | `20` |

## Review System (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `REVIEW_MAX_ROUNDS` | Max review rounds per task | `3` |

## Process Management (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `IN_PROGRESS_ORPHAN_GRACE_MS` | Grace period before orphan cleanup | `600000` (10 min) |
| `IN_PROGRESS_ORPHAN_SWEEP_MS` | Orphan sweep interval | `30000` (30 sec) |
| `SUBTASK_DELEGATION_SWEEP_MS` | Subtask delegation check interval | `15000` (15 sec) |

## Security Notes

> **Never commit `.env` to version control.**

- Generate secrets with: `openssl rand -hex 32`
- Use different secrets for dev vs production
- Store production secrets in Railway Variables or VPS environment
- `SUPABASE_SERVICE_ROLE_KEY` provides full database access — never expose to clients

# Railway Deployment Guide

## Prerequisites

- [Railway account](https://railway.app)
- GitHub repository connected to Railway
- Environment variables ready (see [ENV_REFERENCE.md](./ENV_REFERENCE.md))

## Quick Deploy

### 1. Create a New Project

```
Railway Dashboard → New Project → Deploy from GitHub repo
```

Select the `claw-empire` repository and the `feature/affiliate-content-studio` branch (or `main` after merge).

### 2. Configure Environment Variables

In Railway → your service → Variables, add:

```bash
# Required
PORT=8790
HOST=0.0.0.0
OAUTH_ENCRYPTION_SECRET=<generate-a-random-32-char-string>
API_AUTH_TOKEN=<your-auth-token>
INBOX_WEBHOOK_SECRET=<your-webhook-secret>
NODE_ENV=production

# LLM Provider (at least one)
# Example for Claude:
ANTHROPIC_API_KEY=sk-ant-...

# Example for Gemini:
GOOGLE_AI_API_KEY=...

# Optional: Supabase (when ready)
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_ANON_KEY=eyJ...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. Configure Persistent Volume

SQLite data must survive redeploys:

```
Railway → Service → Settings → Volumes
Mount path: /app/data
Size: 1 GB (increase as needed)
```

### 4. Configure Domain

```
Railway → Service → Settings → Networking → Generate Domain
```

This gives you a `*.up.railway.app` domain. Optionally add a custom domain.

### 5. Deploy

Railway auto-deploys on push to the connected branch. Manual deploy:

```
Railway → Service → Deploy → Deploy Now
```

## Dockerfile

The included `Dockerfile` handles everything:
- Node.js 22 slim base
- pnpm dependency installation
- Production build
- Exposes port 8790

No modifications needed for Railway.

## Health Check

After deployment, verify:

```bash
curl https://your-app.up.railway.app/api/health
```

## Persistent Data

| Path | Content | Volume Required |
|------|---------|----------------|
| `/app/data/claw-empire.sqlite` | Database | ✅ Yes |
| `/app/data/logs/` | Execution logs | ✅ Yes |

## Scaling Notes

- Railway free plan: 500 hours/month, 512 MB RAM
- Pro plan: unlimited hours, 8 GB RAM
- For heavy usage (multiple concurrent agents), use Pro plan
- SQLite handles single-writer well; for multi-instance, migrate to Supabase Postgres

## Troubleshooting

| Issue | Solution |
|-------|----------|
| DB reset on redeploy | Ensure volume is mounted at `/app/data` |
| Port not accessible | Set `PORT=8790` and `HOST=0.0.0.0` |
| Build fails | Check Node.js version ≥ 22 in Dockerfile |
| Memory issues | Upgrade to Railway Pro plan |

# Local Development Setup

## Prerequisites

- **Node.js 22+** — `node --version` should show v22 or higher
- **pnpm** — install via `corepack enable && corepack prepare pnpm@latest --activate`
- **Git** — for version control

## Setup

```bash
# Clone the repository
git clone <repo-url>
cd claw-empire

# Install dependencies
pnpm install

# Create environment file
cp .env.example .env
```

## Required Environment Variables

Edit `.env` with at minimum:

```bash
# Server
PORT=8790
HOST=0.0.0.0

# Security (generate unique values)
OAUTH_ENCRYPTION_SECRET=your-random-32-char-string
API_AUTH_TOKEN=your-auth-token
INBOX_WEBHOOK_SECRET=your-webhook-secret
```

## Running

```bash
# Development mode (hot reload)
pnpm run dev

# The server starts on http://localhost:8790
# The frontend is served from the same port (Vite dev proxy)
# Open http://localhost:8800 in your browser
```

## Loading the Affiliate Content Studio Pack

1. Open the app at `http://localhost:8800`
2. Go to **Settings** (gear icon)
3. Under **Office Pack**, select **"Affiliate Content Studio"**
4. The system will hydrate 4 departments and 10 specialist agents
5. Navigate to the **Agent Manager** to see your team

## Testing

```bash
# Run all server tests
pnpm run test:api

# Run a specific test file
pnpm exec vitest run server/modules/workflow/packs/execution-guidance.test.ts
```

## Database

SQLite database is stored at `data/claw-empire.sqlite` by default.

```bash
# Override database location
DB_PATH=/path/to/custom.sqlite pnpm run dev

# Override logs directory
LOGS_DIR=/path/to/logs pnpm run dev
```

## Directory Structure

```
claw-empire/
├── server/                  # Express backend
│   ├── modules/
│   │   ├── workflow/
│   │   │   ├── packs/       # ★ Workflow pack definitions
│   │   │   ├── orchestration.ts
│   │   │   └── ...
│   │   ├── routes/          # API routes
│   │   └── bootstrap/       # DB schema + seeds
│   └── db/                  # Database runtime
├── src/                     # React frontend
├── docs/                    # Documentation
├── data/                    # SQLite + logs (gitignored)
└── templates/               # Office pack templates
```

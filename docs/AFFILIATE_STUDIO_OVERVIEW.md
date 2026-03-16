# Affiliate Content Studio

## What Is This?

An AI-operated content production system for solo affiliate creators. You act as the CEO — 10 AI specialist agents run your content pipeline.

## Architecture

```
┌─────────────────────────────────────────────┐
│                  CEO (You)                  │
│        $ directives  →  # tasks             │
└──────────────────┬──────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼───┐    ┌────▼────┐   ┌────▼─────┐   ┌──────▼────────┐
│Strategy│    │Production│  │ Creative │   │ Distribution  │
│& Insight│   │          │  │ Studio   │   │ & Analytics   │
├────────┤    ├──────────┤  ├──────────┤   ├───────────────┤
│Strategist│  │Writer    │  │Visual    │   │Calendar Mgr   │
│Trend     │  │Hook &    │  │Designer  │   │Publisher &    │
│Hunter    │  │Copy      │  │Video     │   │Community      │
│Audience  │  │Specialist│  │Script    │   │Performance    │
│Planner   │  │          │  │Producer  │   │Analyst        │
└──────────┘  └──────────┘  └──────────┘   └───────────────┘
```

## Content Pipeline

| # | Stage | Agent | Output |
|---|-------|-------|--------|
| 1 | Product Analysis | Chief Content Strategist | Product brief, value prop, objections |
| 2 | Audience Insight | Audience Insight Planner | Pain points, desires, triggers, language |
| 3 | Trend Scan | Trend Hunter | Trending formats, sounds, opportunities |
| 4 | Angle Selection | Chief Content Strategist | Ranked content angles for the product |
| 5 | Content Draft | Content Writer | Main copy with hook + CTA |
| 6 | Hook Generation | Hook & Copy Specialist | 5+ hook variants, 3+ CTAs |
| 7 | Visual Brief | Visual Designer | Image/thumbnail/carousel briefs |
| 8 | Video Scripts | Video Script Producer | 3 TikTok script variants with timing |
| 9 | Calendar Slot | Content Calendar Manager | Schedule with optimal timing |
| 10 | Publish Package | Publisher & Community Mgr | Copy-paste ready per-platform output |
| 11 | Post-Publish | Performance Analyst | Weekly performance report + learnings |

## Platforms

| Platform | Type | Key Action |
|----------|------|------------|
| **TikTok** | Primary | Affiliate basket (ปักตะกร้า) |
| **Facebook → Shopee** | Secondary | Post with affiliate link |
| **Facebook → Lazada** | Secondary | Post with affiliate link |
| Instagram Reels | Optional | Repurposed TikTok content |
| YouTube Shorts | Optional | Repurposed TikTok content |

## Quick Start

```bash
# 1. Clone and enter
git clone <repo-url> && cd claw-empire

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 4. Run locally
pnpm run dev

# 5. Open browser
open http://localhost:8800
```

Then in Settings → Office Pack, select **"Affiliate Content Studio"** to load the 4 departments and 10 agents.

## Key Files

| File | Purpose |
|------|---------|
| `server/modules/workflow/packs/definitions.ts` | Pack key + seed definition |
| `server/modules/workflow/packs/affiliate-studio-profile.ts` | 4 departments, 10 agents |
| `server/modules/workflow/packs/affiliate-studio-schemas.ts` | 16 structured output schemas |
| `server/modules/workflow/packs/execution-guidance.ts` | Agent execution instructions |
| `server/modules/routes/ops/workflow-packs.ts` | Routing keywords + classification |
| `docs/supabase-schema.sql` | Supabase data layer (14 tables) |

## Deployment Docs

- [LOCAL_DEV.md](./LOCAL_DEV.md) — Local development setup
- [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md) — Railway cloud deployment
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) — Supabase project setup
- [VPS_MIGRATION.md](./VPS_MIGRATION.md) — Railway → VPS migration
- [ENV_REFERENCE.md](./ENV_REFERENCE.md) — Environment variable reference

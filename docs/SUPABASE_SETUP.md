# Supabase Setup Guide

## When to Use Supabase

Supabase is **optional** for local development. The core app uses SQLite. Use Supabase when you want:

- **Persistent cloud data** — Products, content history, performance metrics
- **Cloud storage** — Content assets (images, thumbnails, videos)
- **Real-time sync** — Multi-device access to content pipeline
- **Analytics at scale** — Performance dashboards with SQL

## Setup Steps

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a name (e.g., `affiliate-studio`)
3. Set a database password (save this securely)
4. Select the region closest to you
5. Wait for provisioning (~2 minutes)

### 2. Run the Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. Open `docs/supabase-schema.sql` from this repository
3. Paste the entire contents into the SQL Editor
4. Click **Run**

This creates 14 tables with indexes, constraints, and RLS policies.

### 3. Create Storage Bucket

1. Go to **Storage** in the Supabase dashboard
2. Click **New Bucket**
3. Name: `content-assets`
4. Public: **No** (private by default)
5. File size limit: 50 MB

### 4. Get Connection Credentials

Go to **Settings → API** and copy:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJ...     # Safe for client-side
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-side only, NEVER expose to client
```

### 5. Add to Environment

Add these to your `.env` file (local) or Railway variables (production):

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Schema Overview

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `products` | Product catalog | name, url, platform, features |
| `affiliate_links` | Per-platform affiliate links | product_id, platform, url |
| `content_ideas` | Pre-production idea pipeline | angle, priority, status |
| `content_jobs` | Active content tracking | type, platform, status, copy |
| `content_assets` | Generated visual assets | storage_path, type |
| `publish_queue` | Ready-to-publish queue | scheduled_at, caption, hashtags |
| `comment_queue` | Comments with buying signals | signal_type, suggested_reply |
| `performance_daily` | Daily engagement metrics | views, clicks, conversions |
| `winning_hooks` | Library of proven hooks | hook_text, type, engagement_rate |
| `brand_memory` | Brand voice and preferences | key, value, category |
| `campaigns` | Campaign grouping | objective, product, dates |
| `trend_reports` | Daily trend analysis | formats, hooks, opportunities |
| `weekly_reports` | Weekly performance summaries | top/bottom performers |
| `audience_profiles` | Reusable audience personas | pain_points, desires |

## Security Notes

- RLS is enabled on all tables
- Default policy allows all authenticated users full access
- For production, create role-specific policies
- NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the browser

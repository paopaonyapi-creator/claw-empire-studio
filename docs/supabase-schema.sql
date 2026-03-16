-- ============================================================================
-- Affiliate Content Studio — Supabase Schema
-- ============================================================================
-- Run this in the Supabase SQL Editor to create the required tables.
-- All tables use IF NOT EXISTS for safe re-runs.
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. products
-- Purpose: Master product catalog for affiliate items
-- Used by: Trend Hunter, Audience Insight Planner, Content Writer
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price_range TEXT,
  product_url TEXT,
  image_url TEXT,
  affiliate_platform TEXT CHECK (affiliate_platform IN ('tiktok', 'shopee', 'lazada', 'other')),
  key_features JSONB DEFAULT '[]'::jsonb,
  value_proposition TEXT,
  unique_selling_points JSONB DEFAULT '[]'::jsonb,
  potential_objections JSONB DEFAULT '[]'::jsonb,
  commission_rate TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_platform ON products(affiliate_platform);

-- ============================================================================
-- 2. affiliate_links
-- Purpose: Track affiliate links per product per platform
-- Relationship: Many-to-one with products
-- ============================================================================
CREATE TABLE IF NOT EXISTS affiliate_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'shopee', 'lazada', 'facebook', 'instagram', 'other')),
  link_url TEXT NOT NULL,
  short_url TEXT,
  is_active BOOLEAN DEFAULT true,
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_links_product ON affiliate_links(product_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_platform ON affiliate_links(platform);

-- ============================================================================
-- 3. content_ideas
-- Purpose: Pipeline of content ideas before they become jobs
-- Used by: Chief Content Strategist, Trend Hunter
-- ============================================================================
CREATE TABLE IF NOT EXISTS content_ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content_angle TEXT,
  angle_type TEXT CHECK (angle_type IN ('educational', 'story', 'comparison', 'problem_solution', 'review', 'lifestyle', 'urgency')),
  target_platform TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT DEFAULT 'idea' CHECK (status IN ('idea', 'approved', 'in_production', 'completed', 'rejected')),
  audience_insight JSONB,
  hooks JSONB DEFAULT '[]'::jsonb,
  source TEXT, -- 'trend_report', 'manual', 'performance_insight'
  created_by TEXT, -- agent ID
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_ideas_status ON content_ideas(status);
CREATE INDEX IF NOT EXISTS idx_content_ideas_priority ON content_ideas(priority);

-- ============================================================================
-- 4. content_jobs
-- Purpose: Active content production tracking (idea → draft → review → done)
-- Used by: All production agents
-- Relationship: One-to-one with content_ideas (optional)
-- ============================================================================
CREATE TABLE IF NOT EXISTS content_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idea_id UUID REFERENCES content_ideas(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('tiktok_video', 'facebook_post', 'instagram_reel', 'carousel', 'story', 'youtube_short', 'thread')),
  target_platform TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'writing', 'hooks', 'visual', 'video_script', 'review', 'ready', 'scheduled', 'published')),
  assigned_agent TEXT,
  main_copy TEXT,
  hooks JSONB DEFAULT '[]'::jsonb,
  cta_variants JSONB DEFAULT '[]'::jsonb,
  visual_brief JSONB,
  video_script JSONB,
  publish_package JSONB,
  claw_empire_task_id TEXT, -- Link back to Claw-Empire task board
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_jobs_status ON content_jobs(status);
CREATE INDEX IF NOT EXISTS idx_content_jobs_platform ON content_jobs(target_platform);

-- ============================================================================
-- 5. content_assets
-- Purpose: Store generated assets (images, thumbnails, videos, carousels)
-- Used by: Visual Designer, Video Script Producer
-- Relationship: Many-to-one with content_jobs
-- ============================================================================
CREATE TABLE IF NOT EXISTS content_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES content_jobs(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'thumbnail', 'carousel_slide', 'video', 'audio', 'document')),
  storage_path TEXT, -- Supabase Storage path
  storage_bucket TEXT DEFAULT 'content-assets',
  file_name TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_assets_job ON content_assets(job_id);

-- ============================================================================
-- 6. publish_queue
-- Purpose: Ready-to-publish content with scheduling
-- Used by: Content Calendar Manager, Publisher
-- ============================================================================
CREATE TABLE IF NOT EXISTS publish_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES content_jobs(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  caption TEXT,
  hashtags JSONB DEFAULT '[]'::jsonb,
  affiliate_link_id UUID REFERENCES affiliate_links(id) ON DELETE SET NULL,
  posting_instructions TEXT,
  post_url TEXT, -- URL of the published post (filled after publishing)
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_publish_queue_status ON publish_queue(status);
CREATE INDEX IF NOT EXISTS idx_publish_queue_scheduled ON publish_queue(scheduled_at);

-- ============================================================================
-- 7. comment_queue
-- Purpose: Track comments with buying signals for community management
-- Used by: Publisher & Community Manager
-- ============================================================================
CREATE TABLE IF NOT EXISTS comment_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publish_id UUID REFERENCES publish_queue(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  comment_author TEXT,
  signal_type TEXT CHECK (signal_type IN ('buying_intent', 'price_question', 'availability', 'comparison', 'positive_review', 'objection', 'spam', 'general')),
  suggested_reply TEXT,
  reply_sent BOOLEAN DEFAULT false,
  reply_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comment_queue_signal ON comment_queue(signal_type);

-- ============================================================================
-- 8. performance_daily
-- Purpose: Daily content performance metrics
-- Used by: Performance Analyst
-- ============================================================================
CREATE TABLE IF NOT EXISTS performance_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publish_id UUID REFERENCES publish_queue(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  platform TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  basket_adds INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0,
  engagement_rate DECIMAL(8,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_performance_daily_date ON performance_daily(date);
CREATE INDEX IF NOT EXISTS idx_performance_daily_publish ON performance_daily(publish_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_performance_daily_unique ON performance_daily(publish_id, date);

-- ============================================================================
-- 9. winning_hooks
-- Purpose: Library of proven high-performing hooks for reuse
-- Used by: Hook & Copy Specialist, Performance Analyst
-- ============================================================================
CREATE TABLE IF NOT EXISTS winning_hooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hook_text TEXT NOT NULL,
  hook_type TEXT CHECK (hook_type IN ('question', 'bold_claim', 'story', 'curiosity_gap', 'pain_point', 'statistic', 'controversy')),
  platform TEXT,
  category TEXT, -- product category where this hook worked
  avg_engagement_rate DECIMAL(8,4),
  times_used INTEGER DEFAULT 1,
  best_performing_post_url TEXT,
  source_job_id UUID REFERENCES content_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_winning_hooks_type ON winning_hooks(hook_type);
CREATE INDEX IF NOT EXISTS idx_winning_hooks_engagement ON winning_hooks(avg_engagement_rate DESC);

-- ============================================================================
-- 10. brand_memory
-- Purpose: Store brand voice, style guidelines, and learned preferences
-- Used by: All agents (read), Chief Content Strategist (write)
-- ============================================================================
CREATE TABLE IF NOT EXISTS brand_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  category TEXT CHECK (category IN ('voice', 'style', 'preference', 'audience', 'platform_rules', 'learned', 'other')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_memory_category ON brand_memory(category);

-- ============================================================================
-- OPTIONAL TABLES (create when needed)
-- ============================================================================

-- 11. campaigns — Group content around campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  objective TEXT CHECK (objective IN ('reach', 'engagement', 'sales', 'authority', 'brand')),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'paused', 'completed')),
  budget_notes TEXT,
  target_metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. trend_reports — Store daily trend analysis
CREATE TABLE IF NOT EXISTS trend_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_date DATE NOT NULL,
  platform TEXT,
  trending_formats JSONB DEFAULT '[]'::jsonb,
  trending_hooks JSONB DEFAULT '[]'::jsonb,
  product_opportunities JSONB DEFAULT '[]'::jsonb,
  seasonal_hooks JSONB DEFAULT '[]'::jsonb,
  generated_by TEXT, -- agent ID
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trend_reports_date ON trend_reports(report_date DESC);

-- 13. weekly_reports — Store weekly performance summaries
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  report_data JSONB NOT NULL,
  top_performers JSONB DEFAULT '[]'::jsonb,
  patterns_to_repeat JSONB DEFAULT '[]'::jsonb,
  patterns_to_stop JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  generated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. audience_profiles — Reusable audience persona snapshots
CREATE TABLE IF NOT EXISTS audience_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  segment_description TEXT,
  pain_points JSONB DEFAULT '[]'::jsonb,
  desires JSONB DEFAULT '[]'::jsonb,
  objections JSONB DEFAULT '[]'::jsonb,
  emotional_triggers JSONB DEFAULT '[]'::jsonb,
  language_patterns JSONB DEFAULT '[]'::jsonb,
  product_categories JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- Row Level Security (RLS)
-- Enable RLS on all tables. Policies should be added based on your auth model.
-- ============================================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE publish_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE winning_hooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Default RLS policies (allow authenticated users full access)
-- Adjust these for your specific auth requirements
-- ============================================================================
DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN 
    SELECT unnest(ARRAY[
      'products', 'affiliate_links', 'content_ideas', 'content_jobs',
      'content_assets', 'publish_queue', 'comment_queue', 'performance_daily',
      'winning_hooks', 'brand_memory', 'campaigns', 'trend_reports',
      'weekly_reports', 'audience_profiles'
    ])
  LOOP
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      'allow_auth_' || tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================================================
-- Storage bucket for content assets
-- Run this via Supabase Dashboard > Storage > New Bucket
-- or via the Supabase JS client:
--   supabase.storage.createBucket('content-assets', { public: false })
-- ============================================================================
-- Note: Supabase Storage buckets cannot be created via SQL.
-- Create a bucket named "content-assets" via the Dashboard.

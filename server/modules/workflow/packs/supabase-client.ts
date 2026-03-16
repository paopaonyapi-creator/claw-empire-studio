/**
 * Affiliate Content Studio — Supabase Client Module
 *
 * Provides a typed Supabase client for the Affiliate Content Studio.
 * All Supabase operations are optional fallbacks — the app runs fine
 * with SQLite only (Supabase is for cloud persistence layer).
 *
 * Usage:
 *   import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.ts";
 *   if (isSupabaseConfigured()) {
 *     const client = getSupabaseClient();
 *     // ... use client
 *   }
 */

// ---------------------------------------------------------------------------
// Types for Supabase tables (mirrors docs/supabase-schema.sql)
// ---------------------------------------------------------------------------

export interface Product {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  price_range?: string;
  product_url?: string;
  image_url?: string;
  affiliate_platform?: "tiktok" | "shopee" | "lazada" | "other";
  key_features?: string[];
  value_proposition?: string;
  unique_selling_points?: string[];
  potential_objections?: string[];
  commission_rate?: string;
  status?: "active" | "paused" | "archived";
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface AffiliateLink {
  id?: string;
  product_id: string;
  platform: "tiktok" | "shopee" | "lazada" | "facebook" | "instagram" | "other";
  link_url: string;
  short_url?: string;
  is_active?: boolean;
  click_count?: number;
  conversion_count?: number;
}

export interface ContentIdea {
  id?: string;
  product_id?: string;
  title: string;
  content_angle?: string;
  angle_type?: "educational" | "story" | "comparison" | "problem_solution" | "review" | "lifestyle" | "urgency";
  target_platform?: string;
  priority?: "high" | "medium" | "low";
  status?: "idea" | "approved" | "in_production" | "completed" | "rejected";
  audience_insight?: Record<string, unknown>;
  hooks?: string[];
  source?: string;
  created_by?: string;
}

export interface ContentJob {
  id?: string;
  idea_id?: string;
  product_id?: string;
  title: string;
  content_type: "tiktok_video" | "facebook_post" | "instagram_reel" | "carousel" | "story" | "youtube_short" | "thread";
  target_platform: string;
  status?: string;
  assigned_agent?: string;
  main_copy?: string;
  hooks?: unknown[];
  cta_variants?: unknown[];
  visual_brief?: Record<string, unknown>;
  video_script?: Record<string, unknown>;
  publish_package?: Record<string, unknown>;
  claw_empire_task_id?: string;
}

export interface PerformanceDaily {
  id?: string;
  publish_id: string;
  date: string;
  platform: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  basket_adds?: number;
  conversions?: number;
  revenue?: number;
  engagement_rate?: number;
}

export interface WinningHook {
  id?: string;
  hook_text: string;
  hook_type?: "question" | "bold_claim" | "story" | "curiosity_gap" | "pain_point" | "statistic" | "controversy";
  platform?: string;
  category?: string;
  avg_engagement_rate?: number;
  times_used?: number;
  best_performing_post_url?: string;
  source_job_id?: string;
}

export interface BrandMemoryEntry {
  id?: string;
  key: string;
  value: Record<string, unknown>;
  category?: "voice" | "style" | "preference" | "audience" | "platform_rules" | "learned" | "other";
  description?: string;
}

// ---------------------------------------------------------------------------
// Client configuration
// ---------------------------------------------------------------------------

interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

function getConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  return {
    url,
    anonKey,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/**
 * Check if Supabase environment variables are configured.
 */
export function isSupabaseConfigured(): boolean {
  return getConfig() !== null;
}

// ---------------------------------------------------------------------------
// Lightweight REST client (no external dependency)
// ---------------------------------------------------------------------------

class SupabaseRestClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: SupabaseConfig) {
    this.baseUrl = `${config.url}/rest/v1`;
    const authKey = config.serviceRoleKey || config.anonKey;
    this.headers = {
      apikey: config.anonKey,
      Authorization: `Bearer ${authKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<{ data: T | null; error: string | null }> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { ...this.headers, ...extraHeaders },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { data: null, error: `${response.status}: ${errorText}` };
      }

      const data = (await response.json()) as T;
      return { data, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { data: null, error: message };
    }
  }

  // --- Products ---

  async upsertProduct(product: Product): Promise<{ data: Product | null; error: string | null }> {
    const result = await this.request<Product[]>("POST", "/products", product, {
      Prefer: "return=representation,resolution=merge-duplicates",
    });
    return { data: result.data?.[0] ?? null, error: result.error };
  }

  async getProducts(
    status: string = "active",
    limit: number = 50,
  ): Promise<{ data: Product[]; error: string | null }> {
    const result = await this.request<Product[]>(
      "GET",
      `/products?status=eq.${status}&order=created_at.desc&limit=${limit}`,
    );
    return { data: result.data ?? [], error: result.error };
  }

  // --- Content Ideas ---

  async createContentIdea(idea: ContentIdea): Promise<{ data: ContentIdea | null; error: string | null }> {
    const result = await this.request<ContentIdea[]>("POST", "/content_ideas", idea);
    return { data: result.data?.[0] ?? null, error: result.error };
  }

  async getContentIdeas(
    status: string = "idea",
    limit: number = 20,
  ): Promise<{ data: ContentIdea[]; error: string | null }> {
    const result = await this.request<ContentIdea[]>(
      "GET",
      `/content_ideas?status=eq.${status}&order=created_at.desc&limit=${limit}`,
    );
    return { data: result.data ?? [], error: result.error };
  }

  // --- Content Jobs ---

  async createContentJob(job: ContentJob): Promise<{ data: ContentJob | null; error: string | null }> {
    const result = await this.request<ContentJob[]>("POST", "/content_jobs", job);
    return { data: result.data?.[0] ?? null, error: result.error };
  }

  async updateContentJob(
    id: string,
    updates: Partial<ContentJob>,
  ): Promise<{ data: ContentJob | null; error: string | null }> {
    const result = await this.request<ContentJob[]>("PATCH", `/content_jobs?id=eq.${id}`, updates);
    return { data: result.data?.[0] ?? null, error: result.error };
  }

  // --- Performance ---

  async recordPerformance(
    entry: PerformanceDaily,
  ): Promise<{ data: PerformanceDaily | null; error: string | null }> {
    const result = await this.request<PerformanceDaily[]>("POST", "/performance_daily", entry, {
      Prefer: "return=representation,resolution=merge-duplicates",
    });
    return { data: result.data?.[0] ?? null, error: result.error };
  }

  async getPerformanceSummary(
    days: number = 7,
  ): Promise<{ data: PerformanceDaily[]; error: string | null }> {
    const since = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
    const result = await this.request<PerformanceDaily[]>(
      "GET",
      `/performance_daily?date=gte.${since}&order=date.desc`,
    );
    return { data: result.data ?? [], error: result.error };
  }

  // --- Winning Hooks ---

  async saveWinningHook(hook: WinningHook): Promise<{ data: WinningHook | null; error: string | null }> {
    const result = await this.request<WinningHook[]>("POST", "/winning_hooks", hook);
    return { data: result.data?.[0] ?? null, error: result.error };
  }

  async getTopHooks(
    limit: number = 20,
  ): Promise<{ data: WinningHook[]; error: string | null }> {
    const result = await this.request<WinningHook[]>(
      "GET",
      `/winning_hooks?order=avg_engagement_rate.desc.nullslast&limit=${limit}`,
    );
    return { data: result.data ?? [], error: result.error };
  }

  // --- Brand Memory ---

  async setBrandMemory(entry: BrandMemoryEntry): Promise<{ data: BrandMemoryEntry | null; error: string | null }> {
    const result = await this.request<BrandMemoryEntry[]>("POST", "/brand_memory", entry, {
      Prefer: "return=representation,resolution=merge-duplicates",
    });
    return { data: result.data?.[0] ?? null, error: result.error };
  }

  async getBrandMemory(
    category?: string,
  ): Promise<{ data: BrandMemoryEntry[]; error: string | null }> {
    const filter = category ? `?category=eq.${category}` : "";
    const result = await this.request<BrandMemoryEntry[]>("GET", `/brand_memory${filter}`);
    return { data: result.data ?? [], error: result.error };
  }
}

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

let _client: SupabaseRestClient | null = null;

/**
 * Get the Supabase REST client. Returns null if not configured.
 */
export function getSupabaseClient(): SupabaseRestClient | null {
  if (_client) return _client;

  const config = getConfig();
  if (!config) return null;

  _client = new SupabaseRestClient(config);
  return _client;
}

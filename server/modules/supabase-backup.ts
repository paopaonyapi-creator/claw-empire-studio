/**
 * Supabase Backup — Auto-sync tasks, links, products to Supabase cloud
 *
 * Periodic backup + on-demand sync
 */

import type { Express } from "express";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Supabase Helper
// ---------------------------------------------------------------------------

async function supabaseUpsert(table: string, rows: Record<string, unknown>[]): Promise<{ ok: boolean; count: number; error?: string }> {
  if (!SUPABASE_URL || !SUPABASE_KEY || rows.length === 0) {
    return { ok: false, count: 0, error: "Supabase not configured or no data" };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify(rows),
    });

    if (res.ok) {
      return { ok: true, count: rows.length };
    }

    const text = await res.text();
    return { ok: false, count: 0, error: `${res.status}: ${text.slice(0, 100)}` };
  } catch (e: unknown) {
    return { ok: false, count: 0, error: String(e) };
  }
}

// ---------------------------------------------------------------------------
// Data Fetchers
// ---------------------------------------------------------------------------

async function fetchLocalTasks(): Promise<Record<string, unknown>[]> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/tasks`);
    if (!res.ok) return [];
    const data = (await res.json()) as { tasks?: Array<Record<string, unknown>> };
    return (data.tasks || []).map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      agent_id: t.agent_id,
      output: typeof t.output === "string" ? t.output.slice(0, 5000) : null,
      created_at: t.created_at,
      updated_at: t.updated_at || new Date().toISOString(),
    }));
  } catch { return []; }
}

async function fetchLocalLinks(): Promise<Record<string, unknown>[]> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/links`);
    if (!res.ok) return [];
    const data = (await res.json()) as { links?: Array<Record<string, unknown>> };
    return (data.links || []).map(l => ({
      id: l.id || l.shortCode,
      short_code: l.shortCode,
      original_url: l.originalUrl,
      label: l.label,
      clicks: l.clicks || 0,
      created_at: l.createdAt,
    }));
  } catch { return []; }
}

async function fetchLocalProducts(): Promise<Record<string, unknown>[]> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/products`);
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: Array<Record<string, unknown>> };
    return (data.products || []).map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      url: p.url,
      platform: p.platform,
      pipeline_count: p.pipelineCount || 0,
      created_at: p.createdAt,
    }));
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Sync Execution
// ---------------------------------------------------------------------------

interface SyncResult {
  tasks: { ok: boolean; count: number; error?: string };
  links: { ok: boolean; count: number; error?: string };
  products: { ok: boolean; count: number; error?: string };
  timestamp: string;
}

async function runFullSync(): Promise<SyncResult> {
  const [tasks, links, products] = await Promise.all([
    fetchLocalTasks(),
    fetchLocalLinks(),
    fetchLocalProducts(),
  ]);

  const [taskResult, linkResult, productResult] = await Promise.all([
    supabaseUpsert("tasks", tasks),
    supabaseUpsert("links", links),
    supabaseUpsert("products", products),
  ]);

  return {
    tasks: taskResult,
    links: linkResult,
    products: productResult,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// TG Command
// ---------------------------------------------------------------------------

export async function handleSyncCommand(): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return "⚠️ Supabase ยังไม่ได้ตั้งค่า\n\nต้องเพิ่ม SUPABASE_URL และ SUPABASE_ANON_KEY ใน Railway";
  }

  const result = await runFullSync();

  return (
    `☁️ <b>Supabase Sync</b>\n\n` +
    `📋 Tasks: ${result.tasks.ok ? "✅ " + result.tasks.count : "❌ " + result.tasks.error}\n` +
    `🔗 Links: ${result.links.ok ? "✅ " + result.links.count : "❌ " + result.links.error}\n` +
    `📦 Products: ${result.products.ok ? "✅ " + result.products.count : "❌ " + result.products.error}\n\n` +
    `⏰ ${new Date().toLocaleTimeString("th-TH")}`
  );
}

// ---------------------------------------------------------------------------
// Scheduler — auto-sync every 6 hours
// ---------------------------------------------------------------------------

let syncTimer: ReturnType<typeof setInterval> | null = null;

export function startSupabaseBackupScheduler(): void {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log("[Supabase Backup] ⚠️ Not configured, skipping auto-sync");
    return;
  }

  // Sync every 6 hours
  syncTimer = setInterval(async () => {
    try {
      const result = await runFullSync();
      console.log(
        `[Supabase Backup] ✅ Synced: tasks=${result.tasks.count}, links=${result.links.count}, products=${result.products.count}`,
      );
    } catch (e) {
      console.error("[Supabase Backup] ❌ Sync failed:", e);
    }
  }, 6 * 60 * 60 * 1000); // 6 hours

  // Also do initial sync after 30 seconds
  setTimeout(() => {
    runFullSync()
      .then(r => console.log(`[Supabase Backup] ✅ Initial sync: tasks=${r.tasks.count}, links=${r.links.count}, products=${r.products.count}`))
      .catch(() => {});
  }, 30000);

  console.log("[Supabase Backup] ✅ Auto-sync every 6h");
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerSupabaseBackupRoutes(app: Express): void {
  // Manual sync trigger
  app.post("/api/supabase/sync", async (_req, res) => {
    const result = await runFullSync();
    res.json({ ok: true, ...result });
  });

  // Sync status
  app.get("/api/supabase/backup-status", (_req, res) => {
    res.json({
      ok: true,
      configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
      supabaseUrl: SUPABASE_URL ? SUPABASE_URL.slice(0, 30) + "..." : "not set",
      autoSync: syncTimer !== null,
      interval: "6h",
    });
  });
}

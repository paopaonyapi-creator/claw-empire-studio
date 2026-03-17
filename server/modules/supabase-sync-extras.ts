/**
 * Supabase Sync — Periodic backup of SQLite data to Supabase cloud
 *
 * Syncs: tasks, agents, content_archive, settings
 * Runs every 10 minutes when SUPABASE_URL is configured.
 *
 * Also provides content calendar API and auto-post framework.
 */

import type { DatabaseSync } from "node:sqlite";
import { getSupabaseClient, isSupabaseConfigured } from "./workflow/packs/supabase-client.ts";

const SYNC_INTERVAL_MS = 600_000; // 10 minutes

// ---------------------------------------------------------------------------
// Supabase Sync
// ---------------------------------------------------------------------------

async function syncToSupabase(db: DatabaseSync): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    // 1. Sync completed tasks as content jobs
    const doneTasks = db
      .prepare(
        `SELECT id, title, description, result, status, assigned_agent_id, department_id,
                created_at, completed_at, task_type, workflow_pack_key
         FROM tasks WHERE status = 'done' AND completed_at > ?
         ORDER BY completed_at DESC LIMIT 50`,
      )
      .all(Date.now() - 24 * 60 * 60 * 1000) as Array<{
      id: string;
      title: string;
      description: string | null;
      result: string | null;
      status: string;
      assigned_agent_id: string | null;
      department_id: string | null;
      created_at: number;
      completed_at: number;
      task_type: string | null;
      workflow_pack_key: string | null;
    }>;

    let synced = 0;
    for (const task of doneTasks) {
      const agentRow = task.assigned_agent_id
        ? (db.prepare("SELECT name FROM agents WHERE id = ?").get(task.assigned_agent_id) as { name?: string } | undefined)
        : undefined;

      const contentJob = {
        id: task.id,
        title: task.title,
        content_type: "tiktok_video" as const,
        target_platform: "tiktok",
        status: task.status,
        assigned_agent: agentRow?.name || task.assigned_agent_id || undefined,
        main_copy: task.result || task.description || undefined,
        claw_empire_task_id: task.id,
      };

      const { error } = await client.createContentJob(contentJob);
      if (!error) synced++;
    }

    if (synced > 0) {
      console.log(`[SupabaseSync] ☁️ Synced ${synced} completed tasks to Supabase`);
    }

    // 2. Sync agent stats as brand memory
    const agentStats = db
      .prepare("SELECT id, name, stats_tasks_done, stats_xp, status FROM agents ORDER BY stats_xp DESC LIMIT 20")
      .all() as Array<{ id: string; name: string; stats_tasks_done: number; stats_xp: number; status: string }>;

    const statsSnapshot = {
      key: "agent_stats_snapshot",
      category: "learned" as const,
      value: {
        timestamp: Date.now(),
        agents: agentStats.map((a) => ({
          name: a.name,
          tasks_done: a.stats_tasks_done,
          xp: a.stats_xp,
          status: a.status,
        })),
      } as Record<string, unknown>,
    };

    await client.setBrandMemory(statsSnapshot);
    console.log(`[SupabaseSync] ☁️ Agent stats snapshot saved`);
  } catch (err) {
    console.error("[SupabaseSync] ❌ Sync failed:", err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// Content Calendar API
// ---------------------------------------------------------------------------

export function registerContentCalendarRoutes(app: any, db: DatabaseSync): void {
  // GET /api/content-calendar?days=30 — show content by date
  app.get("/api/content-calendar", (req: any, res: any) => {
    const days = Math.min(Number(req.query?.days) || 30, 90);
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const tasks = db
      .prepare(
        `SELECT id, title, status, created_at, completed_at, assigned_agent_id, department_id, task_type
         FROM tasks
         WHERE created_at > ?
         ORDER BY created_at DESC`,
      )
      .all(since) as Array<{
      id: string;
      title: string;
      status: string;
      created_at: number;
      completed_at: number | null;
      assigned_agent_id: string | null;
      department_id: string | null;
      task_type: string | null;
    }>;

    // Group by date (Bangkok time)
    const calendar: Record<string, Array<{ id: string; title: string; status: string; agent: string | null; type: string | null }>> = {};

    for (const task of tasks) {
      const date = new Date(task.created_at + 7 * 60 * 60 * 1000);
      const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

      if (!calendar[dateKey]) calendar[dateKey] = [];

      let agentName: string | null = null;
      if (task.assigned_agent_id) {
        const agentRow = db.prepare("SELECT name FROM agents WHERE id = ?").get(task.assigned_agent_id) as { name?: string } | undefined;
        agentName = agentRow?.name || null;
      }

      calendar[dateKey].push({
        id: task.id,
        title: task.title,
        status: task.status,
        agent: agentName,
        type: task.task_type,
      });
    }

    // Scheduled tasks (from content-scheduler)
    const scheduledDaily = [
      { time: "07:00", title: "Trend Report", type: "research" },
      { time: "09:00", title: "Script Writing", type: "content" },
      { time: "14:00", title: "Thumbnail Brief", type: "design" },
      { time: "20:00", title: "Daily Summary (TG)", type: "summary" },
    ];

    res.json({
      ok: true,
      calendar,
      scheduled_daily: scheduledDaily,
      total_tasks: tasks.length,
      date_range: { from: new Date(since).toISOString().split("T")[0], days },
    });
  });

  // GET /api/content-calendar/today — quick view of today's tasks
  app.get("/api/content-calendar/today", (_req: any, res: any) => {
    const now = new Date(Date.now() + 7 * 60 * 60 * 1000); // Bangkok
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime() - 7 * 60 * 60 * 1000;
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    const tasks = db
      .prepare(
        `SELECT t.id, t.title, t.status, t.created_at, t.completed_at,
                a.name as agent_name, t.task_type
         FROM tasks t
         LEFT JOIN agents a ON t.assigned_agent_id = a.id
         WHERE t.created_at >= ? AND t.created_at < ?
         ORDER BY t.created_at ASC`,
      )
      .all(todayStart, todayEnd) as Array<{
      id: string;
      title: string;
      status: string;
      created_at: number;
      completed_at: number | null;
      agent_name: string | null;
      task_type: string | null;
    }>;

    const done = tasks.filter((t) => t.status === "done").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const total = tasks.length;

    res.json({
      ok: true,
      date: now.toISOString().split("T")[0],
      tasks,
      summary: { total, done, in_progress: inProgress, pending: total - done - inProgress },
    });
  });
}

// ---------------------------------------------------------------------------
// Auto-Post Framework
// ---------------------------------------------------------------------------

export function registerAutoPostRoutes(app: any, db: DatabaseSync): void {
  // POST /api/auto-post/draft — Create a post draft from completed task
  app.post("/api/auto-post/draft", (req: any, res: any) => {
    const { task_id, platform = "tiktok" } = req.body ?? {};

    if (!task_id) return res.status(400).json({ error: "task_id required" });

    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(task_id) as {
      id: string;
      title: string;
      result: string | null;
      description: string | null;
      status: string;
    } | undefined;

    if (!task) return res.status(404).json({ error: "task not found" });

    const content = task.result || task.description || "";

    // Generate platform-specific draft
    let draft: { caption: string; hashtags: string[]; cta: string; platform: string; suggested_time: string };

    if (platform === "tiktok") {
      const hashtags = ["#affiliate", "#ปักตะกร้า", "#รีวิว", "#สินค้าดี", "#สินค้าราคาถูก"];
      draft = {
        caption: content.slice(0, 150),
        hashtags,
        cta: "ปักตะกร้า 🛒 ลิงก์ในโปรไฟล์!",
        platform: "tiktok",
        suggested_time: "18:00-20:00 BKK",
      };
    } else {
      draft = {
        caption: content.slice(0, 300),
        hashtags: ["#affiliate", "#shopee", "#lazada"],
        cta: "สั่งซื้อได้ที่ลิงก์ด้านล่าง 👇",
        platform: "facebook",
        suggested_time: "12:00-14:00 BKK",
      };
    }

    // Store draft
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS post_drafts (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          platform TEXT NOT NULL,
          caption TEXT,
          hashtags TEXT,
          cta TEXT,
          suggested_time TEXT,
          status TEXT DEFAULT 'draft',
          created_at INTEGER NOT NULL
        )
      `);

      const draftId = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      db.prepare(
        `INSERT INTO post_drafts (id, task_id, platform, caption, hashtags, cta, suggested_time, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(draftId, task_id, platform, draft.caption, JSON.stringify(draft.hashtags), draft.cta, draft.suggested_time, Date.now());

      res.json({ ok: true, draft: { id: draftId, ...draft } });
    } catch (err) {
      res.status(500).json({ error: "draft_creation_failed", detail: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/auto-post/drafts — List all post drafts
  app.get("/api/auto-post/drafts", (_req: any, res: any) => {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS post_drafts (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          platform TEXT NOT NULL,
          caption TEXT,
          hashtags TEXT,
          cta TEXT,
          suggested_time TEXT,
          status TEXT DEFAULT 'draft',
          created_at INTEGER NOT NULL
        )
      `);

      const drafts = db.prepare("SELECT * FROM post_drafts ORDER BY created_at DESC LIMIT 50").all();
      res.json({ ok: true, drafts, total: (drafts as any[]).length });
    } catch {
      res.json({ ok: true, drafts: [], total: 0 });
    }
  });
}

// ---------------------------------------------------------------------------
// Dashboard Enhanced Stats
// ---------------------------------------------------------------------------

export function registerDashboardEnhancedRoutes(app: any, db: DatabaseSync): void {
  // GET /api/dashboard/today — Today's KPIs
  app.get("/api/dashboard/today", (_req: any, res: any) => {
    const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime() - 7 * 60 * 60 * 1000;
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;

    const todayDone = (
      db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'done' AND completed_at >= ?").get(todayStart) as { cnt: number }
    ).cnt;
    const todayCreated = (
      db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE created_at >= ?").get(todayStart) as { cnt: number }
    ).cnt;
    const weekDone = (
      db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'done' AND completed_at >= ?").get(weekStart) as { cnt: number }
    ).cnt;
    const weekCreated = (
      db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE created_at >= ?").get(weekStart) as { cnt: number }
    ).cnt;

    // Agent productivity today
    const agentProductivity = db
      .prepare(
        `SELECT a.id, a.name, a.avatar_emoji,
                COUNT(CASE WHEN t.completed_at >= ? THEN 1 END) as tasks_today,
                a.stats_tasks_done, a.stats_xp
         FROM agents a
         LEFT JOIN tasks t ON t.assigned_agent_id = a.id AND t.status = 'done'
         GROUP BY a.id
         ORDER BY tasks_today DESC, a.stats_xp DESC
         LIMIT 10`,
      )
      .all(todayStart);

    // Content pipeline status
    const pipeline = {
      trend_report: db
        .prepare("SELECT COUNT(*) as cnt FROM tasks WHERE title LIKE '%Trend%' AND created_at >= ?")
        .get(todayStart) as { cnt: number },
      scripts: db
        .prepare("SELECT COUNT(*) as cnt FROM tasks WHERE title LIKE '%Script%' AND created_at >= ?")
        .get(todayStart) as { cnt: number },
      thumbnails: db
        .prepare("SELECT COUNT(*) as cnt FROM tasks WHERE title LIKE '%Thumbnail%' AND created_at >= ?")
        .get(todayStart) as { cnt: number },
    };

    res.json({
      ok: true,
      date: now.toISOString().split("T")[0],
      today: { done: todayDone, created: todayCreated },
      week: { done: weekDone, created: weekCreated },
      agent_productivity: agentProductivity,
      pipeline: {
        trend_reports: pipeline.trend_report.cnt,
        scripts: pipeline.scripts.cnt,
        thumbnails: pipeline.thumbnails.cnt,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Supabase Restore — Pull data back from cloud
// ---------------------------------------------------------------------------

export function registerSupabaseRestoreRoutes(app: any, db: DatabaseSync): void {
  // POST /api/supabase/restore — restore content jobs from Supabase
  app.post("/api/supabase/restore", async (_req: any, res: any) => {
    if (!isSupabaseConfigured()) {
      return res.status(400).json({ error: "Supabase not configured" });
    }

    const supabaseUrl = process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !supabaseKey) {
      return res.status(400).json({ error: "Supabase credentials missing" });
    }

    try {
      // Fetch content_jobs directly from Supabase REST API
      const fetchRes = await fetch(`${supabaseUrl}/rest/v1/content_jobs?select=*&order=created_at.desc&limit=100`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!fetchRes.ok) {
        const text = await fetchRes.text().catch(() => "");
        return res.json({ ok: true, restored: 0, message: `Supabase returned ${fetchRes.status}: ${text.slice(0, 200)}` });
      }

      const jobs = (await fetchRes.json()) as Array<{
        id?: string;
        title?: string;
        main_copy?: string;
        status?: string;
        content_type?: string;
        claw_empire_task_id?: string;
        created_at?: string;
      }>;

      if (!Array.isArray(jobs) || jobs.length === 0) {
        return res.json({ ok: true, restored: 0, message: "No content jobs found in Supabase" });
      }

      let restored = 0;
      for (const job of jobs) {
        // Check if task already exists
        const checkId = job.claw_empire_task_id || job.id || "";
        if (!checkId) continue;
        const existing = db.prepare("SELECT id FROM tasks WHERE id = ?").get(checkId);
        if (existing) continue;

        const taskId = checkId || `restored-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        try {
          db.prepare(
            `INSERT OR IGNORE INTO tasks (id, title, description, status, created_at, completed_at, task_type)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            taskId,
            job.title || "Restored from Supabase",
            job.main_copy || null,
            job.status === "done" ? "done" : "inbox",
            job.created_at ? new Date(job.created_at).getTime() : Date.now(),
            job.status === "done" ? Date.now() : null,
            job.content_type || "general",
          );
          restored++;
        } catch {
          // skip duplicates
        }
      }

      console.log(`[SupabaseRestore] ☁️→💾 Restored ${restored} tasks from Supabase`);
      res.json({ ok: true, restored, total_in_supabase: jobs.length });
    } catch (err) {
      console.error("[SupabaseRestore] ❌", err instanceof Error ? err.message : err);
      res.status(500).json({ error: "restore_failed", detail: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/supabase/status — check Supabase connection
  app.get("/api/supabase/status", async (_req: any, res: any) => {
    res.json({
      ok: true,
      configured: isSupabaseConfigured(),
      supabase_url: process.env.SUPABASE_URL ? "✅ set" : "❌ missing",
    });
  });
}

// ---------------------------------------------------------------------------
// Performance Charts API — 7-day data for frontend charts
// ---------------------------------------------------------------------------

export function registerChartsRoutes(app: any, db: DatabaseSync): void {
  app.get("/api/dashboard/charts", (_req: any, res: any) => {
    const now = Date.now();
    const bkkOffset = 7 * 60 * 60 * 1000;
    const days = 7;

    // 1. Daily task completion (7 days)
    const dailyCompletion: Array<{ date: string; done: number; created: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const dayDate = new Date(now + bkkOffset - i * 24 * 60 * 60 * 1000);
      const dateKey = `${dayDate.getUTCFullYear()}-${String(dayDate.getUTCMonth() + 1).padStart(2, "0")}-${String(dayDate.getUTCDate()).padStart(2, "0")}`;
      const dayStart = new Date(Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate())).getTime() - bkkOffset;
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      const done = (
        db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'done' AND completed_at >= ? AND completed_at < ?").get(dayStart, dayEnd) as { cnt: number }
      ).cnt;
      const created = (
        db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE created_at >= ? AND created_at < ?").get(dayStart, dayEnd) as { cnt: number }
      ).cnt;

      dailyCompletion.push({ date: dateKey, done, created });
    }

    // 2. Agent productivity (top 10)
    const agentProductivity = db
      .prepare(
        `SELECT a.name, a.stats_tasks_done as total_done, a.stats_xp as xp,
                COUNT(CASE WHEN t.completed_at >= ? THEN 1 END) as week_done
         FROM agents a
         LEFT JOIN tasks t ON t.assigned_agent_id = a.id AND t.status = 'done'
         GROUP BY a.id
         ORDER BY week_done DESC, a.stats_xp DESC
         LIMIT 10`,
      )
      .all(now - days * 24 * 60 * 60 * 1000) as Array<{
      name: string;
      total_done: number;
      xp: number;
      week_done: number;
    }>;

    // 3. Pipeline throughput (weekly)
    const weekStart = now - days * 24 * 60 * 60 * 1000;
    const pipelineTypes = [
      { key: "trends", pattern: "%Trend%" },
      { key: "scripts", pattern: "%Script%" },
      { key: "thumbnails", pattern: "%Thumbnail%" },
      { key: "reviews", pattern: "%Review%" },
    ];
    const pipeline: Record<string, number> = {};
    for (const { key, pattern } of pipelineTypes) {
      const row = db
        .prepare("SELECT COUNT(*) as cnt FROM tasks WHERE title LIKE ? AND created_at >= ?")
        .get(pattern, weekStart) as { cnt: number };
      pipeline[key] = row.cnt;
    }

    // 4. Status distribution
    const statusDist = db
      .prepare(
        `SELECT status, COUNT(*) as cnt FROM tasks GROUP BY status`,
      )
      .all() as Array<{ status: string; cnt: number }>;

    res.json({
      ok: true,
      period: `${days} days`,
      daily_completion: dailyCompletion,
      agent_productivity: agentProductivity,
      pipeline_throughput: pipeline,
      status_distribution: statusDist,
    });
  });
}

// ---------------------------------------------------------------------------
// Start all services
// ---------------------------------------------------------------------------

export function startSupabaseSyncAndExtras(app: any, db: DatabaseSync): void {
  // Register API routes
  registerContentCalendarRoutes(app, db);
  registerAutoPostRoutes(app, db);
  registerDashboardEnhancedRoutes(app, db);
  registerSupabaseRestoreRoutes(app, db);
  registerChartsRoutes(app, db);

  // Start Supabase sync if configured
  if (isSupabaseConfigured()) {
    console.log("[SupabaseSync] ☁️ Supabase configured — starting periodic sync (every 10min)");
    setTimeout(() => syncToSupabase(db), 30_000);
    setInterval(() => syncToSupabase(db), SYNC_INTERVAL_MS);
  } else {
    console.log("[SupabaseSync] ⚠️ No SUPABASE_URL configured — sync disabled");
  }

  console.log("[ContentCalendar] ✅ API ready: /api/content-calendar, /api/content-calendar/today");
  console.log("[AutoPost] ✅ API ready: /api/auto-post/draft, /api/auto-post/drafts");
  console.log("[Dashboard+] ✅ API ready: /api/dashboard/today, /api/dashboard/charts");
  console.log("[SupabaseRestore] ✅ API ready: /api/supabase/restore, /api/supabase/status");
}


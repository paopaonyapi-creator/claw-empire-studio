/**
 * Activity Log — Audit Trail System
 * 
 * Records all important actions: login, logout, create, delete, update, post, etc.
 * Queryable via API for CEO/Admin viewing.
 */

import type { Express, Request, Response } from "express";
import { getStudioDb } from "./studio-db.ts";
import { pushTgNotification } from "./tg-notifier.ts";
import { awardXp } from "./gamification.ts";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export function initActivityLogTable(): void {
  const db = getStudioDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS studio_activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'system',
      actor TEXT NOT NULL DEFAULT 'system',
      detail TEXT DEFAULT '',
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_activity_log_created ON studio_activity_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_log_category ON studio_activity_log(category);
  `);
  console.log("[ActivityLog] ✅ Table initialized");
}

// ---------------------------------------------------------------------------
// Log function (call from anywhere)
// ---------------------------------------------------------------------------

export function logActivity(params: {
  action: string;
  category?: "auth" | "content" | "product" | "revenue" | "settings" | "system" | "social";
  actor?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}): void {
  try {
    const db = getStudioDb();
    db.prepare(
      `INSERT INTO studio_activity_log (action, category, actor, detail, metadata) VALUES (?, ?, ?, ?, ?)`
    ).run(
      params.action,
      params.category || "system",
      params.actor || "system",
      params.detail || "",
      JSON.stringify(params.metadata || {}),
    );
  } catch {
    // Silent — logging should never break the app
  }
  // Push TG notification for important events
  pushTgNotification({ action: params.action, actor: params.actor, detail: params.detail });
  // Award XP for gamification
  awardXp(params.action);
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerActivityLogRoutes(app: Express): void {
  initActivityLogTable();

  // GET /api/activity-log — fetch recent activity
  app.get("/api/activity-log", (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const category = req.query.category as string | undefined;

    const db = getStudioDb();
    let rows: any[];
    if (category && category !== "all") {
      rows = db.prepare(
        "SELECT * FROM studio_activity_log WHERE category = ? ORDER BY created_at DESC LIMIT ?"
      ).all(category, limit) as any[];
    } else {
      rows = db.prepare(
        "SELECT * FROM studio_activity_log ORDER BY created_at DESC LIMIT ?"
      ).all(limit) as any[];
    }

    res.json({
      ok: true,
      activities: rows.map(r => ({
        id: r.id,
        action: r.action,
        category: r.category,
        actor: r.actor,
        detail: r.detail,
        metadata: JSON.parse(r.metadata || "{}"),
        createdAt: r.created_at,
      })),
    });
  });

  // GET /api/activity-log/stats — summary stats
  app.get("/api/activity-log/stats", (_req: Request, res: Response) => {
    const db = getStudioDb();
    const today = new Date().toISOString().split("T")[0];
    const todayCount = (db.prepare(
      "SELECT COUNT(*) as cnt FROM studio_activity_log WHERE created_at >= ?"
    ).get(today + "T00:00:00") as any)?.cnt || 0;

    const total = (db.prepare(
      "SELECT COUNT(*) as cnt FROM studio_activity_log"
    ).get() as any)?.cnt || 0;

    const categories = db.prepare(
      "SELECT category, COUNT(*) as cnt FROM studio_activity_log GROUP BY category ORDER BY cnt DESC"
    ).all() as any[];

    res.json({
      ok: true,
      stats: { today: todayCount, total, categories },
    });
  });

  console.log("[ActivityLog] ✅ Routes registered");
}

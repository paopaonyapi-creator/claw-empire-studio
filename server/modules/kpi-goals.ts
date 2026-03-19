/**
 * KPI Goals — Daily/Weekly Target System
 *
 * CEO can set KPI targets (revenue, tasks, posts, etc.)
 * and track progress with completion percentages.
 */

import type { Express, Request, Response } from "express";
import { getStudioDb } from "./studio-db.ts";
import { logActivity } from "./activity-log.ts";

export function initKpiGoalsTable(): void {
  const db = getStudioDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS studio_kpi_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric TEXT NOT NULL,
      target REAL NOT NULL DEFAULT 0,
      current REAL NOT NULL DEFAULT 0,
      period TEXT NOT NULL DEFAULT 'daily',
      icon TEXT DEFAULT '🎯',
      color TEXT DEFAULT '#6366f1',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function registerKpiGoalsRoutes(app: Express): void {
  initKpiGoalsTable();

  // GET /api/kpi-goals — list all goals
  app.get("/api/kpi-goals", (_req: Request, res: Response) => {
    const db = getStudioDb();
    const rows = db.prepare("SELECT * FROM studio_kpi_goals ORDER BY created_at DESC").all() as any[];
    res.json({
      ok: true,
      goals: rows.map(r => ({
        id: r.id,
        metric: r.metric,
        target: r.target,
        current: r.current,
        period: r.period,
        icon: r.icon,
        color: r.color,
        percent: r.target > 0 ? Math.min(100, Math.round((r.current / r.target) * 100)) : 0,
        createdAt: r.created_at,
      })),
    });
  });

  // POST /api/kpi-goals — create or update goal
  app.post("/api/kpi-goals", (req: Request, res: Response) => {
    const { metric, target, current, period, icon, color } = req.body;
    if (!metric || target == null) return res.status(400).json({ ok: false, error: "metric & target required" });

    const db = getStudioDb();
    // Upsert: if metric+period exists, update; else insert
    const existing = db.prepare("SELECT id FROM studio_kpi_goals WHERE metric = ? AND period = ?").get(metric, period || "daily") as any;
    if (existing) {
      db.prepare("UPDATE studio_kpi_goals SET target = ?, current = COALESCE(?, current), icon = COALESCE(?, icon), color = COALESCE(?, color), updated_at = datetime('now') WHERE id = ?")
        .run(target, current, icon, color, existing.id);
      res.json({ ok: true, id: existing.id, action: "updated" });
    } else {
      const result = db.prepare("INSERT INTO studio_kpi_goals (metric, target, current, period, icon, color) VALUES (?, ?, ?, ?, ?, ?)")
        .run(metric, target, current || 0, period || "daily", icon || "🎯", color || "#6366f1");
      res.json({ ok: true, id: (result as any).lastInsertRowid, action: "created" });
    }
    logActivity({ action: "set_kpi_goal", category: "settings", detail: `${metric}: ${target} (${period || "daily"})` });
  });

  // PATCH /api/kpi-goals/:id — update progress
  app.patch("/api/kpi-goals/:id", (req: Request, res: Response) => {
    const { current } = req.body;
    if (current == null) return res.status(400).json({ ok: false, error: "current required" });
    const db = getStudioDb();
    const id = String(req.params.id);
    db.prepare("UPDATE studio_kpi_goals SET current = ?, updated_at = datetime('now') WHERE id = ?").run(current, id);
    res.json({ ok: true });
  });

  // DELETE /api/kpi-goals/:id
  app.delete("/api/kpi-goals/:id", (req: Request, res: Response) => {
    const db = getStudioDb();
    const id = String(req.params.id);
    db.prepare("DELETE FROM studio_kpi_goals WHERE id = ?").run(id);
    res.json({ ok: true });
  });

  console.log("[KPI Goals] ✅ API ready");
}

/**
 * Revenue Goals API — Monthly revenue targets with real progress tracking
 *
 * GET  /api/revenue-goals         — list all goals with actual revenue
 * GET  /api/revenue-goals/current — current month goal + progress
 * POST /api/revenue-goals         — set/update goal for a month
 */

import type { Express, Request, Response } from "express";
import { getStudioDb } from "./studio-db.ts";

// Initialize revenue_goals table on first use
function initRevenueGoalsTable(): void {
  const db = getStudioDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS revenue_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL UNIQUE,
      target_amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'THB',
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export function registerRevenueGoalsRoutes(app: Express): void {
  initRevenueGoalsTable();

  // GET /api/revenue-goals — list all goals with actual revenue
  app.get("/api/revenue-goals", (_req: Request, res: Response) => {
    try {
      const db = getStudioDb();
      const goals = db.prepare("SELECT * FROM revenue_goals ORDER BY month DESC LIMIT 12").all() as any[];

      const enriched = goals.map((g) => {
        const monthStart = `${g.month}-01`;
        const monthEnd = `${g.month}-31`;
        const revenueRow = db.prepare(
          "SELECT COALESCE(SUM(amount), 0) as total FROM studio_revenue WHERE timestamp >= ? AND timestamp <= ?"
        ).get(monthStart, monthEnd) as { total: number } | undefined;

        const actual = revenueRow?.total ?? 0;
        const progress = g.target_amount > 0 ? Math.min(100, Math.round((actual / g.target_amount) * 100)) : 0;
        return { ...g, actual_amount: actual, progress_pct: progress };
      });

      res.json({ ok: true, goals: enriched });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // GET /api/revenue-goals/current — current month goal + progress
  app.get("/api/revenue-goals/current", (_req: Request, res: Response) => {
    try {
      const db = getStudioDb();
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      let goal = db.prepare("SELECT * FROM revenue_goals WHERE month = ?").get(month) as any;
      if (!goal) {
        db.prepare("INSERT OR IGNORE INTO revenue_goals (month, target_amount) VALUES (?, 0)").run(month);
        goal = db.prepare("SELECT * FROM revenue_goals WHERE month = ?").get(month) as any;
      }

      const monthStart = `${month}-01`;
      const monthEnd = `${month}-31`;
      const revenueRow = db.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM studio_revenue WHERE timestamp >= ? AND timestamp <= ?"
      ).get(monthStart, monthEnd) as { total: number } | undefined;

      const actual = revenueRow?.total ?? 0;
      const progress = goal.target_amount > 0 ? Math.min(100, Math.round((actual / goal.target_amount) * 100)) : 0;

      res.json({ ok: true, goal: { ...goal, actual_amount: actual, progress_pct: progress } });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // POST /api/revenue-goals — set goal for a month
  app.post("/api/revenue-goals", (req: Request, res: Response) => {
    try {
      const { month, target_amount, note } = req.body;
      if (!month || target_amount == null) {
        return res.status(400).json({ ok: false, error: "month and target_amount required" });
      }

      const db = getStudioDb();
      db.prepare(`
        INSERT INTO revenue_goals (month, target_amount, note, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT (month) DO UPDATE SET
          target_amount = excluded.target_amount,
          note = excluded.note,
          updated_at = datetime('now')
      `).run(month, target_amount, note ?? "");

      res.json({ ok: true, message: `Goal set for ${month}: ฿${target_amount}` });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  console.log("[RevenueGoals] 🎯 API ready: /api/revenue-goals");
}

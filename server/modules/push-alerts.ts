/**
 * Push Alerts — Real-time notification alerts API
 *
 * Uses separate table `studio_push_alerts` to avoid conflict with
 * the existing `studio_alerts` table used by performance-alerts.
 */

import type { Express, Request, Response } from "express";
import { getStudioDb } from "./studio-db.ts";

function initPushAlertsTable(): void {
  const db = getStudioDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS studio_push_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT DEFAULT '',
      icon TEXT DEFAULT '🔔',
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function pushAlert(title: string, message: string, type: "info" | "success" | "warning" | "error" = "info", icon = "🔔"): void {
  try {
    const db = getStudioDb();
    db.prepare("INSERT INTO studio_push_alerts (type, title, message, icon) VALUES (?, ?, ?, ?)").run(type, title, message, icon);
  } catch {}
}

export function registerPushAlertsRoutes(app: Express): void {
  initPushAlertsTable();

  // GET /api/alerts — list latest push alerts
  app.get("/api/push-alerts", (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 20;
      const unreadOnly = req.query.unread === "1";
      const db = getStudioDb();

      let query = "SELECT * FROM studio_push_alerts";
      if (unreadOnly) query += " WHERE read = 0";
      query += " ORDER BY id DESC LIMIT ?";

      const rows = db.prepare(query).all(limit) as any[];
      const unreadCount = (db.prepare("SELECT COUNT(*) as cnt FROM studio_push_alerts WHERE read = 0").get() as any)?.cnt || 0;

      res.json({
        ok: true,
        alerts: rows.map(r => ({
          id: r.id, type: r.type, title: r.title, message: r.message,
          icon: r.icon, read: !!r.read, createdAt: r.created_at || new Date().toISOString(),
        })),
        unreadCount,
      });
    } catch {
      res.json({ ok: true, alerts: [], unreadCount: 0 });
    }
  });

  // PATCH /api/push-alerts/:id/read — mark as read
  app.patch("/api/push-alerts/:id/read", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const db = getStudioDb();
    db.prepare("UPDATE studio_push_alerts SET read = 1 WHERE id = ?").run(id);
    res.json({ ok: true });
  });

  // POST /api/push-alerts/read-all — mark all as read
  app.post("/api/push-alerts/read-all", (_req: Request, res: Response) => {
    const db = getStudioDb();
    db.prepare("UPDATE studio_push_alerts SET read = 1 WHERE read = 0").run();
    res.json({ ok: true });
  });

  // POST /api/push-alerts — create manual alert
  app.post("/api/push-alerts", (req: Request, res: Response) => {
    const { title, message, type, icon } = req.body;
    if (!title) return res.status(400).json({ ok: false, error: "title required" });
    pushAlert(title, message || "", type || "info", icon || "🔔");
    res.json({ ok: true });
  });

  console.log("[PushAlerts] 🔔 API ready");
}

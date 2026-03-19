/**
 * AI Content Scheduler — Schedule AI to auto-generate and publish content
 *
 * CEO sets schedules for AI to create content at specific times.
 */

import type { Express, Request, Response } from "express";
import { getStudioDb } from "./studio-db.ts";
import { logActivity } from "./activity-log.ts";

function initSchedulerTable(): void {
  const db = getStudioDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS studio_ai_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'post',
      platform TEXT NOT NULL DEFAULT 'facebook',
      schedule_time TEXT NOT NULL DEFAULT '09:00',
      days TEXT NOT NULL DEFAULT 'mon,wed,fri',
      prompt_template TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      last_run TEXT DEFAULT '',
      run_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function registerAiSchedulerRoutes(app: Express): void {
  initSchedulerTable();

  // GET /api/ai-scheduler — list all schedules
  app.get("/api/ai-scheduler", (_req: Request, res: Response) => {
    const db = getStudioDb();
    const rows = db.prepare("SELECT * FROM studio_ai_schedules ORDER BY created_at DESC").all() as any[];
    res.json({
      ok: true,
      schedules: rows.map(r => ({
        id: r.id,
        name: r.name,
        contentType: r.content_type,
        platform: r.platform,
        scheduleTime: r.schedule_time,
        days: r.days.split(","),
        promptTemplate: r.prompt_template,
        status: r.status,
        lastRun: r.last_run,
        runCount: r.run_count,
      })),
    });
  });

  // POST /api/ai-scheduler — create new schedule
  app.post("/api/ai-scheduler", (req: Request, res: Response) => {
    const { name, contentType, platform, scheduleTime, days, promptTemplate } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: "name required" });

    const db = getStudioDb();
    const result = db.prepare(
      "INSERT INTO studio_ai_schedules (name, content_type, platform, schedule_time, days, prompt_template) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      name,
      contentType || "post",
      platform || "facebook",
      scheduleTime || "09:00",
      Array.isArray(days) ? days.join(",") : (days || "mon,wed,fri"),
      promptTemplate || "",
    );
    logActivity({ action: "create_ai_schedule", category: "system", detail: `${name} → ${platform} at ${scheduleTime}` });
    res.json({ ok: true, id: (result as any).lastInsertRowid });
  });

  // PATCH /api/ai-scheduler/:id — toggle status
  app.patch("/api/ai-scheduler/:id", (req: Request, res: Response) => {
    const { status } = req.body;
    const id = String(req.params.id);
    const db = getStudioDb();
    db.prepare("UPDATE studio_ai_schedules SET status = ? WHERE id = ?").run(status || "paused", id);
    res.json({ ok: true });
  });

  // DELETE /api/ai-scheduler/:id
  app.delete("/api/ai-scheduler/:id", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const db = getStudioDb();
    db.prepare("DELETE FROM studio_ai_schedules WHERE id = ?").run(id);
    res.json({ ok: true });
  });

  console.log("[AI Scheduler] 🤖 API ready");
}

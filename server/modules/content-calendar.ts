/**
 * Content Calendar Pro — CRUD events for content scheduling
 */

import type { Express, Request, Response } from "express";
import { getStudioDb } from "./studio-db.ts";
import { logActivity } from "./activity-log.ts";

function initCalendarTable(): void {
  const db = getStudioDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS studio_calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      date TEXT NOT NULL,
      time TEXT DEFAULT '09:00',
      platform TEXT DEFAULT 'facebook',
      content_type TEXT DEFAULT 'post',
      status TEXT DEFAULT 'planned',
      color TEXT DEFAULT '#6366f1',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function registerContentCalendarRoutes(app: Express): void {
  initCalendarTable();

  // GET /api/calendar — list events (optional month filter)
  app.get("/api/calendar", (req: Request, res: Response) => {
    const month = String(req.query.month || ""); // format: 2026-03
    const db = getStudioDb();

    let query = "SELECT * FROM studio_calendar_events";
    const params: any[] = [];
    if (month) {
      query += " WHERE date LIKE ?";
      params.push(`${month}%`);
    }
    query += " ORDER BY date ASC, time ASC";

    const rows = db.prepare(query).all(...params) as any[];
    res.json({
      ok: true,
      events: rows.map(r => ({
        id: r.id, title: r.title, description: r.description,
        date: r.date, time: r.time, platform: r.platform,
        contentType: r.content_type, status: r.status,
        color: r.color, createdAt: r.created_at,
      })),
    });
  });

  // POST /api/calendar — create event
  app.post("/api/calendar", (req: Request, res: Response) => {
    const { title, description, date, time, platform, contentType, color } = req.body;
    if (!title || !date) return res.status(400).json({ ok: false, error: "title and date required" });

    const db = getStudioDb();
    const result = db.prepare(
      "INSERT INTO studio_calendar_events (title, description, date, time, platform, content_type, color) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(title, description || "", date, time || "09:00", platform || "facebook", contentType || "post", color || "#6366f1");

    logActivity({ action: "create_calendar_event", category: "content", detail: `${title} → ${date}` });
    res.json({ ok: true, id: (result as any).lastInsertRowid });
  });

  // PATCH /api/calendar/:id — update event status
  app.patch("/api/calendar/:id", (req: Request, res: Response) => {
    const { status, title, date, time } = req.body;
    const id = String(req.params.id);
    const db = getStudioDb();

    if (status) db.prepare("UPDATE studio_calendar_events SET status = ? WHERE id = ?").run(status, id);
    if (title) db.prepare("UPDATE studio_calendar_events SET title = ? WHERE id = ?").run(title, id);
    if (date) db.prepare("UPDATE studio_calendar_events SET date = ? WHERE id = ?").run(date, id);
    if (time) db.prepare("UPDATE studio_calendar_events SET time = ? WHERE id = ?").run(time, id);

    res.json({ ok: true });
  });

  // DELETE /api/calendar/:id
  app.delete("/api/calendar/:id", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const db = getStudioDb();
    db.prepare("DELETE FROM studio_calendar_events WHERE id = ?").run(id);
    res.json({ ok: true });
  });

  console.log("[Calendar Pro] 📆 API ready");
}

// TG command handler (used by ceo-chat.ts)
export async function handleScheduleCommand(_text: string): Promise<string> {
  const db = getStudioDb();
  const today = new Date().toISOString().split("T")[0];
  const upcoming = db.prepare(
    "SELECT title, date, time, platform, status FROM studio_calendar_events WHERE date >= ? ORDER BY date ASC, time ASC LIMIT 5"
  ).all(today) as any[];

  if (upcoming.length === 0) return "📆 ยังไม่มี content ที่กำหนดไว้";

  let msg = "📆 <b>Content Schedule:</b>\n";
  for (const e of upcoming) {
    const statusIcon = e.status === "published" ? "✅" : e.status === "in_progress" ? "🔄" : "📝";
    msg += `\n${statusIcon} ${e.title}\n   📅 ${e.date} ⏰ ${e.time} | ${e.platform}`;
  }
  return msg;
}

/**
 * System Settings — Centralized config management
 *
 * CEO can view/update system config like API keys, bot tokens,
 * notification preferences via a settings widget.
 */

import type { Express, Request, Response } from "express";
import { getStudioDb } from "./studio-db.ts";
import { logActivity } from "./activity-log.ts";

function initSettingsTable(): void {
  const db = getStudioDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS studio_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'general',
      label TEXT DEFAULT '',
      type TEXT DEFAULT 'text',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Insert defaults if not exist
  const defaults: Array<[string, string, string, string, string]> = [
    ["tg_bot_token", process.env.TELEGRAM_BOT_TOKEN || "", "telegram", "Bot Token", "password"],
    ["tg_chat_id", process.env.TELEGRAM_CHAT_ID || "", "telegram", "CEO Chat ID", "text"],
    ["tg_notifications", "on", "telegram", "Push Notifications", "toggle"],
    ["auto_summary_time", "08:00", "automation", "Daily Summary Time", "text"],
    ["auto_summary_enabled", "on", "automation", "Auto Daily Summary", "toggle"],
    ["ai_auto_reply", "on", "ai", "Smart Auto-Reply", "toggle"],
    ["ai_content_schedule", "off", "ai", "AI Content Scheduler", "toggle"],
    ["theme_default", "dark", "appearance", "Default Theme", "select"],
    ["company_name", "Content Studio", "general", "Company Name", "text"],
    ["supabase_sync", "on", "backup", "Supabase Auto-Sync", "toggle"],
  ];

  const stmt = db.prepare("INSERT OR IGNORE INTO studio_settings (key, value, category, label, type) VALUES (?, ?, ?, ?, ?)");
  for (const d of defaults) stmt.run(...d);
}

export function registerSettingsRoutes(app: Express): void {
  initSettingsTable();

  // GET /api/settings — list all settings grouped by category
  app.get("/api/settings", (_req: Request, res: Response) => {
    const db = getStudioDb();
    const rows = db.prepare("SELECT * FROM studio_settings ORDER BY category, key").all() as any[];
    const grouped: Record<string, any[]> = {};
    for (const r of rows) {
      if (!grouped[r.category]) grouped[r.category] = [];
      grouped[r.category].push({
        key: r.key,
        value: r.type === "password" ? "••••••••" : r.value,
        rawValue: r.value,
        category: r.category,
        label: r.label,
        type: r.type,
      });
    }
    res.json({ ok: true, settings: grouped });
  });

  // PUT /api/settings/:key — update a setting
  app.put("/api/settings/:key", (req: Request, res: Response) => {
    const { value } = req.body;
    const key = String(req.params.key);
    if (value == null) return res.status(400).json({ ok: false, error: "value required" });

    const db = getStudioDb();
    const existing = db.prepare("SELECT key FROM studio_settings WHERE key = ?").get(key) as any;
    if (!existing) return res.status(404).json({ ok: false, error: "setting not found" });

    db.prepare("UPDATE studio_settings SET value = ?, updated_at = datetime('now') WHERE key = ?").run(String(value), key);
    logActivity({ action: "update_setting", category: "settings", actor: "ceo", detail: `${key} = ${String(value).substring(0, 20)}` });
    res.json({ ok: true });
  });

  console.log("[Settings] ⚙️ API ready");
}

/**
 * Gamification System — CEO XP / Level / Badge / Streaks
 *
 * Tracks CEO actions and awards XP. Levels up with milestones.
 */

import type { Express, Request, Response } from "express";
import { getStudioDb } from "./studio-db.ts";

const XP_REWARDS: Record<string, number> = {
  login: 5,
  create_user: 10,
  set_kpi_goal: 15,
  create_task: 10,
  complete_task: 25,
  fb_post_published: 20,
  new_order: 30,
  export_completed: 5,
  generate_content: 15,
};

const LEVELS = [
  { level: 1, xp: 0, title: "Rookie CEO", badge: "🌱" },
  { level: 2, xp: 50, title: "Rising Star", badge: "⭐" },
  { level: 3, xp: 150, title: "Go-Getter", badge: "🔥" },
  { level: 4, xp: 300, title: "Hustler", badge: "💎" },
  { level: 5, xp: 500, title: "Empire Builder", badge: "👑" },
  { level: 6, xp: 800, title: "Content King", badge: "🏆" },
  { level: 7, xp: 1200, title: "Affiliate Legend", badge: "🚀" },
  { level: 8, xp: 2000, title: "Millionaire Mind", badge: "💰" },
  { level: 9, xp: 3500, title: "Crypto Whale", badge: "🐋" },
  { level: 10, xp: 5000, title: "Universe Boss", badge: "🌌" },
];

function initGamificationTable(): void {
  const db = getStudioDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS studio_gamification (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_xp INTEGER NOT NULL DEFAULT 0,
      current_streak INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0,
      last_active_date TEXT DEFAULT '',
      badges TEXT DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO studio_gamification (id, total_xp) VALUES (1, 0);
  `);
}

function getLevel(xp: number): { level: number; title: string; badge: string; nextXp: number; progress: number } {
  let current = LEVELS[0];
  let next = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || { xp: current.xp + 1000 };
      break;
    }
  }
  const range = (next as any).xp - current.xp;
  const progress = range > 0 ? Math.min(100, Math.round(((xp - current.xp) / range) * 100)) : 100;
  return { level: current.level, title: current.title, badge: current.badge, nextXp: (next as any).xp, progress };
}

/**
 * Award XP for an action (call from activity-log)
 */
export function awardXp(action: string): void {
  const xp = XP_REWARDS[action];
  if (!xp) return;
  try {
    const db = getStudioDb();
    const today = new Date().toISOString().split("T")[0];
    const row = db.prepare("SELECT last_active_date, current_streak, best_streak FROM studio_gamification WHERE id = 1").get() as any;

    let streak = row?.current_streak || 0;
    let bestStreak = row?.best_streak || 0;

    if (row?.last_active_date !== today) {
      // Check if consecutive day
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      streak = (row?.last_active_date === yesterday) ? streak + 1 : 1;
      bestStreak = Math.max(bestStreak, streak);
    }

    db.prepare(
      "UPDATE studio_gamification SET total_xp = total_xp + ?, current_streak = ?, best_streak = ?, last_active_date = ?, updated_at = datetime('now') WHERE id = 1"
    ).run(xp, streak, bestStreak, today);
  } catch {}
}

export function registerGamificationRoutes(app: Express): void {
  initGamificationTable();

  // GET /api/gamification — get CEO stats
  app.get("/api/gamification", (_req: Request, res: Response) => {
    const db = getStudioDb();
    const row = db.prepare("SELECT * FROM studio_gamification WHERE id = 1").get() as any;
    if (!row) return res.json({ ok: false });

    const levelInfo = getLevel(row.total_xp);
    res.json({
      ok: true,
      stats: {
        totalXp: row.total_xp,
        ...levelInfo,
        currentStreak: row.current_streak,
        bestStreak: row.best_streak,
        lastActiveDate: row.last_active_date,
        badges: JSON.parse(row.badges || "[]"),
      },
    });
  });

  console.log("[Gamification] 🏆 API ready");
}

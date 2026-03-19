/**
 * Goal Tracker — Set & track revenue/content targets
 *
 * NOW BACKED BY SQLite (via studio-db.ts).
 * TG: /goal, /goal set revenue 10000 month, /goal set content 5 week
 * API: GET /api/goals, POST /api/goals
 */

import type { Express, Request, Response } from "express";
import {
  dbGetGoals,
  dbUpsertGoal,
  dbDeleteGoal,
  getStudioDb,
  dbGetAllLinks,
  dbGetTotalClicks,
  type StudioGoal,
} from "./studio-db.ts";

const METRIC_ICONS: Record<string, string> = { revenue: "💰", content: "📝", clicks: "🔗", tasks: "📋" };

function getCurrentValue(metric: string, _period: string): number {
  switch (metric) {
    case "clicks": {
      return dbGetTotalClicks();
    }
    case "revenue": {
      const links = dbGetAllLinks();
      return links.reduce((sum, l) => sum + (l.revenue || 0), 0);
    }
    default:
      return 0;
  }
}

function refreshGoals(): StudioGoal[] {
  const goals = dbGetGoals();
  for (const g of goals) {
    g.current = getCurrentValue(g.metric, g.period);
    g.progress = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
    dbUpsertGoal(g);
  }
  return goals;
}

// ---------------------------------------------------------------------------
// TG Command
// ---------------------------------------------------------------------------

export function handleGoalCommand(arg: string): string {
  const trimmed = arg.trim().toLowerCase();

  // /goal set revenue 10000 month
  if (trimmed.startsWith("set ")) {
    const match = trimmed.match(/^set\s+(\w+)\s+(\d+)\s+(day|week|month)/);
    if (!match) return "❌ ใช้: /goal set <metric> <target> <period>\n\nMetrics: revenue, content, clicks, tasks\nPeriods: day, week, month\n\nตัวอย่าง: /goal set revenue 10000 month";
    const [, metric, target, period] = match;
    const newGoal: StudioGoal = {
      id: `goal-${Date.now()}`, metric, target: parseInt(target), period,
      current: getCurrentValue(metric, period),
      progress: 0, createdAt: new Date().toISOString(),
      icon: METRIC_ICONS[metric] || "🎯",
    };
    newGoal.progress = newGoal.target > 0 ? Math.min(100, Math.round((newGoal.current / newGoal.target) * 100)) : 0;
    dbUpsertGoal(newGoal);
    return `✅ Goal set!\n\n${newGoal.icon} ${metric}: ${newGoal.current}/${target} per ${period}\n${"▓".repeat(Math.floor(newGoal.progress / 5))}${"░".repeat(20 - Math.floor(newGoal.progress / 5))} ${newGoal.progress}%`;
  }

  // /goal remove <metric>
  if (trimmed.startsWith("remove ")) {
    const metric = trimmed.slice(7).trim();
    dbDeleteGoal(metric);
    return `✅ Removed all "${metric}" goals`;
  }

  // /goal (show all)
  const goals = refreshGoals();
  if (goals.length === 0) {
    return "🎯 Goal Tracker\n\nยังไม่มีเป้าหมาย\n\nตั้งเป้า: /goal set revenue 10000 month\nMetrics: revenue, content, clicks, tasks";
  }

  let msg = "🎯 GOALS\n";
  msg += `${"═".repeat(24)}\n\n`;
  for (const g of goals) {
    const bar = "▓".repeat(Math.floor(g.progress / 5)) + "░".repeat(20 - Math.floor(g.progress / 5));
    const emoji = g.progress >= 100 ? "🎉" : g.progress >= 75 ? "🔥" : g.progress >= 50 ? "⚡" : "💪";
    msg += `${g.icon} ${g.metric} (${g.period})\n`;
    msg += `   ${g.current.toLocaleString()} / ${g.target.toLocaleString()} ${emoji}\n`;
    msg += `   ${bar} ${g.progress}%\n\n`;
  }
  msg += "💡 /goal set content 5 week";
  return msg;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerGoalRoutes(app: Express): void {
  getStudioDb(); // Ensure DB is initialized

  app.get("/api/goals", (_req: Request, res: Response) => {
    res.json({ goals: refreshGoals() });
  });

  app.post("/api/goals", (req: Request, res: Response) => {
    const { metric, target, period } = req.body || {};
    if (!metric || !target || !period) { res.status(400).json({ error: "metric, target, period required" }); return; }
    const newGoal: StudioGoal = {
      id: `goal-${Date.now()}`, metric, target: Number(target), period,
      current: getCurrentValue(metric, period), progress: 0,
      createdAt: new Date().toISOString(), icon: METRIC_ICONS[metric] || "🎯",
    };
    newGoal.progress = newGoal.target > 0 ? Math.min(100, Math.round((newGoal.current / newGoal.target) * 100)) : 0;
    dbUpsertGoal(newGoal);
    res.json(newGoal);
  });
}

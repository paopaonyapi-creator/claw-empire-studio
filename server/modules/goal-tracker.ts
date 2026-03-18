/**
 * Goal Tracker — Set & track revenue/content targets
 *
 * TG: /goal, /goal set revenue 10000 month, /goal set content 5 week
 * API: GET /api/goals, POST /api/goals
 */

import type { Express, Request, Response } from "express";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "path";

interface Goal {
  id: string;
  metric: string;       // revenue, content, clicks, tasks
  target: number;
  period: string;        // day, week, month
  current: number;
  progress: number;      // 0-100
  createdAt: string;
  icon: string;
}

const GOALS_FILE = path.resolve("data/goals.json");

function loadGoals(): Goal[] {
  try { if (existsSync(GOALS_FILE)) return JSON.parse(readFileSync(GOALS_FILE, "utf-8")) || []; } catch {} return [];
}
function saveGoals(d: Goal[]): void {
  mkdirSync(path.dirname(GOALS_FILE), { recursive: true });
  writeFileSync(GOALS_FILE, JSON.stringify(d, null, 2));
}

function loadJson(f: string): unknown[] {
  try { const p = path.resolve(`data/${f}`); if (existsSync(p)) return JSON.parse(readFileSync(p, "utf-8")) || []; } catch {} return [];
}

const METRIC_ICONS: Record<string, string> = { revenue: "💰", content: "📝", clicks: "🔗", tasks: "📋" };

function getCurrentValue(metric: string, period: string): number {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  function isInPeriod(ts: string): boolean {
    const d = new Date(ts);
    if (period === "day") return ts.startsWith(todayStr);
    if (period === "week") return now.getTime() - d.getTime() < 7 * 86400000;
    if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  }

  switch (metric) {
    case "revenue": {
      const rev = loadJson("revenue.json") as Array<{ amount?: number; timestamp?: string }>;
      return rev.filter((r) => isInPeriod(r.timestamp || "")).reduce((s, r) => s + (r.amount || 0), 0);
    }
    case "content": {
      const items = loadJson("content-items.json") as Array<{ createdAt?: string }>;
      return items.filter((c) => isInPeriod(c.createdAt || "")).length;
    }
    case "clicks": {
      const links = loadJson("link-clicks.json") as Array<{ timestamp?: string }>;
      return links.filter((l) => isInPeriod(l.timestamp || "")).length;
    }
    case "tasks": {
      const tasks = loadJson("tasks.json") as Array<{ status?: string }>;
      return tasks.filter((t) => t.status === "done").length;
    }
    default: return 0;
  }
}

function refreshGoals(): Goal[] {
  const goals = loadGoals();
  for (const g of goals) {
    g.current = getCurrentValue(g.metric, g.period);
    g.progress = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
  }
  saveGoals(goals);
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
    const goals = loadGoals();
    // Remove existing goal for same metric+period
    const filtered = goals.filter((g) => !(g.metric === metric && g.period === period));
    const newGoal: Goal = {
      id: `goal-${Date.now()}`, metric, target: parseInt(target), period,
      current: getCurrentValue(metric, period),
      progress: 0, createdAt: new Date().toISOString(),
      icon: METRIC_ICONS[metric] || "🎯",
    };
    newGoal.progress = newGoal.target > 0 ? Math.min(100, Math.round((newGoal.current / newGoal.target) * 100)) : 0;
    filtered.push(newGoal);
    saveGoals(filtered);
    return `✅ Goal set!\n\n${newGoal.icon} ${metric}: ${newGoal.current}/${target} per ${period}\n${"▓".repeat(Math.floor(newGoal.progress / 5))}${"░".repeat(20 - Math.floor(newGoal.progress / 5))} ${newGoal.progress}%`;
  }

  // /goal remove <metric>
  if (trimmed.startsWith("remove ")) {
    const metric = trimmed.slice(7).trim();
    const goals = loadGoals().filter((g) => g.metric !== metric);
    saveGoals(goals);
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
  app.get("/api/goals", (_req: Request, res: Response) => {
    res.json({ goals: refreshGoals() });
  });

  app.post("/api/goals", (req: Request, res: Response) => {
    const { metric, target, period } = req.body || {};
    if (!metric || !target || !period) { res.status(400).json({ error: "metric, target, period required" }); return; }
    const goals = loadGoals().filter((g) => !(g.metric === metric && g.period === period));
    const newGoal: Goal = {
      id: `goal-${Date.now()}`, metric, target: Number(target), period,
      current: getCurrentValue(metric, period), progress: 0,
      createdAt: new Date().toISOString(), icon: METRIC_ICONS[metric] || "🎯",
    };
    newGoal.progress = newGoal.target > 0 ? Math.min(100, Math.round((newGoal.current / newGoal.target) * 100)) : 0;
    goals.push(newGoal);
    saveGoals(goals);
    res.json(newGoal);
  });
}

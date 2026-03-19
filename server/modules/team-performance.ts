/**
 * Team Performance — Agent productivity rankings & stats
 */

import type { Express, Request, Response } from "express";
import { getStudioDb } from "./studio-db.ts";

interface AgentPerf {
  id: string;
  name: string;
  department: string;
  avatar: string;
  tasksCompleted: number;
  tasksInProgress: number;
  totalTasks: number;
  completionRate: number;
  avgCompletionHours: number;
  weeklyTrend: "up" | "down" | "stable";
  streak: number;
}

export function registerTeamPerformanceRoutes(app: Express): void {
  app.get("/api/team-performance", (_req: Request, res: Response) => {
    const db = getStudioDb();

    try {
      // Get agents
      const agents = db.prepare("SELECT id, name, department, avatar FROM agents ORDER BY name").all() as any[];

      const perfData: AgentPerf[] = agents.map(agent => {
        // Tasks stats per agent
        let completed = 0, inProgress = 0, total = 0;
        try {
          const taskStats = db.prepare(
            "SELECT status, COUNT(*) as cnt FROM tasks WHERE assigned_to = ? GROUP BY status"
          ).all(agent.id) as any[];
          for (const s of taskStats) {
            total += s.cnt;
            if (s.status === "done") completed = s.cnt;
            if (s.status === "in_progress") inProgress = s.cnt;
          }
        } catch {}

        // Weekly tasks done
        let weekDone = 0, prevWeekDone = 0;
        try {
          weekDone = (db.prepare(
            "SELECT COUNT(*) as cnt FROM tasks WHERE assigned_to = ? AND status = 'done' AND updated_at >= datetime('now', '-7 days')"
          ).get(agent.id) as any)?.cnt || 0;
          prevWeekDone = (db.prepare(
            "SELECT COUNT(*) as cnt FROM tasks WHERE assigned_to = ? AND status = 'done' AND updated_at >= datetime('now', '-14 days') AND updated_at < datetime('now', '-7 days')"
          ).get(agent.id) as any)?.cnt || 0;
        } catch {}

        const trend = weekDone > prevWeekDone ? "up" : weekDone < prevWeekDone ? "down" : "stable";
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
          id: agent.id,
          name: agent.name,
          department: agent.department || "General",
          avatar: agent.avatar || "🤖",
          tasksCompleted: completed,
          tasksInProgress: inProgress,
          totalTasks: total,
          completionRate: rate,
          avgCompletionHours: 0,
          weeklyTrend: trend,
          streak: weekDone,
        };
      });

      // Sort by completion rate, then tasks completed
      perfData.sort((a, b) => b.completionRate - a.completionRate || b.tasksCompleted - a.tasksCompleted);

      // Team summary
      const totalCompleted = perfData.reduce((s, a) => s + a.tasksCompleted, 0);
      const totalInProgress = perfData.reduce((s, a) => s + a.tasksInProgress, 0);
      const totalAll = perfData.reduce((s, a) => s + a.totalTasks, 0);
      const avgRate = perfData.length > 0 ? Math.round(perfData.reduce((s, a) => s + a.completionRate, 0) / perfData.length) : 0;

      res.json({
        ok: true,
        agents: perfData,
        summary: {
          totalAgents: perfData.length,
          totalCompleted,
          totalInProgress,
          totalTasks: totalAll,
          avgCompletionRate: avgRate,
          topPerformer: perfData[0]?.name || "N/A",
        },
      });
    } catch {
      res.json({ ok: true, agents: [], summary: { totalAgents: 0, totalCompleted: 0, totalInProgress: 0, totalTasks: 0, avgCompletionRate: 0, topPerformer: "N/A" } });
    }
  });

  console.log("[TeamPerf] 📋 API ready");
}

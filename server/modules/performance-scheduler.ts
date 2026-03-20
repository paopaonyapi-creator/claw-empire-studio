/**
 * Performance-based Scheduling
 * Agent scoring + tier system + priority task routing
 * Tiers: ⭐ Rookie → 🌟 Pro → 💎 Elite → 👑 Legend
 */

import type { Express } from "express";

const PORT = process.env.PORT || 8790;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentTier = "rookie" | "pro" | "elite" | "legend";

export interface AgentPerformance {
  agentId: string;
  agentName: string;
  departmentId: string;
  role: string;
  score: number;
  tier: AgentTier;
  tierEmoji: string;
  tierLabel: string;
  stats: {
    tasksDone: number;
    xp: number;
    completionRate: number;
    avgTaskTime: number; // minutes (estimated)
    streak: number; // consecutive completions
  };
  rank: number;
}

// ---------------------------------------------------------------------------
// Tier System
// ---------------------------------------------------------------------------

const TIER_THRESHOLDS: { tier: AgentTier; minScore: number; emoji: string; label: string }[] = [
  { tier: "legend", minScore: 200, emoji: "👑", label: "Legend" },
  { tier: "elite", minScore: 100, emoji: "💎", label: "Elite" },
  { tier: "pro", minScore: 40, emoji: "🌟", label: "Pro" },
  { tier: "rookie", minScore: 0, emoji: "⭐", label: "Rookie" },
];

function getTier(score: number): { tier: AgentTier; emoji: string; label: string } {
  for (const t of TIER_THRESHOLDS) {
    if (score >= t.minScore) return t;
  }
  return TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];
}

// ---------------------------------------------------------------------------
// Score Calculation
// ---------------------------------------------------------------------------

function calculateAgentScore(agent: any, tasks: any[]): number {
  const tasksDone = agent.stats_tasks_done || 0;
  const xp = agent.stats_xp || 0;
  
  // Count agent's tasks
  const agentTasks = tasks.filter((t: any) => t.assigned_agent_id === agent.id);
  const doneTasks = agentTasks.filter((t: any) => t.status === "done").length;
  const failedTasks = agentTasks.filter((t: any) => t.status === "failed").length;
  const totalAttempted = doneTasks + failedTasks;
  const completionRate = totalAttempted > 0 ? doneTasks / totalAttempted : 0.5;

  // Score formula
  const score = (tasksDone * 2) + (xp * 0.5) + (completionRate * 50) - (failedTasks * 5);
  return Math.max(0, Math.round(score));
}

function estimateAvgTaskTime(agent: any, tasks: any[]): number {
  const agentTasks = tasks.filter((t: any) => 
    t.assigned_agent_id === agent.id && t.status === "done" && t.started_at && t.completed_at
  );
  if (agentTasks.length === 0) return 0;

  const totalMs = agentTasks.reduce((sum: number, t: any) => {
    const start = new Date(t.started_at).getTime();
    const end = new Date(t.completed_at || t.updated_at).getTime();
    return sum + Math.max(0, end - start);
  }, 0);

  return Math.round(totalMs / agentTasks.length / 60000); // minutes
}

function calculateStreak(agent: any, tasks: any[]): number {
  const agentTasks = tasks
    .filter((t: any) => t.assigned_agent_id === agent.id && (t.status === "done" || t.status === "failed"))
    .sort((a: any, b: any) => (b.updated_at || 0) - (a.updated_at || 0));

  let streak = 0;
  for (const t of agentTasks) {
    if (t.status === "done") streak++;
    else break;
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

async function fetchData(): Promise<{ agents: any[]; tasks: any[] }> {
  try {
    const [agentsRes, tasksRes] = await Promise.all([
      fetch(`http://127.0.0.1:${PORT}/api/agents`),
      fetch(`http://127.0.0.1:${PORT}/api/tasks`),
    ]);
    const agentsData = agentsRes.ok ? (await agentsRes.json() as any) : { agents: [] };
    const tasksData = tasksRes.ok ? (await tasksRes.json() as any) : { tasks: [] };
    return { agents: agentsData.agents || [], tasks: tasksData.tasks || [] };
  } catch {
    return { agents: [], tasks: [] };
  }
}

export async function getAgentPerformance(agentId: string): Promise<AgentPerformance | null> {
  const { agents, tasks } = await fetchData();
  const agent = agents.find((a: any) => a.id === agentId);
  if (!agent) return null;

  const score = calculateAgentScore(agent, tasks);
  const { tier, emoji, label } = getTier(score);
  const agentTasks = tasks.filter((t: any) => t.assigned_agent_id === agentId);
  const doneTasks = agentTasks.filter((t: any) => t.status === "done").length;
  const failedTasks = agentTasks.filter((t: any) => t.status === "failed").length;
  const totalAttempted = doneTasks + failedTasks;

  return {
    agentId,
    agentName: agent.name,
    departmentId: agent.department_id,
    role: agent.role,
    score,
    tier,
    tierEmoji: emoji,
    tierLabel: label,
    stats: {
      tasksDone: agent.stats_tasks_done || 0,
      xp: agent.stats_xp || 0,
      completionRate: totalAttempted > 0 ? Math.round((doneTasks / totalAttempted) * 100) : 100,
      avgTaskTime: estimateAvgTaskTime(agent, tasks),
      streak: calculateStreak(agent, tasks),
    },
    rank: 0,
  };
}

export async function getAgentRanking(): Promise<AgentPerformance[]> {
  const { agents, tasks } = await fetchData();
  
  const performances: AgentPerformance[] = agents.map((agent: any) => {
    const score = calculateAgentScore(agent, tasks);
    const { tier, emoji, label } = getTier(score);
    const agentTasks = tasks.filter((t: any) => t.assigned_agent_id === agent.id);
    const doneTasks = agentTasks.filter((t: any) => t.status === "done").length;
    const failedTasks = agentTasks.filter((t: any) => t.status === "failed").length;
    const totalAttempted = doneTasks + failedTasks;

    return {
      agentId: agent.id,
      agentName: agent.name,
      departmentId: agent.department_id,
      role: agent.role,
      score,
      tier,
      tierEmoji: emoji,
      tierLabel: label,
      stats: {
        tasksDone: agent.stats_tasks_done || 0,
        xp: agent.stats_xp || 0,
        completionRate: totalAttempted > 0 ? Math.round((doneTasks / totalAttempted) * 100) : 100,
        avgTaskTime: estimateAvgTaskTime(agent, tasks),
        streak: calculateStreak(agent, tasks),
      },
      rank: 0,
    };
  });

  performances.sort((a, b) => b.score - a.score);
  performances.forEach((p, i) => { p.rank = i + 1; });

  return performances;
}

// Get agents suitable for high-priority tasks (Elite+ only)
export async function getEliteAgents(): Promise<AgentPerformance[]> {
  const ranking = await getAgentRanking();
  return ranking.filter(a => a.tier === "elite" || a.tier === "legend");
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerPerformanceSchedulerRoutes(app: Express): void {
  // Get all agents performance + ranking
  app.get("/api/agent-performance", async (_req, res) => {
    const ranking = await getAgentRanking();
    res.json({ ok: true, agents: ranking, totalAgents: ranking.length });
  });

  // Get single agent performance
  app.get("/api/agents/:id/performance", async (req, res) => {
    const perf = await getAgentPerformance(req.params.id);
    if (!perf) return res.status(404).json({ ok: false, error: "Agent not found" });
    res.json({ ok: true, performance: perf });
  });

  // Get ranking leaderboard
  app.get("/api/agents/ranking", async (_req, res) => {
    const ranking = await getAgentRanking();
    res.json({
      ok: true,
      leaderboard: ranking.map(r => ({
        rank: r.rank,
        name: r.agentName,
        tier: `${r.tierEmoji} ${r.tierLabel}`,
        score: r.score,
        tasksDone: r.stats.tasksDone,
        streak: r.stats.streak,
        completionRate: `${r.stats.completionRate}%`,
      })),
    });
  });

  // Get elite agents (for high-priority tasks)
  app.get("/api/agents/elite", async (_req, res) => {
    const elites = await getEliteAgents();
    res.json({ ok: true, agents: elites });
  });

  console.log("[Performance Scheduler] ✅ Tier system ready (⭐→🌟→💎→👑)");
}

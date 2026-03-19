/**
 * Analytics Engine — Revenue tracking, engagement metrics, content performance
 * Aggregates data from tasks, agents, pipelines, and publishing
 */

import type { Express } from "express";

const PORT = process.env.PORT || 8800;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DailyMetrics {
  date: string;
  tasksCompleted: number;
  contentGenerated: number;
  postsPublished: number;
  agentsActive: number;
  avgQualityScore: number;
  pipelinesRun: number;
}

interface ContentPerformance {
  platform: string;
  totalPosts: number;
  avgEngagement: number;
  topContent: string;
}

// In-memory analytics store
const dailyMetrics: DailyMetrics[] = [];
const contentEvents: Array<{ type: string; platform: string; timestamp: string; data: any }> = [];

// ---------------------------------------------------------------------------
// Track Events
// ---------------------------------------------------------------------------

export function trackEvent(type: string, platform: string, data: any): void {
  contentEvents.push({
    type,
    platform,
    timestamp: new Date().toISOString(),
    data,
  });
  // Keep last 1000 events
  if (contentEvents.length > 1000) contentEvents.splice(0, contentEvents.length - 1000);
}

// ---------------------------------------------------------------------------
// Compute Analytics
// ---------------------------------------------------------------------------

async function computeDashboardAnalytics(): Promise<{
  overview: any;
  daily: DailyMetrics[];
  platforms: ContentPerformance[];
  agents: any[];
  trends: any;
}> {
  // Fetch current data
  let agents: any[] = [];
  let tasks: any[] = [];

  try {
    const agentsRes = await fetch(`http://127.0.0.1:${PORT}/api/agents`);
    if (agentsRes.ok) {
      const data = (await agentsRes.json()) as any;
      agents = data.agents || [];
    }
  } catch {}

  try {
    const tasksRes = await fetch(`http://127.0.0.1:${PORT}/api/tasks`);
    if (tasksRes.ok) {
      const data = (await tasksRes.json()) as any;
      tasks = data.tasks || [];
    }
  } catch {}

  // Overview metrics
  const completedTasks = tasks.filter((t: any) => t.status === "done");
  const totalXP = agents.reduce((s: number, a: any) => s + (a.stats?.xp || 0), 0);
  const totalTasksDone = agents.reduce((s: number, a: any) => s + (a.stats?.tasks_done || 0), 0);
  const activeAgents = agents.filter((a: any) => (a.stats?.tasks_done || 0) > 0).length;

  const overview = {
    totalAgents: agents.length,
    activeAgents,
    totalTasksDone,
    totalXP,
    completedToday: completedTasks.filter((t: any) => {
      const d = new Date(t.completed_at || t.updated_at || 0);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }).length,
    contentEvents: contentEvents.length,
    avgTasksPerAgent: agents.length > 0 ? Math.round(totalTasksDone / agents.length) : 0,
  };

  // Platform performance
  const platformMap: Record<string, { posts: number; engagement: number }> = {};
  for (const evt of contentEvents) {
    if (!platformMap[evt.platform]) platformMap[evt.platform] = { posts: 0, engagement: 0 };
    platformMap[evt.platform].posts++;
    platformMap[evt.platform].engagement += evt.data?.engagement || 0;
  }
  const platforms: ContentPerformance[] = Object.entries(platformMap).map(([platform, data]) => ({
    platform,
    totalPosts: data.posts,
    avgEngagement: data.posts > 0 ? Math.round(data.engagement / data.posts) : 0,
    topContent: "—",
  }));

  // Agent analytics
  const agentAnalytics = agents.slice(0, 10).map((a: any) => ({
    id: a.id,
    name: a.name,
    department: a.department,
    tasksDone: a.stats?.tasks_done || 0,
    xp: a.stats?.xp || 0,
    streak: a.stats?.streak || 0,
    efficiency: a.stats?.tasks_done > 0 ? Math.round(((a.stats?.tasks_done - (a.stats?.tasks_failed || 0)) / a.stats?.tasks_done) * 100) : 0,
  }));

  // Trends (mock weekly data for now)
  const trends = {
    tasksTrend: generateTrend(7, totalTasksDone),
    xpTrend: generateTrend(7, totalXP),
    contentTrend: generateTrend(7, contentEvents.length),
  };

  return { overview, daily: dailyMetrics.slice(-30), platforms, agents: agentAnalytics, trends };
}

function generateTrend(days: number, currentValue: number): Array<{ date: string; value: number }> {
  const trend: Array<{ date: string; value: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const variance = Math.floor(Math.random() * Math.max(1, currentValue * 0.3));
    trend.push({
      date: d.toISOString().slice(0, 10),
      value: Math.max(0, Math.floor(currentValue / days) + variance - Math.floor(currentValue * 0.15)),
    });
  }
  // Last day = current
  if (trend.length > 0) trend[trend.length - 1].value = currentValue;
  return trend;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerAnalyticsRoutes(app: Express): void {
  // Full dashboard analytics
  app.get("/api/analytics/dashboard", async (_req, res) => {
    const data = await computeDashboardAnalytics();
    res.json({ ok: true, ...data });
  });

  // Track event
  app.post("/api/analytics/track", (req, res) => {
    const { type, platform, data } = req.body || {};
    if (!type) return res.status(400).json({ ok: false, error: "type required" });
    trackEvent(type, platform || "unknown", data || {});
    res.json({ ok: true, total: contentEvents.length });
  });

  // Get recent events
  app.get("/api/analytics/events", (_req, res) => {
    const recent = contentEvents.slice(-50).reverse();
    res.json({ ok: true, events: recent, total: contentEvents.length });
  });

  // Provider usage stats
  app.get("/api/analytics/providers", async (_req, res) => {
    try {
      const healthRes = await fetch(`http://127.0.0.1:${PORT}/api/providers/health`);
      const healthData = healthRes.ok ? (await healthRes.json()) as any : { providers: [] };
      res.json({
        ok: true,
        providers: (healthData.providers || []).map((p: any) => ({
          name: p.name,
          status: p.statusEmoji + " " + p.status,
          uptime: p.uptime + "%",
          latency: p.latencyMs ? p.latencyMs + "ms" : "N/A",
          configured: p.configured,
        })),
      });
    } catch {
      res.json({ ok: true, providers: [] });
    }
  });

  console.log("[Analytics] ✅ Dashboard analytics engine ready");
}

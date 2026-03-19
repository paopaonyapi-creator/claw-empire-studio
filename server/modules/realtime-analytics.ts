/**
 * Real-time Analytics — Live metrics, charts data, system pulse
 * Aggregates everything for a real-time dashboard experience
 */

import type { Express } from "express";

const PORT = process.env.PORT || 8800;

// ---------------------------------------------------------------------------
// Pulse Data (updated every call)
// ---------------------------------------------------------------------------

interface SystemPulse {
  timestamp: string;
  uptime: number;
  agents: { total: number; active: number };
  tasks: { total: number; completed: number; pending: number; inProgress: number };
  providers: { total: number; healthy: number; bestProvider: string };
  content: { generated: number; published: number; avgScore: number };
  costs: { totalUSD: number; breakdown: Record<string, number> };
}

const pulseHistory: SystemPulse[] = [];
const startTime = Date.now();

// ---------------------------------------------------------------------------
// Core: Collect Real-time Data
// ---------------------------------------------------------------------------

async function collectPulse(): Promise<SystemPulse> {
  const pulse: SystemPulse = {
    timestamp: new Date().toISOString(),
    uptime: Math.round((Date.now() - startTime) / 1000),
    agents: { total: 0, active: 0 },
    tasks: { total: 0, completed: 0, pending: 0, inProgress: 0 },
    providers: { total: 5, healthy: 0, bestProvider: "gemini" },
    content: { generated: 0, published: 0, avgScore: 0 },
    costs: { totalUSD: 0, breakdown: {} },
  };

  try {
    // Agents
    const agentsRes = await fetch(`http://127.0.0.1:${PORT}/api/agents`);
    if (agentsRes.ok) {
      const data = (await agentsRes.json()) as any;
      const agents = data.agents || [];
      pulse.agents.total = agents.length;
      pulse.agents.active = agents.filter((a: any) => (a.stats?.tasks_done || 0) > 0).length;
    }
  } catch {}

  try {
    // Tasks
    const tasksRes = await fetch(`http://127.0.0.1:${PORT}/api/tasks`);
    if (tasksRes.ok) {
      const data = (await tasksRes.json()) as any;
      const tasks = data.tasks || [];
      pulse.tasks.total = tasks.length;
      pulse.tasks.completed = tasks.filter((t: any) => t.status === "done").length;
      pulse.tasks.pending = tasks.filter((t: any) => t.status === "pending" || t.status === "queued").length;
      pulse.tasks.inProgress = tasks.filter((t: any) => t.status === "in_progress" || t.status === "running").length;
    }
  } catch {}

  try {
    // Providers
    const healthRes = await fetch(`http://127.0.0.1:${PORT}/api/providers/health`);
    if (healthRes.ok) {
      const data = (await healthRes.json()) as any;
      const providers = data.providers || [];
      pulse.providers.total = providers.filter((p: any) => p.configured).length;
      pulse.providers.healthy = providers.filter((p: any) => p.status === "healthy").length;
      pulse.providers.bestProvider = data.bestProvider || "gemini";
    }
  } catch {}

  try {
    // Costs
    const costsRes = await fetch(`http://127.0.0.1:${PORT}/api/costs/summary`);
    if (costsRes.ok) {
      const data = (await costsRes.json()) as any;
      pulse.costs.totalUSD = data.totalCost || 0;
      for (const [k, v] of Object.entries(data.byProvider || {}) as any) {
        pulse.costs.breakdown[k] = v.cost;
      }
    }
  } catch {}

  // Store
  pulseHistory.push(pulse);
  if (pulseHistory.length > 100) pulseHistory.splice(0, pulseHistory.length - 100);

  return pulse;
}

// Generate chart-ready time series
function getTimeSeriesData(metric: string, points: number = 24): Array<{ time: string; value: number }> {
  const recent = pulseHistory.slice(-points);
  return recent.map(p => {
    let value = 0;
    switch (metric) {
      case "tasks": value = p.tasks.completed; break;
      case "agents": value = p.agents.active; break;
      case "providers": value = p.providers.healthy; break;
      case "costs": value = p.costs.totalUSD; break;
      case "uptime": value = p.uptime; break;
      default: value = 0;
    }
    return { time: p.timestamp, value };
  });
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerRealtimeAnalyticsRoutes(app: Express): void {
  // Current pulse
  app.get("/api/realtime/pulse", async (_req, res) => {
    const pulse = await collectPulse();
    res.json({ ok: true, pulse });
  });

  // Pulse history
  app.get("/api/realtime/history", (_req, res) => {
    res.json({ ok: true, history: pulseHistory.slice(-50), total: pulseHistory.length });
  });

  // Time series for charts
  app.get("/api/realtime/series/:metric", (req, res) => {
    const metric = req.params.metric;
    const points = parseInt(req.query.points as string) || 24;
    const data = getTimeSeriesData(metric, points);
    res.json({ ok: true, metric, data });
  });

  // Full dashboard snapshot
  app.get("/api/realtime/snapshot", async (_req, res) => {
    const pulse = await collectPulse();
    res.json({
      ok: true,
      snapshot: {
        pulse,
        charts: {
          tasks: getTimeSeriesData("tasks"),
          agents: getTimeSeriesData("agents"),
          costs: getTimeSeriesData("costs"),
        },
        summary: {
          uptimeHours: Math.round(pulse.uptime / 3600),
          healthyProviders: `${pulse.providers.healthy}/${pulse.providers.total}`,
          taskCompletion: pulse.tasks.total > 0 ? Math.round((pulse.tasks.completed / pulse.tasks.total) * 100) : 0,
        },
      },
    });
  });

  // Auto-collect pulse every 2 minutes
  setInterval(async () => {
    try { await collectPulse(); } catch {}
  }, 2 * 60 * 1000);

  console.log("[Realtime Analytics] ✅ Live metrics and charting ready");
}

/**
 * Smart TG Notifications — Intelligent notifications for milestones
 * Tier-ups, streaks, daily summaries, anomaly detection
 */

import type { Express } from "express";

const PORT = process.env.PORT || 8790;

// Track last known tiers for change detection
const lastKnownTiers: Map<string, string> = new Map();
const milestonesSent: Set<string> = new Set();

// ---------------------------------------------------------------------------
// Notification Triggers
// ---------------------------------------------------------------------------

async function sendTg(text: string): Promise<void> {
  try {
    const { sendTgNotification } = await import("./auto-pipeline.ts");
    await sendTgNotification(text);
  } catch {}
}

// Check for tier changes and milestones
export async function checkAndNotify(): Promise<void> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/agent-performance`);
    if (!res.ok) return;
    const data = (await res.json()) as any;
    const agents = data.agents || [];

    for (const agent of agents) {
      const prevTier = lastKnownTiers.get(agent.agentId);
      const currentTier = `${agent.tierEmoji} ${agent.tierLabel}`;

      // Tier-up notification
      if (prevTier && prevTier !== currentTier) {
        await sendTg(
          `🎉 <b>Tier Up!</b>\n\n` +
          `${agent.agentName} เลื่อนขั้นแล้ว!\n` +
          `${prevTier} → ${currentTier}\n` +
          `📊 Score: ${agent.score} pts`
        );
      }
      lastKnownTiers.set(agent.agentId, currentTier);

      // Milestone notifications
      const milestones = [10, 25, 50, 100, 200, 500];
      for (const m of milestones) {
        const key = `${agent.agentId}_tasks_${m}`;
        if (agent.stats.tasksDone >= m && !milestonesSent.has(key)) {
          milestonesSent.add(key);
          await sendTg(
            `🏅 <b>Milestone!</b>\n\n` +
            `${agent.agentName} ทำงานครบ ${m} tasks แล้ว! 🎊\n` +
            `${currentTier} · Score: ${agent.score}`
          );
        }
      }

      // Streak notifications
      const streakMilestones = [5, 10, 20, 50];
      for (const s of streakMilestones) {
        const key = `${agent.agentId}_streak_${s}`;
        if (agent.stats.streak >= s && !milestonesSent.has(key)) {
          milestonesSent.add(key);
          await sendTg(
            `🔥 <b>Streak x${s}!</b>\n\n` +
            `${agent.agentName} ทำงานสำเร็จติดต่อกัน ${s} ครั้ง!`
          );
        }
      }
    }
  } catch {}
}

// Daily performance summary
export async function sendDailyPerformanceSummary(): Promise<void> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/agent-performance`);
    if (!res.ok) return;
    const data = (await res.json()) as any;
    const agents = (data.agents || []).slice(0, 5);

    if (agents.length === 0) return;

    let msg = `📊 <b>Daily Agent Performance</b>\n\n`;
    for (const a of agents) {
      msg += `${a.rank}. ${a.tierEmoji} ${a.agentName} — ${a.score}pts (✅${a.stats.tasksDone} tasks, 🔥${a.stats.streak} streak)\n`;
    }

    const totalTasks = agents.reduce((s: number, a: any) => s + a.stats.tasksDone, 0);
    const avgScore = Math.round(agents.reduce((s: number, a: any) => s + a.score, 0) / agents.length);
    msg += `\n📈 Total: ${totalTasks} tasks · Avg Score: ${avgScore}pts`;

    await sendTg(msg);
  } catch {}
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

let notifyInterval: ReturnType<typeof setInterval> | null = null;

export function startSmartNotifications(): void {
  // Check every 5 minutes
  notifyInterval = setInterval(checkAndNotify, 5 * 60 * 1000);
  
  // Daily summary at startup (will be rescheduled)
  setTimeout(sendDailyPerformanceSummary, 30000);

  console.log("[Smart Notifications] ✅ Milestone & tier-up alerts active");
}

export function registerSmartNotificationRoutes(app: Express): void {
  // Trigger manual check
  app.post("/api/notifications/check", async (_req, res) => {
    await checkAndNotify();
    res.json({ ok: true, message: "Check complete" });
  });

  // Trigger daily summary  
  app.post("/api/notifications/daily-summary", async (_req, res) => {
    await sendDailyPerformanceSummary();
    res.json({ ok: true, message: "Summary sent" });
  });

  // Get notification settings
  app.get("/api/notifications/settings", (_req, res) => {
    res.json({
      ok: true,
      settings: {
        tierUpAlerts: true,
        milestoneAlerts: true,
        streakAlerts: true,
        dailySummary: true,
        checkInterval: "5 minutes",
      },
    });
  });

  startSmartNotifications();
}

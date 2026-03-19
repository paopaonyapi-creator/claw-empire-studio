/**
 * Smart Insights Pro — AI-powered trend analysis + recommendations
 *
 * Analyzes studio data patterns and generates actionable insights.
 */

import type { Express, Request, Response } from "express";
import { getStudioDb } from "./studio-db.ts";

interface Insight {
  id: string;
  type: "trend" | "alert" | "recommendation" | "achievement";
  icon: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  timestamp: string;
}

function generateInsights(): Insight[] {
  const db = getStudioDb();
  const insights: Insight[] = [];
  const now = new Date();

  // 1. Revenue trend analysis
  try {
    const today = now.toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const todayRev = (db.prepare("SELECT SUM(amount) as total FROM studio_revenue WHERE DATE(created_at) = ?").get(today) as any)?.total || 0;
    const yesterdayRev = (db.prepare("SELECT SUM(amount) as total FROM studio_revenue WHERE DATE(created_at) = ?").get(yesterday) as any)?.total || 0;

    if (todayRev > yesterdayRev && yesterdayRev > 0) {
      const growthPct = Math.round(((todayRev - yesterdayRev) / yesterdayRev) * 100);
      insights.push({
        id: "rev_growth", type: "trend", icon: "📈", priority: "high",
        title: `Revenue เติบโต +${growthPct}%`,
        description: `วันนี้ ฿${todayRev.toLocaleString()} vs เมื่อวาน ฿${yesterdayRev.toLocaleString()}`,
        timestamp: now.toISOString(),
      });
    } else if (todayRev < yesterdayRev && yesterdayRev > 0) {
      const dropPct = Math.round(((yesterdayRev - todayRev) / yesterdayRev) * 100);
      insights.push({
        id: "rev_drop", type: "alert", icon: "📉", priority: "high",
        title: `Revenue ลดลง -${dropPct}%`,
        description: `วันนี้ ฿${todayRev.toLocaleString()} vs เมื่อวาน ฿${yesterdayRev.toLocaleString()} — ลองเช็คแคมเปญ`,
        timestamp: now.toISOString(),
      });
    }
  } catch {}

  // 2. Task completion analysis
  try {
    const weekDone = (db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'done' AND updated_at >= datetime('now', '-7 days')").get() as any)?.cnt || 0;
    const weekCreated = (db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE created_at >= datetime('now', '-7 days')").get() as any)?.cnt || 0;

    if (weekDone >= 10) {
      insights.push({
        id: "tasks_productive", type: "achievement", icon: "🏅", priority: "medium",
        title: `Productive Week! (${weekDone} tasks done)`,
        description: `ทำ ${weekDone} tasks สำเร็จใน 7 วัน — เก่งมาก!`,
        timestamp: now.toISOString(),
      });
    }
    if (weekCreated > weekDone * 2 && weekCreated > 5) {
      insights.push({
        id: "tasks_backlog", type: "alert", icon: "⚠️", priority: "medium",
        title: `Task Backlog สะสม`,
        description: `สร้าง ${weekCreated} tasks แต่ทำเสร็จ ${weekDone} — ลอง prioritize`,
        timestamp: now.toISOString(),
      });
    }
  } catch {}

  // 3. KPI Goals progress
  try {
    const goals = db.prepare("SELECT metric, target, current, icon FROM studio_kpi_goals WHERE target > 0").all() as any[];
    for (const g of goals) {
      const pct = Math.round((g.current / g.target) * 100);
      if (pct >= 90 && pct < 100) {
        insights.push({
          id: `kpi_close_${g.metric}`, type: "recommendation", icon: "🎯", priority: "high",
          title: `${g.icon} ${g.metric} ใกล้ถึงเป้าแล้ว!`,
          description: `${pct}% (${g.current}/${g.target}) — อีกนิดเดียว!`,
          timestamp: now.toISOString(),
        });
      } else if (pct >= 100) {
        insights.push({
          id: `kpi_done_${g.metric}`, type: "achievement", icon: "🏆", priority: "medium",
          title: `${g.icon} ${g.metric} ถึงเป้าแล้ว!`,
          description: `${pct}% — สำเร็จ! ลองตั้งเป้าใหม่ที่สูงกว่า`,
          timestamp: now.toISOString(),
        });
      }
    }
  } catch {}

  // 4. Login streak achievement
  try {
    const gami = db.prepare("SELECT current_streak, total_xp FROM studio_gamification WHERE id = 1").get() as any;
    if (gami?.current_streak >= 7) {
      insights.push({
        id: "streak_7", type: "achievement", icon: "🔥", priority: "low",
        title: `${gami.current_streak} Day Streak!`,
        description: `เข้าระบบติดต่อกัน ${gami.current_streak} วัน — รวม ${gami.total_xp} XP`,
        timestamp: now.toISOString(),
      });
    }
  } catch {}

  // 5. Best platform recommendation
  try {
    const topPlatform = db.prepare(
      "SELECT platform, SUM(amount) as total FROM studio_revenue WHERE created_at >= datetime('now', '-30 days') GROUP BY platform ORDER BY total DESC LIMIT 1"
    ).get() as any;
    if (topPlatform?.total > 0) {
      insights.push({
        id: "top_platform", type: "recommendation", icon: "💡", priority: "medium",
        title: `เพิ่ม content บน ${topPlatform.platform}`,
        description: `${topPlatform.platform} สร้างรายได้สูงสุด ฿${topPlatform.total.toLocaleString()} ใน 30 วัน — ลง content เพิ่ม!`,
        timestamp: now.toISOString(),
      });
    }
  } catch {}

  // 6. Fallback — getting started tips if no data
  if (insights.length === 0) {
    insights.push(
      { id: "gs_1", type: "recommendation", icon: "🚀", title: "เริ่มใช้งาน!", description: "สร้าง task, เพิ่มสินค้า, ทำ content — แล้ว Insights จะวิเคราะห์ให้อัตโนมัติ", priority: "low", timestamp: now.toISOString() },
      { id: "gs_2", type: "recommendation", icon: "🎯", title: "ตั้ง KPI Goals", description: "ไปที่ KPI Goals widget → กด ➕ สร้างเป้าหมายรายได้/tasks", priority: "low", timestamp: now.toISOString() },
      { id: "gs_3", type: "recommendation", icon: "🤖", title: "ลอง AI Scheduler", description: "ตั้งเวลาให้ AI สร้าง content อัตโนมัติทุกวัน", priority: "low", timestamp: now.toISOString() },
    );
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return insights;
}

export function registerSmartInsightsRoutes(app: Express): void {
  app.get("/api/smart-insights", (_req: Request, res: Response) => {
    const insights = generateInsights();
    res.json({ ok: true, insights, totalInsights: insights.length });
  });

  console.log("[SmartInsights] 🧠 API ready");
}

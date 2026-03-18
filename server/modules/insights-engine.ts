/**
 * Smart Insights Engine — AI-powered analytics
 *
 * Auto-analyzes: best posting time, top platform, conversion rate
 * TG command: /insights
 */

import type { Express, Request, Response } from "express";
import { existsSync, readFileSync } from "node:fs";
import path from "path";

interface InsightCard {
  id: string;
  type: "tip" | "warning" | "trend" | "achievement";
  icon: string;
  title: string;
  message: string;
  metric?: string;
  change?: string;
  priority: number; // 1-10
}

function loadJsonFile(filename: string): unknown[] {
  try {
    const p = path.resolve(`data/${filename}`);
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf-8")) || [];
  } catch { /* ignore */ }
  return [];
}

function generateInsights(): InsightCard[] {
  const insights: InsightCard[] = [];
  const tasks = loadJsonFile("tasks.json") as Array<{ status?: string; created_at?: string; updated_at?: string; title?: string; agent_id?: string }>;
  const links = loadJsonFile("links.json") as Array<{ clicks?: number; shortCode?: string; originalUrl?: string; platform?: string }>;
  const revenue = loadJsonFile("revenue.json") as Array<{ amount?: number; platform?: string; timestamp?: string; productName?: string }>;
  const calendar = loadJsonFile("calendar.json") as Array<{ day?: string; status?: string; platform?: string }>;

  // ─── Task Insights ───
  const doneTasks = tasks.filter((t) => t.status === "done");
  const totalTasks = tasks.length;

  if (totalTasks > 0) {
    const completionRate = Math.round((doneTasks.length / totalTasks) * 100);
    insights.push({
      id: "task_rate",
      type: completionRate >= 80 ? "achievement" : completionRate >= 50 ? "tip" : "warning",
      icon: completionRate >= 80 ? "🏆" : completionRate >= 50 ? "📊" : "⚠️",
      title: "Task Completion Rate",
      message: completionRate >= 80
        ? `ยอดเยี่ยม! ทำเสร็จ ${completionRate}% — ทีมทำงานดีมาก`
        : completionRate >= 50
          ? `${completionRate}% เสร็จแล้ว — ยังมี ${totalTasks - doneTasks.length} tasks รอทำ`
          : `แค่ ${completionRate}% เสร็จ — ต้องเร่งให้ Agent ทำงาน`,
      metric: `${doneTasks.length}/${totalTasks}`,
      priority: completionRate >= 80 ? 3 : 7,
    });
  }

  // ─── Best Posting Time Analysis ───
  if (doneTasks.length >= 3) {
    const hours: Record<number, number> = {};
    for (const t of doneTasks) {
      if (t.updated_at) {
        const h = new Date(t.updated_at).getHours();
        hours[h] = (hours[h] || 0) + 1;
      }
    }
    const bestHour = Object.entries(hours)
      .sort(([, a], [, b]) => b - a)[0];

    if (bestHour) {
      insights.push({
        id: "best_time",
        type: "tip",
        icon: "⏰",
        title: "Best Posting Time",
        message: `เวลาที่ content สำเร็จมากสุดคือ ${bestHour[0]}:00 น. — ลองโพสต์ช่วงนี้`,
        metric: `${bestHour[0]}:00`,
        priority: 5,
      });
    }
  }

  // ─── Link Performance ───
  const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);
  if (links.length > 0) {
    const avgClicks = Math.round(totalClicks / links.length);
    const topLink = [...links].sort((a, b) => (b.clicks || 0) - (a.clicks || 0))[0];

    insights.push({
      id: "link_perf",
      type: totalClicks > 100 ? "achievement" : "tip",
      icon: "🔗",
      title: "Link Performance",
      message: totalClicks > 100
        ? `เยี่ยม! ${totalClicks} clicks รวม — เฉลี่ย ${avgClicks}/link`
        : `${totalClicks} clicks — สร้าง content เพิ่มเพื่อดัน traffic`,
      metric: `${totalClicks} clicks`,
      priority: 4,
    });

    if (topLink && (topLink.clicks || 0) > 0) {
      insights.push({
        id: "top_link",
        type: "trend",
        icon: "🔥",
        title: "Top Performing Link",
        message: `${topLink.shortCode} ได้ ${topLink.clicks} clicks — ใช้สินค้านี้ทำ content เพิ่ม!`,
        metric: `${topLink.clicks} clicks`,
        priority: 6,
      });
    }
  }

  // ─── Revenue Insights ───
  if (revenue.length > 0) {
    const totalRevenue = revenue.reduce((sum, r) => sum + (r.amount || 0), 0);
    const thisWeek = revenue.filter((r) => {
      const d = new Date(r.timestamp || "");
      return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
    });
    const weekRevenue = thisWeek.reduce((sum, r) => sum + (r.amount || 0), 0);

    const platformTotals: Record<string, number> = {};
    for (const r of revenue) {
      platformTotals[r.platform || "other"] = (platformTotals[r.platform || "other"] || 0) + (r.amount || 0);
    }
    const topPlatform = Object.entries(platformTotals).sort(([, a], [, b]) => b - a)[0];

    insights.push({
      id: "revenue_total",
      type: totalRevenue > 10000 ? "achievement" : "trend",
      icon: "💰",
      title: "Revenue Overview",
      message: `รายได้รวม ${totalRevenue.toLocaleString()} THB — สัปดาห์นี้ ${weekRevenue.toLocaleString()} THB`,
      metric: `${totalRevenue.toLocaleString()} THB`,
      priority: 8,
    });

    if (topPlatform) {
      insights.push({
        id: "top_platform",
        type: "trend",
        icon: "🏪",
        title: "Top Platform",
        message: `${topPlatform[0]} สร้างรายได้มากสุด: ${topPlatform[1].toLocaleString()} THB — เน้น platform นี้`,
        metric: topPlatform[0],
        priority: 5,
      });
    }
  }

  // ─── Calendar Insights ───
  if (calendar.length > 0) {
    const scheduled = calendar.filter((c) => c.status === "scheduled").length;
    const posted = calendar.filter((c) => c.status === "posted").length;

    if (scheduled > 0) {
      insights.push({
        id: "calendar_upcoming",
        type: "tip",
        icon: "📅",
        title: "Upcoming Posts",
        message: `มี ${scheduled} posts ในคิว — อย่าลืมโพสต์!`,
        metric: `${scheduled} scheduled`,
        priority: 6,
      });
    }

    if (posted > 0) {
      insights.push({
        id: "calendar_posted",
        type: "achievement",
        icon: "✅",
        title: "Posts Completed",
        message: `โพสต์ไปแล้ว ${posted} ชิ้น — keep going! 💪`,
        metric: `${posted} posted`,
        priority: 3,
      });
    }
  }

  // ─── Default insight if nothing ───
  if (insights.length === 0) {
    insights.push({
      id: "getting_started",
      type: "tip",
      icon: "🚀",
      title: "Getting Started",
      message: "เริ่มใช้งาน! สร้าง task, เพิ่มสินค้า, ทำ content — แล้ว Insights จะวิเคราะห์ให้อัตโนมัติ",
      priority: 1,
    });
  }

  return insights.sort((a, b) => b.priority - a.priority);
}

// ---------------------------------------------------------------------------
// TG Command Handler
// ---------------------------------------------------------------------------

export function handleInsightsCommand(): string {
  const insights = generateInsights();
  let msg = `🧠 Smart Insights\n${"═".repeat(22)}\n\n`;

  for (const insight of insights.slice(0, 8)) {
    msg += `${insight.icon} ${insight.title}\n`;
    msg += `${insight.message}\n`;
    if (insight.metric) msg += `📊 ${insight.metric}\n`;
    msg += "\n";
  }

  msg += `─────────────\n${insights.length} insights generated`;
  return msg;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerInsightsRoutes(app: Express): void {
  app.get("/api/insights", (_req: Request, res: Response) => {
    res.json({
      insights: generateInsights(),
      generatedAt: new Date().toISOString(),
    });
  });
}

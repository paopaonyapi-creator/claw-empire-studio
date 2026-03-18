/**
 * CEO Morning Brief — Daily auto-summary sent to Telegram
 *
 * Compiles: tasks, revenue, insights, calendar, agent status
 * Auto-sends at 09:00 Thai time
 * TG command: /brief (manual trigger)
 * API: GET /api/brief (JSON), GET /api/report/pdf (HTML report)
 */

import type { Express, Request, Response } from "express";
import { existsSync, readFileSync } from "node:fs";
import path from "path";

const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

function loadJson(filename: string): unknown[] {
  try {
    const p = path.resolve(`data/${filename}`);
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf-8")) || [];
  } catch { /* ignore */ }
  return [];
}

interface BriefData {
  date: string;
  greeting: string;
  tasks: { total: number; done: number; inProgress: number; pending: number };
  revenue: { today: number; week: number; month: number; topProduct: string };
  calendar: { scheduledToday: number; entries: Array<{ time: string; product: string; platform: string }> };
  agents: { total: number; working: number; topAgent: string };
  insights: Array<{ icon: string; title: string; message: string }>;
}

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "🌅 สวัสดีตอนเช้า";
  if (h < 17) return "☀️ สวัสดีตอนบ่าย";
  return "🌙 สวัสดีตอนเย็น";
}

export function generateBrief(): BriefData {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const todayDay = dayNames[now.getDay()];

  // Tasks
  const tasks = loadJson("tasks.json") as Array<{ status?: string }>;
  const done = tasks.filter((t) => t.status === "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const pending = tasks.filter((t) => t.status === "pending" || t.status === "queued").length;

  // Revenue
  const revenue = loadJson("revenue.json") as Array<{ amount?: number; timestamp?: string; productName?: string }>;
  const todayRev = revenue.filter((r) => (r.timestamp || "").startsWith(todayStr));
  const weekRev = revenue.filter((r) => {
    const d = new Date(r.timestamp || "");
    return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  });
  const monthRev = revenue.filter((r) => {
    const d = new Date(r.timestamp || "");
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const productTotals: Record<string, number> = {};
  for (const r of revenue) { productTotals[r.productName || ""] = (productTotals[r.productName || ""] || 0) + (r.amount || 0); }
  const topProduct = Object.entries(productTotals).sort(([, a], [, b]) => b - a)[0]?.[0] || "—";

  // Calendar
  const calendar = loadJson("calendar.json") as Array<{ day?: string; time?: string; productName?: string; platform?: string; status?: string; weekOf?: string }>;
  const todayEntries = calendar.filter((c) => c.day === todayDay && c.status === "scheduled");

  // Agents
  const agents = loadJson("agents.json") as Array<{ status?: string; name?: string; tasks_completed?: number }>;
  const working = agents.filter((a) => a.status === "working" || a.status === "busy").length;
  const topAgent = [...agents].sort((a, b) => (b.tasks_completed || 0) - (a.tasks_completed || 0))[0]?.name || "—";

  // Insights (top 3)
  const insightsRaw = loadJson("insights-cache.json") as Array<{ icon?: string; title?: string; message?: string }>;
  const topInsights = insightsRaw.slice(0, 3).map((i) => ({
    icon: i.icon || "💡",
    title: i.title || "",
    message: i.message || "",
  }));

  return {
    date: now.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    greeting: getTimeGreeting(),
    tasks: { total: tasks.length, done, inProgress, pending },
    revenue: {
      today: todayRev.reduce((s, r) => s + (r.amount || 0), 0),
      week: weekRev.reduce((s, r) => s + (r.amount || 0), 0),
      month: monthRev.reduce((s, r) => s + (r.amount || 0), 0),
      topProduct,
    },
    calendar: {
      scheduledToday: todayEntries.length,
      entries: todayEntries.map((e) => ({ time: e.time || "", product: e.productName || "", platform: e.platform || "" })),
    },
    agents: { total: agents.length, working, topAgent },
    insights: topInsights,
  };
}

// ---------------------------------------------------------------------------
// TG Command
// ---------------------------------------------------------------------------

export function handleBriefCommand(): string {
  const b = generateBrief();
  let msg = `${b.greeting}, Boss! 👋\n`;
  msg += `📅 ${b.date}\n`;
  msg += `${"═".repeat(26)}\n\n`;

  msg += `📋 TASKS\n`;
  msg += `  ✅ Done: ${b.tasks.done}  ⏳ In Progress: ${b.tasks.inProgress}  📋 Pending: ${b.tasks.pending}\n\n`;

  msg += `💰 REVENUE\n`;
  msg += `  วันนี้: ฿${b.revenue.today.toLocaleString()}\n`;
  msg += `  7 วัน: ฿${b.revenue.week.toLocaleString()}\n`;
  msg += `  เดือน: ฿${b.revenue.month.toLocaleString()}\n`;
  if (b.revenue.topProduct !== "—") msg += `  🏆 Top: ${b.revenue.topProduct}\n`;
  msg += "\n";

  msg += `📅 TODAY'S SCHEDULE\n`;
  if (b.calendar.scheduledToday === 0) {
    msg += `  📭 ไม่มี post วันนี้\n`;
  } else {
    for (const e of b.calendar.entries) {
      msg += `  ⏰ ${e.time} — ${e.product} (${e.platform})\n`;
    }
  }
  msg += "\n";

  msg += `🤖 AGENTS\n`;
  msg += `  ${b.agents.working}/${b.agents.total} กำลังทำงาน\n`;
  if (b.agents.topAgent !== "—") msg += `  🏆 Top: ${b.agents.topAgent}\n`;

  if (b.insights.length > 0) {
    msg += `\n🧠 INSIGHTS\n`;
    for (const i of b.insights) {
      msg += `  ${i.icon} ${i.title}: ${i.message}\n`;
    }
  }

  msg += `\n─────────────\n💡 /revenue /schedule /insights`;
  return msg;
}

// ---------------------------------------------------------------------------
// Auto-scheduler (09:00 Thai time)
// ---------------------------------------------------------------------------

async function sendTg(text: string): Promise<void> {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: "HTML" }),
    });
  } catch { /* ignore */ }
}

export function startMorningBriefScheduler(): void {
  setInterval(() => {
    const now = new Date();
    // Check if it's 09:00 (within 30-second window)
    if (now.getHours() === 9 && now.getMinutes() === 0 && now.getSeconds() < 30) {
      const brief = handleBriefCommand();
      sendTg(brief);
      console.log("[morning-brief] 🌅 Auto brief sent at 09:00");
    }
  }, 30000); // Check every 30 seconds
  console.log("[morning-brief] ⏰ Scheduler active — brief at 09:00 daily");
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

function generateHtmlReport(b: BriefData): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CEO Daily Report — ${b.date}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; }
    .container { max-width: 700px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; padding: 30px; background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 16px; border: 1px solid rgba(99,102,241,0.3); }
    .header h1 { font-size: 28px; color: #f59e0b; margin-bottom: 8px; }
    .header .date { color: #94a3b8; font-size: 14px; }
    .section { margin-bottom: 24px; padding: 20px; background: rgba(30,30,65,0.5); border-radius: 12px; border: 1px solid rgba(99,102,241,0.15); }
    .section h2 { font-size: 16px; color: #fbbf24; margin-bottom: 12px; }
    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .stat-card { background: rgba(16,16,42,0.6); border-radius: 10px; padding: 16px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: 800; color: #fbbf24; }
    .stat-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-top: 4px; }
    .list-item { padding: 8px 0; border-bottom: 1px solid rgba(50,50,95,0.3); font-size: 14px; display: flex; justify-content: space-between; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; }
    @media print { body { background: #fff; color: #1e293b; } .header { background: #f8fafc; border-color: #e2e8f0; } .section { background: #f8fafc; border-color: #e2e8f0; } .stat-card { background: #fff; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 CEO Daily Report</h1>
      <div class="date">${b.date}</div>
    </div>

    <div class="section">
      <h2>📋 Tasks</h2>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-value">${b.tasks.done}</div><div class="stat-label">Done</div></div>
        <div class="stat-card"><div class="stat-value">${b.tasks.inProgress}</div><div class="stat-label">In Progress</div></div>
        <div class="stat-card"><div class="stat-value">${b.tasks.pending}</div><div class="stat-label">Pending</div></div>
      </div>
    </div>

    <div class="section">
      <h2>💰 Revenue</h2>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-value">฿${b.revenue.today.toLocaleString()}</div><div class="stat-label">Today</div></div>
        <div class="stat-card"><div class="stat-value">฿${b.revenue.week.toLocaleString()}</div><div class="stat-label">7 Days</div></div>
        <div class="stat-card"><div class="stat-value">฿${b.revenue.month.toLocaleString()}</div><div class="stat-label">Month</div></div>
      </div>
    </div>

    <div class="section">
      <h2>📅 Today's Schedule</h2>
      ${b.calendar.entries.length > 0
        ? b.calendar.entries.map((e) => `<div class="list-item"><span>⏰ ${e.time} — ${e.product}</span><span>${e.platform}</span></div>`).join("")
        : '<div style="text-align:center;color:#64748b;padding:12px;">📭 No posts scheduled</div>'}
    </div>

    <div class="section">
      <h2>🤖 Agents</h2>
      <div class="list-item"><span>Active</span><span>${b.agents.working}/${b.agents.total}</span></div>
      <div class="list-item"><span>🏆 Top Agent</span><span>${b.agents.topAgent}</span></div>
    </div>

    <div class="footer">
      Generated by Content Studio • ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>`;
}

export function registerMorningBriefRoutes(app: Express): void {
  // JSON brief
  app.get("/api/brief", (_req: Request, res: Response) => {
    res.json(generateBrief());
  });

  // HTML report (printable / save as PDF)
  app.get("/api/report/pdf", (_req: Request, res: Response) => {
    const brief = generateBrief();
    const html = generateHtmlReport(brief);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });
}

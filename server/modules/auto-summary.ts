/**
 * Auto Daily Summary — Sends morning brief via TG at 08:00 ICT
 * 
 * Aggregates: tasks done, revenue, goals progress, alerts, agent performance
 */

import { PORT } from "../config/runtime.ts";

const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CEO_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

async function sendTg(text: string): Promise<void> {
  if (!TG_BOT_TOKEN || !TG_CEO_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CEO_CHAT_ID, text, parse_mode: "HTML" }),
    });
  } catch {}
}

async function buildDailySummary(): Promise<string> {
  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", weekday: "long", day: "numeric", month: "long" });

  let summary = `☀️ <b>สรุปเช้า</b> — ${dateStr}\n\n`;

  // Tasks summary
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/dashboard/today`);
    const data = await res.json() as any;
    summary += `📝 <b>Tasks:</b> Done ${data.today?.done || 0} | Created ${data.today?.created || 0}\n`;
  } catch { summary += `📝 Tasks: ไม่สามารถดึงข้อมูลได้\n`; }

  // Revenue summary
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/revenue/summary`);
    const data = await res.json() as any;
    if (data.ok) {
      summary += `💰 <b>Revenue:</b> วันนี้ ฿${(data.today || 0).toLocaleString()} | เดือนนี้ ฿${(data.month || 0).toLocaleString()}\n`;
    }
  } catch {}

  // KPI Goals progress
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/kpi-goals`);
    const data = await res.json() as any;
    if (data.ok && data.goals?.length > 0) {
      const goalsText = data.goals.slice(0, 3).map((g: any) =>
        `  ${g.icon} ${g.metric}: ${g.percent}%`
      ).join("\n");
      summary += `\n🎯 <b>KPI Goals:</b>\n${goalsText}\n`;
    }
  } catch {}

  // Active alerts
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/alerts`);
    const data = await res.json() as any;
    const unack = data.alerts?.filter((a: any) => !a.acknowledged)?.length || 0;
    if (unack > 0) summary += `\n🚨 <b>Alerts:</b> ${unack} ยังไม่ดำเนินการ\n`;
  } catch {}

  // Server uptime
  const uptimeH = Math.floor(process.uptime() / 3600);
  const uptimeM = Math.floor((process.uptime() % 3600) / 60);
  summary += `\n🚀 Server: ${uptimeH}h ${uptimeM}m uptime`;

  return summary;
}

export function startAutoSummaryScheduler(): void {
  const checkInterval = 60_000; // Check every minute
  let lastSentDate = "";

  setInterval(async () => {
    const now = new Date();
    const bangkokHour = Number(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", hour12: false }));
    const bangkokMinute = Number(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok", minute: "numeric" }));
    const today = now.toISOString().split("T")[0];

    // Send at 08:00 ICT, once per day
    if (bangkokHour === 8 && bangkokMinute === 0 && lastSentDate !== today) {
      lastSentDate = today;
      const summary = await buildDailySummary();
      await sendTg(summary);
      console.log("[AutoSummary] ☀️ Morning brief sent");
    }
  }, checkInterval);

  console.log("[AutoSummary] ⏰ Scheduler active — daily brief at 08:00 ICT");
}

/**
 * TG command: /summary — manually trigger daily summary
 */
export async function handleSummaryCommand(): Promise<string> {
  return await buildDailySummary();
}

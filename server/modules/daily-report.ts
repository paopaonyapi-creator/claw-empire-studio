/**
 * Daily Report — Auto-sends daily summary to TG every morning
 *
 * Runs at 08:00 ICT (UTC+7) daily
 * Also available as /report TG command
 */

const PORT = process.env.PORT || 3000;
const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

// ---------------------------------------------------------------------------
// TG Send Helper
// ---------------------------------------------------------------------------

async function sendTg(text: string): Promise<void> {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Report Generation
// ---------------------------------------------------------------------------

interface ReportData {
  tasks: { total: number; done: number; inProgress: number; pending: number };
  agents: { total: number; active: number };
  today: { done: number; created: number };
  links: { total: number; totalClicks: number; todayClicks: number };
  pipelines: { active: number };
}

async function fetchReportData(): Promise<ReportData> {
  const data: ReportData = {
    tasks: { total: 0, done: 0, inProgress: 0, pending: 0 },
    agents: { total: 0, active: 0 },
    today: { done: 0, created: 0 },
    links: { total: 0, totalClicks: 0, todayClicks: 0 },
    pipelines: { active: 0 },
  };

  try {
    // Stats
    const statsRes = await fetch(`http://127.0.0.1:${PORT}/api/stats`);
    if (statsRes.ok) {
      const stats = (await statsRes.json()) as { stats?: { tasks?: Record<string, number>; agents?: Record<string, number> } };
      data.tasks.total = stats.stats?.tasks?.total || 0;
      data.tasks.done = stats.stats?.tasks?.done || 0;
      data.tasks.inProgress = stats.stats?.tasks?.in_progress || 0;
      data.tasks.pending = stats.stats?.tasks?.pending || 0;
      data.agents.total = stats.stats?.agents?.total || 0;
    }
  } catch { /* ignore */ }

  try {
    // Today KPI
    const todayRes = await fetch(`http://127.0.0.1:${PORT}/api/dashboard/today`);
    if (todayRes.ok) {
      const today = (await todayRes.json()) as { today?: { done?: number; created?: number } };
      data.today.done = today.today?.done || 0;
      data.today.created = today.today?.created || 0;
    }
  } catch { /* ignore */ }

  try {
    // Links
    const linksRes = await fetch(`http://127.0.0.1:${PORT}/api/links`);
    if (linksRes.ok) {
      const links = (await linksRes.json()) as { total?: number; totalClicks?: number; links?: Array<{ clicks: number }> };
      data.links.total = links.total || 0;
      data.links.totalClicks = links.totalClicks || 0;
    }
  } catch { /* ignore */ }

  try {
    // Active pipelines
    const plRes = await fetch(`http://127.0.0.1:${PORT}/api/pipelines/active`);
    if (plRes.ok) {
      const pl = (await plRes.json()) as { pipelines?: Array<{ status: string }> };
      data.pipelines.active = (pl.pipelines || []).filter((p) => p.status === "running").length;
    }
  } catch { /* ignore */ }

  return data;
}

function formatReport(data: ReportData, type: "morning" | "manual"): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  const header = type === "morning" ? "☀️ <b>Good Morning CEO!</b>" : "📊 <b>Studio Report</b>";

  const completionRate = data.tasks.total > 0 ? Math.round((data.tasks.done / data.tasks.total) * 100) : 0;
  const bar = "█".repeat(Math.round(completionRate / 10)) + "░".repeat(10 - Math.round(completionRate / 10));

  return (
    `${header}\n` +
    `📅 ${dateStr}\n⏰ ${timeStr}\n\n` +
    `━━━ 📋 <b>Tasks</b> ━━━\n` +
    `📊 ${bar} ${completionRate}%\n` +
    `✅ Done: ${data.tasks.done} | 🔄 Progress: ${data.tasks.inProgress} | ⏳ Pending: ${data.tasks.pending}\n` +
    `📈 Total: ${data.tasks.total}\n\n` +
    `━━━ 🤖 <b>Agents</b> ━━━\n` +
    `👥 ${data.agents.total} agents online (Gemini 2.0 Flash)\n\n` +
    `━━━ 📅 <b>Today</b> ━━━\n` +
    `✅ Done: ${data.today.done} | 🆕 Created: ${data.today.created}\n\n` +
    `━━━ 📎 <b>Links</b> ━━━\n` +
    `🔗 ${data.links.total} links | 👆 ${data.links.totalClicks} total clicks\n\n` +
    (data.pipelines.active > 0 ? `🔄 ${data.pipelines.active} pipeline(s) running\n\n` : "") +
    `💡 /help — ดูคำสั่งทั้งหมด`
  );
}

// ---------------------------------------------------------------------------
// Public: Generate report (for TG command)
// ---------------------------------------------------------------------------

export async function handleReportCommand(): Promise<string> {
  const data = await fetchReportData();
  return formatReport(data, "manual");
}

// ---------------------------------------------------------------------------
// Scheduler — runs every day at 08:00 ICT
// ---------------------------------------------------------------------------

let reportTimer: ReturnType<typeof setInterval> | null = null;

function getNextMorningMs(): number {
  const now = new Date();
  // Target 08:00 ICT (UTC+7) = 01:00 UTC
  const target = new Date(now);
  target.setUTCHours(1, 0, 0, 0); // 01:00 UTC = 08:00 ICT

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1); // next day
  }

  return target.getTime() - now.getTime();
}

async function sendMorningReport(): Promise<void> {
  try {
    const data = await fetchReportData();
    const report = formatReport(data, "morning");
    await sendTg(report);
    console.log("[Daily Report] ✅ Morning report sent");
  } catch (e) {
    console.error("[Daily Report] ❌ Failed to send:", e);
  }
}

export function startDailyReportScheduler(): void {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
    console.log("[Daily Report] ⚠️ TG not configured, skipping scheduler");
    return;
  }

  // Schedule first report
  const msUntilMorning = getNextMorningMs();
  const hoursUntil = (msUntilMorning / 3600000).toFixed(1);

  console.log(`[Daily Report] ✅ Scheduled — next report in ${hoursUntil}h (08:00 ICT)`);

  setTimeout(() => {
    sendMorningReport();
    // Then repeat every 24 hours
    reportTimer = setInterval(sendMorningReport, 24 * 60 * 60 * 1000);
  }, msUntilMorning);
}

export function stopDailyReportScheduler(): void {
  if (reportTimer) {
    clearInterval(reportTimer);
    reportTimer = null;
  }
}

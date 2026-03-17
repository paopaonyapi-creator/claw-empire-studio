/**
 * Content Auto-Scheduler v2
 *
 * Features:
 * 1. Daily scheduled tasks at specific Bangkok times (UTC+7)
 * 2. Chain Workflow: output of completed task → input for next task
 * 3. Daily Summary at 20:00 sent via Telegram
 *
 * Enabled via CONTENT_SCHEDULE_ENABLED=1 environment variable.
 */

import { PORT } from "../config/runtime.ts";

// ---------------------------------------------------------------------------
// Schedule definition
// ---------------------------------------------------------------------------

interface ScheduleEntry {
  id: string;
  hour: number;
  minute: number;
  content: string;
  /** If set, this task auto-triggers after the specified chain predecessor completes */
  chainAfter?: string;
  /** Template for chain content — uses {{output}} placeholder for predecessor's result */
  chainContent?: string;
}

const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8614741415:AAFUSyh1gwnbFIQU_9SqYI11GipLJex_P3Y";
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "7724670451";

const SCHEDULE: ScheduleEntry[] = [
  {
    id: "daily-trend-report",
    hour: 7,
    minute: 0,
    content:
      "$สร้าง Trend Report ประจำวัน — วิเคราะห์เทรนด์ TikTok/Facebook ที่กำลังมาแรงวันนี้ แนะนำ 3 หัวข้อ content ที่น่าทำ พร้อมเหตุผล คืนผลลัพธ์เป็นรายการหัวข้อพร้อม keyword",
  },
  {
    id: "daily-script-writing",
    hour: 9,
    minute: 0,
    content:
      "$เขียน Script สำหรับ content วันนี้ — ใช้เทรนด์จาก Trend Report เขียน TikTok script 30-60 วินาที พร้อม hook ที่ดึงดูด และ CTA ปักตะกร้า",
    chainAfter: "daily-trend-report",
    chainContent:
      "$เขียน Script สำหรับ content วันนี้ — อ้างอิงจาก Trend Report ที่เพิ่งทำเสร็จ: {{output}}\n\nเขียน TikTok script 30-60 วินาที พร้อม hook ที่ดึงดูด และ CTA ปักตะกร้า",
  },
  {
    id: "daily-thumbnail-brief",
    hour: 14,
    minute: 0,
    content:
      "$สร้าง Thumbnail Brief — ออกแบบ 3 thumbnail concepts สำหรับ content วันนี้ ระบุ text overlay, สี, mood, และ layout ที่เหมาะกับแต่ละ platform",
    chainAfter: "daily-script-writing",
    chainContent:
      "$สร้าง Thumbnail Brief — อ้างอิงจาก Script ที่เสร็จแล้ว: {{output}}\n\nออกแบบ 3 thumbnail concepts ระบุ text overlay, สี, mood, และ layout สำหรับ TikTok + Facebook",
  },
  {
    id: "daily-summary",
    hour: 20,
    minute: 0,
    content: "__DAILY_SUMMARY__", // Special: triggers TG summary instead of a directive
  },
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let dispatchedToday = new Set<string>();
let chainPendingToday = new Map<string, string>(); // chainAfter ID → waiting entry ID
let lastDateKey = "";

function bangkokNow(): Date {
  const utc = new Date();
  return new Date(utc.getTime() + 7 * 60 * 60 * 1000);
}

function dateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

async function dispatchDirective(content: string, scheduleId: string): Promise<void> {
  const url = `http://127.0.0.1:${PORT}/api/directives`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, source: "content-scheduler" }),
    });
    const status = res.status;
    if (status >= 200 && status < 300) {
      console.log(`[ContentScheduler] ✅ Dispatched "${scheduleId}" (HTTP ${status})`);

      // Auto-run: find the newest inbox task and trigger execution
      setTimeout(async () => {
        try {
          const tasksRes = await fetch(`http://127.0.0.1:${PORT}/api/tasks?status=inbox&limit=5`, {
            headers: { "Content-Type": "application/json" },
          });
          if (!tasksRes.ok) return;
          const tasksData = (await tasksRes.json()) as { tasks?: Array<{ id: string; title: string; assigned_agent_id?: string }> };
          const tasks = tasksData.tasks || [];
          if (tasks.length === 0) return;

          // Run the most recent inbox task (should be the one we just created)
          const task = tasks[0];
          if (!task.assigned_agent_id) {
            console.log(`[ContentScheduler] ⏳ "${task.title}" has no agent assigned — skipping auto-run`);
            return;
          }

          const runRes = await fetch(`http://127.0.0.1:${PORT}/api/tasks/${task.id}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          console.log(
            `[ContentScheduler] 🤖 Auto-run "${task.title}": ${runRes.ok ? "✅ STARTED" : `⚠️ HTTP ${runRes.status}`}`,
          );
        } catch (err) {
          console.error("[ContentScheduler] Auto-run failed:", err instanceof Error ? err.message : err);
        }
      }, 5_000); // Wait 5s for task to be fully created and assigned
    } else {
      const text = await res.text().catch(() => "");
      console.warn(`[ContentScheduler] ⚠️ "${scheduleId}" responded ${status}: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`[ContentScheduler] ❌ Failed to dispatch "${scheduleId}":`, err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// Chain Workflow: check for completed predecessor tasks
// ---------------------------------------------------------------------------

async function checkChainCompletions(): Promise<void> {
  if (chainPendingToday.size === 0) return;

  try {
    const url = `http://127.0.0.1:${PORT}/api/tasks?status=done&limit=20`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { tasks?: Array<{ id: string; title: string; status: string; description?: string }> };
    const doneTasks = data.tasks || [];

    for (const [predecessorId, waitingEntryId] of chainPendingToday.entries()) {
      if (dispatchedToday.has(waitingEntryId)) continue;

      // Check if a task matching the predecessor was completed today
      const predecessorEntry = SCHEDULE.find((e) => e.id === predecessorId);
      if (!predecessorEntry) continue;

      const matchingTask = doneTasks.find((t) => {
        const title = (t.title || "").toLowerCase();
        const desc = (t.description || "").toLowerCase();
        // Match by content keywords from the predecessor
        const keywords = predecessorEntry.content.slice(1, 30).toLowerCase();
        return title.includes(keywords.slice(0, 15)) || desc.includes(keywords.slice(0, 15));
      });

      if (matchingTask) {
        const waitingEntry = SCHEDULE.find((e) => e.id === waitingEntryId);
        if (!waitingEntry || !waitingEntry.chainContent) continue;

        dispatchedToday.add(waitingEntryId);
        chainPendingToday.delete(predecessorId);

        const taskOutput = matchingTask.title + (matchingTask.description ? "\n" + matchingTask.description.slice(0, 500) : "");
        const chainedContent = waitingEntry.chainContent.replace("{{output}}", taskOutput);

        console.log(`[ContentScheduler] 🔗 Chain triggered: "${predecessorId}" → "${waitingEntryId}"`);
        await dispatchDirective(chainedContent, waitingEntryId + "-chain");
      }
    }
  } catch {
    // Silent — chain check is best-effort
  }
}

// ---------------------------------------------------------------------------
// Telegram Daily Summary
// ---------------------------------------------------------------------------

async function sendDailySummary(): Promise<void> {
  try {
    // Fetch stats from existing /api/stats endpoint
    const statsUrl = `http://127.0.0.1:${PORT}/api/stats`;
    const statsRes = await fetch(statsUrl, { headers: { "Content-Type": "application/json" } });
    let statsText = "";

    if (statsRes.ok) {
      const data = (await statsRes.json()) as {
        stats?: {
          tasks?: { total?: number; inbox?: number; done?: number; in_progress?: number; review?: number; completion_rate?: number };
          agents?: { total?: number; working?: number; idle?: number };
          top_agents?: Array<{ name?: string; stats_tasks_done?: number; stats_xp?: number }>;
        };
      };
      const t = data.stats?.tasks;
      const a = data.stats?.agents;
      const topAgents = data.stats?.top_agents || [];

      let topAgentsText = "";
      if (topAgents.length > 0) {
        topAgentsText = "\n🏆 Top Agents:\n";
        for (let i = 0; i < Math.min(topAgents.length, 5); i++) {
          const ag = topAgents[i];
          topAgentsText += `  ${i + 1}. ${ag.name || "?"} — ${ag.stats_tasks_done ?? 0} tasks, ${ag.stats_xp ?? 0} XP\n`;
        }
      }

      statsText =
        `📊 สรุปประจำวัน (${dateKey(bangkokNow())})\n\n` +
        `📋 Tasks:\n` +
        `  ✅ Done: ${t?.done ?? 0}\n` +
        `  🔄 In Progress: ${t?.in_progress ?? 0}\n` +
        `  📝 Review: ${t?.review ?? 0}\n` +
        `  📥 Inbox: ${t?.inbox ?? 0}\n` +
        `  📦 Total: ${t?.total ?? 0}\n` +
        `  📈 Completion: ${t?.completion_rate ?? 0}%\n\n` +
        `🤖 Agents:\n` +
        `  💼 Working: ${a?.working ?? 0}\n` +
        `  😴 Idle: ${a?.idle ?? 0}\n` +
        `  👥 Total: ${a?.total ?? 0}\n` +
        topAgentsText +
        `\n⏰ Tomorrow:\n` +
        `  07:00 — Trend Report\n` +
        `  09:00 — Script Writing\n` +
        `  14:00 — Thumbnail Brief\n` +
        `  20:00 — Daily Summary\n\n` +
        `🔗 Dashboard: https://claw-empire-studio-production.up.railway.app`;
    } else {
      statsText = `📊 Daily summary (${dateKey(bangkokNow())}): unable to fetch stats`;
    }

    // Send via Telegram
    const tgUrl = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
    const tgRes = await fetch(tgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text: statsText }),
    });
    const tgData = (await tgRes.json()) as { ok?: boolean };
    console.log(`[ContentScheduler] 📱 Daily summary sent to Telegram: ${tgData.ok ? "OK" : "FAILED"}`);
  } catch (err) {
    console.error("[ContentScheduler] ❌ Daily summary failed:", err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// Tick
// ---------------------------------------------------------------------------

function tick(): void {
  const now = bangkokNow();
  const today = dateKey(now);

  if (today !== lastDateKey) {
    dispatchedToday = new Set<string>();
    chainPendingToday = new Map<string, string>();
    lastDateKey = today;
    console.log(`[ContentScheduler] 📅 New day: ${today} — schedule reset`);

    // Register chain dependencies for today
    for (const entry of SCHEDULE) {
      if (entry.chainAfter) {
        chainPendingToday.set(entry.chainAfter, entry.id);
      }
    }
  }

  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();

  for (const entry of SCHEDULE) {
    if (dispatchedToday.has(entry.id)) continue;

    if (currentHour > entry.hour || (currentHour === entry.hour && currentMinute >= entry.minute)) {
      dispatchedToday.add(entry.id);

      if (entry.content === "__DAILY_SUMMARY__") {
        console.log(`[ContentScheduler] 📱 Triggering daily summary`);
        sendDailySummary().catch(() => {});
        continue;
      }

      // If this task has a chain dependency, skip time-based trigger
      // (it will be triggered by chain completion instead)
      if (entry.chainAfter && !dispatchedToday.has(entry.chainAfter + "-chain-override")) {
        // Still dispatch on time as fallback, chain will provide better context
        console.log(
          `[ContentScheduler] 🚀 Triggering "${entry.id}" (time-based, chain from "${entry.chainAfter}" pending)`,
        );
        dispatchDirective(entry.content, entry.id).catch(() => {});
        continue;
      }

      console.log(
        `[ContentScheduler] 🚀 Triggering "${entry.id}" (${String(entry.hour).padStart(2, "0")}:${String(entry.minute).padStart(2, "0")} BKK)`,
      );
      dispatchDirective(entry.content, entry.id).catch(() => {});
    }
  }

  // Check chain completions every tick
  checkChainCompletions().catch(() => {});
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startContentScheduler(): void {
  const enabled = String(process.env.CONTENT_SCHEDULE_ENABLED ?? "").trim();
  if (enabled !== "1" && enabled !== "true") {
    console.log("[ContentScheduler] Disabled (set CONTENT_SCHEDULE_ENABLED=1 to enable)");
    return;
  }

  console.log(`[ContentScheduler] ✅ Started with ${SCHEDULE.length} daily tasks (Bangkok UTC+7)`);
  for (const entry of SCHEDULE) {
    const chain = entry.chainAfter ? ` (chains after: ${entry.chainAfter})` : "";
    console.log(
      `  → ${entry.id} at ${String(entry.hour).padStart(2, "0")}:${String(entry.minute).padStart(2, "0")}${chain}`,
    );
  }

  lastDateKey = dateKey(bangkokNow());

  // Register initial chain dependencies
  for (const entry of SCHEDULE) {
    if (entry.chainAfter) {
      chainPendingToday.set(entry.chainAfter, entry.id);
    }
  }

  setTimeout(tick, 15_000);
  setInterval(tick, 60_000);
}
